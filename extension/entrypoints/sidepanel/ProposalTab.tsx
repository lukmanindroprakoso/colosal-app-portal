import { useRef, useState } from "react"
import { usePersistentState } from "../../lib/use-persistent-state"
import { api } from "../../lib/api"
import { DEFAULT_TEMPLATE } from "../../lib/default-template"
import { snapshotActiveTab } from "../../lib/page"
import { jobIdFromUrl, pageKind, type PageKind } from "../../lib/page-kind"
import { parseJobText } from "../../lib/parse-job"
import { splitPrompts } from "../../lib/prompt-markers"
import type {
  JobData,
  ProposalProgress,
  ProposalResult,
  Rating,
  Template,
  TemplateInput,
} from "../../lib/types"
import Collapsible from "./Collapsible"
import CopyButton from "./CopyButton"
import PageState from "./PageState"
import TemplateForm from "./TemplateForm"

const RATING_LABEL: Record<Rating, string> = {
  good: "Good",
  neutral: "Neutral",
  poor: "Poor",
  unknown: "Unknown",
}

interface Step {
  label: string
  status: "active" | "done" | "warn"
}

function nextSteps(prev: Step[], e: ProposalProgress): Step[] {
  if (e.step === "reviewed") {
    const label = e.failed.length ? `Needs changes (${e.failed.join(", ")})` : "All checks passed"
    return [...prev.slice(0, -1), { label, status: e.failed.length ? "warn" : "done" }]
  }
  const label =
    e.step === "generate"
      ? "Writing the first draft"
      : e.step === "review"
        ? "Running human, freelancer and client checks"
        : e.step === "revise"
          ? "Rewriting with reviewer feedback"
          : "Finishing"
  return [...prev.map((s): Step => (s.status === "active" ? { ...s, status: "done" } : s)), { label, status: "active" }]
}

const STEP_MARK = { active: "…", done: "✓", warn: "↻" }

export default function ProposalTab({
  templates,
  kind,
  jobId,
  onChanged,
}: {
  templates: Template[]
  kind: PageKind
  jobId: string | null
  onChanged: () => Promise<void>
}) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Each job keeps its own proposal in chrome.storage.local, so it is back whenever that job's
  // details or apply page is open, even after the browser restarted.
  const suffix = jobId ?? "none"
  const [result, setResult] = usePersistentState<ProposalResult | null>(
    `proposal.result.${suffix}`,
    null,
    "local"
  )
  const [form, setForm] = useState<TemplateInput | null>(null)
  // Job and template the current result was generated for; revisions always refer to these.
  const [generated, setGenerated] = usePersistentState<{
    job: JobData
    templateId: string
  } | null>(`proposal.generated.${suffix}`, null, "local")
  const [feedback, setFeedback] = usePersistentState(`proposal.feedback.${suffix}`, "", "local")
  const jobIdRef = useRef(suffix)
  jobIdRef.current = suffix

  // Saves a finished request under the job it was started for. If the user has since moved to
  // another job, write straight to storage instead of putting it on screen.
  function save(
    id: string,
    p: { result?: ProposalResult; generated?: { job: JobData; templateId: string }; feedback?: string }
  ) {
    if (id !== jobIdRef.current) {
      void chrome.storage.local.set(
        Object.fromEntries(Object.entries(p).map(([k, v]) => [`proposal.${k}.${id}`, v]))
      )
      return
    }
    if (p.result) setResult(p.result)
    if (p.generated) setGenerated(p.generated)
    if (p.feedback !== undefined) setFeedback(p.feedback)
  }
  const [refining, setRefining] = useState(false)
  const [steps, setSteps] = useState<Step[]>([])
  const onProgress = (e: ProposalProgress) => setSteps((s) => nextSteps(s, e))

  // Templates can refresh after mount (panel focus re-check); keep the selection valid.
  const current = templates.find((t) => t.id === templateId) ?? templates[0]

  // Generating needs a job page; the job's saved result shows on its details and apply pages.
  const onJob = kind === "job"

  if (form && onJob) {
    return (
      <TemplateForm
        initial={form}
        onCancel={() => setForm(null)}
        onSaved={async (saved) => {
          await onChanged()
          setTemplateId(saved.id)
          setForm(null)
        }}
      />
    )
  }

  async function generate() {
    if (!current) return
    setBusy(true)
    setError(null)
    setResult(null)
    setSteps([])
    try {
      const snap = await snapshotActiveTab()
      if (!snap || pageKind(snap.url) !== "job")
        throw new Error("Open a job details page on Upwork first.")
      const id = jobIdFromUrl(snap.url) ?? "none"
      const job = parseJobText(snap.title, snap.text)
      const r = await api.proposal(job, current.id, onProgress)
      if (!r.ok) {
        throw new Error(
          r.status === "unauth"
            ? "Session expired. Sign in to Colosal again."
            : r.message
        )
      }
      save(id, {
        result: r.data,
        generated: { job, templateId: current.id },
        feedback: "",
      })
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Something went wrong. Please try again."
      )
    } finally {
      setBusy(false)
    }
  }

  // With feedback: revise the visible draft. Without: a fresh version for the same job and template.
  async function regenerate() {
    if (!generated || !result) return
    const id = suffix
    setRefining(true)
    setError(null)
    setSteps([])
    try {
      const text = feedback.trim()
      if (text) {
        const r = await api.reviseProposal(
          generated.job,
          generated.templateId,
          text,
          {
            coverLetter: result.coverLetter,
            questionAnswers: result.questionAnswers,
          }
        )
        if (!r.ok)
          throw new Error(
            r.status === "unauth"
              ? "Session expired. Sign in to Colosal again."
              : r.message
          )
        save(id, {
          result: {
            ...result,
            coverLetter: r.data.coverLetter,
            questionAnswers: r.data.questionAnswers,
          },
          feedback: "",
        })
      } else {
        const r = await api.proposal(generated.job, generated.templateId, onProgress)
        if (!r.ok)
          throw new Error(
            r.status === "unauth"
              ? "Session expired. Sign in to Colosal again."
              : r.message
          )
        save(id, { result: r.data })
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Something went wrong. Please try again."
      )
    } finally {
      setRefining(false)
    }
  }

  return (
    <>
      {onJob && current ? (
        <>
          <div className="row">
            <h2 style={{ margin: 0 }}>Template</h2>
            <button
              className="link"
              onClick={() => setForm({ ...DEFAULT_TEMPLATE })}
              disabled={busy}
            >
              New template
            </button>
          </div>
          <select
            value={current.id}
            onChange={(e) => setTemplateId(e.target.value)}
            disabled={busy}
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name ?? "Untitled"}
              </option>
            ))}
          </select>

          <section className="card preview">
            <Collapsible
              title="Preview"
              defaultOpen={false}
              actions={
                <button
                  className="link"
                  onClick={() =>
                    setForm({
                      id: current.id,
                      name: current.name ?? "",
                      template: current.template,
                      ai_instruction: current.ai_instruction,
                    })
                  }
                  disabled={busy}
                >
                  Edit
                </button>
              }
            >
            <pre>
              {splitPrompts(current.template).map((p, i) =>
                p.prompt ? (
                  <mark key={i} className="prompt-mark">
                    {p.text}
                  </mark>
                ) : (
                  <span key={i}>{p.text}</span>
                )
              )}
            </pre>
            {current.ai_instruction && (
              <p className="muted small">
                <strong>AI instruction:</strong> {current.ai_instruction}
              </p>
            )}
            </Collapsible>
          </section>

          {result && (
            <section className="card">
              <h3>Refine</h3>
              <label className="field">
                <span className="visually-hidden">
                  Describe the changes you want
                </span>
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={feedback}
                  placeholder="Describe the changes you want, e.g. make it shorter and mention my Next.js experience"
                  onChange={(e) => setFeedback(e.target.value)}
                  disabled={refining}
                />
                <span className="hint">
                  Leave empty to generate a fresh version.
                </span>
              </label>
              <button
                className="btn"
                onClick={regenerate}
                disabled={refining || busy}
              >
                {refining
                  ? "Regenerating..."
                  : feedback.trim()
                    ? "Apply changes"
                    : "Regenerate"}
              </button>
            </section>
          )}

          {!result && (
            <button
              className="btn"
              style={{ marginTop: 12 }}
              onClick={generate}
              disabled={busy || refining}
            >
              {busy ? "Generating proposal..." : "Generate proposal"}
            </button>
          )}
        </>
      ) : onJob ? (
        <>
          <p>You don't have any proposal templates yet.</p>
          <button
            className="btn"
            onClick={() => setForm({ ...DEFAULT_TEMPLATE })}
          >
            New template
          </button>
        </>
      ) : (
        <PageState
          title="Job details page required"
          text={
            kind === "outside"
              ? "Go to Upwork and open a job details page to generate a proposal. Proposals you generated reappear on their job page."
              : "Open a job details page on Upwork to generate a proposal. Proposals you generated reappear on their job page."
          }
        />
      )}
      {(busy || refining) && steps.length > 0 && (
        <ol className="steps">
          {steps.map((s, i) => (
            <li key={i} className={s.status}>
              <span className="mark">{STEP_MARK[s.status]}</span> {s.label}
            </li>
          ))}
        </ol>
      )}
      {error && <p className="err">{error}</p>}

      {result && (
        <>
          {generated && (
            <p className="muted small">Generated for: {generated.job.title}</p>
          )}
          <section className="card">
            <Collapsible title="Cover Letter" actions={<CopyButton text={result.coverLetter} />}>
              <pre>{result.coverLetter}</pre>
            </Collapsible>
          </section>

          <section className="card">
            <Collapsible title="Question Answers" defaultOpen={false}>
              {result.questionAnswers.length === 0 ? (
                <p className="muted">This job has no screening questions.</p>
              ) : (
                result.questionAnswers.map((a, i) => (
                  <div key={i} className="qa">
                    <Collapsible title={a.question} defaultOpen={false} actions={<CopyButton text={a.answer} />}>
                      <pre>{a.answer}</pre>
                    </Collapsible>
                  </div>
                ))
              )}
            </Collapsible>
          </section>

          <section className="card">
            <Collapsible title="Confidence Level" defaultOpen={false}>
            <div className="score">
              {result.confidence.score === null
                ? "-"
                : `${result.confidence.score}/100`}
            </div>
            <ul>
              {result.confidence.factors.map((f) => (
                <li key={f.name}>
                  <strong>{f.name}</strong>{" "}
                  <span className={`badge ${f.rating}`}>
                    {RATING_LABEL[f.rating]}
                  </span>
                  <div className="muted">{f.note}</div>
                </li>
              ))}
            </ul>
            </Collapsible>
          </section>
        </>
      )}
    </>
  )
}
