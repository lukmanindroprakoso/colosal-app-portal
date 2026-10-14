import { useState } from "react"
import { usePersistentState } from "../../lib/use-persistent-state"
import { api } from "../../lib/api"
import { looksLikeOwnProfile } from "../../lib/own-profile"
import { pageKind, type PageKind } from "../../lib/page-kind"
import { snapshotActiveTab } from "../../lib/page"
import type { ProfileResult } from "../../lib/types"
import PageState from "./PageState"
import ScoreCard from "./ScoreCard"
import Suggestions from "./Suggestions"

// Scanning needs your profile page; a result you already have stays visible on every Upwork page,
// e.g. while you edit your profile.
export default function ProfileTab({ kind }: { kind: PageKind }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = usePersistentState<ProfileResult | null>("profile.result", null)
  const [own, setOwn] = usePersistentState<boolean | null>("profile.own", null)
  const [showSuggestions, setShowSuggestions] = usePersistentState("profile.showSuggestions", false)

  const message = (r: { status: string; message: string }) =>
    r.status === "unauth" ? "Session expired. Sign in to Colosal again." : r.message

  async function scan() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (pageKind(tab?.url) !== "profile") {
      setError("Open your Upwork profile first.")
      return
    }
    setBusy(true)
    setError(null)
    setResult(null)
    setShowSuggestions(false)
    try {
      const snap = await snapshotActiveTab()
      const r = await api.profile()
      if (!r.ok) throw new Error(message(r))
      setResult(r.data)
      setOwn(looksLikeOwnProfile(snap?.text ?? "", r.data.yourHeadline))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <h2>Profile Optimization</h2>
      {kind === "profile" ? (
        <>
          <p className="muted">The scan always analyzes the Upwork profile connected to your Colosal account.</p>
          <button className="btn" onClick={scan} disabled={busy}>
            {busy ? "Scanning profile..." : "Start scan"}
          </button>
        </>
      ) : (
        <PageState
          title="Profile page required"
          text={
            kind === "outside"
              ? "Go to Upwork and open your profile to run a scan. Your latest result stays below."
              : "Open your Upwork profile to run a scan. Your latest result stays below."
          }
        />
      )}
      {error && <p className="err">{error}</p>}

      {result && (
        <>
          {own === false && (
            <p className="warn">
              The page you scanned didn't look like your Upwork profile. The results are for the profile connected to
              your Colosal account.
            </p>
          )}
          <ScoreCard score={result.score} />

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
            <Suggestions suggestions={result.suggestions} storageKey="suggestions.profile" />
          )}
        </>
      )}
    </>
  )
}
