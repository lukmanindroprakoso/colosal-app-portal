# Search Job Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Search Job" page where a user searches Upwork jobs by keyword, narrows results with live sidebar filters, sees a skills-overlap match score, and saves the search as a Draft scanner config.

**Architecture:** `/api/upwork/jobs-search` gets an `all=1` mode returning rich job cards. A pure module `lib/search-job/core.ts` holds types, filtering and match score (with an assert-based self-check). A client component on `/search-job` fetches once per Search click, filters and scores client-side, and inserts a `Draft` `user_scan_config` row through the browser Supabase client, then redirects to the existing edit form.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind v4, Supabase, shadcn/ui, lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-05-search-job-design.md`

## Global Constraints

- Next.js 16 has breaking changes: before writing Next-specific code, skim `node_modules/next/dist/docs/` for the pages you touch (server `page.tsx` with async `params`/`searchParams`, `"use client"` components).
- Server code uses `lib/supabase/server.ts`; `"use client"` code uses `lib/supabase/client.ts`.
- Path alias `@/` maps to repo root.
- Enum values: `contract_type` is `FIXED` | `HOURLY`; `experience_level` is `ENTRY_LEVEL` | `INTERMEDIATE` | `EXPERT`.
- Saved scanner status is exactly `"Draft"`.
- Without `all=1` the `jobs-search` response stays `{ jobs: [{ id, title, description }] }` (used by the form's test-job picker).
- Max 50 results per search, recency order.
- Run `npm run typecheck` and `npm run lint` before each commit. Do not touch the existing uncommitted files unless a task lists them.
- UI copy is English, matching the rest of the app.

## Review Focus

- Job with no skills, or user with empty `skills_text`: no score badge, job still listed, no crash (Task 2).
- Skill name case and whitespace differences ("React " vs "react"): still match (Task 2).
- Job with null budget/hourly data when a rate filter is set: excluded, not crash (Task 2).
- Both hourly and budget filters set: job passes if it qualifies under either (Task 2).
- Upwork not connected (400) or Upwork failure (502): inline error, not a blank page (Task 4).
- Save with empty name or while a save is in flight: blocked, no duplicate Draft rows (Task 5).

---

## File Structure

- Create `lib/search-job/core.ts`: types `SearchJob`, `JobFilters`; `parseSkills`, `matchScore`, `applyFilters`, `matchScoreStyle`; self-check.
- Modify `app/api/upwork/jobs-search/route.ts`: `all=1` mode, richer query fields.
- Modify `components/layout/app-sidebar.tsx`: nav item.
- Create `app/(dashboard)/search-job/page.tsx`: server page, loads profile defaults.
- Create `app/(dashboard)/search-job/search-job.tsx`: client UI (search bar, filter sidebar, cards, save dialog).

Skills filter note: the saved `user_scan_config.skills` column stores `{id, preferredLabel}` and search results only carry skill names, so the skills filter narrows results but is not saved to the scanner. Every other active filter is saved.

---

### Task 1: Rich jobs-search API

**Files:**
- Modify: `app/api/upwork/jobs-search/route.ts`

**Interfaces:**
- Consumes: existing `fetchUpworkWithAuth`.
- Produces: `GET /api/upwork/jobs-search?keyword=<k>&all=1` returns `{ jobs: SearchJobDTO[], totalCount: number }` where
  `SearchJobDTO = { id: string; title: string; description: string; createdAt: string | null; contractType: "FIXED" | "HOURLY" | null; amount: number | null; hourlyMin: number | null; hourlyMax: number | null; experienceLevel: string | null; category: string | null; skills: string[] }`.
  `category` is the subcategory id if Upwork returns one, else `null`. Without `all=1`, unchanged `{ jobs: [{id,title,description}] }`.

- [ ] **Step 1: Extend the GraphQL node selection**

Replace the `node { ... }` block in `QUERY` with:

```graphql
      node {
        title
        description
        ciphertext
        createdDateTime
        experienceLevel
        amount { rawValue }
        hourlyBudgetMin { rawValue }
        hourlyBudgetMax { rawValue }
        skills { name prettyName }
        classification {
          subCategory { id }
        }
        job {
          contractorSelection {
            proposalRequirement {
              screeningQuestions { question }
            }
          }
        }
      }
```

Field names come from the Upwork `MarketplaceJobPosting` type and must be verified in Step 4.

- [ ] **Step 2: Branch on `all=1` in the handler**

Replace the keyword read and the final `edges`/`jobs` mapping. Change:

```ts
  const keyword = new URL(request.url).searchParams.get("keyword")?.trim()
  if (!keyword) return NextResponse.json({ jobs: [] })
```

to:

```ts
  const params = new URL(request.url).searchParams
  const keyword = params.get("keyword")?.trim()
  const all = params.get("all") === "1"
  if (!keyword) return NextResponse.json({ jobs: [] })
```

and replace everything from `const edges = ...` to the end of the function with:

```ts
  const result = json?.data?.marketplaceJobPostingsSearch
  const edges = result?.edges ?? []

  if (all) {
    const num = (v: unknown) => (v == null || v === "" ? null : Number(v))
    const jobs = edges.map((e: any) => {
      const n = e.node
      const hourlyMin = num(n.hourlyBudgetMin?.rawValue)
      const hourlyMax = num(n.hourlyBudgetMax?.rawValue)
      const amount = num(n.amount?.rawValue)
      const contractType =
        hourlyMin != null || hourlyMax != null
          ? "HOURLY"
          : amount != null && amount > 0
            ? "FIXED"
            : null
      return {
        id: n.ciphertext,
        title: n.title,
        description: n.description,
        createdAt: n.createdDateTime ?? null,
        contractType,
        amount,
        hourlyMin,
        hourlyMax,
        experienceLevel: n.experienceLevel ?? null,
        category: n.classification?.subCategory?.id ?? null,
        skills: (n.skills ?? [])
          .map((s: any) => s.prettyName ?? s.name)
          .filter(Boolean),
      }
    })
    return NextResponse.json({ jobs, totalCount: result?.totalCount ?? jobs.length })
  }

  const jobs = edges
    .filter(
      (e: any) =>
        (e.node?.job?.contractorSelection?.proposalRequirement?.screeningQuestions ?? [])
          .length > 0
    )
    .map((e: any) => ({
      id: e.node.ciphertext,
      title: e.node.title,
      description: e.node.description,
    }))

  return NextResponse.json({ jobs })
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Verify against real Upwork**

Run `npm run dev`, log in with an Upwork-connected account, and in the browser console run:

```js
fetch("/api/upwork/jobs-search?keyword=react&all=1").then(r => r.json()).then(j => console.log(j.jobs[0], j.totalCount))
```

Expected: an object with filled `skills`, `experienceLevel`, and either `hourlyMin/Max` or `amount`. If the response is a 502, read the dev-server log line `Upwork job search failed ...` for the field name Upwork rejected, remove or rename that field in the query and DTO mapping, and rerun. If `category` stays `null` for every job, leave it: the category filter then hides itself (Task 4).
Also confirm the old picker call still works: `fetch("/api/upwork/jobs-search?keyword=react")` returns `{ jobs: [{id,title,description}] }`.

- [ ] **Step 5: Commit**

```bash
git add app/api/upwork/jobs-search/route.ts
git commit -m "feat: rich job cards from jobs-search with all=1"
```

---

### Task 2: Core module (types, filters, match score)

**Files:**
- Create: `lib/search-job/core.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (all exported from `lib/search-job/core.ts`):
  - `interface SearchJob` (same shape as `SearchJobDTO` in Task 1).
  - `interface JobFilters { hourlyMin: number | null; hourlyMax: number | null; budgetMin: number | null; budgetMax: number | null; experience: string | null; contractType: string[]; category: string | null; skill: string }`
  - `const EMPTY_FILTERS: JobFilters`
  - `parseSkills(text: string | null): string[]`
  - `matchScore(jobSkills: string[], userSkills: string[]): number | null`
  - `applyFilters(jobs: SearchJob[], f: JobFilters): SearchJob[]`
  - `matchScoreStyle(score: number): string`

- [ ] **Step 1: Write the module with its self-check**

```ts
export interface SearchJob {
  id: string
  title: string
  description: string
  createdAt: string | null
  contractType: "FIXED" | "HOURLY" | null
  amount: number | null
  hourlyMin: number | null
  hourlyMax: number | null
  experienceLevel: string | null
  category: string | null
  skills: string[]
}

export interface JobFilters {
  hourlyMin: number | null
  hourlyMax: number | null
  budgetMin: number | null
  budgetMax: number | null
  experience: string | null
  contractType: string[]
  category: string | null
  skill: string
}

export const EMPTY_FILTERS: JobFilters = {
  hourlyMin: null,
  hourlyMax: null,
  budgetMin: null,
  budgetMax: null,
  experience: null,
  contractType: [],
  category: null,
  skill: "",
}

const norm = (s: string) => s.trim().toLowerCase()

export function parseSkills(text: string | null): string[] {
  return (text ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

// percent of the job's skills that the user has; null when it can't be computed
export function matchScore(jobSkills: string[], userSkills: string[]): number | null {
  if (!jobSkills.length || !userSkills.length) return null
  const mine = new Set(userSkills.map(norm))
  const hits = jobSkills.filter((s) => mine.has(norm(s))).length
  return Math.round((100 * hits) / jobSkills.length)
}

function inRange(v: number | null, min: number | null, max: number | null): boolean {
  if (v == null) return false
  return (min == null || v >= min) && (max == null || v <= max)
}

export function applyFilters(jobs: SearchJob[], f: JobFilters): SearchJob[] {
  const hourlySet = f.hourlyMin != null || f.hourlyMax != null
  const budgetSet = f.budgetMin != null || f.budgetMax != null
  const skill = norm(f.skill)
  return jobs.filter((j) => {
    if (hourlySet || budgetSet) {
      // a rate filter implies that contract type, like Upwork's own filters
      const hourlyOk =
        hourlySet &&
        j.contractType === "HOURLY" &&
        // job's hourly range must overlap the requested range
        (f.hourlyMax == null || (j.hourlyMin ?? j.hourlyMax ?? Infinity) <= f.hourlyMax) &&
        (f.hourlyMin == null || (j.hourlyMax ?? j.hourlyMin ?? -Infinity) >= f.hourlyMin)
      const budgetOk =
        budgetSet && j.contractType === "FIXED" && inRange(j.amount, f.budgetMin, f.budgetMax)
      if (!hourlyOk && !budgetOk) return false
    }
    if (f.experience && j.experienceLevel !== f.experience) return false
    if (f.contractType.length && (!j.contractType || !f.contractType.includes(j.contractType)))
      return false
    if (f.category && j.category !== f.category) return false
    if (skill && !j.skills.some((s) => norm(s).includes(skill))) return false
    return true
  })
}

export function matchScoreStyle(score: number): string {
  if (score >= 80) return "bg-emerald-500/15 text-emerald-500"
  if (score >= 50) return "bg-amber-500/15 text-amber-500"
  return "bg-rose-500/15 text-rose-500"
}

// self-check: node --experimental-strip-types lib/search-job/core.ts
if (typeof process !== "undefined" && process.argv?.[1]?.endsWith("search-job/core.ts")) {
  const assert = (c: boolean, m: string) => {
    if (!c) throw new Error("FAIL: " + m)
  }
  assert(matchScore(["React", "Node"], ["react ", "css"]) === 50, "case/space-insensitive match")
  assert(matchScore([], ["react"]) === null, "no job skills gives null")
  assert(matchScore(["React"], parseSkills("")) === null, "no user skills gives null")
  assert(parseSkills("a, b,,c ").join("|") === "a|b|c", "parseSkills trims and drops empties")

  const base: SearchJob = {
    id: "1", title: "t", description: "d", createdAt: null, contractType: null,
    amount: null, hourlyMin: null, hourlyMax: null, experienceLevel: null,
    category: null, skills: [],
  }
  const hourly = { ...base, id: "h", contractType: "HOURLY" as const, hourlyMin: 20, hourlyMax: 40 }
  const fixed = { ...base, id: "f", contractType: "FIXED" as const, amount: 500 }
  const nodata = { ...base, id: "n" }
  const ids = (f: Partial<JobFilters>) =>
    applyFilters([hourly, fixed, nodata], { ...EMPTY_FILTERS, ...f }).map((j) => j.id).join("")

  assert(ids({}) === "hfn", "no filters keeps all")
  assert(ids({ hourlyMin: 30 }) === "h", "hourly filter keeps overlapping hourly only")
  assert(ids({ hourlyMin: 50 }) === "", "hourly range above job excludes it")
  assert(ids({ budgetMax: 1000 }) === "f", "budget filter keeps fixed only")
  assert(ids({ budgetMax: 100 }) === "", "budget below amount excludes it")
  assert(ids({ hourlyMin: 30, budgetMax: 1000 }) === "hf", "both rate filters are an OR")
  assert(ids({ contractType: ["FIXED"] }) === "f", "contract type filter")
  console.log("search-job core: all checks passed")
}
```

- [ ] **Step 2: Run the self-check**

Run: `node --experimental-strip-types lib/search-job/core.ts`
Expected: `search-job core: all checks passed`. If an assertion fails, fix the logic, not the assertion.

- [ ] **Step 3: Typecheck and lint**

Run: `npm run typecheck; npm run lint`
Expected: PASS (if lint flags `process`, keep the `typeof process` guard and add `// eslint-disable-next-line` on that line only).

- [ ] **Step 4: Commit**

```bash
git add lib/search-job/core.ts
git commit -m "feat: search-job filters and skills-overlap match score"
```

---

### Task 3: Sidebar item and page shell

**Files:**
- Modify: `components/layout/app-sidebar.tsx:5,15`
- Create: `app/(dashboard)/search-job/page.tsx`
- Create: `app/(dashboard)/search-job/search-job.tsx` (stub, filled in Task 4)

**Interfaces:**
- Produces: `<SearchJob skillsText={string|null} email={string} phone={string} />` default-less named export `SearchJobClient` from `search-job.tsx`:
  `export function SearchJobClient(props: { skillsText: string | null; email: string; phone: string }): JSX.Element`

- [ ] **Step 1: Add the nav item**

In `components/layout/app-sidebar.tsx` add `Search` to the lucide import and this entry after Job Scanner:

```tsx
import { LayoutDashboard, Settings, TrendingUp, Radar, Search, PanelLeftClose, PanelLeftOpen } from "lucide-react"
```
```tsx
      { href: "/search-job", label: "Search Job", icon: Search },
```

- [ ] **Step 2: Create the server page**

`app/(dashboard)/search-job/page.tsx`:

```tsx
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
```

- [ ] **Step 3: Create the stub client**

`app/(dashboard)/search-job/search-job.tsx`:

```tsx
"use client"

export function SearchJobClient(_props: {
  skillsText: string | null
  email: string
  phone: string
}) {
  return <div className="p-6">Search Job</div>
}
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck`, then `npm run dev` and open `/search-job`.
Expected: page renders "Search Job" inside the dashboard layout, sidebar item highlights when active.

- [ ] **Step 5: Commit**

```bash
git add components/layout/app-sidebar.tsx "app/(dashboard)/search-job"
git commit -m "feat: search job page shell and sidebar item"
```

---

### Task 4: Search UI (search bar, filter sidebar, result cards)

**Files:**
- Modify: `app/(dashboard)/search-job/search-job.tsx` (replace stub)

**Interfaces:**
- Consumes: `SearchJob`, `JobFilters`, `EMPTY_FILTERS`, `parseSkills`, `matchScore`, `applyFilters`, `matchScoreStyle` from `@/lib/search-job/core`; `NativeSelect`, `Checkbox`, `EXPERIENCE_LEVELS` from `../job-scanner/scanner-form`; `timeAgo` from `../job-scanner/scanner-format`; `/api/upwork/jobs-search?keyword=&all=1`; `/api/upwork/categories`.
- Produces: component state `jobs`, `filters`, `keyword` (searched keyword) consumed by Task 5's save button.

- [ ] **Step 1: Replace the stub with the full UI (without save)**

```tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, Search } from "lucide-react"
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
              {/* Save as scanner button added in Task 5 */}
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
                <span>{timeAgo(job.createdAt)}</span>
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
    </div>
  )
}
```

`timeAgo(null)` is already handled by the helper's `string | null` signature; confirm its output for `null` reads sensibly, otherwise render nothing when `createdAt` is null.

- [ ] **Step 2: Typecheck and lint**

Run: `npm run typecheck; npm run lint`
Expected: PASS.

- [ ] **Step 3: Manual check**

Run `npm run dev`, open `/search-job`. Expected:
- Centered search bar only. Searching "react" shows cards with match badges, sidebar filters on the left.
- Typing in Hourly min or Skill narrows the list instantly with no network call (check the Network tab).
- Sort "Best match" puts high scores first; "Newest" restores API order.
- A user with no Upwork connection sees the inline "Upwork is not connected" message.
- Empty filter result shows "No jobs found".

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/search-job/search-job.tsx"
git commit -m "feat: search job results with live filters and match score"
```

---

### Task 5: Save as scanner

**Files:**
- Modify: `app/(dashboard)/search-job/search-job.tsx`

**Interfaces:**
- Consumes: Task 4 state (`keyword`, `filters`), props `email`, `phone`; `createClient` from `@/lib/supabase/client`; `Dialog*` from `@/components/ui/dialog`; `toast` from `sonner`; `useRouter` from `next/navigation`.
- Produces: inserts a `Draft` `user_scan_config` row, then `router.push("/job-scanner/<id>/edit")`.

- [ ] **Step 1: Add imports and state**

Add imports:

```tsx
import { useRouter } from "next/navigation"
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
```

Change the component signature to destructure all props: `{ skillsText, email, phone }`. Inside the component add:

```tsx
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
```

`saving` stays `true` on success so the button stays disabled during navigation.

- [ ] **Step 2: Add the button and dialog**

Replace the `{/* Save as scanner button added in Task 5 */}` comment with:

```tsx
              <Button onClick={() => { setSaveName(keyword); setSaveOpen(true) }}>
                Save as scanner
              </Button>
```

and add before the closing `</div>` of the root results wrapper:

```tsx
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
```

- [ ] **Step 3: Typecheck and lint**

Run: `npm run typecheck; npm run lint`
Expected: PASS.

- [ ] **Step 4: Manual end-to-end check**

Run `npm run dev`. Search "react", set Hourly min 30 and Experience "Expert", click "Save as scanner", name it, Save.
Expected: redirect to `/job-scanner/<id>/edit`; form shows the keyword, hourly min 30 and Expert prefilled; the scanner appears in `/job-scanner` with status Draft; an empty name keeps Save disabled; double-clicking Save creates one row.
Also confirm a free-plan account with 2 active scanners can still save (Draft is not blocked).

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/search-job/search-job.tsx"
git commit -m "feat: save job search as draft scanner"
```
