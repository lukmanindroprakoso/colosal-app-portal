import { useEffect, useRef, useState } from "react"

// useState that survives the component unmounting (page changes, tab switches) and the panel
// closing. Backed by chrome.storage.session: stays in memory, is cleared when the browser closes
// (and by clearSession() on logout). Falls back to plain state if the API is unavailable.
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial)
  const loaded = useRef(false)
  const store = chrome.storage?.session

  useEffect(() => {
    let alive = true
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
  }, [key, store])

  useEffect(() => {
    if (loaded.current && store) store.set({ [key]: value })
  }, [key, value, store])

  return [value, setValue] as const
}

// Drops every persisted result, e.g. when the user logs out, so the next account does not see them.
export const clearSession = () => chrome.storage?.session?.clear()
