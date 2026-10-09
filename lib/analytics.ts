type GtagParams = Record<string, string | number | boolean | undefined>

declare global {
  interface Window {
    gtag?: (command: "event", name: string, params?: GtagParams) => void
  }
}

// Safe no-op when GA is blocked, not loaded yet, or running on the server.
// Keep params free of PII (no emails, names, phone numbers).
export function track(name: string, params?: GtagParams) {
  if (typeof window === "undefined") return
  window.gtag?.("event", name, params)
}
