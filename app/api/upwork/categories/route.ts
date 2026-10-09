import { createClient } from "@/lib/supabase/server"
import { fetchUpworkCategories } from "@/lib/upwork/categories"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("access_token, refresh_token")
    .eq("user_id", user.id)
    .single()

  if (!profile?.access_token) {
    return NextResponse.json({ error: "Upwork not connected" }, { status: 400 })
  }

  const categories = await fetchUpworkCategories(
    supabase,
    user.id,
    profile.access_token,
    profile.refresh_token
  )

  // Browser reuses it across pages and dev double-effects; skip caching failures.
  return NextResponse.json(
    { categories },
    categories.length ? { headers: { "Cache-Control": "private, max-age=3600" } } : undefined
  )
}
