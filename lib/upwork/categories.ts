import type { SupabaseClient } from "@supabase/supabase-js"
import { BROWSER_UA, fetchUpworkWithAuth } from "./token"

const QUERY = `query { ontologyCategories { id preferredLabel slug subcategories { id preferredLabel } } }`

export interface UpworkCategory {
  id: string
  preferredLabel: string
  slug: string
  subcategories: { id: string; preferredLabel: string }[]
}

// ponytail: per-instance memory cache, the ontology is global and rarely changes.
// Swap for unstable_cache / Runtime Cache if cold instances make it miss too often.
const TTL_MS = 60 * 60 * 1000
let cache: { at: number; data: UpworkCategory[] } | null = null

export async function fetchUpworkCategories(
  supabase: SupabaseClient,
  userId: string,
  accessToken: string,
  refreshToken: string | null
): Promise<UpworkCategory[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data

  const res = await fetchUpworkWithAuth(supabase, userId, accessToken, refreshToken, (token) =>
    fetch("https://api.upwork.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": BROWSER_UA,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query: QUERY }),
    })
  )

  const json = await res.json().catch(() => null)
  if (!res.ok || json?.errors) return []
  const data: UpworkCategory[] = json?.data?.ontologyCategories ?? []
  if (data.length) cache = { at: Date.now(), data }
  return data
}
