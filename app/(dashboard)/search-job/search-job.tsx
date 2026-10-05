"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Search } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
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
}: {
  skillsText: string | null
  email: string
  phone: string
}) {
  const [input, setInput] = useState("")
  const [keyword, setKeyword] = useState("") // keyword of the last completed search
  const [jobs, setJobs] = useState<SearchJob[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<JobFilters>(EMPTY_FILTERS)
  const [sort, setSort] = useState<"match" | "newest">("match")
  const [categories, setCategories] = useState<UpworkCategory[]>([])

  const router = useRouter()
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveName, setSaveName] = useState("")
  const [saving, setSaving] = useState(false)

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
    const { data, error } = await supabase
      .from("user_scan_config")
      .insert({
        user_id: userData.user.id,
        name,
        keyword,
        contract_type: filters.contractType.length ? filters.contractType : null,
        budget_min: filters.budgetMin,
        budget_max: filters.budgetMax,
        hourly_rate_min: filters.hourlyMin,
        hourly_rate_max: filters.hourlyMax,
        experience_level: filters.experience || null,
        category: filters.category || null,
        email: email || null,
        whatsapp: phone || null,
        status: "Draft",
      })
      .select("id")
      .single()
    if (error || !data) {
      setSaving(false)
      toast.error(error?.message ?? "Failed to save scanner")
      return
    }
    router.push(`/job-scanner/${data.id}/edit`)
  }

  const userSkills = useMemo(() => parseSkills(skillsText), [skillsText])

  useEffect(() => {
    fetch("/api/upwork/categories")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setCategories(j?.categories ?? []))
      .catch(() => {})
  }, [])

  async function search(e: React.FormEvent) {
    e.preventDefault()
    const k = input.trim()
    if (!k) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/upwork/jobs-search?keyword=${encodeURIComponent(k)}&all=1`)
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setError(
          res.status === 400
            ? "Upwork is not connected. Reconnect it in Settings."
            : "Search failed. Try again."
        )
        return
      }
      setJobs(json?.jobs ?? [])
      setKeyword(k)
      setFilters(EMPTY_FILTERS)
    } finally {
      setLoading(false)
    }
  }

  const set = <K extends keyof JobFilters>(key: K, v: JobFilters[K]) =>
    setFilters((f) => ({ ...f, [key]: v }))

  const visible = useMemo(() => {
    const scored = applyFilters(jobs ?? [], filters).map((job) => ({
      job,
      score: matchScore(job.skills, userSkills),
    }))
    if (sort === "match") scored.sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
    return scored
  }, [jobs, filters, userSkills, sort])

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
    <div className="space-y-6 p-6">
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
            <NativeSelect
              value={filters.experience}
              onChange={(v) => set("experience", v)}
              placeholder="Any"
              options={EXPERIENCE_LEVELS}
            />
          </div>
          {hasCategoryData && (
            <div className="space-y-2">
              <Label>Category</Label>
              <NativeSelect
                value={filters.category}
                onChange={(v) => set("category", v)}
                placeholder="Any"
                options={categoryOptions}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label>Skill</Label>
            <Input placeholder="e.g. react" value={filters.skill} onChange={(e) => set("skill", e.target.value)} />
          </div>
          <Button variant="outline" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
            Clear filters
          </Button>
        </aside>

        <section className="min-w-0 flex-1 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {visible.length} of {jobs.length} jobs for &ldquo;{keyword}&rdquo;
            </p>
            <div className="flex items-center gap-2">
              <NativeSelect
                value={sort}
                onChange={(v) => setSort(v as "match" | "newest")}
                placeholder="Sort"
                options={[
                  { value: "match", label: "Best match" },
                  { value: "newest", label: "Newest" },
                ]}
              />
              <Button onClick={() => { setSaveName(keyword); setSaveOpen(true) }}>
                Save as scanner
              </Button>
            </div>
          </div>

          {visible.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground">No jobs found</p>
          )}

          {visible.map(({ job, score }) => (
            <article key={job.id} className="space-y-2 rounded-2xl border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-medium">{job.title}</h3>
                {score !== null && (
                  <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-medium", matchScoreStyle(score))}>
                    {score}% match
                  </span>
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
        </section>
      </div>
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as scanner</DialogTitle>
            <DialogDescription>
              Saves &ldquo;{keyword}&rdquo; and your current filters as a draft scanner. You
              will add the cover letter and other settings next.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="Scanner name"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveScanner()}
          />
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
