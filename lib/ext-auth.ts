import { createClient } from "@/lib/supabase/server"
import { extJson } from "@/lib/ext-cors"

const DAILY_LIMIT = { free: 10, paid: 100 }

// Origin + session check; with `kind`, also enforces and records the daily limit.
// ponytail: count-then-insert is not atomic; a burst can overshoot the limit by a few calls.
export async function extGuard(req: Request, kind?: "proposal" | "profile") {
  if (req.headers.get("origin") !== process.env.EXTENSION_ORIGIN) {
    return { error: extJson(req, { error: "Forbidden" }, 403) }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: extJson(req, { error: "Unauthorized" }, 401) }

  if (kind) {
    const { data: sub } = await supabase
      .from("user_subscriptions")
      .select("plan, status")
      .eq("user_id", user.id)
      .maybeSingle()
    const limit = sub?.plan === "paid" && sub.status !== "cancelled" ? DAILY_LIMIT.paid : DAILY_LIMIT.free

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from("ext_usage")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", since)
    if ((count ?? 0) >= limit) {
      return {
        error: extJson(req, { error: `Batas ${limit} permintaan per hari tercapai. Coba lagi besok.` }, 429),
      }
    }
    await supabase.from("ext_usage").insert({ user_id: user.id, kind })
  }

  return { supabase, user }
}
