import { createClient } from "@/lib/supabase/server"
import { fetchUpworkWithAuth } from "@/lib/upwork/token"
import { NextResponse } from "next/server"

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

const RICH_FIELDS = `
        createdDateTime
        experienceLevel
        amount { rawValue }
        hourlyBudgetMin { rawValue }
        hourlyBudgetMax { rawValue }
        skills { name prettyName }
        classification {
          subCategory { id }
        }`

const buildQuery = (all: boolean) => `query marketplaceJobPostingsSearch(
  $marketPlaceJobFilter: MarketplaceJobPostingsSearchFilter,
  $sortAttributes: [MarketplaceJobPostingSearchSortAttribute]
) {
  marketplaceJobPostingsSearch(
    marketPlaceJobFilter: $marketPlaceJobFilter,
    sortAttributes: $sortAttributes
  ) {
    totalCount
    edges {
      node {
        title
        description
        ciphertext${all ? RICH_FIELDS : ""}
        job {
          contractorSelection {
            proposalRequirement {
              screeningQuestions { question }
            }
          }
        }
      }
    }
  }
}`

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const params = new URL(request.url).searchParams
  const keyword = params.get("keyword")?.trim()
  const all = params.get("all") === "1"
  if (!keyword) return NextResponse.json({ jobs: [] })

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("access_token, refresh_token")
    .eq("user_id", user.id)
    .single()

  if (!profile?.access_token) {
    return NextResponse.json({ error: "Upwork not connected" }, { status: 400 })
  }

  const res = await fetchUpworkWithAuth(
    supabase,
    user.id,
    profile.access_token,
    profile.refresh_token,
    (token) =>
      fetch("https://api.upwork.com/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": BROWSER_UA,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: buildQuery(all),
          variables: {
            marketPlaceJobFilter: {
              searchExpression_eq: keyword,
              pagination_eq: { after: "0", first: 50 },
            },
            sortAttributes: [{ field: "RECENCY" }],
          },
        }),
      })
  )

  const json = await res.json().catch(() => null)

  if (!res.ok || json?.errors) {
    console.error("Upwork job search failed", res.status, JSON.stringify(json?.errors))
    return NextResponse.json({ error: "Failed to search jobs" }, { status: 502 })
  }

  const result = json?.data?.marketplaceJobPostingsSearch
  const edges = result?.edges ?? []

  if (all) {
    const num = (v: unknown) => (v == null || v === "" ? null : Number(v))
    const jobs = edges.filter((e: any) => e?.node).map((e: any) => {
      const n = e.node
      const hourlyMin = num(n.hourlyBudgetMin?.rawValue)
      const hourlyMax = num(n.hourlyBudgetMax?.rawValue)
      const amount = num(n.amount?.rawValue)
      const contractType =
        (hourlyMin ?? 0) > 0 || (hourlyMax ?? 0) > 0
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
}
