export type PageKind = "job" | "profile" | "other-upwork" | "outside"

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
  // Job detail URLs (/jobs/, /freelance-jobs/apply/, /nx/.../details/) all carry a ~0… job id.
  if (/~0\d{15,}/.test(u.pathname)) return "job"
  return "other-upwork"
}
