import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { chatJson } from "@/lib/ai/sumopod"
import { HUMAN_STYLE, TEMPLATE_RULES, refineProposal, type Draft, type Progress } from "@/lib/ai/refine"

type QA = { question: string; answer: string }
type GeneratedDraft = Draft & { attachmentIds: string[] }

// LLM call can exceed the platform default timeout, which returns an empty body
export const maxDuration = 60

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => null)
  const proposalId = body?.proposalId as string | undefined
  if (!proposalId) return NextResponse.json({ error: "Missing proposalId" }, { status: 400 })

  const { data: proposal } = await supabase
    .from("proposals")
    .select("id, upwork_job_id")
    .eq("id", proposalId)
    .eq("user_id", user.id)
    .single()
  if (!proposal?.upwork_job_id) return NextResponse.json({ error: "Proposal not found" }, { status: 404 })

  const { data: job } = await supabase
    .from("upwork_jobs")
    .select("title, description, screening_questions, scan_config_id")
    .eq("id", proposal.upwork_job_id)
    .single()
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 })

  const { data: config } = await supabase
    .from("user_scan_config")
    .select("proposal_template_id, question_instruction, question_answer_base, attachments, user_id")
    .eq("id", job.scan_config_id)
    .eq("user_id", user.id)
    .single()
  if (!config?.proposal_template_id) {
    return NextResponse.json({ error: "Scanner has no proposal template" }, { status: 400 })
  }

  const { data: template } = await supabase
    .from("proposal_templates")
    .select("template, ai_instruction")
    .eq("id", config.proposal_template_id)
    .single()
  if (!template) return NextResponse.json({ error: "Proposal template not found" }, { status: 404 })

  const candidateIds: string[] = Array.isArray(config.attachments) ? config.attachments : []
  const { data: candidates } =
    candidateIds.length > 0
      ? await supabase.from("attachments").select("id, file_name, description").in("id", candidateIds)
      : { data: [] }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select(
      "summary, current_role, previous_experience, skills_text, portfolio, key_proof_points, positioning_notes"
    )
    .eq("user_id", config.user_id)
    .single()

  const screeningQuestions: string[] = Array.isArray(job.screening_questions)
    ? job.screening_questions
    : []

  const systemPrompt = `You are an Upwork proposal assistant. Given a job, a cover letter template, the freelancer's background, and a list of candidate attachments, return ONLY a JSON object with this exact shape:
{"coverLetter": string, "questionAnswers": [{"question": string, "answer": string}], "attachmentIds": string[]}

Cover letter: fill in the cover letter template (given in <template> tags) with content tailored to the job, using the freelancer's background. No [prompt] markers in the output.
${TEMPLATE_RULES}
Question answers: one entry per screening question listed below, answered using the freelancer's answer knowledge. Empty array if no questions.
Attachment ids: pick only candidate ids genuinely relevant to this job from the "Candidate attachments" list. Empty array if none fit.

${HUMAN_STYLE}`

  const userPrompt = `Job title: ${job.title ?? "Untitled"}
Job description: ${job.description ?? "N/A"}

<template>
${template.template}
</template>
${template.ai_instruction ? `<template_instructions>\n${template.ai_instruction}\n</template_instructions>` : ""}

Freelancer background:
Summary: ${profile?.summary ?? "N/A"}
Current role: ${profile?.current_role ?? "N/A"}
Previous experience: ${profile?.previous_experience ?? "N/A"}
Skills: ${profile?.skills_text ?? "N/A"}
Portfolio: ${profile?.portfolio ?? "N/A"}
Key proof points: ${profile?.key_proof_points ?? "N/A"}
Positioning notes: ${profile?.positioning_notes ?? "N/A"}

Screening questions:
${screeningQuestions.length ? screeningQuestions.join("\n") : "None"}
Answer knowledge: ${config.question_answer_base ?? "N/A"}
${config.question_instruction ? `Answer instructions: ${config.question_instruction}` : ""}

Candidate attachments:
${candidates?.length ? candidates.map((a) => `${a.id}: ${a.file_name ?? "Untitled"} — ${a.description ?? "no description"}`).join("\n") : "None"}`

  if (!process.env.SUMOPOD_BASE_URL || !process.env.SUMOPOD_API_KEY) {
    console.error("missing SUMOPOD_BASE_URL or SUMOPOD_API_KEY")
    return NextResponse.json({ error: "AI service not configured" }, { status: 500 })
  }

  type Parsed = { coverLetter?: string; questionAnswers?: QA[]; attachmentIds?: string[] }
  const validCandidateIds = new Set((candidates ?? []).map((a) => a.id))
  const toDraft = (p: Parsed): GeneratedDraft => ({
    coverLetter: p.coverLetter ?? "",
    questionAnswers: p.questionAnswers ?? [],
    attachmentIds: (p.attachmentIds ?? []).filter((id) => validCandidateIds.has(id)),
  })

  // Does the work; `emit` reports each step so a streaming client can show what is happening.
  async function generate(emit: (p: Progress) => void) {
    emit({ step: "generate" })
    let first: { data: Parsed; tokens: number | null }
    try {
      first = await chatJson<Parsed>(systemPrompt, userPrompt)
    } catch (e) {
      console.error("sumopod generation error", e)
      throw new Error("AI generation failed")
    }

    let draft = toDraft(first.data)
    let totalTokenUsed = first.tokens
    // Multi-layer check: human-sounding, freelancer quality and client reviewers, with rewrites on failure.
    if (draft.coverLetter.trim()) {
      try {
        const refined = await refineProposal<GeneratedDraft>(
          `Title: ${job!.title ?? "Untitled"}\nDescription: ${job!.description ?? "N/A"}\nScreening questions:\n${screeningQuestions.join("\n") || "None"}`,
          { draft, tokens: totalTokenUsed },
          async (feedback, prev) => {
            const r = await chatJson<Parsed>(
              systemPrompt,
              `${userPrompt}

Previous draft:
<previous_draft>
${JSON.stringify(prev)}
</previous_draft>

Rewrite the draft and apply this reviewer feedback. Keep what the reviewers did not criticise. Do not invent facts about the freelancer.
<reviewer_feedback>
${feedback}
</reviewer_feedback>`
            )
            return { draft: toDraft(r.data), tokens: r.tokens }
          },
          emit,
          template?.template
        )
        draft = refined.draft
        totalTokenUsed = refined.tokens
      } catch (e) {
        console.error("proposal refinement failed", e)
      }
    }

    emit({ step: "save" })
    const generatedAt = new Date().toISOString()
    await supabase
      .from("proposals")
      .update({
        cover_letter_generated: draft.coverLetter || null,
        question_answer: draft.questionAnswers,
        attachment: draft.attachmentIds,
        last_generated_at: generatedAt,
        total_token_used: totalTokenUsed,
      })
      .eq("id", proposalId)

    return {
      cover_letter_generated: draft.coverLetter || null,
      question_answer: draft.questionAnswers,
      attachments: (candidates ?? [])
        .filter((a) => draft.attachmentIds.includes(a.id))
        .map((a) => ({ id: a.id, file_name: a.file_name })),
      last_generated_at: generatedAt,
      total_token_used: totalTokenUsed,
    }
  }

  const message = (e: unknown) => (e instanceof Error ? e.message : "AI generation failed")

  if (!body?.stream) {
    try {
      return NextResponse.json(await generate(() => {}))
    } catch (e) {
      return NextResponse.json({ error: message(e) }, { status: 502 })
    }
  }

  // Newline-delimited JSON: progress events, then one "done" or "error".
  const enc = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: object) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"))
      try {
        send({ type: "done", result: await generate((p) => send({ type: "progress", ...p })) })
      } catch (e) {
        send({ type: "error", error: message(e) })
      }
      controller.close()
    },
  })
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" },
  })
}
