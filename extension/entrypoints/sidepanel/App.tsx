import { useCallback, useEffect, useState } from "react"
import { api } from "../../lib/api"
import { COLOSAL_URL } from "../../lib/config"
import type { Template } from "../../lib/types"
import ProfileTab from "./ProfileTab"
import ProposalTab from "./ProposalTab"

type Auth =
  | { state: "loading" }
  | { state: "unauth" }
  | { state: "error"; message: string }
  | { state: "ready"; templates: Template[] }

export default function App() {
  const [auth, setAuth] = useState<Auth>({ state: "loading" })
  const [tab, setTab] = useState<"proposal" | "profile">("proposal")

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

  if (auth.state === "loading") return <main className="p muted">Memuat...</main>

  if (auth.state === "unauth") {
    return (
      <main className="p">
        <h1>Masuk ke Colosal</h1>
        <p>Anda perlu login di Colosal untuk memakai extension ini.</p>
        <div className="row">
          <button className="btn" onClick={() => chrome.tabs.create({ url: `${COLOSAL_URL}/login` })}>
            Login ke Colosal
          </button>
          <button className="link" onClick={check}>
            Periksa lagi
          </button>
        </div>
      </main>
    )
  }

  if (auth.state === "error") {
    return (
      <main className="p">
        <p className="err">{auth.message}</p>
        <button className="btn" onClick={check}>
          Coba lagi
        </button>
      </main>
    )
  }

  return (
    <>
      <nav className="tabs">
        <button className={tab === "proposal" ? "on" : ""} onClick={() => setTab("proposal")}>
          Proposal
        </button>
        <button className={tab === "profile" ? "on" : ""} onClick={() => setTab("profile")}>
          Profil
        </button>
      </nav>
      <main className="p">
        {tab === "proposal" ? <ProposalTab templates={auth.templates} /> : <ProfileTab />}
      </main>
    </>
  )
}
