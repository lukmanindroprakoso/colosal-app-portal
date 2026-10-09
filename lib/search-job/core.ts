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

// which of the job's skills the user has and lacks
export function matchBreakdown(jobSkills: string[], userSkills: string[]) {
  const mine = new Set(userSkills.map(norm))
  return {
    matched: jobSkills.filter((s) => mine.has(norm(s))),
    missing: jobSkills.filter((s) => !mine.has(norm(s))),
  }
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
if (typeof process !== "undefined" && process.argv?.[1]?.replace(/\\/g, "/").endsWith("search-job/core.ts")) {
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
