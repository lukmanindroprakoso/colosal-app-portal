import { pageKind } from "./page-kind"

export type PageSnapshot = { url: string; title: string; text: string }

// Reads the visible text of the active tab. Returns null when it is not an Upwork page.
export async function snapshotActiveTab(): Promise<PageSnapshot | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id || !tab.url || pageKind(tab.url) === "outside") return null

  const [res] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => ({
      title: document.querySelector("h1")?.textContent?.trim() ?? document.title,
      text: document.body.innerText,
    }),
  })
  if (!res?.result) return null
  return { url: tab.url, ...res.result }
}
