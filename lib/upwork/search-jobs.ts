import type { SupabaseClient } from "@supabase/supabase-js"
import { BROWSER_UA, fetchUpworkWithAuth } from "@/lib/upwork/token"

const RICH_FIELDS = `
        createdDateTime
        experienceLevel
        amount { rawValue }
        hourlyBudgetMin { rawValue }
        hourlyBudgetMax { rawValue }
        skills { name prettyName }`

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

// all=true returns rich job cards; otherwise the slim list the test-job picker uses
export async function searchJobs(
  supabase: SupabaseClient,
  userId: string,
  keyword: string,
  all: boolean,
  extra: Record<string, unknown> = {},
  page = { after: 0, first: 50 }
): Promise<{ status: number; body: any }> {
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("access_token, refresh_token")
    .eq("user_id", userId)
    .single()

  if (!profile?.access_token) {
    return { status: 400, body: { error: "Upwork not connected" } }
  }

  const res = await fetchUpworkWithAuth(
    supabase,
    userId,
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
              ...extra,
              pagination_eq: { after: String(page.after), first: page.first },
            },
            sortAttributes: [{ field: "RECENCY" }],
          },
        }),
      })
  )

  const json = await res.json().catch(() => null)

  if (!res.ok || json?.errors) {
    console.error("Upwork job search failed", res.status, JSON.stringify(json?.errors))
    return { status: 502, body: { error: "Failed to search jobs" } }
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
        category: null, // ponytail: search result category is not the ontology subcategory id; filter hides itself
        skills: (n.skills ?? [])
          .map((s: any) => s.prettyName ?? s.name)
          .filter(Boolean),
      }
    })
    return { status: 200, body: { jobs, totalCount: result?.totalCount ?? jobs.length } }
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

  return { status: 200, body: { jobs } }
}
