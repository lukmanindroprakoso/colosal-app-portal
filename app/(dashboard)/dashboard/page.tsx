import { createClient } from "@/lib/supabase/server"
import { DashboardSearch } from "./dashboard-search"
import { StatCard } from "./stat-card"

const sevenDaysAgo = () => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("username")
    .eq("user_id", user!.id)
    .single()

  const since = sevenDaysAgo()
  const [{ count: jobsScanned }, { count: proposalsGenerated }] = await Promise.all([
    supabase
      .from("upwork_jobs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user!.id)
      .gte("inserted_at", since),
    supabase
      .from("proposals")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user!.id)
      .gte("last_generated_at", since),
  ])

  const name = profile?.username ?? user?.email?.split("@")[0] ?? "there"

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Jobs scanned" value={jobsScanned ?? 0} />
        <StatCard label="Proposals generated" value={proposalsGenerated ?? 0} />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center space-y-4 pb-16 text-center">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Hey, {name} 👋</h1>
          <p className="text-muted-foreground max-w-sm">
            Your Colosal workspace is ready. More features are on the way — stay tuned.
          </p>
        </div>
        <DashboardSearch />
      </div>
    </div>
  )
}
