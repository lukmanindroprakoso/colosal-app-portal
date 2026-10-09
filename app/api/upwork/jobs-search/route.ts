import { createClient } from "@/lib/supabase/server"
import { searchJobs } from "@/lib/upwork/search-jobs"
import { NextResponse } from "next/server"

const PAGE_SIZE = 10
const EXPERIENCE = ["ENTRY_LEVEL", "INTERMEDIATE", "EXPERT"]

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const params = new URL(request.url).searchParams
  const keyword = params.get("keyword")?.trim()
  if (!keyword) return NextResponse.json({ jobs: [] })

  // Upwork-side filters; the client re-applies its own filters on top
  const n = (k: string) => {
    const v = params.get(k)
    return v ? Number(v) : null
  }
  const extra: Record<string, unknown> = {}
  const experience = params.get("experience")
  if (experience && EXPERIENCE.includes(experience)) extra.experienceLevel_eq = experience
  const skill = params.get("skill")?.trim()
  if (skill) extra.skillExpression_eq = skill

  const contractType = params.get("contractType")
  if (contractType === "HOURLY" || contractType === "FIXED") extra.jobType_eq = contractType

  const hourly = [n("hourlyMin"), n("hourlyMax")]
  const budget = [n("budgetMin"), n("budgetMax")]
  const hourlySet = hourly.some((v) => v != null)
  const budgetSet = budget.some((v) => v != null)
  // both set means OR on the client; Upwork would AND them, so leave it to the client
  if (hourlySet !== budgetSet) {
    const [lo, hi] = hourlySet ? hourly : budget
    extra.jobType_eq = hourlySet ? "HOURLY" : "FIXED"
    extra[hourlySet ? "hourlyRate_eq" : "budgetRange_eq"] = {
      rangeStart: lo ?? 0,
      rangeEnd: hi ?? 100000,
    }
  }

  // posting counts for the same keyword and filters. Upwork ignores daysPosted_eq, so results
  // (sorted newest first) are binary-searched for the first job older than each cutoff.
  if (params.get("stats") === "1") {
    const at = async (after: number) => {
      const r = await searchJobs(supabase, user.id, keyword, true, extra, { after, first: 1 })
      if (r.status !== 200) throw new Error("upwork")
      return r.body as { jobs: { createdAt: string | null }[]; totalCount: number }
    }
    const time = (iso: string | null) => (iso ? Date.parse(iso.replace(/([+-]\d\d)(\d\d)$/, "$1:$2")) : NaN)
    try {
      const total = (await at(0)).totalCount
      const countSince = async (cutoff: number) => {
        let lo = 0
        let hi = total // answer: number of jobs at or after the cutoff
        while (lo < hi) {
          const mid = Math.floor((lo + hi) / 2)
          const t = time((await at(mid)).jobs[0]?.createdAt ?? null)
          if (t >= cutoff) lo = mid + 1
          else hi = mid // older job, or no job at this offset
        }
        return lo
      }
      const now = Date.now()
      const [day, week] = await Promise.all([countSince(now - 864e5), countSince(now - 7 * 864e5)])
      return NextResponse.json({ day, week })
    } catch {
      return NextResponse.json({ error: "Failed to load stats" }, { status: 502 })
    }
  }

  const all = params.get("all") === "1"
  const pageNo = Math.max(1, Number(params.get("page")) || 1)
  const size = all ? PAGE_SIZE : 50
  const { status, body } = await searchJobs(supabase, user.id, keyword, all, extra, {
    after: (pageNo - 1) * size,
    first: size,
  })
  return NextResponse.json(body, { status })
}
