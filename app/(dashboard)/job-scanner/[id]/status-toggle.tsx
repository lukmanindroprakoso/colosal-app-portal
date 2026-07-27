"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { STATUS_STYLES } from "../scanner-format"

export function StatusToggle({ id, status }: { id: string; status: string }) {
  const router = useRouter()
  const [current, setCurrent] = useState(status)
  const [saving, setSaving] = useState(false)

  if (current === "Draft") {
    return (
      <Badge className={cn("gap-1.5", STATUS_STYLES.Draft)}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        Draft
      </Badge>
    )
  }

  async function toggle(checked: boolean) {
    const next = checked ? "Active" : "Inactive"
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from("user_scan_config").update({ status: next }).eq("id", id)
    setSaving(false)

    if (error) {
      if (error.message.startsWith("SCAN_LIMIT_REACHED")) {
        toast.error("Free plan allows up to 2 active scanners", {
          description: "Upgrade to activate more.",
          action: {
            label: "Contact us",
            onClick: () => window.open("mailto:team@paistudio.dev?subject=Upgrade%20request"),
          },
        })
      } else {
        toast.error(error.message)
      }
      return
    }

    setCurrent(next)
    toast.success(next === "Active" ? "Scanner activated" : "Scanner paused")
    router.refresh()
  }

  return (
    <div className="flex items-center gap-2">
      <Badge className={cn("gap-1.5", STATUS_STYLES[current] ?? STATUS_STYLES.Inactive)}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        {current}
      </Badge>
      <Switch checked={current === "Active"} disabled={saving} onCheckedChange={toggle} />
    </div>
  )
}
