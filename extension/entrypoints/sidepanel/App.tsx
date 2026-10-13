import { useCallback, useEffect, useState } from "react"
import { api } from "../../lib/api"
import { COLOSAL_URL } from "../../lib/config"
import { usePageKind } from "../../lib/use-page-kind"
import type { Template } from "../../lib/types"
import Logo from "./Logo"
import ProfileTab from "./ProfileTab"
import ProposalTab from "./ProposalTab"

type Auth =
  | { state: "loading" }
  | { state: "unauth" }
  | { state: "error"; message: string }
  | { state: "ready"; templates: Template[] }

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="top">
        <Logo />
      </header>
      {children}
    </>
  )
}

export default function App() {
  const [auth, setAuth] = useState<Auth>({ state: "loading" })
  const [tab, setTab] = useState<"proposal" | "profile">("proposal")
  const kind = usePageKind()

  const check = useCallback(async () => {
    const r = await api.templates()
    if (r.ok) setAuth({ state: "ready", templates: r.data.templates })
    else if (r.status === "unauth") setAuth({ state: "unauth" })
    else setAuth({ state: "error", message: r.message })
  }, [])

  // Re-check whenever the panel regains focus (e.g. after logging in in another tab).
  useEffect(() => {
    check()
    window.addEventListener("focus", check)
    return () => window.removeEventListener("focus", check)
  }, [check])

  if (auth.state === "loading") {
    return (
      <Shell>
        <main className="p muted">Loading...</main>
      </Shell>
    )
  }

  if (auth.state === "unauth") {
    return (
      <Shell>
        <main className="p">
          <h1>Sign in to Colosal</h1>
          <p>You need to be signed in to Colosal to use this extension.</p>
          <div className="row">
            <button
              className="btn"
              onClick={() =>
                chrome.tabs.create({ url: `${COLOSAL_URL}/login` })
              }
            >
              Sign in to Colosal
            </button>
            <button className="link" onClick={check}>
              Check again
            </button>
          </div>
        </main>
      </Shell>
    )
  }

  if (auth.state === "error") {
    return (
      <Shell>
        <main className="p">
          <p className="err">{auth.message}</p>
          <button className="btn" onClick={check}>
            Try again
          </button>
        </main>
      </Shell>
    )
  }

  return (
    <Shell>
      <nav className="tabs">
        <button
          className={tab === "proposal" ? "on" : ""}
          onClick={() => setTab("proposal")}
        >
          Proposal
        </button>
        <button
          className={tab === "profile" ? "on" : ""}
          onClick={() => setTab("profile")}
        >
          Profile
        </button>
      </nav>
      <main className="p">
        {tab === "proposal" ? (
          <ProposalTab templates={auth.templates} kind={kind} />
        ) : (
          <ProfileTab kind={kind} />
        )}
      </main>
    </Shell>
  )
}
