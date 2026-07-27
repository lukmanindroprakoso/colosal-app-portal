import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Mail, MessageCircle, Pencil } from "lucide-react"
import { STATUS_STYLES } from "../scanner-format"
import { StatusToggle } from "./status-toggle"

export interface ScanConfigDetail {
  id: string
  name: string | null
  status: string
  keyword: string | null
  category: string | null
  experience_level: string | null
  contract_type: string[] | null
  budget_min: number | null
  budget_max: number | null
  hourly_rate_min: number | null
  hourly_rate_max: number | null
  skills: { id?: string; preferredLabel?: string; label?: string }[] | null
  last_scan: string | null
  next_scan: string | null
  scan_result: string | null
  notif_email: boolean
  email: string | null
  notif_whatsapp: boolean
  whatsapp: string | null
}

function formatCurrency(n: number | null): string | null {
  if (n === null || n === undefined) return null
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n)
}

function formatRange(min: number | null, max: number | null, suffix = ""): string {
  const a = formatCurrency(min)
  const b = formatCurrency(max)
  if (a && b) return `${a} - ${b}${suffix}`
  if (a) return `${a}+${suffix}`
  if (b) return `Up to ${b}${suffix}`
  return ""
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—"
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso))
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <Badge variant="outline" className="font-normal">
      <span className="text-muted-foreground">{label}:</span>&nbsp;{value}
    </Badge>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3.5">
      <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{title}</span>
      {children}
    </div>
  )
}

export function ConfigSummary({ config }: { config: ScanConfigDetail }) {
  const skillLabels = (config.skills ?? [])
    .map((s) => s.preferredLabel ?? s.label)
    .filter((label): label is string => Boolean(label))

  const filterChips: { label: string; value: string }[] = [
    { label: "Keyword", value: config.keyword ?? "" },
    { label: "Category", value: config.category ?? "" },
    { label: "Experience", value: config.experience_level ?? "" },
    {
      label: "Contract",
      value: config.contract_type && config.contract_type.length > 0 ? config.contract_type.join(", ") : "",
    },
    { label: "Budget", value: formatRange(config.budget_min, config.budget_max) },
    { label: "Hourly", value: formatRange(config.hourly_rate_min, config.hourly_rate_max, "/hour") },
  ].filter((c) => c.value)

const scanFailed = config.scan_result ? /fail|error/i.test(config.scan_result) : false

  return (
    <div className="sticky top-0 flex flex-col gap-4 rounded-3xl bg-card p-5 shadow-sm ring-1 ring-foreground/5 dark:ring-foreground/10">
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <StatusToggle id={config.id} status={config.status} />
          <Button asChild variant="outline" size="sm">
            <Link href={`/job-scanner/${config.id}/edit`}>
              <Pencil /> Edit
            </Link>
          </Button>
        </div>
        <p className="font-heading text-lg font-semibold">{config.name ?? "Untitled scanner"}</p>
      </div>

      {filterChips.length > 0 && (
        <Section title="Filters">
          <div className="flex flex-wrap gap-1.5">
            {filterChips.map((c) => (
              <Chip key={c.label} label={c.label} value={c.value} />
            ))}
          </div>
        </Section>
      )}

      {skillLabels.length > 0 && (
        <Section title="Skills">
          <div className="flex flex-wrap gap-1.5">
            {skillLabels.map((label) => (
              <Badge key={label} variant="outline">
                {label}
              </Badge>
            ))}
          </div>
        </Section>
      )}

      <Section title="Schedule">
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip label="Last scan" value={formatDateTime(config.last_scan)} />
          {config.scan_result ? (
            <Badge className={cn("gap-1.5", scanFailed ? STATUS_STYLES.Failed : STATUS_STYLES.Active)}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {config.scan_result}
            </Badge>
          ) : null}
          <Chip label="Next scan" value={formatDateTime(config.next_scan)} />
        </div>
      </Section>

      <Section title="Notifications">
        <div className="flex flex-col gap-2">
          <div className={cn("flex items-center gap-1.5 text-sm", !config.notif_email && "opacity-50")}>
            <Mail className="h-4 w-4 shrink-0" />
            <span className="truncate">{config.email || "No email set"}</span>
            <Badge variant={config.notif_email ? "default" : "outline"} className="ml-auto shrink-0">
              {config.notif_email ? "On" : "Off"}
            </Badge>
          </div>
          <div className={cn("flex items-center gap-1.5 text-sm", !config.notif_whatsapp && "opacity-50")}>
            <MessageCircle className="h-4 w-4 shrink-0" />
            <span className="truncate">{config.whatsapp || "No number set"}</span>
            <Badge variant={config.notif_whatsapp ? "default" : "outline"} className="ml-auto shrink-0">
              {config.notif_whatsapp ? "On" : "Off"}
            </Badge>
          </div>
        </div>
      </Section>
    </div>
  )
}
