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
      <h2>Profile Optimization</h2>
      <p className="muted">Scan your Upwork profile connected to Colosal.</p>
      <button className="btn" onClick={scan} disabled={busy}>
        {busy ? "Scanning profile..." : "Start scan"}
      </button>
      {error && <p className="err">{error}</p>}

      {result && (
        <>
          <section className="card">
            <h3>Strengths</h3>
            <ul>
              {result.report.strengths.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
            <h3>Weaknesses</h3>
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
