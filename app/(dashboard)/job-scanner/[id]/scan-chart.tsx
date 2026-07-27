"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

export interface DailyCount {
  date: string
  label: string
  count: number
}

export function ScanChart({ days }: { days: DailyCount[] }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const max = Math.max(1, ...days.map((d) => d.count))
  const total = days.reduce((sum, d) => sum + d.count, 0)
  const todayIso = new Date().toISOString().slice(0, 10)

  return (
    <div className="rounded-3xl bg-card p-4 shadow-sm ring-1 ring-foreground/5 dark:ring-foreground/10">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="font-heading text-sm font-semibold">Jobs scanned, last 7 days</span>
        <span className="text-xs text-muted-foreground">
          <b className="font-medium text-foreground">{total}</b> total
        </span>
      </div>
      <div
        className="relative grid h-27 items-end gap-2.5 bg-[length:100%_33.33%] bg-bottom bg-repeat-y pt-4"
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
                "w-3/5 max-w-8 rounded-t bg-primary transition-[filter]",
                d.date === todayIso && "bg-primary/60",
                hovered === i && "brightness-110"
              )}
              style={{ height: `${Math.max(4, (d.count / max) * 100)}%` }}
            />
          </div>
        ))}
        {hovered !== null ? (
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
      <div className="mt-1.5 grid gap-2.5" style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>
        {days.map((d) => (
          <span
            key={d.date}
            className={cn(
              "text-center text-xs text-muted-foreground",
              d.date === todayIso && "font-semibold text-foreground"
            )}
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  )
}
