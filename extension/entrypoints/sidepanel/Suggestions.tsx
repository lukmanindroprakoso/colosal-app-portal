import { useState } from "react"
import { api } from "../../lib/api"
import { hasPlaceholders } from "../../lib/placeholders"
import type { ProfileFields, ProfileResult } from "../../lib/types"
import CopyButton from "./CopyButton"

type SaveState =
  | { step: "idle" }
  | { step: "confirm" }
  | { step: "saving" }
  | { step: "saved"; previous: ProfileFields }
  | { step: "reverted" }

// Headline / overview / skills suggestions with Copy, plus the explicit "Save to Colosal profile" flow.
export default function Suggestions({ suggestions }: { suggestions: ProfileResult["suggestions"] }) {
  const [save, setSave] = useState<SaveState>({ step: "idle" })
  const [error, setError] = useState<string | null>(null)
  const skills = suggestions.skills.join(", ")
  // [add: ...] marks proof the AI could not know; saving it would feed placeholders into proposals.
  const unfinished = hasPlaceholders([suggestions.headline, suggestions.overview, skills])

  const message = (r: { status: string; message: string }) =>
    r.status === "unauth" ? "Session expired. Sign in to Colosal again." : r.message

  async function saveToColosal() {
    setSave({ step: "saving" })
    setError(null)
    const r = await api.saveProfile({
      summary: suggestions.overview,
      current_role: suggestions.headline,
      skills_text: skills,
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

  return (
    <>
      <section className="card">
        <div className="row">
          <h3>Headline</h3>
          <CopyButton text={suggestions.headline} />
        </div>
        <pre>{suggestions.headline}</pre>
      </section>
      <section className="card">
        <div className="row">
          <h3>Overview</h3>
          <CopyButton text={suggestions.overview} />
        </div>
        <pre>{suggestions.overview}</pre>
      </section>
      <section className="card">
        <div className="row">
          <h3>Skills</h3>
          <CopyButton text={skills} />
        </div>
        <pre>{skills}</pre>
      </section>

      <section className="card">
        {unfinished && (
          <p className="warn" style={{ marginTop: 0 }}>
            Replace the [add: ...] placeholders with your real details before saving. Copy the text, fill it in, then
            paste it into your profile.
          </p>
        )}
        {save.step === "idle" && (
          <button className="btn" onClick={() => setSave({ step: "confirm" })} disabled={unfinished}>
            Save to Colosal profile
          </button>
        )}
        {(save.step === "confirm" || save.step === "saving") && (
          <>
            <p>
              This replaces the Summary, Current Role and Skills in your Colosal profile. Those fields are used to write
              your proposals.
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
        {error && <p className="err">{error}</p>}
      </section>
    </>
  )
}
