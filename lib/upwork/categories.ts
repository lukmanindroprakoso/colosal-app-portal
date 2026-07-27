import type { SupabaseClient } from "@supabase/supabase-js"
import { BROWSER_UA, fetchUpworkWithAuth } from "./token"

const QUERY = `query { ontologyCategories { id preferredLabel slug subcategories { id preferredLabel } } }`

export interface UpworkCategory {
  id: string
  preferredLabel: string
  slug: string
  subcategories: { id: string; preferredLabel: string }[]
}

export async function fetchUpworkCategories(
  supabase: SupabaseClient,
  userId: string,
  accessToken: string,
  refreshToken: string | null
): Promise<UpworkCategory[]> {
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
  return json?.data?.ontologyCategories ?? []
}
