import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => null)
  const jobId = body?.jobId as string | undefined
  if (!jobId) return NextResponse.json({ error: "Missing jobId" }, { status: 400 })

  const { data: job } = await supabase
    .from("upwork_jobs")
    .select("id, scan_config_id")
    .eq("id", jobId)
    .single()
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 })

  const { data: config } = await supabase
    .from("user_scan_config")
    .select("proposal_template_id, user_id")
    .eq("id", job.scan_config_id)
    .eq("user_id", user.id)
    .single()

  if (!config) return NextResponse.json({ error: "Job not found" }, { status: 404 })

  if (!config.proposal_template_id) {
    return NextResponse.json(
      { error: "Set a proposal template on this scanner first" },
      { status: 400 }
    )
  }

  const { data: proposal, error } = await supabase
    .from("proposals")
    .insert({ user_id: user.id, upwork_job_id: jobId, attachment: [] })
    .select("id")
    .single()

  if (error || !proposal) {
    return NextResponse.json({ error: error?.message ?? "Failed to create proposal" }, { status: 500 })
  }

  await supabase
    .from("upwork_jobs")
    .update({ apply_status: "Applied" })
    .eq("id", jobId)
    .eq("scan_config_id", job.scan_config_id)

  return NextResponse.json({ proposalId: proposal.id })
}
