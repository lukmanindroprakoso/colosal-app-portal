import { useState } from "react"
import { api } from "../../lib/api"
import type { ProfileResult } from "../../lib/types"
import CopyButton from "./CopyButton"

export default function ProfileTab() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ProfileResult | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)

  async function scan() {
    setBusy(true)
    setError(null)
    setResult(null)
    setShowSuggestions(false)
    try {
      const r = await api.profile()
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
      <h2>Optimasi Profil</h2>
      <p className="muted">Pindai profil Upwork Anda yang terhubung ke Colosal.</p>
      <button className="btn" onClick={scan} disabled={busy}>
        {busy ? "Memindai profil..." : "Start scan"}
      </button>
      {error && <p className="err">{error}</p>}

      {result && (
        <>
          <section className="card">
            <h3>Kelebihan</h3>
            <ul>
              {result.report.strengths.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
            <h3>Kekurangan</h3>
            <ul>
              {result.report.weaknesses.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </section>

          {!showSuggestions ? (
            <button className="btn" style={{ marginTop: 12 }} onClick={() => setShowSuggestions(true)}>
              Optimize now
            </button>
          ) : (
            <>
              <section className="card">
                <div className="row">
                  <h3>Headline</h3>
                  <CopyButton text={result.suggestions.headline} />
                </div>
                <pre>{result.suggestions.headline}</pre>
              </section>
              <section className="card">
                <div className="row">
                  <h3>Overview</h3>
                  <CopyButton text={result.suggestions.overview} />
                </div>
                <pre>{result.suggestions.overview}</pre>
              </section>
              <section className="card">
                <div className="row">
                  <h3>Skills</h3>
                  <CopyButton text={result.suggestions.skills.join(", ")} />
                </div>
                <pre>{result.suggestions.skills.join(", ")}</pre>
              </section>
            </>
          )}
        </>
      )}
    </>
  )
}
