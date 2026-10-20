import { useState } from "react"
import { usePersistentState } from "../../lib/use-persistent-state"
import { api } from "../../lib/api"
import { DEFAULT_TEMPLATE } from "../../lib/default-template"
import { snapshotActiveTab } from "../../lib/page"
import { pageKind, type PageKind } from "../../lib/page-kind"
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
  onChanged,
}: {
  templates: Template[]
  kind: PageKind
  onChanged: () => Promise<void>
}) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = usePersistentState<ProposalResult | null>(
    "proposal.result",
    null
  )
  const [form, setForm] = useState<TemplateInput | null>(null)
  // Job and template the current result was generated for; revisions always refer to these.
  const [generated, setGenerated] = usePersistentState<{
    job: JobData
    templateId: string
  } | null>("proposal.generated", null)
  const [feedback, setFeedback] = usePersistentState("proposal.feedback", "")
  const [refining, setRefining] = useState(false)
  const [steps, setSteps] = useState<Step[]>([])
  const onProgress = (e: ProposalProgress) => setSteps((s) => nextSteps(s, e))

  // Templates can refresh after mount (panel focus re-check); keep the selection valid.
  const current = templates.find((t) => t.id === templateId) ?? templates[0]

  // Generating needs a job page; a result you already have stays visible on any page (e.g. the apply form).
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
      const job = parseJobText(snap.title, snap.text)
      const r = await api.proposal(job, current.id, onProgress)
      if (r.ok) {
        setGenerated({ job, templateId: current.id })
        setFeedback("")
      }
      if (!r.ok) {
        throw new Error(
          r.status === "unauth"
            ? "Session expired. Sign in to Colosal again."
            : r.message
        )
      }
      setResult(r.data)
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
        setResult({
          ...result,
          coverLetter: r.data.coverLetter,
          questionAnswers: r.data.questionAnswers,
        })
        setFeedback("")
      } else {
        const r = await api.proposal(generated.job, generated.templateId, onProgress)
        if (!r.ok)
          throw new Error(
            r.status === "unauth"
              ? "Session expired. Sign in to Colosal again."
              : r.message
          )
        setResult(r.data)
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
            <div className="row">
              <h3>Preview</h3>
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
            </div>
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
          </section>

          <button
            className="btn"
            style={{ marginTop: 12 }}
            onClick={generate}
            disabled={busy || refining}
          >
            {busy ? "Generating proposal..." : "Generate proposal"}
          </button>
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
              ? "Go to Upwork and open a job details page to generate a proposal. Your latest result stays below."
              : "Open a job details page on Upwork to generate a proposal. Your latest result stays below."
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
            <div className="row">
              <h3>Cover Letter</h3>
              <CopyButton text={result.coverLetter} />
            </div>
            <pre>{result.coverLetter}</pre>
          </section>

          <section className="card">
            <h3>Question Answers</h3>
            {result.questionAnswers.length === 0 ? (
              <p className="muted">This job has no screening questions.</p>
            ) : (
              result.questionAnswers.map((a, i) => (
                <div key={i} className="qa">
                  <div className="row">
                    <strong>{a.question}</strong>
                    <CopyButton text={a.answer} />
                  </div>
                  <pre>{a.answer}</pre>
                </div>
              ))
            )}
          </section>

          <section className="card">
            <h3>Confidence Level</h3>
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
          </section>

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
        </>
      )}
    </>
  )
}
