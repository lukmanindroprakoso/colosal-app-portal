import type { SupabaseClient } from "@supabase/supabase-js"

export const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

export async function refreshUpworkToken(
  supabase: SupabaseClient,
  userId: string,
  refreshToken: string
): Promise<string | null> {
  const credentials = Buffer.from(
    `${process.env.UPWORK_CLIENT_ID}:${process.env.UPWORK_CLIENT_SECRET}`
  ).toString("base64")

  const res = await fetch("https://www.upwork.com/api/v3/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  })

  if (!res.ok) return null

  const { access_token, refresh_token, expires_in } = await res.json()
  await supabase
    .from("user_profiles")
    .update({
      access_token,
      refresh_token: refresh_token ?? refreshToken,
      expires_at: expires_in ? new Date(Date.now() + expires_in * 1000).toISOString() : null,
      last_used: new Date().toISOString(),
    })
    .eq("user_id", userId)

  return access_token
}

/**
 * Calls fetchFn(token) with the current access token. On 401/403, refreshes
 * the token once via refresh_token and retries.
 */
export async function fetchUpworkWithAuth(
  supabase: SupabaseClient,
  userId: string,
  accessToken: string,
  refreshToken: string | null,
  fetchFn: (token: string) => Promise<Response>
): Promise<Response> {
  let res = await fetchFn(accessToken)

  if ((res.status === 401 || res.status === 403) && refreshToken) {
    const newToken = await refreshUpworkToken(supabase, userId, refreshToken)
    if (newToken) res = await fetchFn(newToken)
  }

  return res
}
