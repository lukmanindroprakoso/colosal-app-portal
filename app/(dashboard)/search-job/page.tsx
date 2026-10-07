import { createClient } from "@/lib/supabase/server"
import { searchJobs } from "@/lib/upwork/search-jobs"
import { SearchJobClient } from "./search-job"

export default async function SearchJobPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const keyword = q?.trim() ?? ""
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("phone, skills_text")
    .eq("user_id", user!.id)
    .single()

  // arriving with ?q= (from the dashboard): search here so navigation completes with results ready
  const result = keyword ? await searchJobs(supabase, user!.id, keyword, true) : null
  const initialJobs = result?.status === 200 ? result.body.jobs : null
  const initialError = !result || result.status === 200
    ? null
    : result.status === 400
      ? "Upwork is not connected. Reconnect it in Settings."
      : "Search failed. Try again."

  return (
    <SearchJobClient
      key={keyword}
      skillsText={profile?.skills_text ?? null}
      email={user?.email ?? ""}
      phone={profile?.phone ?? ""}
      initialKeyword={keyword}
      initialJobs={initialJobs}
      initialError={initialError}
    />
  )
}
