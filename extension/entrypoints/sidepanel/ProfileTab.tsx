import { useState } from "react"
import { api } from "../../lib/api"
import { looksLikeOwnProfile } from "../../lib/own-profile"
import { pageKind, type PageKind } from "../../lib/page-kind"
import { snapshotActiveTab } from "../../lib/page"
import type { ProfileFields, ProfileResult } from "../../lib/types"
import CopyButton from "./CopyButton"
import PageState from "./PageState"

type SaveState =
  | { step: "idle" }
  | { step: "confirm" }
  | { step: "saving" }
  | { step: "saved"; previous: ProfileFields }
  | { step: "reverted" }

export default function ProfileTab({ kind }: { kind: PageKind }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ProfileResult | null>(null)
  const [own, setOwn] = useState<boolean | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [save, setSave] = useState<SaveState>({ step: "idle" })

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
    setSave({ step: "idle" })
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

  async function saveToColosal() {
    if (!result) return
    setSave({ step: "saving" })
    setError(null)
    const r = await api.saveProfile({
      summary: result.suggestions.overview,
      current_role: result.suggestions.headline,
      skills_text: result.suggestions.skills.join(", "),
    })
    if (!r.ok) {
      setError(message(r))
      setSave({ step: "confirm" })
      return
    }
    setSave({ step: "saved", previous: r.data.previous })
  }

  async function undo() {
    if (save.step !== "saved") return
    // Previous values may be null in the database; write them back as empty text.
    const p = save.previous
    const r = await api.saveProfile({
      summary: p.summary ?? "",
      current_role: p.current_role ?? "",
      skills_text: p.skills_text ?? "",
    })
    if (!r.ok) {
      setError(message(r))
      return
    }
    setSave({ step: "reverted" })
  }

  if (kind !== "profile") {
    return (
      <PageState
        title="Profile page required"
        text={
          kind === "outside"
            ? "Go to Upwork and open your profile to start a scan."
            : "Open your Upwork profile to start a scan."
        }
      />
    )
  }

  return (
    <>
      <h2>Profile Optimization</h2>
      <p className="muted">The scan always analyzes the Upwork profile connected to your Colosal account.</p>
      <button className="btn" onClick={scan} disabled={busy}>
        {busy ? "Scanning profile..." : "Start scan"}
      </button>
      {error && <p className="err">{error}</p>}
      {result && own === false && (
        <p className="warn">
          This page doesn't look like your Upwork profile. The results are for the profile connected to your Colosal
          account.
        </p>
      )}

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

              <section className="card">
                {save.step === "idle" && (
                  <button className="btn" onClick={() => setSave({ step: "confirm" })}>
                    Save to Colosal profile
                  </button>
                )}
                {(save.step === "confirm" || save.step === "saving") && (
                  <>
                    <p>
                      This replaces the Summary, Current Role and Skills in your Colosal profile. Those fields are used
                      to write your proposals.
                    </p>
                    <div className="row">
                      <button className="btn" onClick={saveToColosal} disabled={save.step === "saving"}>
                        {save.step === "saving" ? "Saving..." : "Replace"}
                      </button>
                      <button className="link" onClick={() => setSave({ step: "idle" })} disabled={save.step === "saving"}>
                        Cancel
                      </button>
                    </div>
                  </>
                )}
                {save.step === "saved" && (
                  <div className="row">
                    <span>Saved to your Colosal profile.</span>
                    <button className="link" onClick={undo}>
                      Undo
                    </button>
                  </div>
                )}
                {save.step === "reverted" && <p className="muted">Restored your previous Colosal profile.</p>}
              </section>
            </>
          )}
        </>
      )}
    </>
  )
}
