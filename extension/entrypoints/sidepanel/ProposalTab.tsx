import { useState } from "react"
import { api } from "../../lib/api"
import { COLOSAL_URL } from "../../lib/config"
import { snapshotActiveTab } from "../../lib/page"
import { parseJobText } from "../../lib/parse-job"
import type { ProposalResult, Rating, Template } from "../../lib/types"
import CopyButton from "./CopyButton"

const RATING_LABEL: Record<Rating, string> = {
  good: "Baik",
  neutral: "Netral",
  poor: "Kurang",
  unknown: "Tidak diketahui",
}

export default function ProposalTab({ templates }: { templates: Template[] }) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ProposalResult | null>(null)

  // Templates can refresh after mount (panel focus re-check); keep the selection valid.
  const selected = templates.some((t) => t.id === templateId) ? templateId : (templates[0]?.id ?? "")

  if (templates.length === 0) {
    return (
      <>
        <p>Anda belum memiliki template proposal.</p>
        <button className="btn" onClick={() => chrome.tabs.create({ url: `${COLOSAL_URL}/proposals` })}>
          Buat template di Colosal
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
      if (!snap) throw new Error("Buka halaman detail job di Upwork terlebih dahulu.")
      const job = parseJobText(snap.title, snap.text)
      const r = await api.proposal(job, selected)
      if (!r.ok) {
        throw new Error(r.status === "unauth" ? "Sesi berakhir. Login ulang di Colosal." : r.message)
      }
      setResult(r.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan. Coba lagi.")
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
            {t.name ?? "Tanpa nama"}
          </option>
        ))}
      </select>
      <button className="btn" onClick={generate} disabled={busy}>
        {busy ? "Membuat proposal..." : "Generate proposal"}
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
            <h3>Jawaban Pertanyaan</h3>
            {result.questionAnswers.length === 0 ? (
              <p className="muted">Job ini tidak memiliki pertanyaan.</p>
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
                  <strong>{f.name}</strong> <span className="badge">{RATING_LABEL[f.rating]}</span>
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
