import { Card, CardContent } from "@/components/ui/card"

export function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="w-full">
      <CardContent className="space-y-1 py-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-3xl font-semibold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">Last 7 days</p>
      </CardContent>
    </Card>
  )
}
