import { useEffect, useRef, useState } from "react"

// useState that survives the component unmounting (page changes, tab switches) and the panel
// closing. Backed by chrome.storage.session by default: stays in memory, is cleared when the
// browser closes (and by clearSession() on logout). Pass area "local" to also survive a browser
// restart. Falls back to plain state if the API is unavailable. Changing `key` loads that key's
// value (or `initial`), so one hook can follow e.g. the job being viewed.
export function usePersistentState<T>(
  key: string,
  initial: T,
  area: "session" | "local" = "session"
) {
  const [value, setValue] = useState<T>(initial)
  const loaded = useRef(false)
  const store = chrome.storage?.[area]

  useEffect(() => {
    let alive = true
    loaded.current = false
    setValue(initial)
    if (!store) {
      loaded.current = true
      return
    }
    store.get(key).then((r) => {
      if (!alive) return
      if (key in r) setValue(r[key] as T)
      loaded.current = true
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `initial` only seeds a new key
  }, [key, store])

  useEffect(() => {
    if (loaded.current && store) store.set({ [key]: value })
  }, [key, value, store])

  return [value, setValue] as const
}

// Generated proposals live in chrome.storage.local, one entry per job.
// ponytail: never pruned; local quota is ~10 MB (hundreds of proposals), prune oldest if it fills.
const dropProposals = async () => {
  const local = chrome.storage?.local
  if (!local) return
  const keys = Object.keys(await local.get(null)).filter((k) => k.startsWith("proposal."))
  await local.remove(keys)
}

// Keeps results per account: when the signed-in user differs from the one the results belong to,
// they are dropped. Returns true when that happened so the caller can remount what shows them.
// The user id is kept in local storage so a different account after a browser restart is caught too.
export async function adoptSessionUser(userId: string): Promise<boolean> {
  const local = chrome.storage?.local
  if (!local) return false
  const { sessionUserId } = await local.get("sessionUserId")
  const switched = typeof sessionUserId === "string" && sessionUserId !== userId
  if (switched) {
    await chrome.storage.session?.clear()
    await dropProposals()
  }
  await local.set({ sessionUserId: userId })
  return switched
}

// Drops every persisted result, e.g. when the user logs out, so the next account does not see them.
export const clearSession = () => Promise.all([chrome.storage?.session?.clear(), dropProposals()])
