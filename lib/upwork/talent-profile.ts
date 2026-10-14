import type { SupabaseClient } from "@supabase/supabase-js"
import { BROWSER_UA, fetchUpworkWithAuth } from "@/lib/upwork/token"

const QUERY = `query {
  user {
    talentProfile {
      personalData { title description }
      employmentRecords { companyName jobTitle startDateTime endDateTime description }
      projectList { projects { title description projectUrl } }
      skills { prettyName }
    }
  }
}`

export async function fetchTalentProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<{ ok: true; profile: unknown } | { ok: false; status: 400 | 502; error: string }> {
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("access_token, refresh_token")
    .eq("user_id", userId)
    .single()
  if (!profile?.access_token) return { ok: false, status: 400, error: "Upwork not connected" }

  const res = await fetchUpworkWithAuth(supabase, userId, profile.access_token, profile.refresh_token, (token) =>
    fetch("https://api.upwork.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": BROWSER_UA,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query: QUERY }),
    })
  )
  const json = await res.json().catch(() => null)
  if (!res.ok || json?.errors) return { ok: false, status: 502, error: "Failed to fetch Upwork profile" }
  return { ok: true, profile: json?.data?.user?.talentProfile ?? null }
}
