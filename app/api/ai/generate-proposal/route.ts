import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

const MODEL = "gpt-4o-mini"

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

Cover letter: rewrite the template, replacing each [prompt]...[/prompt] section with content tailored to the job using the freelancer's background. Keep everything else verbatim. No markers in the output.
Question answers: one entry per screening question listed below, answered using the freelancer's answer knowledge. Empty array if no questions.
Attachment ids: pick only candidate ids genuinely relevant to this job from the "Candidate attachments" list. Empty array if none fit.`

  const userPrompt = `Job title: ${job.title ?? "Untitled"}
Job description: ${job.description ?? "N/A"}

Cover letter template:
${template.template}
${template.ai_instruction ? `\nTemplate instructions: ${template.ai_instruction}` : ""}

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

  const res = await fetch(`${process.env.SUMOPOD_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.SUMOPOD_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => "")
    console.error("sumopod generation failed", res.status, errText)
    return NextResponse.json({ error: "AI generation failed" }, { status: 502 })
  }

  const json = await res.json()
  const raw = json?.choices?.[0]?.message?.content?.trim() ?? "{}"
  const parsed = JSON.parse(raw) as {
    coverLetter?: string
    questionAnswers?: { question: string; answer: string }[]
    attachmentIds?: string[]
  }

  const validCandidateIds = new Set((candidates ?? []).map((a) => a.id))
  const attachmentIds = (parsed.attachmentIds ?? []).filter((id) => validCandidateIds.has(id))
  const totalTokenUsed = json?.usage?.total_tokens ?? null

  await supabase
    .from("proposals")
    .update({
      cover_letter_generated: parsed.coverLetter ?? null,
      question_answer: parsed.questionAnswers ?? [],
      attachment: attachmentIds,
      last_generated_at: new Date().toISOString(),
      total_token_used: totalTokenUsed,
    })
    .eq("id", proposalId)

  return NextResponse.json({
    cover_letter_generated: parsed.coverLetter ?? null,
    question_answer: parsed.questionAnswers ?? [],
    attachments: (candidates ?? []).filter((a) => attachmentIds.includes(a.id)).map((a) => ({
      id: a.id,
      file_name: a.file_name,
    })),
    last_generated_at: new Date().toISOString(),
    total_token_used: totalTokenUsed,
  })
}
