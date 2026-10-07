import { createClient } from "@/lib/supabase/server"
import { searchJobs } from "@/lib/upwork/search-jobs"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const params = new URL(request.url).searchParams
  const keyword = params.get("keyword")?.trim()
  if (!keyword) return NextResponse.json({ jobs: [] })

  const { status, body } = await searchJobs(supabase, user.id, keyword, params.get("all") === "1")
  return NextResponse.json(body, { status })
}
