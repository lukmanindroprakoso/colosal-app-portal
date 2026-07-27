"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  Copy,
  Check,
  ChevronDown,
  FileText,
  Globe,
  ArrowUpRight,
  ChevronRight,
  Loader2,
  RefreshCw,
} from "lucide-react"
import { PROPOSAL_STATUS_STYLES, formatProposalDateTime } from "../proposal-format"

export interface QAPair {
  question: string
  answer: string
}

export interface ProposalDetailData {
  id: string
  is_submitted: boolean
  last_generated_at: string | null
  connects_used: number | null
  cover_letter_generated: string | null
  question_answer: QAPair[]
  attachments: { id: string; file_name: string | null }[]
  job: {
    title: string | null
    url: string | null
    description: string | null
    scan_config_id: string | null
    scan_config_name: string | null
    amount: string
    posted: string | null
    client_country: string | null
    skills: string[]
  } | null
}

function CopyButton({ text, label, iconOnly = false }: { text: string; label: string; iconOnly?: boolean }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success("Copied")
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error("Copy failed")
    }
  }

  return (
    <Button variant="outline" size={iconOnly ? "icon" : "sm"} onClick={handleCopy} aria-label={label}>
      {copied ? <Check className="text-emerald-600" /> : <Copy />}
      {iconOnly ? null : "Copy"}
    </Button>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl bg-card p-5 shadow-sm ring-1 ring-foreground/5 dark:ring-foreground/10">
      {children}
    </div>
  )
}

export function ProposalDetail({ data }: { data: ProposalDetailData }) {
  const [detailsOpen, setDetailsOpen] = useState(true)
  const [detail, setDetail] = useState(data)
  const [generating, setGenerating] = useState(false)

  async function generateProposal() {
    setGenerating(true)
    try {
      const res = await fetch("/api/ai/generate-proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId: detail.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Generation failed")
      setDetail((d) => ({
        ...d,
        cover_letter_generated: json.cover_letter_generated,
        question_answer: json.question_answer,
        attachments: json.attachments,
        last_generated_at: json.last_generated_at,
        connects_used: d.connects_used,
      }))
      toast.success("Proposal generated")
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  useEffect(() => {
    if (detail.cover_letter_generated) return
    const timer = setTimeout(generateProposal, 0)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const status = detail.is_submitted ? "Submitted" : "Draft"
  const description = data.job?.description ?? null
  const excerpt = description
    ? description.length > 280
      ? `${description.slice(0, 280)}…`
      : description
    : "—"

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/proposals" className="hover:underline">
          Proposals
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="truncate text-foreground">{data.job?.title ?? "Untitled job"}</span>
      </div>

      {/* Title + status */}
      <div className="flex items-start justify-between gap-3">
        <h1 className="font-heading text-xl font-semibold">{data.job?.title ?? "Job no longer available"}</h1>
        <Badge className={cn("gap-1.5 shrink-0", PROPOSAL_STATUS_STYLES[status])}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {status}
        </Badge>
      </div>

      {/* Configuration card */}
      <Card>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Client">{data.job?.client_country || "—"}</Field>
          <Field label="Configuration">
            {data.job?.scan_config_id ? (
              <Link href={`/job-scanner/${data.job.scan_config_id}`} className="inline-flex items-center gap-1 underline">
                {data.job.scan_config_name ?? "View scanner"} <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              "—"
            )}
          </Field>
          <Field label="Submitted">{formatProposalDateTime(detail.last_generated_at)}</Field>
          <Field label="Connects">{detail.connects_used ?? "—"}</Field>
          <Field label="Skills">{data.job?.skills.length ? data.job.skills.join(", ") : "—"}</Field>
        </div>
      </Card>

      {/* Cover letter card */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-sm font-semibold">Cover letter</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={generateProposal} disabled={generating}>
              {generating ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              {detail.cover_letter_generated ? "Regenerate" : "Generate"}
            </Button>
            <CopyButton text={detail.cover_letter_generated ?? ""} label="Copy cover letter" />
          </div>
        </div>
        {generating && !detail.cover_letter_generated ? (
          <p className="text-sm text-muted-foreground">Generating proposal…</p>
        ) : (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {detail.cover_letter_generated || "—"}
          </p>
        )}
      </Card>

      {/* Question answers card */}
      {detail.question_answer.length > 0 ? (
        <Card>
          <h2 className="mb-4 font-heading text-sm font-semibold">Question answers</h2>
          <div className="space-y-6">
            {detail.question_answer.map((qa, i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm italic text-muted-foreground">{qa.question}</p>
                  <CopyButton text={qa.answer} label={`Copy answer ${i + 1}`} iconOnly />
                </div>
                <p className="whitespace-pre-wrap text-sm">{qa.answer}</p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {/* Attachments card */}
      {detail.attachments.length > 0 ? (
        <Card>
          <h2 className="mb-4 font-heading text-sm font-semibold">Attachments recommended</h2>
          <div className="flex flex-wrap gap-2">
            {detail.attachments.map((a) => (
              <span
                key={a.id}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <FileText className="h-4 w-4 text-muted-foreground" />
                {a.file_name ?? "Untitled"}
              </span>
            ))}
          </div>
        </Card>
      ) : null}

      {/* Job details card (collapsible) */}
      <Card>
        <button
          type="button"
          onClick={() => setDetailsOpen((o) => !o)}
          className="flex w-full items-center justify-between border-b border-border pb-3"
        >
          <h2 className="font-heading text-sm font-semibold">Job details</h2>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", detailsOpen && "rotate-180")} />
        </button>
        {detailsOpen ? (
          <div className="space-y-4 pt-4">
            <Field label="Description excerpt">
              <span className="text-muted-foreground">{excerpt}</span>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Budget">{data.job?.amount ?? "—"}</Field>
              <Field label="Posted">{data.job?.posted || "—"}</Field>
            </div>
            {data.job?.url ? (
              <a
                href={data.job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <Globe className="h-4 w-4" />
                View original posting on Upwork
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            ) : null}
          </div>
        ) : null}
      </Card>
    </div>
  )
}
