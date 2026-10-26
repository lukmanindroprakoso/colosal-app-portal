export type PageKind = "job" | "profile" | "talent-search" | "other-upwork" | "outside"

// Classifies a tab URL so the panel only offers a feature on the page it belongs to.
export function pageKind(url: string | undefined): PageKind {
  if (!url) return "outside"
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return "outside"
  }
  if (u.protocol !== "https:" || !/(^|\.)upwork\.com$/.test(u.hostname)) return "outside"
  if (/^\/freelancers\/~[0-9a-f]+/i.test(u.pathname)) return "profile"
  if (/^\/nx\/search\/talent\/?$/.test(u.pathname)) return "talent-search"
  // Job detail URLs (/jobs/, /freelance-jobs/apply/, /nx/.../details/) all carry a ~0… job id.
  if (/~0\d{15,}/.test(u.pathname)) return "job"
  return "other-upwork"
}

// The "~0…" id shared by a job's detail page and its apply page; null on any other page.
export function jobIdFromUrl(url: string | undefined): string | null {
  if (pageKind(url) !== "job") return null
  return new URL(url!).pathname.match(/~0\d{15,}/)![0]
}
