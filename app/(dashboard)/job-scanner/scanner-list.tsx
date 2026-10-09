"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { track } from "@/lib/analytics"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Pencil, Trash2, Loader2, Radar } from "lucide-react"
import { timeAgo, STATUS_STYLES } from "./scanner-format"

export interface ScannerItem {
  id: string
  name: string | null
  keyword: string | null
  status: string
  last_scan: string | null
  todayCount: number
  weekCount: number
}

export function ScannerList({ items }: { items: ScannerItem[] }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  async function handleDelete(id: string) {
    setDeleting(id)
    const supabase = createClient()
    const { error } = await supabase
      .from("user_scan_config")
      .update({ is_archived: true, status: "Inactive" })
      .eq("id", id)
    if (error) {
      toast.error(error.message)
      setDeleting(null)
      return
    }
    track("scanner_delete")
    toast.success("Scanner deleted")
    setConfirmId(null)
    setDeleting(null)
    router.refresh()
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-4xl border border-dashed border-border py-24 text-center">
        <Radar className="h-8 w-8 text-muted-foreground" />
        <p className="text-muted-foreground">No scanners yet.</p>
        <Button asChild variant="outline">
          <Link href="/job-scanner/new">Create your first scanner</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.id}
          onClick={() => router.push(`/job-scanner/${item.id}`)}
          className="flex cursor-pointer items-center gap-4 rounded-3xl bg-card px-5 py-4 shadow-sm ring-1 ring-foreground/5 dark:ring-foreground/10"
        >
          <Badge
            className={cn(
              "gap-1.5",
              STATUS_STYLES[item.status] ?? STATUS_STYLES.Inactive
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {item.status}
          </Badge>

          <div className="min-w-0 flex-1">
            <p className="truncate font-heading font-medium">{item.name ?? "Untitled scanner"}</p>
            <p className="truncate text-xs text-muted-foreground">
              {item.keyword ? `Keywords: ${item.keyword} • ` : ""}
              Last scan {timeAgo(item.last_scan)}
            </p>
          </div>

          <div className="hidden text-center sm:block">
            <p className="text-lg font-semibold">{item.todayCount}</p>
            <p className="text-xs text-muted-foreground">Today</p>
          </div>

          <div className="hidden text-center sm:block">
            <p className="text-lg font-semibold">{item.weekCount}</p>
            <p className="text-xs text-muted-foreground">Last 7 days</p>
          </div>

          <div
            className="flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <Button asChild variant="ghost" size="icon">
              <Link href={`/job-scanner/${item.id}/edit`} aria-label="Edit scanner">
                <Pencil />
              </Link>
            </Button>

            {confirmId === item.id ? (
              <div className="flex items-center gap-1">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(item.id)}
                  disabled={deleting === item.id}
                >
                  {deleting === item.id ? <Loader2 className="animate-spin" /> : "Delete"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmId(null)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setConfirmId(item.id)}
                aria-label="Delete scanner"
              >
                <Trash2 />
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
