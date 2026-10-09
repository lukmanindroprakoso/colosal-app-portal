"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { track } from "@/lib/analytics"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { Briefcase, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { timeAgo } from "../scanner-format"
import { NativeSelect } from "../scanner-form"

export type ApplyStatusTab = "All" | "New" | "Applied" | "Dismissed"

export interface JobRow {
  id: string
  title: string | null
  url: string | null
  contract_type: string | null
  fixed_price_amount: number | null
  fixed_price_currency: string | null
  hourly_budget_min: number | null
  hourly_budget_max: number | null
  inserted_at: string
  score_matching: number | null
  apply_status: string | null
}

export interface JobListProps {
  scanConfigId: string
  hasTemplate: boolean
  jobs: JobRow[]
  activeTab: ApplyStatusTab
  page: number
  pageSize: number
  activeTabTotal: number
}

const TABS: ApplyStatusTab[] = ["All", "New", "Applied", "Dismissed"]

const APPLY_STATUS_STYLES: Record<string, string> = {
  New: "bg-sky-500/10 text-sky-500",
  Applied: "bg-emerald-500/10 text-emerald-500",
  Dismissed: "bg-muted text-muted-foreground",
}

function formatAmount(job: JobRow): string {
  if (job.contract_type === "FIXED") {
    if (job.fixed_price_amount === null) return "—"
    return `Fixed ${job.fixed_price_currency ?? "$"}${new Intl.NumberFormat("en-US").format(job.fixed_price_amount)}`
  }
  const min = job.hourly_budget_min
  const max = job.hourly_budget_max
  if (min === null && max === null) return "—"
  const fmt = (n: number) => `$${new Intl.NumberFormat("en-US").format(n)}`
  if (min !== null && max !== null) return `${fmt(min)} - ${fmt(max)}/hr`
  return `${fmt(min ?? max ?? 0)}/hr`
}

function safeJobUrl(url: string | null): string | null {
  if (!url) return null
  return /^https?:\/\//i.test(url) ? url : null
}

function matchScoreStyle(score: number): string {
  if (score >= 80) return "bg-emerald-500/15 text-emerald-500"
  if (score >= 50) return "bg-amber-500/15 text-amber-500"
  return "bg-rose-500/15 text-rose-500"
}

function tabHref(scanConfigId: string, tab: ApplyStatusTab): string {
  return tab === "All"
    ? `/job-scanner/${scanConfigId}`
    : `/job-scanner/${scanConfigId}?tab=${tab}`
}

export function JobListTabs({
  scanConfigId,
  counts,
  activeTab,
}: {
  scanConfigId: string
  counts: Record<ApplyStatusTab, number>
  activeTab: ApplyStatusTab
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {TABS.map((tab) => (
        <Link
          key={tab}
          href={tabHref(scanConfigId, tab)}
          className={cn(
            "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
            tab === activeTab
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/70"
          )}
        >
          {tab} ({counts[tab]})
        </Link>
      ))}
    </div>
  )
}

export function JobList({
  scanConfigId,
  hasTemplate,
  jobs,
  activeTab,
  page,
  pageSize,
  activeTabTotal,
}: JobListProps) {
  const router = useRouter()
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [templateSet, setTemplateSet] = useState(hasTemplate)
  const [pickJobId, setPickJobId] = useState<string | null>(null) // job waiting for a template choice
  const [templates, setTemplates] = useState<{ id: string; name: string | null }[] | null>(null)
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const totalPages = Math.max(1, Math.ceil(activeTabTotal / pageSize))

  async function updateStatus(jobId: string, status: "Dismissed") {
    setUpdatingId(jobId)
    const supabase = createClient()
    const { error } = await supabase.from("upwork_jobs").update({ apply_status: status }).eq("id", jobId)
    if (error) {
      toast.error(error.message)
      setUpdatingId(null)
      return
    }
    track("job_dismiss")
    toast.success("Job dismissed")
    setUpdatingId(null)
    router.refresh()
  }

  async function applyToJob(jobId: string) {
    if (!templateSet) {
      setPickJobId(jobId)
      if (!templates) {
        const { data } = await createClient()
          .from("proposal_templates")
          .select("id, name")
          .order("created_at", { ascending: false })
        setTemplates(data ?? [])
      }
      return
    }
    setUpdatingId(jobId)
    const res = await fetch("/api/proposals/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) {
      toast.error(json?.error ?? "Failed to apply")
      setUpdatingId(null)
      return
    }
    track("job_apply")
    router.push(`/proposals/${json.proposalId}`)
  }

  async function confirmTemplate() {
    if (!templateId || !pickJobId || savingTemplate) return
    setSavingTemplate(true)
    const { error } = await createClient()
      .from("user_scan_config")
      .update({ proposal_template_id: templateId })
      .eq("id", scanConfigId)
    setSavingTemplate(false)
    if (error) {
      toast.error(error.message)
      return
    }
    const jobId = pickJobId
    setTemplateSet(true)
    setPickJobId(null)
    applyToJob(jobId)
  }

  return (
    <div className="space-y-4">
      {jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-border py-20 text-center">
          <Briefcase className="h-8 w-8 text-muted-foreground" />
          <p className="text-muted-foreground">No job to display</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const jobUrl = safeJobUrl(job.url)
            const isUpdating = updatingId === job.id

            return (
              <div
                key={job.id}
                className="flex items-center gap-4 rounded-3xl bg-card p-4 shadow-sm ring-1 ring-foreground/5 dark:ring-foreground/10"
              >
                {job.score_matching !== null ? (
                  <div
                    className={cn(
                      "flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-full",
                      matchScoreStyle(job.score_matching)
                    )}
                  >
                    <span className="font-heading text-xl leading-none font-bold">
                      {job.score_matching}
                      <span className="text-xs font-medium">%</span>
                    </span>
                    <span className="text-[10px] leading-none">match</span>
                  </div>
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
                    —
                  </div>
                )}
                <div className="min-w-0 flex-1 space-y-2">
                  {jobUrl ? (
                    <a
                      href={jobUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate font-heading font-medium hover:underline"
                    >
                      {job.title ?? "Untitled job"}
                    </a>
                  ) : (
                    <p className="truncate font-heading font-medium">{job.title ?? "Untitled job"}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>{formatAmount(job)}</span>
                    <span>Scanned {timeAgo(job.inserted_at)}</span>
                    <Badge
                      className={cn(
                        APPLY_STATUS_STYLES[job.apply_status ?? ""] ?? APPLY_STATUS_STYLES.Dismissed
                      )}
                    >
                      {job.apply_status ?? "New"}
                    </Badge>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isUpdating || job.apply_status === "Applied"}
                    onClick={() => applyToJob(job.id)}
                    className="text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600"
                  >
                    {isUpdating ? <Loader2 className="animate-spin" /> : "Apply"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isUpdating || job.apply_status === "Dismissed"}
                    onClick={() => updateStatus(job.id, "Dismissed")}
                    className="text-rose-600 hover:bg-rose-500/10 hover:text-rose-600"
                  >
                    {isUpdating ? <Loader2 className="animate-spin" /> : "Dismiss"}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between pt-2">
          {page > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/job-scanner/${scanConfigId}?tab=${activeTab}&page=${page - 1}`}>
                Previous
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
          )}
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/job-scanner/${scanConfigId}?tab=${activeTab}&page=${page + 1}`}>
                Next
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Next
            </Button>
          )}
        </div>
      ) : null}
      <Dialog open={!!pickJobId} onOpenChange={(o) => !o && setPickJobId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose a proposal template</DialogTitle>
            <DialogDescription>
              This scanner has no proposal template yet. Pick one and it will be saved to the scanner, then the proposal is created.
            </DialogDescription>
          </DialogHeader>
          {templates === null ? (
            <Loader2 className="mx-auto animate-spin text-muted-foreground" />
          ) : templates.length > 0 ? (
            <NativeSelect
              value={templateId}
              onChange={setTemplateId}
              placeholder="Select a saved template"
              options={templates.map((t) => ({ value: t.id, label: t.name ?? "Untitled template" }))}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              You have no templates yet.{" "}
              <Link href="/proposals?tab=templates" className="underline">
                Create one first
              </Link>
              .
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPickJobId(null)}>
              Cancel
            </Button>
            <Button onClick={confirmTemplate} disabled={!templateId || savingTemplate}>
              {savingTemplate && <Loader2 className="animate-spin" />} Save and apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
