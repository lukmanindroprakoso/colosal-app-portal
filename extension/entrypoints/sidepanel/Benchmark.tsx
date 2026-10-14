import { useState } from "react"
import { usePersistentState } from "../../lib/use-persistent-state"
import { api } from "../../lib/api"
import { snapshotActiveTab } from "../../lib/page"
import { pageKind, type PageKind } from "../../lib/page-kind"
import { parseTalentCards, type TalentCard } from "../../lib/parse-talent"
import type {
  BenchmarkResult,
  BenchmarkRow,
  OptimizeResult,
} from "../../lib/types"
import PageState from "./PageState"
import Suggestions from "./Suggestions"

const VERDICT: Record<BenchmarkRow["verdict"], { text: string; cls: string }> =
  {
    below: { text: "Below", cls: "poor" },
    similar: { text: "Similar", cls: "good" },
    above: { text: "Above", cls: "" },
    good: { text: "Good", cls: "good" },
    missing: { text: "Missing", cls: "poor" },
    optional: { text: "Optional", cls: "" },
  }

// Compares the connected Upwork profile with the top freelancers on the open talent search page.
export default function Benchmark({ kind }: { kind: PageKind }) {
  const canRun = kind === "talent-search"
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = usePersistentState<BenchmarkResult | null>(
    "benchmark.result",
    null
  )
  // The cards the result was computed from; the optimizer reuses them instead of re-reading the page.
  const [cards, setCards] = usePersistentState<TalentCard[]>(
    "benchmark.cards",
    []
  )
  const [optimizing, setOptimizing] = useState(false)
  const [optimized, setOptimized] = usePersistentState<OptimizeResult | null>(
    "benchmark.optimized",
    null
  )

  async function run() {
    setBusy(true)
    setError(null)
    setResult(null)
    setOptimized(null)
    try {
      const snap = await snapshotActiveTab()
      if (!snap || pageKind(snap.url) !== "talent-search") {
        throw new Error(
          "Open a freelancer search results page on Upwork first."
        )
      }
      const parsed = parseTalentCards(snap.text)
      const r = await api.benchmark(parsed)
      if (!r.ok)
        throw new Error(
          r.status === "unauth"
            ? "Session expired. Sign in to Colosal again."
            : r.message
        )
      setCards(parsed)
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

  async function optimize() {
    setOptimizing(true)
    setError(null)
    try {
      const r = await api.optimizeWithBenchmark(cards)
      if (!r.ok)
        throw new Error(
          r.status === "unauth"
            ? "Session expired. Sign in to Colosal again."
            : r.message
        )
      setOptimized(r.data)
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Something went wrong. Please try again."
      )
    } finally {
      setOptimizing(false)
    }
  }

  return (
    <>
      <h2>Benchmark</h2>
      {canRun ? (
        <>
          <p className="muted">
            Compare your Upwork profile with the top freelancers on this search
            page (Job Success 90%+ and $5K+ earned). Names are not sent or
            stored.
          </p>
          <button className="btn" onClick={run} disabled={busy || optimizing}>
            {busy ? "Comparing..." : "Run benchmark"}
          </button>
        </>
      ) : (
        <PageState
          title="Freelancer search page required"
          text={
            kind === "outside"
              ? "Go to Upwork and open a freelancer search page to run a benchmark. Your latest result stays below."
              : "Open a freelancer search page on Upwork to run a benchmark. Your latest result stays below."
          }
        />
      )}
      {error && <p className="err">{error}</p>}

      {result && (
        <>
          <section className="card">
            <h3>You vs top profiles</h3>
            <p className="muted small">
              Based on {result.sample} top profiles
              {result.topRate !== null
                ? `. Their median rate is $${result.topRate}/hr.`
                : "."}
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
                      <span className={`badge ${VERDICT[r.verdict].cls}`}>
                        {VERDICT[r.verdict].text}
                      </span>
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

          {!optimized ? (
            <button
              className="btn"
              style={{ marginTop: 12 }}
              onClick={optimize}
              disabled={optimizing || busy}
            >
              {optimizing
                ? "Optimizing..."
                : "Optimize my profile with this benchmark"}
            </button>
          ) : (
            <>
              <section className="card">
                <h3>What changed and why</h3>
                <ul>
                  {optimized.changes.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </section>
              <Suggestions
                suggestions={optimized.suggestions}
                storageKey="suggestions.benchmark"
              />
            </>
          )}
        </>
      )}
    </>
  )
}
