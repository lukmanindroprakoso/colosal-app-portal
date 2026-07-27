export function timeAgo(iso: string | null): string {
  if (!iso) return "never"
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? "" : "s"} ago`
}

export const STATUS_STYLES: Record<string, string> = {
  Active: "bg-emerald-500/10 text-emerald-500",
  Inactive: "bg-muted text-muted-foreground",
  Draft: "bg-amber-500/10 text-amber-500",
  Failed: "bg-rose-500/10 text-rose-500",
}
