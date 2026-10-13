import { useState } from "react"
import { api } from "../../lib/api"
import { COLOSAL_URL } from "../../lib/config"
import { snapshotActiveTab } from "../../lib/page"
import { pageKind, type PageKind } from "../../lib/page-kind"
import { parseJobText } from "../../lib/parse-job"
import type { ProposalResult, Rating, Template } from "../../lib/types"
import CopyButton from "./CopyButton"
import PageState from "./PageState"

const RATING_LABEL: Record<Rating, string> = {
  good: "Good",
  neutral: "Neutral",
  poor: "Poor",
  unknown: "Unknown",
}

export default function ProposalTab({ templates, kind }: { templates: Template[]; kind: PageKind }) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ProposalResult | null>(null)

  // Templates can refresh after mount (panel focus re-check); keep the selection valid.
  const selected = templates.some((t) => t.id === templateId) ? templateId : (templates[0]?.id ?? "")

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

  if (templates.length === 0) {
    return (
      <>
        <p>You don't have any proposal templates yet.</p>
        <button className="btn" onClick={() => chrome.tabs.create({ url: `${COLOSAL_URL}/proposals` })}>
          Create a template in Colosal
        </button>
      </>
    )
  }

  async function generate() {
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const snap = await snapshotActiveTab()
      if (!snap || pageKind(snap.url) !== "job") throw new Error("Open a job details page on Upwork first.")
      const job = parseJobText(snap.title, snap.text)
      const r = await api.proposal(job, selected)
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

  return (
    <>
      <h2>Template</h2>
      <select value={selected} onChange={(e) => setTemplateId(e.target.value)} disabled={busy}>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name ?? "Untitled"}
          </option>
        ))}
      </select>
      <button className="btn" onClick={generate} disabled={busy}>
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
        </>
      )}
    </>
  )
}
