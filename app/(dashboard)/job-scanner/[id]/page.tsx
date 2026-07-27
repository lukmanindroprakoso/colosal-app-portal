import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { fetchUpworkCategories } from "@/lib/upwork/categories"
import { Button } from "@/components/ui/button"
import { ConfigSummary, type ScanConfigDetail } from "./config-summary"
import { JobList, JobListTabs, type ApplyStatusTab, type JobRow } from "./job-list"
import { ScanChart, type DailyCount } from "./scan-chart"

const PAGE_SIZE = 20
const TABS: ApplyStatusTab[] = ["All", "New", "Applied", "Dismissed"]

export default async function ScannerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string; page?: string }>
}) {
  const { id } = await params
  const sp = await searchParams

  const activeTab: ApplyStatusTab = TABS.includes(sp.tab as ApplyStatusTab)
    ? (sp.tab as ApplyStatusTab)
    : "All"
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1)

  const supabase = await createClient()

  const { data: config } = await supabase
    .from("user_scan_config")
    .select("*")
    .eq("id", id)
    .single()

  if (!config) notFound()

  let categoryLabel: string | null = config.category
  if (config.category) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { data: profile } = user
      ? await supabase
          .from("user_profiles")
          .select("access_token, refresh_token")
          .eq("user_id", user.id)
          .single()
      : { data: null }

    if (user && profile?.access_token) {
      const categories = await fetchUpworkCategories(
        supabase,
        user.id,
        profile.access_token,
        profile.refresh_token
      )
      const match = categories
        .flatMap((cat) => cat.subcategories)
        .find((sub) => sub.id === config.category)
      if (match) categoryLabel = match.preferredLabel
    }
  }

  const baseQuery = supabase.from("upwork_jobs").select("id", { count: "exact", head: true }).eq("scan_config_id", id)

  const [allCount, newCount, appliedCount, dismissedCount] = await Promise.all([
    baseQuery,
    supabase
      .from("upwork_jobs")
      .select("id", { count: "exact", head: true })
      .eq("scan_config_id", id)
      .eq("apply_status", "New"),
    supabase
      .from("upwork_jobs")
      .select("id", { count: "exact", head: true })
      .eq("scan_config_id", id)
      .eq("apply_status", "Applied"),
    supabase
      .from("upwork_jobs")
      .select("id", { count: "exact", head: true })
      .eq("scan_config_id", id)
      .eq("apply_status", "Dismissed"),
  ])

  const counts: Record<ApplyStatusTab, number> = {
    All: allCount.count ?? 0,
    New: newCount.count ?? 0,
    Applied: appliedCount.count ?? 0,
    Dismissed: dismissedCount.count ?? 0,
  }

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
  sevenDaysAgo.setHours(0, 0, 0, 0)
  const { data: recentJobs } = await supabase
    .from("upwork_jobs")
    .select("inserted_at")
    .eq("scan_config_id", id)
    .gte("inserted_at", sevenDaysAgo.toISOString())

  const dailyCounts: DailyCount[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sevenDaysAgo)
    d.setDate(d.getDate() + i)
    const date = d.toISOString().slice(0, 10)
    return { date, label: d.toLocaleDateString("en-US", { weekday: "short" }), count: 0 }
  })
  for (const job of recentJobs ?? []) {
    const date = job.inserted_at.slice(0, 10)
    const bucket = dailyCounts.find((d) => d.date === date)
    if (bucket) bucket.count += 1
  }

  const totalPages = Math.max(1, Math.ceil(counts[activeTab] / PAGE_SIZE))
  const clampedPage = Math.min(page, totalPages)

  let jobsQuery = supabase
    .from("upwork_jobs")
    .select(
      "id, title, url, contract_type, fixed_price_amount, fixed_price_currency, hourly_budget_min, hourly_budget_max, inserted_at, score_matching, apply_status"
    )
    .eq("scan_config_id", id)
    .order("inserted_at", { ascending: false })
    .range((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE - 1)

  if (activeTab !== "All") {
    jobsQuery = jobsQuery.eq("apply_status", activeTab)
  }

  const { data: jobRows } = await jobsQuery

  const configDetail: ScanConfigDetail = {
    id: config.id,
    name: config.name,
    status: config.status,
    keyword: config.keyword,
    category: categoryLabel,
    experience_level: config.experience_level,
    contract_type: config.contract_type,
    budget_min: config.budget_min,
    budget_max: config.budget_max,
    hourly_rate_min: config.hourly_rate_min,
    hourly_rate_max: config.hourly_rate_max,
    skills: Array.isArray(config.skills) ? config.skills : [],
    last_scan: config.last_scan,
    next_scan: config.next_scan,
    scan_result: config.scan_result,
    notif_email: config.notif_email ?? false,
    email: config.email,
    notif_whatsapp: config.notif_whatsapp ?? false,
    whatsapp: config.whatsapp,
  }

  return (
    <div className="space-y-6 pb-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit gap-1">
        <Link href="/job-scanner">
          <ArrowLeft className="h-4 w-4" /> Back to Job Scanner
        </Link>
      </Button>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr] lg:items-start">
        <ConfigSummary config={configDetail} />
        <div className="flex min-w-0 flex-col gap-4">
          <ScanChart days={dailyCounts} />
          <JobListTabs scanConfigId={id} counts={counts} activeTab={activeTab} />
          <JobList
            scanConfigId={id}
            jobs={(jobRows ?? []) as JobRow[]}
            activeTab={activeTab}
            page={clampedPage}
            pageSize={PAGE_SIZE}
            activeTabTotal={counts[activeTab]}
          />
        </div>
      </div>
    </div>
  )
}
