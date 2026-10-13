import { useState } from "react"
import { api } from "../../lib/api"
import { snapshotActiveTab } from "../../lib/page"
import { pageKind } from "../../lib/page-kind"
import { parseTalentCards } from "../../lib/parse-talent"
import type { BenchmarkResult, BenchmarkRow } from "../../lib/types"

const VERDICT: Record<BenchmarkRow["verdict"], { text: string; cls: string }> = {
  below: { text: "Below", cls: "poor" },
  similar: { text: "Similar", cls: "good" },
  above: { text: "Above", cls: "" },
  good: { text: "Good", cls: "good" },
  missing: { text: "Missing", cls: "poor" },
  optional: { text: "Optional", cls: "" },
}

// Compares the connected Upwork profile with the top freelancers on the open talent search page.
export default function Benchmark() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<BenchmarkResult | null>(null)

  async function run() {
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const snap = await snapshotActiveTab()
      if (!snap || pageKind(snap.url) !== "talent-search") {
        throw new Error("Open a freelancer search results page on Upwork first.")
      }
      const r = await api.benchmark(parseTalentCards(snap.text))
      if (!r.ok) throw new Error(r.status === "unauth" ? "Session expired. Sign in to Colosal again." : r.message)
      setResult(r.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <h2>Benchmark</h2>
      <p className="muted">
        Compare your Upwork profile with the top freelancers on this search page (Job Success 90%+ and $5K+ earned).
        Names are not sent or stored.
      </p>
      <button className="btn" onClick={run} disabled={busy}>
        {busy ? "Comparing..." : "Run benchmark"}
      </button>
      {error && <p className="err">{error}</p>}

      {result && (
        <>
          <section className="card">
            <h3>You vs top profiles</h3>
            <p className="muted small">
              Based on {result.sample} top profiles
              {result.topRate !== null ? `. Their median rate is $${result.topRate}/hr.` : "."}
            </p>
            <table className="cmp">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>You</th>
                  <th>Top</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr key={r.key}>
                    <td>{r.label}</td>
                    <td>{r.you}</td>
                    <td>{r.top}</td>
                    <td>
                      <span className={`badge ${VERDICT[r.verdict].cls}`}>{VERDICT[r.verdict].text}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="card">
            <h3>Recommendations</h3>
            <ul>
              {result.recommendations.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </section>
        </>
      )}
    </>
  )
}
