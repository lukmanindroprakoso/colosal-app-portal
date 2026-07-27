import { createClient } from "@/lib/supabase/server"
import { BROWSER_UA, fetchUpworkWithAuth } from "@/lib/upwork/token"
import { NextResponse } from "next/server"

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

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("access_token, refresh_token")
    .eq("user_id", user.id)
    .single()

  if (!profile?.access_token) {
    return NextResponse.json({ error: "Upwork not connected" }, { status: 400 })
  }

  const res = await fetchUpworkWithAuth(
    supabase,
    user.id,
    profile.access_token,
    profile.refresh_token,
    (token) =>
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
  if (!res.ok || json?.errors) {
    return NextResponse.json({ error: "Failed to fetch Upwork profile" }, { status: 502 })
  }

  return NextResponse.json({ profile: json?.data?.user?.talentProfile ?? null })
}
