import { createClient } from "@/lib/supabase/server"
import { extJson } from "@/lib/ext-cors"

const DAILY_LIMIT = { free: 10, paid: 100 }

const UNAVAILABLE = "The service is having problems. Please try again."

// Origin + session check; with `kind`, also fails with 429 when the daily limit is used up.
// Fails closed (503) if the usage table cannot be read: the limit exists for cost control.
// Call recordUsage() right before the expensive work so rejected requests are not charged.
export async function extGuard(req: Request, kind?: "proposal" | "profile") {
  // Chrome omits Origin on GET requests from extension pages, so Origin alone cannot identify
  // the extension. A custom header cannot be sent cross-site without a preflight, and the
  // preflight only succeeds for EXTENSION_ORIGIN (see ext-cors.ts); a present Origin must match.
  const origin = req.headers.get("origin")
  const fromExtension =
    req.headers.get("x-colosal-ext") === "1" && (origin === null || origin === process.env.EXTENSION_ORIGIN)
  if (!process.env.EXTENSION_ORIGIN || !fromExtension) {
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
    const { count, error } = await supabase
      .from("ext_usage")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", since)
    if (error || count === null) {
      console.error("ext_usage count failed", error)
      return { error: extJson(req, { error: UNAVAILABLE }, 503) }
    }
    if (count >= limit) {
      return {
        error: extJson(req, { error: `Daily limit of ${limit} requests reached. Try again tomorrow.` }, 429),
      }
    }
  }

  return { supabase, user }
}

// ponytail: count-then-insert is not atomic; a burst can overshoot the limit by a few calls.
export async function recordUsage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  kind: "proposal" | "profile"
) {
  const { error } = await supabase.from("ext_usage").insert({ user_id: userId, kind })
  if (error) console.error("ext_usage insert failed", error)
}
