"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, Loader2, Search } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { track } from "@/lib/analytics"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { Checkbox, NativeSelect, EXPERIENCE_LEVELS } from "../job-scanner/scanner-form"
import { timeAgo } from "../job-scanner/scanner-format"
import {
  EMPTY_FILTERS,
  applyFilters,
  matchBreakdown,
  matchScore,
  matchScoreStyle,
  parseSkills,
  type JobFilters,
  type SearchJob,
} from "@/lib/search-job/core"

interface UpworkCategory {
  id: string
  preferredLabel: string
  subcategories: { id: string; preferredLabel: string }[]
}

// NativeSelect with a custom chevron inset from the edge; width comes from className
function SelectBox({ className, ...props }: React.ComponentProps<typeof NativeSelect> & { className?: string }) {
  return (
    <div className={cn("relative [&_select]:appearance-none [&_select]:pr-9", className)}>
      <NativeSelect {...props} />
      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}

const jobUrl = (id: string) => `https://www.upwork.com/jobs/${id.startsWith("~") ? id : "~" + id}`

function filterParams(keyword: string, f: JobFilters) {
  const q = new URLSearchParams({ keyword, all: "1" })
  if (f.experience) q.set("experience", f.experience)
  if (f.skill.trim()) q.set("skill", f.skill.trim())
  if (f.contractType.length === 1) q.set("contractType", f.contractType[0])
  for (const key of ["hourlyMin", "hourlyMax", "budgetMin", "budgetMax"] as const) {
    if (f[key] != null) q.set(key, String(f[key]))
  }
  return q
}

const num = (v: string) => (v ? Number(v) : null)

function money(j: SearchJob): string | null {
  if (j.contractType === "HOURLY" && (j.hourlyMin != null || j.hourlyMax != null))
    return `$${j.hourlyMin ?? "?"}-${j.hourlyMax ?? "?"}/hr`
  if (j.contractType === "FIXED" && j.amount != null) return `Fixed $${j.amount}`
  return null
}

export function SearchJobClient({
  skillsText,
  email,
  phone,
  atLimit = false,
  initialKeyword = "",
  initialJobs = null,
  initialTotal = null,
  initialError = null,
}: {
  skillsText: string | null
  email: string
  phone: string
  atLimit?: boolean
  initialKeyword?: string
  initialJobs?: SearchJob[] | null
  initialTotal?: number | null
  initialError?: string | null
}) {
  const [input, setInput] = useState(initialKeyword)
  const [keyword, setKeyword] = useState(initialJobs ? initialKeyword : "") // keyword of the last completed search
  const [jobs, setJobs] = useState<SearchJob[] | null>(initialJobs)
  const [total, setTotal] = useState<number | null>(initialTotal) // Upwork's totalCount for the last search
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(initialError)
  const [filters, setFilters] = useState<JobFilters>(EMPTY_FILTERS)
  const [sort, setSort] = useState<"match" | "newest">("match")
  const [categories, setCategories] = useState<UpworkCategory[]>([])
  const reqId = useRef(0)
  const statsReq = useRef(0) // ignore stats from a superseded search
  const [page, setPage] = useState(1)
  const [stats, setStats] = useState<{ day: number; week: number } | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [detail, setDetail] = useState<{ job: SearchJob; score: number } | null>(null)
  const topRef = useRef<HTMLDivElement>(null)
  const [applied, setApplied] = useState<JobFilters>(EMPTY_FILTERS) // filters of the last completed search

  const router = useRouter()
  const [saveOpen, setSaveOpen] = useState(false)
  const [startNow, setStartNow] = useState(true)
  const [saveName, setSaveName] = useState("")
  const [saving, setSaving] = useState(false)

  function notifyLimit() {
    track("scan_limit_reached", { source: "search_job" })
    toast.error("Free plan allows up to 2 active scanners", {
      description: "Upgrade to create more.",
      action: {
        label: "Contact us",
        onClick: () => {
          track("upgrade_click", { source: "search_job_limit" })
          window.open("mailto:team@paistudio.dev?subject=Upgrade%20request")
        },
      },
    })
  }

  async function saveScanner() {
    const name = saveName.trim()
    if (!name || saving) return
    setSaving(true)
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      router.push("/login")
      return
    }
    const contractTypes = [
      ...new Set([
        ...filters.contractType,
        ...(filters.hourlyMin != null || filters.hourlyMax != null ? ["HOURLY"] : []),
        ...(filters.budgetMin != null || filters.budgetMax != null ? ["FIXED"] : []),
      ]),
    ]
    const active = startNow && !atLimit
    const { data, error } = await supabase
      .from("user_scan_config")
      .insert({
        user_id: userData.user.id,
        name,
        keyword,
        contract_type: contractTypes.length ? contractTypes : null,
        budget_min: filters.budgetMin,
        budget_max: filters.budgetMax,
        hourly_rate_min: filters.hourlyMin,
        hourly_rate_max: filters.hourlyMax,
        experience_level: filters.experience || null,
        category: filters.category || null,
        email: email || null,
        whatsapp: phone || null,
        status: active ? "Active" : "Draft",
        notif_email: active && !!email,
      })
      .select("id")
      .single()
    if (error || !data) {
      setSaving(false)
      if (error?.message.startsWith("SCAN_LIMIT_REACHED")) {
        setSaveOpen(false)
        notifyLimit()
        return
      }
      toast.error(error?.message ?? "Failed to save scanner")
      return
    }
    track("search_save_as_scanner")
    router.push(`/job-scanner/${data.id}`)
  }

  const userSkills = useMemo(() => parseSkills(skillsText), [skillsText])

  useEffect(() => {
    fetch("/api/upwork/categories")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setCategories(j?.categories ?? []))
      .catch(() => {})
  }, [])

  // posting counts are secondary: failures just hide the stats
  function loadStats(k: string, f: JobFilters) {
    const q = filterParams(k, f)
    q.set("stats", "1")
    setStats(null)
    setStatsLoading(true)
    const id = ++statsReq.current
    fetch(`/api/upwork/jobs-search?${q}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => id === statsReq.current && j && setStats({ day: j.day, week: j.week }))
      .catch(() => {})
      .finally(() => id === statsReq.current && setStatsLoading(false))
  }

  useEffect(() => {
    if (initialJobs && initialKeyword) loadStats(initialKeyword, EMPTY_FILTERS)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function runSearch(raw: string, f: JobFilters = EMPTY_FILTERS, pageNo = 1) {
    const k = raw.trim()
    if (!k) return
    const id = ++reqId.current
    const q = filterParams(k, f)
    q.set("page", String(pageNo))
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/upwork/jobs-search?${q}`)
      const json = await res.json().catch(() => null)
      if (id !== reqId.current) return // superseded by a newer search
      if (!res.ok) {
        setError(
          res.status === 400
            ? "Upwork is not connected. Reconnect it in Settings."
            : "Search failed. Try again."
        )
        return
      }
      setJobs(json?.jobs ?? [])
      setTotal(json?.totalCount ?? null)
      setPage(pageNo)
      if (pageNo === 1) loadStats(k, f)
      setKeyword(k)
      setFilters(f)
      setApplied(f)
    } catch {
      if (id === reqId.current) setError("Search failed. Try again.")
    } finally {
      if (id === reqId.current) setLoading(false)
    }
  }


  function search(e: React.FormEvent) {
    e.preventDefault()
    runSearch(input)
  }

  const set = <K extends keyof JobFilters>(key: K, v: JobFilters[K]) =>
    setFilters((f) => ({ ...f, [key]: v }))

  const visible = useMemo(() => {
    // Upwork already applied experience, skill and a single rate filter; only redo the rest
    const rateBoth =
      (applied.hourlyMin != null || applied.hourlyMax != null) &&
      (applied.budgetMin != null || applied.budgetMax != null)
    const local: JobFilters = {
      ...applied,
      experience: null,
      skill: "",
      contractType: applied.contractType.length === 1 ? [] : applied.contractType,
      ...(rateBoth ? {} : { hourlyMin: null, hourlyMax: null, budgetMin: null, budgetMax: null }),
    }
    const scored = applyFilters(jobs ?? [], local).map((job) => ({
      job,
      score: matchScore(job.skills, userSkills),
    }))
    if (sort === "match") scored.sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
    return scored
  }, [jobs, applied, userSkills, sort])

  async function goPage(n: number) {
    await runSearch(keyword, applied, n)
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }) // works for any scroll container
  }

  const pages = Math.ceil((total ?? 0) / 10)
  const categoryOptions = categories.flatMap((c) =>
    c.subcategories.map((s) => ({ value: s.id, label: `${c.preferredLabel} — ${s.preferredLabel}` }))
  )
  const hasCategoryData = (jobs ?? []).some((j) => j.category)

  const searchBar = (
    <form onSubmit={search} className="flex w-full max-w-2xl gap-2">
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Search for jobs, e.g. react developer"
        className="h-11"
      />
      <Button type="submit" size="lg" disabled={loading || !input.trim()}>
        {loading ? <Loader2 className="animate-spin" /> : <Search />} Search
      </Button>
    </form>
  )

  if (jobs === null) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-6">
        <h1 className="text-2xl font-semibold">Search Job</h1>
        {searchBar}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    )
  }

  return (
    <div ref={topRef} className="space-y-6 p-6">
      {searchBar}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="w-full shrink-0 space-y-5 lg:w-64">
          <div className="space-y-2">
            <Label>Hourly rate ($)</Label>
            <div className="flex gap-2">
              <Input type="number" placeholder="Min" value={filters.hourlyMin ?? ""} onChange={(e) => set("hourlyMin", num(e.target.value))} />
              <Input type="number" placeholder="Max" value={filters.hourlyMax ?? ""} onChange={(e) => set("hourlyMax", num(e.target.value))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Fixed budget ($)</Label>
            <div className="flex gap-2">
              <Input type="number" placeholder="Min" value={filters.budgetMin ?? ""} onChange={(e) => set("budgetMin", num(e.target.value))} />
              <Input type="number" placeholder="Max" value={filters.budgetMax ?? ""} onChange={(e) => set("budgetMax", num(e.target.value))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Contract type</Label>
            {(["HOURLY", "FIXED"] as const).map((t) => (
              <Checkbox
                key={t}
                label={t === "HOURLY" ? "Hourly" : "Fixed price"}
                checked={filters.contractType.includes(t)}
                onChange={(on) =>
                  set("contractType", on ? [...filters.contractType, t] : filters.contractType.filter((x) => x !== t))
                }
              />
            ))}
          </div>
          <div className="space-y-2">
            <Label>Experience level</Label>
            <SelectBox
              value={filters.experience}
              onChange={(v) => set("experience", v || null)}
              placeholder="Any"
              options={[{ value: "", label: "Any" }, ...EXPERIENCE_LEVELS]}
            />
          </div>
          {hasCategoryData && (
            <div className="space-y-2">
              <Label>Category</Label>
              <SelectBox
                value={filters.category}
                onChange={(v) => set("category", v || null)}
                placeholder="Any"
                options={[{ value: "", label: "Any" }, ...categoryOptions]}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label>Skill</Label>
            <Input placeholder="e.g. react" value={filters.skill} onChange={(e) => set("skill", e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={loading} onClick={() => runSearch(keyword, filters)}>
              {loading && <Loader2 className="animate-spin" />} Apply filters
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => {
                setFilters(EMPTY_FILTERS)
                runSearch(keyword, EMPTY_FILTERS)
              }}
            >
              Clear
            </Button>
          </div>
        </aside>

        <section className="min-w-0 flex-1 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <p className="text-sm text-muted-foreground">
                {visible.length} shown of {total ?? jobs.length} jobs for &ldquo;{keyword}&rdquo;
              </p>
              <Button
                size="sm"
                onClick={() => {
                  setStartNow(!atLimit)
                  setSaveName(keyword)
                  setSaveOpen(true)
                }}
              >
                Save as scanner
              </Button>
            </div>
            <SelectBox
              className="w-40"
              value={sort}
              onChange={(v) => setSort(v as "match" | "newest")}
              placeholder="Sort"
              options={[
                { value: "match", label: "Best match" },
                { value: "newest", label: "Newest" },
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Posted in last 24 hours", value: stats?.day },
              { label: "Posted in last 7 days", value: stats?.week },
            ].map((x) => (
              <div key={x.label} className="rounded-2xl border border-border p-3">
                <p className="text-xs text-muted-foreground">{x.label}</p>
                {statsLoading ? (
                  <div className="mt-1.5 h-6 w-16 animate-pulse rounded-md bg-muted" />
                ) : (
                  <p className="text-xl font-semibold">
                    {x.value == null ? "—" : new Intl.NumberFormat("en-US").format(x.value)}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="relative space-y-4">
            {loading && (
              <div className="absolute inset-0 z-10 flex items-start justify-center bg-background/60 pt-24">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
          {visible.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground">No jobs found</p>
          )}

          {visible.map(({ job, score }) => (
            <article key={job.id} className="space-y-2 rounded-2xl border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-medium">
                  <a href={jobUrl(job.id)} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {job.title}
                  </a>
                </h3>
                {score !== null && (
                  <button
                    type="button"
                    onClick={() => setDetail({ job, score })}
                    className={cn("shrink-0 cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium hover:opacity-80", matchScoreStyle(score))}
                  >
                    {score}% match
                  </button>
                )}
              </div>
              <p className="line-clamp-3 text-sm text-muted-foreground">{job.description}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {money(job) && <span>{money(job)}</span>}
                {job.experienceLevel && <span>{job.experienceLevel.replace("_", " ").toLowerCase()}</span>}
                {job.createdAt && <span>{timeAgo(job.createdAt)}</span>}
              </div>
              {job.skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {job.skills.map((s) => (
                    <span key={s} className="rounded-full bg-input/50 px-2 py-0.5 text-xs">{s}</span>
                  ))}
                </div>
              )}
            </article>
          ))}
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button variant="outline" size="sm" disabled={loading || page <= 1} onClick={() => goPage(page - 1)}>
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">Page {page} of {pages}</span>
              <Button variant="outline" size="sm" disabled={loading || page >= pages} onClick={() => goPage(page + 1)}>
                Next
              </Button>
            </div>
          )}
        </section>
      </div>
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent>
          {detail && (() => {
            const { matched, missing } = matchBreakdown(detail.job.skills, userSkills)
            return (
              <>
                <DialogHeader>
                  <DialogTitle>{detail.score}% match</DialogTitle>
                  <DialogDescription>{detail.job.title}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 text-sm">
                  <p>
                    You have {matched.length} of the {detail.job.skills.length} skills this job asks for.
                  </p>
                  {matched.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="font-medium">Skills you have</p>
                      <div className="flex flex-wrap gap-1.5">
                        {matched.map((s) => (
                          <span key={s} className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-500">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {missing.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="font-medium">Skills you lack</p>
                      <div className="flex flex-wrap gap-1.5">
                        {missing.map((s) => (
                          <span key={s} className="rounded-full bg-rose-500/15 px-2 py-0.5 text-xs text-rose-500">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <p className="font-medium">Tips to apply</p>
                    <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                      {detail.score >= 80 ? (
                        <li>Strong fit. Apply early and lead your proposal with your closest past project.</li>
                      ) : detail.score >= 50 ? (
                        <li>Decent fit. Stress the skills you have and show how you would close the gaps.</li>
                      ) : (
                        <li>Weak fit. Apply only if you can show related experience for the missing skills.</li>
                      )}
                      {missing.length > 0 && (
                        <li>Mention any related experience for {missing.slice(0, 3).join(", ")} in your cover letter.</li>
                      )}
                      <li>Answer the client&apos;s screening questions specifically instead of reusing a generic reply.</li>
                    </ul>
                  </div>
                </div>
                <DialogFooter>
                  <Button asChild>
                    <a href={jobUrl(detail.job.id)} target="_blank" rel="noopener noreferrer">View on Upwork</a>
                  </Button>
                </DialogFooter>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as scanner</DialogTitle>
            <DialogDescription>
              Saves &ldquo;{keyword}&rdquo; and your current filters, except the skill filter, as a
              scanner. You can add the cover letter and other settings later from its edit page.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="Scanner name"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveScanner()}
          />
          <Checkbox
            checked={startNow && !atLimit}
            onChange={(v) => !atLimit && setStartNow(v)}
            label="Start scanning right away"
          />
          {atLimit && (
            <p className="text-sm text-muted-foreground">
              Free plan allows up to 2 active scanners, so this one will be saved as a draft.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>Cancel</Button>
            <Button onClick={saveScanner} disabled={saving || !saveName.trim()}>
              {saving && <Loader2 className="animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
