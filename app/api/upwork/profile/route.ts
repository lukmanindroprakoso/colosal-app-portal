import { createClient } from "@/lib/supabase/server"
import { fetchTalentProfile } from "@/lib/upwork/talent-profile"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const r = await fetchTalentProfile(supabase, user.id)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  return NextResponse.json({ profile: r.profile })
}
