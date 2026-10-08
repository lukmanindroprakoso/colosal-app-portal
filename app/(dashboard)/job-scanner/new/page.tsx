import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ScannerForm, type ScanConfig } from "../scanner-form"

export default async function NewScannerPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: subscription } = await supabase
    .from("user_subscriptions")
    .select("plan, status")
    .eq("user_id", user!.id)
    .maybeSingle()

  const { count: activeCount } = await supabase
    .from("user_scan_config")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user!.id)
    .eq("status", "Active")

  const isFreePlan = (subscription?.plan ?? "free") === "free"
  if (isFreePlan && (activeCount ?? 0) >= 2) {
    redirect("/job-scanner")
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("phone, telegram_chat_id")
    .eq("user_id", user!.id)
    .single()
  const phone = profile?.phone ?? null

  const initial: Partial<ScanConfig> = {
    email: user?.email ?? "",
    whatsapp: phone ?? "",
  }

  return (
    <ScannerForm
      initial={initial as ScanConfig}
      telegramConnected={Boolean(profile?.telegram_chat_id)}
      isPaid={subscription?.plan === "paid" && subscription.status !== "cancelled"}
    />
  )
}
