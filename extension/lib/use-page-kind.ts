import { useEffect, useState } from "react"
import { pageKind, type PageKind } from "./page-kind"

// Tracks the active tab's page kind: tab switches, URL changes (Upwork is a SPA), window focus.
export function usePageKind(): PageKind {
  const [kind, setKind] = useState<PageKind>("outside")

  useEffect(() => {
    const refresh = async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      setKind(pageKind(tab?.url))
    }
    refresh()
    const onUpdated = (_id: number, info: chrome.tabs.OnUpdatedInfo) => {
      if (info.url || info.status === "complete") refresh()
    }
    chrome.tabs.onActivated.addListener(refresh)
    chrome.tabs.onUpdated.addListener(onUpdated)
    chrome.windows.onFocusChanged.addListener(refresh)
    return () => {
      chrome.tabs.onActivated.removeListener(refresh)
      chrome.tabs.onUpdated.removeListener(onUpdated)
      chrome.windows.onFocusChanged.removeListener(refresh)
    }
  }, [])

  return kind
}
