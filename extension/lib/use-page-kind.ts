import { useEffect, useState } from "react"
import { jobIdFromUrl, pageKind, type PageKind } from "./page-kind"

// Tracks the active tab's page kind and job id: tab switches, URL changes (Upwork is a SPA), window focus.
export function usePageKind(): { kind: PageKind; jobId: string | null } {
  const [page, setPage] = useState<{ kind: PageKind; jobId: string | null }>({
    kind: "outside",
    jobId: null,
  })

  useEffect(() => {
    const refresh = async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      const next = { kind: pageKind(tab?.url), jobId: jobIdFromUrl(tab?.url) }
      setPage((p) => (p.kind === next.kind && p.jobId === next.jobId ? p : next))
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

  return page
}
