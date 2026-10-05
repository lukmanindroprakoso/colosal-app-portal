import { createClient } from "@/lib/supabase/server"
import { SearchJobClient } from "./search-job"

export default async function SearchJobPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("phone, skills_text")
    .eq("user_id", user!.id)
    .single()

  return (
    <SearchJobClient
      skillsText={profile?.skills_text ?? null}
      email={user?.email ?? ""}
      phone={profile?.phone ?? ""}
    />
  )
}
