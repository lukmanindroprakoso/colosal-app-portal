// True for the Supabase session cookie (sb-<ref>-auth-token, possibly chunked as .0, .1...)
// that belongs to the Colosal host. A login or logout on the website changes these cookies.
export function isAuthCookieFor(cookie: { name: string; domain: string }, hostname: string): boolean {
  if (!/^sb-.+-auth-token(\.\d+)?$/.test(cookie.name)) return false
  const domain = cookie.domain.replace(/^\./, "")
  return hostname === domain || hostname.endsWith(`.${domain}`)
}
