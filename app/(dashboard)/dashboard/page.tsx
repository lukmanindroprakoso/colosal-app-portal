import { createClient } from "@/lib/supabase/server"
import { DashboardSearch } from "./dashboard-search"
import { StatCard } from "./stat-card"
import { Briefcase } from "lucide-react"
import { matchScoreStyle } from "@/lib/search-job/core"
import { cn } from "@/lib/utils"
import { timeAgo } from "../job-scanner/scanner-format"

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
  const [{ count: jobsScanned }, { count: proposalsGenerated }, { data: topJobs }] = await Promise.all([
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
    supabase
      .from("upwork_jobs")
      .select("id, title, url, score_matching, inserted_at")
      .eq("user_id", user!.id)
      .gt("score_matching", 95)
      .or("apply_status.is.null,apply_status.neq.Dismissed")
      .order("inserted_at", { ascending: false })
      .limit(10),
  ])

  const name = profile?.username ?? user?.email?.split("@")[0] ?? "there"

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-4 pt-2 text-center">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Hey, {name} 👋</h1>
          <p className="text-muted-foreground mx-auto max-w-sm">
            Your Colosal workspace is ready. More features are on the way — stay tuned.
          </p>
        </div>
        <DashboardSearch />
      </div>
      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Jobs scanned" value={jobsScanned ?? 0} />
        <StatCard label="Proposals generated" value={proposalsGenerated ?? 0} />
      </div>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Top matches</h2>
        {topJobs?.length ? (
          <div className="space-y-2">
            {topJobs.map((j) => (
              <div key={j.id} className="flex items-center gap-3 rounded-2xl bg-card p-3 ring-1 ring-foreground/5 dark:ring-foreground/10">
                <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-medium", matchScoreStyle(j.score_matching))}>
                  {j.score_matching}%
                </span>
                {j.url && /^https?:\/\//i.test(j.url) ? (
                  <a href={j.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate font-medium hover:underline">
                    {j.title ?? "Untitled job"}
                  </a>
                ) : (
                  <p className="min-w-0 flex-1 truncate font-medium">{j.title ?? "Untitled job"}</p>
                )}
                <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(j.inserted_at)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-border py-12 text-center">
            <Briefcase className="h-7 w-7 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No job above 95% match yet</p>
          </div>
        )}
      </section>
    </div>
  )
}
