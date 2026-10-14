import { extGuard } from "@/lib/ext-auth"
import { extJson, extOptions } from "@/lib/ext-cors"

// Same columns the onboarding step and Settings page edit; this route only writes these three.
const LIMITS = { summary: 6000, current_role: 300, skills_text: 2000 } as const
type Field = keyof typeof LIMITS

export async function OPTIONS(req: Request) {
  return extOptions(req)
}

export async function POST(req: Request) {
  const g = await extGuard(req)
  if ("error" in g) return g.error

  const body = await req.json().catch(() => null)
  const patch: Partial<Record<Field, string>> = {}
  for (const key of Object.keys(LIMITS) as Field[]) {
    const v = body?.[key]
    if (v === undefined) continue
    if (typeof v !== "string" || v.length > LIMITS[key]) {
      return extJson(req, { error: `Invalid value for ${key}.` }, 400)
    }
    patch[key] = v.trim()
  }
  if (Object.keys(patch).length === 0) return extJson(req, { error: "Nothing to save." }, 400)

  const { data: previous } = await g.supabase
    .from("user_profiles")
    .select("summary, current_role, skills_text")
    .eq("user_id", g.user.id)
    .maybeSingle()
  if (!previous) return extJson(req, { error: "Colosal profile not found." }, 404)

  const { error } = await g.supabase.from("user_profiles").update(patch).eq("user_id", g.user.id)
  if (error) {
    console.error("save profile failed", error)
    return extJson(req, { error: "Failed to save your profile. Please try again." }, 500)
  }

  return extJson(req, { saved: true, previous })
}
