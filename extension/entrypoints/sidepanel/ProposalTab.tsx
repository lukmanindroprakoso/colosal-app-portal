import { useState } from "react"
import { api } from "../../lib/api"
import { DEFAULT_TEMPLATE } from "../../lib/default-template"
import { snapshotActiveTab } from "../../lib/page"
import { pageKind, type PageKind } from "../../lib/page-kind"
import { parseJobText } from "../../lib/parse-job"
import { splitPrompts } from "../../lib/prompt-markers"
import type { JobData, ProposalResult, Rating, Template, TemplateInput } from "../../lib/types"
import CopyButton from "./CopyButton"
import PageState from "./PageState"
import TemplateForm from "./TemplateForm"

const RATING_LABEL: Record<Rating, string> = {
  good: "Good",
  neutral: "Neutral",
  poor: "Poor",
  unknown: "Unknown",
}

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
  const [result, setResult] = useState<ProposalResult | null>(null)
  const [form, setForm] = useState<TemplateInput | null>(null)
  // Job and template the current result was generated for; revisions always refer to these.
  const [generated, setGenerated] = useState<{ job: JobData; templateId: string } | null>(null)
  const [feedback, setFeedback] = useState("")
  const [refining, setRefining] = useState(false)

  // Templates can refresh after mount (panel focus re-check); keep the selection valid.
  const current = templates.find((t) => t.id === templateId) ?? templates[0]

  if (kind !== "job") {
    return (
      <PageState
        title="Job details page required"
        text={
          kind === "outside"
            ? "Go to Upwork and open a job details page to start generating a proposal."
            : "Open a job details page on Upwork to start generating a proposal."
        }
      />
    )
  }

  if (form) {
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

  if (!current) {
    return (
      <>
        <p>You don't have any proposal templates yet.</p>
        <button className="btn" onClick={() => setForm({ ...DEFAULT_TEMPLATE })}>
          New template
        </button>
      </>
    )
  }

  async function generate() {
    if (!current) return
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const snap = await snapshotActiveTab()
      if (!snap || pageKind(snap.url) !== "job") throw new Error("Open a job details page on Upwork first.")
      const job = parseJobText(snap.title, snap.text)
      const r = await api.proposal(job, current.id)
      if (r.ok) {
        setGenerated({ job, templateId: current.id })
        setFeedback("")
      }
      if (!r.ok) {
        throw new Error(r.status === "unauth" ? "Session expired. Sign in to Colosal again." : r.message)
      }
      setResult(r.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  // With feedback: revise the visible draft. Without: a fresh version for the same job and template.
  async function regenerate() {
    if (!generated || !result) return
    setRefining(true)
    setError(null)
    try {
      const text = feedback.trim()
      if (text) {
        const r = await api.reviseProposal(generated.job, generated.templateId, text, {
          coverLetter: result.coverLetter,
          questionAnswers: result.questionAnswers,
        })
        if (!r.ok) throw new Error(r.status === "unauth" ? "Session expired. Sign in to Colosal again." : r.message)
        setResult({ ...result, coverLetter: r.data.coverLetter, questionAnswers: r.data.questionAnswers })
        setFeedback("")
      } else {
        const r = await api.proposal(generated.job, generated.templateId)
        if (!r.ok) throw new Error(r.status === "unauth" ? "Session expired. Sign in to Colosal again." : r.message)
        setResult(r.data)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.")
    } finally {
      setRefining(false)
    }
  }

  return (
    <>
      <div className="row">
        <h2 style={{ margin: 0 }}>Template</h2>
        <button className="link" onClick={() => setForm({ ...DEFAULT_TEMPLATE })} disabled={busy}>
          New template
        </button>
      </div>
      <select value={current.id} onChange={(e) => setTemplateId(e.target.value)} disabled={busy}>
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

      <button className="btn" style={{ marginTop: 12 }} onClick={generate} disabled={busy || refining}>
        {busy ? "Generating proposal..." : "Generate proposal"}
      </button>
      {error && <p className="err">{error}</p>}

      {result && (
        <>
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
                <div key={i}>
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
            <div className="score">{result.confidence.score === null ? "-" : `${result.confidence.score}/100`}</div>
            <ul>
              {result.confidence.factors.map((f) => (
                <li key={f.name}>
                  <strong>{f.name}</strong> <span className={`badge ${f.rating}`}>{RATING_LABEL[f.rating]}</span>
                  <div className="muted">{f.note}</div>
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <h3>Refine</h3>
            <label className="field" style={{ marginBottom: 8 }}>
              <span className="visually-hidden">Describe the changes you want</span>
              <textarea
                rows={3}
                maxLength={2000}
                value={feedback}
                placeholder="Describe the changes you want, e.g. make it shorter and mention my Next.js experience"
                onChange={(e) => setFeedback(e.target.value)}
                disabled={refining}
              />
              <span className="hint">Leave empty to generate a fresh version.</span>
            </label>
            <button className="btn" onClick={regenerate} disabled={refining || busy}>
              {refining ? "Regenerating..." : feedback.trim() ? "Apply changes" : "Regenerate"}
            </button>
          </section>
        </>
      )}
    </>
  )
}
