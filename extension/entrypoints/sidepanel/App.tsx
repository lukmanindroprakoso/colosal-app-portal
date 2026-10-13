import { useCallback, useEffect, useState } from "react"
import { api } from "../../lib/api"
import { isAuthCookieFor } from "../../lib/auth-cookie"
import { COLOSAL_URL } from "../../lib/config"
import { usePageKind } from "../../lib/use-page-kind"
import { clearSession } from "../../lib/use-persistent-state"
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
        <button
          type="button"
          className="icon-btn"
          aria-label="Open Colosal settings"
          title="Settings"
          onClick={() => chrome.tabs.create({ url: `${COLOSAL_URL}/settings` })}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
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
    else if (r.status === "unauth") {
      clearSession() // logged out: do not show the next account the previous results
      setAuth({ state: "unauth" })
    }
    else setAuth({ state: "error", message: r.message })
  }, [])

  // Re-check when the panel regains focus, and as soon as the website's session cookie changes
  // (login or logout in any tab). Chunked cookies fire several events, so debounce.
  useEffect(() => {
    check()
    window.addEventListener("focus", check)

    const host = new URL(COLOSAL_URL).hostname
    let timer: ReturnType<typeof setTimeout> | undefined
    const onCookie = ({ cookie }: chrome.cookies.CookieChangeInfo) => {
      if (!isAuthCookieFor(cookie, host)) return
      clearTimeout(timer)
      timer = setTimeout(check, 400)
    }
    // chrome.cookies is undefined until Chrome has applied the "cookies" permission (extension
    // not reloaded yet); the focus re-check above still covers login/logout then.
    chrome.cookies?.onChanged.addListener(onCookie)

    return () => {
      window.removeEventListener("focus", check)
      chrome.cookies?.onChanged.removeListener(onCookie)
      clearTimeout(timer)
    }
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
          <ProposalTab templates={auth.templates} kind={kind} onChanged={check} />
        ) : (
          <ProfileTab kind={kind} />
        )}
      </main>
    </Shell>
  )
}
