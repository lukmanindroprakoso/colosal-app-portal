"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Mail, MessageCircle, Send } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { track } from "@/lib/analytics"

type Channel = "notif_email" | "notif_whatsapp" | "notif_telegram"

export function NotificationToggles({
  id,
  values,
  email,
  whatsapp,
  isPaid,
  telegramConnected,
}: {
  id: string
  values: Record<Channel, boolean>
  email: string | null
  whatsapp: string | null
  isPaid: boolean
  telegramConnected: boolean
}) {
  const router = useRouter()
  const [on, setOn] = useState(values)
  const [saving, setSaving] = useState<Channel | null>(null)

  async function toggle(channel: Channel, next: boolean) {
    // turning off is always allowed; turning on needs the channel to be usable
    if (next) {
      if (channel === "notif_email" && !email) return toast.error("Add an email in Edit first")
      if (channel === "notif_whatsapp") {
        if (!isPaid) return toast.error("WhatsApp notifications are available on the paid plan")
        if (!whatsapp) return toast.error("Add a WhatsApp number in Edit first")
      }
      if (channel === "notif_telegram" && !telegramConnected)
        return toast.error("Telegram is not connected yet", {
          action: { label: "Settings", onClick: () => router.push("/settings") },
        })
    }
    setSaving(channel)
    const { error } = await createClient().from("user_scan_config").update({ [channel]: next }).eq("id", id)
    setSaving(null)
    if (error) {
      toast.error(error.message.startsWith("WHATSAPP_PAID_ONLY") ? "WhatsApp notifications require a paid plan" : error.message)
      return
    }
    setOn((o) => ({ ...o, [channel]: next }))
    track("scanner_notification_toggle", { channel, on: next })
    router.refresh()
  }

  const rows: { channel: Channel; icon: typeof Mail; label: string }[] = [
    { channel: "notif_email", icon: Mail, label: email || "No email set" },
    { channel: "notif_whatsapp", icon: MessageCircle, label: whatsapp || "No number set" },
    { channel: "notif_telegram", icon: Send, label: "Telegram" },
  ]

  return (
    <div className="flex flex-col gap-2">
      {rows.map(({ channel, icon: Icon, label }) => (
        <div key={channel} className={cn("flex items-center gap-1.5 text-sm", !on[channel] && "opacity-60")}>
          <Icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{label}</span>
          <Switch
            className="ml-auto shrink-0"
            checked={on[channel]}
            disabled={saving === channel}
            onCheckedChange={(v) => toggle(channel, v)}
          />
        </div>
      ))}
      {!isPaid && (
        <p className="text-xs text-muted-foreground">
          WhatsApp is on the paid plan.{" "}
          <Link href="/settings" className="underline">
            Learn more
          </Link>
        </p>
      )}
    </div>
  )
}
