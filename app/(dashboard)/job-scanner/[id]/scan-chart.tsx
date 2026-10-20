"use client"

import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"

export interface DailyCount {
  date: string
  label: string
  count: number
}

type Mode = "7d" | "30d" | "month"

const MODES: { value: Mode; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "month", label: "Month" },
]

function dateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${m}-${day}`
}

// Inclusive start, exclusive end, both at local midnight.
function rangeFor(mode: Mode, monthOffset: number): { start: Date; end: Date } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  if (mode === "month") {
    const start = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1)
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1)
    return { start, end: end > tomorrow ? tomorrow : end }
  }
  const start = new Date(today)
  start.setDate(start.getDate() - (mode === "7d" ? 6 : 29))
  return { start, end: tomorrow }
}

async function fetchDays(scanConfigId: string, mode: Mode, monthOffset: number): Promise<DailyCount[]> {
  const { start, end } = rangeFor(mode, monthOffset)
  const supabase = createClient()

  // Paged: Supabase caps a response at 1000 rows.
  const PAGE = 1000
  const stamps: string[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("upwork_jobs")
      .select("inserted_at")
      .eq("scan_config_id", scanConfigId)
      .gte("inserted_at", start.toISOString())
      .lt("inserted_at", end.toISOString())
      .order("inserted_at", { ascending: false })
      .range(from, from + PAGE - 1)
    if (error) throw error
    stamps.push(...data.map((r) => r.inserted_at as string))
    if (data.length < PAGE) break
  }

  const counts = new Map<string, number>()
  for (const s of stamps) {
    const k = dateKey(new Date(s))
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }

  const days: DailyCount[] = []
  for (const d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    const date = dateKey(d)
    days.push({
      date,
      label:
        mode === "7d"
          ? d.toLocaleDateString("en-US", { weekday: "short" })
          : d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      count: counts.get(date) ?? 0,
    })
  }
  return days
}

export function ScanChart({ scanConfigId, days: initialDays }: { scanConfigId: string; days: DailyCount[] }) {
  const [mode, setMode] = useState<Mode>("7d")
  const [monthOffset, setMonthOffset] = useState(0)
  const [hovered, setHovered] = useState<number | null>(null)
  const [loaded, setLoaded] = useState<{ key: string; days: DailyCount[] } | null>(null)
  const [failed, setFailed] = useState(false)

  const key = `${mode}:${mode === "month" ? monthOffset : 0}`
  const useInitial = key === "7d:0" && !loaded
  const loading = !useInitial && loaded?.key !== key
  // Keep showing the previous bars while the next range loads.
  const days = useInitial ? initialDays : (loaded?.days ?? initialDays)

  useEffect(() => {
    if (key === "7d:0") return
    let cancelled = false
    fetchDays(scanConfigId, mode, monthOffset)
      .then((d) => {
        if (cancelled) return
        setFailed(false)
        setLoaded({ key, days: d })
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [key, mode, monthOffset, scanConfigId])

  const max = Math.max(1, ...days.map((d) => d.count))
  const total = days.reduce((sum, d) => sum + d.count, 0)
  const todayIso = dateKey(new Date())
  const dense = days.length > 10

  const monthLabel = rangeFor("month", monthOffset).start.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })
  const title =
    mode === "7d" ? "Jobs scanned, last 7 days" : mode === "30d" ? "Jobs scanned, last 30 days" : "Jobs scanned"

  return (
    <div className="rounded-3xl bg-card p-4 shadow-sm ring-1 ring-foreground/5 dark:ring-foreground/10">
      <div className="mb-3 flex min-h-8 flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg bg-muted p-0.5" role="tablist" aria-label="Chart range">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              role="tab"
              aria-selected={mode === m.value}
              onClick={() => {
                setMode(m.value)
                setHovered(null)
              }}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors",
                mode === m.value && "bg-card text-foreground shadow-sm"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        {mode === "month" ? (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Previous month"
              onClick={() => setMonthOffset((o) => o - 1)}
            >
              <ChevronLeft />
            </Button>
            <span className="min-w-28 text-center text-xs font-medium">{monthLabel}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Next month"
              disabled={monthOffset >= 0}
              onClick={() => setMonthOffset((o) => o + 1)}
            >
              <ChevronRight />
            </Button>
          </div>
        ) : null}
      </div>
      <div className="mb-3 flex items-baseline justify-between">
        <span className="font-heading text-sm font-semibold">{title}</span>
        <span className="text-xs text-muted-foreground">
          {failed ? (
            <span className="text-destructive">Failed to load</span>
          ) : (
            <>
              <b className="font-medium text-foreground">{total}</b> total
            </>
          )}
        </span>
      </div>
      <div
        className={cn(
          "relative grid h-27 items-end bg-[length:100%_33.33%] bg-bottom bg-repeat-y pt-4 transition-opacity",
          dense ? "gap-1" : "gap-2.5",
          loading && "opacity-50"
        )}
        style={{
          gridTemplateColumns: `repeat(${days.length}, 1fr)`,
          backgroundImage:
            "repeating-linear-gradient(to top, var(--border) 0, var(--border) 1px, transparent 1px, transparent 33.33%)",
        }}
      >
        {days.map((d, i) => (
          <div
            key={d.date}
            className="flex h-full items-end justify-center"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            <div
              className={cn(
                "max-w-8 rounded-t bg-primary transition-[filter]",
                dense ? "w-4/5" : "w-3/5",
                d.date === todayIso && "bg-primary/60",
                hovered === i && "brightness-110"
              )}
              style={{ height: `${Math.max(4, (d.count / max) * 100)}%` }}
            />
          </div>
        ))}
        {hovered !== null && days[hovered] ? (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md bg-foreground px-2 py-1 text-xs font-semibold whitespace-nowrap text-background"
            style={{
              left: `${((hovered + 0.5) / days.length) * 100}%`,
              top: `${100 - (days[hovered].count / max) * 100}%`,
              marginTop: "-8px",
            }}
          >
            {days[hovered].count} jobs
            <span className="ml-1 font-normal opacity-70">{days[hovered].label}</span>
          </div>
        ) : null}
      </div>
      <div
        className={cn("mt-1.5 grid", dense ? "gap-1" : "gap-2.5")}
        style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}
      >
        {days.map((d, i) => (
          <span
            key={d.date}
            className={cn(
              "text-center text-xs text-muted-foreground",
              d.date === todayIso && "font-semibold text-foreground",
              // dense ranges: label the first day and every 5th to avoid overlap
              dense && i % 5 !== 0 && "invisible"
            )}
          >
            {dense ? Number(d.date.slice(8)) : d.label}
          </span>
        ))}
      </div>
    </div>
  )
}
