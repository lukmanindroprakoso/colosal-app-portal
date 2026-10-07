import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ScannerForm, type ScanConfig } from "../../scanner-form"

export default async function EditScannerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: config } = await supabase
    .from("user_scan_config")
    .select("*")
    .eq("id", id)
    .single()

  if (!config) notFound()

  const initial: ScanConfig = {
    id: config.id,
    name: config.name,
    keyword: config.keyword,
    contract_type: config.contract_type,
    budget_min: config.budget_min,
    budget_max: config.budget_max,
    hourly_rate_min: config.hourly_rate_min,
    hourly_rate_max: config.hourly_rate_max,
    skills: Array.isArray(config.skills)
      ? config.skills
          .map((s: unknown) => {
            if (typeof s === "string") return { id: "", preferredLabel: s }
            const obj = s as { id?: string; preferredLabel?: string; label?: string }
            const preferredLabel = obj?.preferredLabel ?? obj?.label ?? ""
            return preferredLabel ? { id: obj?.id ?? "", preferredLabel } : null
          })
          .filter(
            (s: { id: string; preferredLabel: string } | null): s is { id: string; preferredLabel: string } =>
              s !== null
          )
      : [],
    experience_level: config.experience_level,
    category: config.category,
    client_hire_rate: config.client_hire_rate,
    proposal_template_id: config.proposal_template_id,
    question_instruction: config.question_instruction,
    question_answer_base: config.question_answer_base,
    attachments: Array.isArray(config.attachments) ? config.attachments : [],
    notif_email: config.notif_email ?? false,
    email: config.email,
    notif_whatsapp: config.notif_whatsapp ?? false,
    whatsapp: config.whatsapp,
    notif_telegram: config.notif_telegram ?? false,
    status: config.status,
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("telegram_chat_id")
    .eq("user_id", config.user_id)
    .single()

  return <ScannerForm initial={initial} telegramConnected={Boolean(profile?.telegram_chat_id)} />
}
