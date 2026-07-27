"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { ArrowLeft, ArrowRight, Check, Sparkles, Loader2, Paperclip } from "lucide-react"
import { SkillTagInput, type Skill } from "./skill-tag-input"

const STEPS = ["Filters", "Cover Letter", "Questions", "Attachments", "Notifications"] as const

export const EXPERIENCE_LEVELS = [
  { value: "ENTRY_LEVEL", label: "Entry Level" },
  { value: "INTERMEDIATE", label: "Intermediate" },
  { value: "EXPERT", label: "Expert" },
]


export interface ScanConfig {
  id?: string
  name: string | null
  keyword: string | null
  contract_type: string[] | null
  budget_min: number | null
  budget_max: number | null
  hourly_rate_min: number | null
  hourly_rate_max: number | null
  skills: Skill[] | null
  experience_level: string | null
  category: string | null
  client_hire_rate: number | null
  proposal_template_id: string | null
  question_instruction: string | null
  question_answer_base: string | null
  attachments: string[] | null
  notif_email: boolean
  email: string | null
  notif_whatsapp: boolean
  whatsapp: string | null
  status: string
}

interface JobOption {
  id: string
  title: string | null
  description: string | null
}

interface AttachmentOption {
  id: string
  file_name: string | null
  description: string | null
}

interface ProposalTemplate {
  id: string
  name: string | null
  ai_instruction: string | null
  template: string | null
}

interface UpworkCategory {
  id: string
  preferredLabel: string
  slug: string
  subcategories: { id: string; preferredLabel: string }[]
}

const EMPTY_CONFIG: ScanConfig = {
  name: "",
  keyword: "",
  contract_type: [],
  budget_min: null,
  budget_max: null,
  hourly_rate_min: null,
  hourly_rate_max: null,
  skills: [],
  experience_level: null,
  category: null,
  client_hire_rate: null,
  proposal_template_id: null,
  question_instruction: "",
  question_answer_base: "",
  attachments: [],
  notif_email: false,
  email: "",
  notif_whatsapp: false,
  whatsapp: "",
  status: "Active",
}

export function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5 text-sm"
    >
      <span
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-md border transition-colors",
          checked
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-input/50"
        )}
      >
        {checked && <Check className="h-3.5 w-3.5" />}
      </span>
      {label}
    </button>
  )
}

export function NativeSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string | null
  onChange: (v: string) => void
  placeholder: string
  options: { value: string; label: string }[]
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-3xl border border-transparent bg-input/50 px-3 text-sm text-foreground outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
    >
      <option value="" disabled className="bg-popover text-muted-foreground">
        {placeholder}
      </option>
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-popover text-foreground">
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function ScannerForm({ initial }: { initial?: ScanConfig }) {
  const router = useRouter()
  const supabase = createClient()
  const isEdit = Boolean(initial?.id)

  const [step, setStep] = useState(0)
  const [config, setConfig] = useState<ScanConfig>({ ...EMPTY_CONFIG, ...initial })
  const [saving, setSaving] = useState(false)

  const [jobs, setJobs] = useState<JobOption[]>([])
  const [attachmentOptions, setAttachmentOptions] = useState<AttachmentOption[]>([])
  const [testJobCL, setTestJobCL] = useState("")
  const [testJobQ, setTestJobQ] = useState("")
  const [testing, setTesting] = useState<null | "cover" | "question">(null)
  const [testResult, setTestResult] = useState<{ kind: string; text: string } | null>(null)
  const [templates, setTemplates] = useState<ProposalTemplate[]>([])
  const selectedTemplate = templates.find((t) => t.id === config.proposal_template_id) ?? null
  const [creatingTemplate, setCreatingTemplate] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState("")
  const [newTemplateInstruction, setNewTemplateInstruction] = useState("")
  const [newTemplateBody, setNewTemplateBody] = useState("")
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [categories, setCategories] = useState<UpworkCategory[]>([])

  useEffect(() => {
    async function load() {
      const { data: attachData } = await supabase
        .from("attachments")
        .select("id, file_name, description")
        .order("created_at", { ascending: false })
      setAttachmentOptions(attachData ?? [])

      const { data: templateData } = await supabase
        .from("proposal_templates")
        .select("id, name, ai_instruction, template")
        .order("created_at", { ascending: false })
      setTemplates(templateData ?? [])

      const catRes = await fetch("/api/upwork/categories")
      const catJson = await catRes.json().catch(() => null)
      if (catRes.ok) setCategories(catJson?.categories ?? [])
    }
    load()
  }, [supabase])

  useEffect(() => {
    const keyword = config.keyword?.trim()
    if (!keyword) {
      setJobs([])
      return
    }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/upwork/jobs-search?keyword=${encodeURIComponent(keyword)}`)
      const json = await res.json().catch(() => null)
      if (res.ok) setJobs(json?.jobs ?? [])
    }, 500)
    return () => clearTimeout(timer)
  }, [config.keyword])

  // n8n's marketplace filter uses subcategoryIds_any, which only accepts
  // subcategory ids — parent category ids are intentionally left out here.
  const categoryOptions = categories.flatMap((cat) =>
    cat.subcategories.map((sub) => ({
      value: sub.id,
      label: `${cat.preferredLabel} — ${sub.preferredLabel}`,
    }))
  )

  async function createTemplate() {
    if (!newTemplateName.trim() || !newTemplateBody.trim()) {
      toast.error("Give the template a name and body")
      return
    }
    setSavingTemplate(true)
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      router.push("/login")
      return
    }
    const { data, error } = await supabase
      .from("proposal_templates")
      .insert({
        user_id: userData.user.id,
        name: newTemplateName,
        ai_instruction: newTemplateInstruction || null,
        template: newTemplateBody,
      })
      .select("id, name, ai_instruction, template")
      .single()
    setSavingTemplate(false)
    if (error || !data) {
      toast.error(error?.message ?? "Failed to create template")
      return
    }
    setTemplates((t) => [data, ...t])
    set("proposal_template_id", data.id)
    setCreatingTemplate(false)
    setNewTemplateName("")
    setNewTemplateInstruction("")
    setNewTemplateBody("")
    toast.success("Template created")
  }

  function set<K extends keyof ScanConfig>(key: K, value: ScanConfig[K]) {
    setConfig((c) => ({ ...c, [key]: value }))
  }

  function toggleContract(type: "FIXED" | "HOURLY", on: boolean) {
    const current = new Set(config.contract_type ?? [])
    if (on) current.add(type)
    else current.delete(type)
    set("contract_type", Array.from(current))
  }

  const hasHourly = (config.contract_type ?? []).includes("HOURLY")
  const hasFixed = (config.contract_type ?? []).includes("FIXED")

  async function runTest(kind: "cover" | "question") {
    const jobId = kind === "cover" ? testJobCL : testJobQ
    const job = jobs.find((j) => j.id === jobId)
    if (!job) {
      toast.error("Select a job to test with first")
      return
    }
    const base =
      kind === "cover" ? selectedTemplate?.template ?? "" : config.question_answer_base ?? ""
    if (!base.trim()) {
      toast.error(
        kind === "cover" ? "Select a proposal template above first" : "Add answer knowledge above first"
      )
      return
    }
    setTesting(kind)
    setTestResult(null)
    try {
      const res = await fetch("/api/ai/generate-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          jobTitle: job.title,
          jobDescription: job.description,
          base,
          instruction:
            kind === "cover" ? selectedTemplate?.ai_instruction : config.question_instruction,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Generation failed")
      setTestResult({
        kind: kind === "cover" ? "Cover letter" : "Question answer",
        text: json.text,
      })
      toast.success("Generated")
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setTesting(null)
    }
  }

  async function handleSubmit(asDraft = false) {
    if (!config.name?.trim()) {
      toast.error("Give your scanner a name")
      setStep(0)
      return
    }
    setSaving(true)

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      router.push("/login")
      return
    }

    const payload = {
      user_id: userData.user.id,
      name: config.name,
      keyword: config.keyword || null,
      contract_type: config.contract_type?.length ? config.contract_type : null,
      budget_min: config.budget_min,
      budget_max: config.budget_max,
      hourly_rate_min: config.hourly_rate_min,
      hourly_rate_max: config.hourly_rate_max,
      skills: config.skills ?? [],
      experience_level: config.experience_level || null,
      category: config.category || null,
      client_hire_rate: config.client_hire_rate ?? 0,
      proposal_template_id: config.proposal_template_id || null,
      question_instruction: config.question_instruction || null,
      question_answer_base: config.question_answer_base || null,
      attachments: config.attachments ?? [],
      notif_email: config.notif_email,
      email: config.email || null,
      notif_whatsapp: config.notif_whatsapp,
      whatsapp: config.whatsapp || null,
      status: asDraft ? "Draft" : "Active",
    }

    const { error } = isEdit
      ? await supabase.from("user_scan_config").update(payload).eq("id", initial!.id!)
      : await supabase.from("user_scan_config").insert(payload)

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
      setSaving(false)
      return
    }

    toast.success(isEdit ? "Scanner updated" : "Scanner created")
    router.push("/job-scanner")
    router.refresh()
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="font-heading text-2xl font-semibold">
          {isEdit ? "Edit scan configuration" : "New scan configuration"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Step {step + 1} of {STEPS.length} &mdash; {STEPS[step]}
        </p>
      </div>

      {/* Stepper */}
      <div className="mb-8 grid grid-cols-5 gap-2">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(i)}
            className="text-left"
          >
            <div
              className={cn(
                "mb-2 h-1 rounded-full transition-colors",
                i <= step ? "bg-primary" : "bg-border"
              )}
            />
            <span
              className={cn(
                "text-xs",
                i === step ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {label}
            </span>
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="rounded-4xl bg-card p-6 shadow-md ring-1 ring-foreground/5 dark:ring-foreground/10">
        {step === 0 && (
          <div className="space-y-5">
            <h2 className="font-heading text-lg font-medium">Job Filters</h2>

            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                placeholder="Input config name"
                value={config.name ?? ""}
                onChange={(e) => set("name", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Keyword</Label>
              <Input
                placeholder="Input your keyword"
                value={config.keyword ?? ""}
                onChange={(e) => set("keyword", e.target.value)}
              />
            </div>

            <div className="space-y-3">
              <Checkbox
                checked={hasFixed}
                onChange={(v) => toggleContract("FIXED", v)}
                label="Fixed Contract"
              />
              {hasFixed && (
                <div className="grid grid-cols-2 gap-4 pl-7">
                  <div className="space-y-1.5">
                    <Label>Budget Minimum</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={config.budget_min ?? ""}
                      onChange={(e) =>
                        set("budget_min", e.target.value ? Number(e.target.value) : null)
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Budget Maximum</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={config.budget_max ?? ""}
                      onChange={(e) =>
                        set("budget_max", e.target.value ? Number(e.target.value) : null)
                      }
                    />
                  </div>
                </div>
              )}

              <Checkbox
                checked={hasHourly}
                onChange={(v) => toggleContract("HOURLY", v)}
                label="Hourly Contract"
              />
              {hasHourly && (
                <div className="grid grid-cols-2 gap-4 pl-7">
                  <div className="space-y-1.5">
                    <Label>Hourly Rate Minimum</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={config.hourly_rate_min ?? ""}
                      onChange={(e) =>
                        set("hourly_rate_min", e.target.value ? Number(e.target.value) : null)
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Hourly Rate Maximum</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={config.hourly_rate_max ?? ""}
                      onChange={(e) =>
                        set("hourly_rate_max", e.target.value ? Number(e.target.value) : null)
                      }
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Skill</Label>
              <SkillTagInput
                value={config.skills ?? []}
                onChange={(v) => set("skills", v)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Experience Level</Label>
              <NativeSelect
                value={config.experience_level}
                onChange={(v) => set("experience_level", v)}
                placeholder="Select experience level"
                options={EXPERIENCE_LEVELS}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Category</Label>
              <NativeSelect
                value={config.category}
                onChange={(v) => set("category", v)}
                placeholder="Select category"
                options={categoryOptions}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Hire Rate (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                placeholder="0-100"
                value={
                  config.client_hire_rate != null
                    ? Math.round(config.client_hire_rate * 100 * 1e6) / 1e6
                    : ""
                }
                onChange={(e) => {
                  if (!e.target.value) {
                    set("client_hire_rate", null)
                    return
                  }
                  const pct = Math.min(100, Math.max(0, Number(e.target.value)))
                  set("client_hire_rate", Math.round((pct / 100) * 1e6) / 1e6)
                }}
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <h2 className="font-heading text-lg font-medium">Cover Letter</h2>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Proposal template</Label>
                <button
                  type="button"
                  onClick={() => setCreatingTemplate((v) => !v)}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {creatingTemplate ? "Cancel" : "+ New template"}
                </button>
              </div>
              {templates.length > 0 ? (
                <NativeSelect
                  value={config.proposal_template_id}
                  onChange={(v) => set("proposal_template_id", v)}
                  placeholder="Select a saved template"
                  options={templates.map((t) => ({
                    value: t.id,
                    label: t.name ?? "Untitled template",
                  }))}
                />
              ) : (
                !creatingTemplate && (
                  <p className="text-sm text-muted-foreground">
                    No templates yet — create one below.
                  </p>
                )
              )}
            </div>

            {creatingTemplate && (
              <div className="space-y-3 rounded-2xl border border-border p-4">
                <div className="space-y-1.5">
                  <Label>Template name</Label>
                  <Input
                    placeholder="e.g. General web dev pitch"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>
                    AI Instruction <span className="text-muted-foreground">(Optional)</span>
                  </Label>
                  <Textarea
                    rows={3}
                    placeholder="Tone, what to emphasize, what to avoid…"
                    value={newTemplateInstruction}
                    onChange={(e) => setNewTemplateInstruction(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Cover letter template</Label>
                  <Textarea
                    rows={8}
                    placeholder="Write your cover letter template. Use [prompt]…[/prompt] for AI-filled sections."
                    value={newTemplateBody}
                    onChange={(e) => setNewTemplateBody(e.target.value)}
                  />
                </div>
                <Button type="button" onClick={createTemplate} disabled={savingTemplate}>
                  {savingTemplate ? <Loader2 className="animate-spin" /> : <Check />}
                  Save template
                </Button>
              </div>
            )}

            {selectedTemplate && !creatingTemplate && (
              <div className="space-y-3 rounded-2xl bg-muted/50 p-4 text-sm">
                {selectedTemplate.ai_instruction && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      AI Instruction
                    </p>
                    <p className="whitespace-pre-wrap">{selectedTemplate.ai_instruction}</p>
                  </div>
                )}
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Template</p>
                  <p className="whitespace-pre-wrap">{selectedTemplate.template}</p>
                </div>
              </div>
            )}

            <Separator />

            <TestRow
              label="Select a job to test generation"
              jobs={jobs}
              value={testJobCL}
              onChange={setTestJobCL}
              onRun={() => runTest("cover")}
              loading={testing === "cover"}
            />
            {testResult && testResult.kind === "Cover letter" && (
              <TestPreview text={testResult.text} />
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <h2 className="font-heading text-lg font-medium">Question</h2>

            <div className="space-y-1.5">
              <Label>
                AI Instruction <span className="text-muted-foreground">(Optional)</span>
              </Label>
              <Textarea
                rows={4}
                placeholder="Add any extra instructions to guide the AI — tone, what to emphasize, what to avoid…"
                value={config.question_instruction ?? ""}
                onChange={(e) => set("question_instruction", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Answer Knowledge</Label>
              <Textarea
                rows={5}
                placeholder="Tell us about your company, your best work, the tech you use, and your current rates/availability…"
                value={config.question_answer_base ?? ""}
                onChange={(e) => set("question_answer_base", e.target.value)}
              />
            </div>

            <Separator />

            <TestRow
              label="Select a job to test generation"
              jobs={jobs}
              value={testJobQ}
              onChange={setTestJobQ}
              onRun={() => runTest("question")}
              loading={testing === "question"}
            />
            {testResult && testResult.kind === "Question answer" && (
              <TestPreview text={testResult.text} />
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <h2 className="font-heading text-lg font-medium">Attachments</h2>
            <p className="text-sm text-muted-foreground">
              Select which files to attach when applying with this scanner.
            </p>
            {attachmentOptions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                No attachments uploaded yet.
              </div>
            ) : (
              <div className="space-y-2">
                {attachmentOptions.map((a) => {
                  const selected = (config.attachments ?? []).includes(a.id)
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        const current = new Set(config.attachments ?? [])
                        if (selected) current.delete(a.id)
                        else current.add(a.id)
                        set("attachments", Array.from(current))
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-2xl border p-3 text-left text-sm transition-colors",
                        selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
                          selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-input/50"
                        )}
                      >
                        {selected && <Check className="h-3.5 w-3.5" />}
                      </span>
                      <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1">
                        <span className="block font-medium">{a.file_name ?? "Untitled"}</span>
                        {a.description && (
                          <span className="block text-xs text-muted-foreground">
                            {a.description}
                          </span>
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <h2 className="font-heading text-lg font-medium">Notifications</h2>
            <p className="text-sm text-muted-foreground">
              Get notified when this scanner finds new matching jobs.
            </p>

            <div className="space-y-3">
              <Checkbox
                checked={config.notif_email}
                onChange={(v) => set("notif_email", v)}
                label="Email notifications"
              />
              {config.notif_email && (
                <div className="space-y-1.5 pl-7">
                  <Label>Email address</Label>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={config.email ?? ""}
                    onChange={(e) => set("email", e.target.value)}
                  />
                </div>
              )}

              <Checkbox
                checked={config.notif_whatsapp}
                onChange={(v) => set("notif_whatsapp", v)}
                label="WhatsApp notifications"
              />
              {config.notif_whatsapp && (
                <div className="space-y-1.5 pl-7">
                  <Label>WhatsApp number</Label>
                  <Input
                    placeholder="+1 555 000 0000"
                    value={config.whatsapp ?? ""}
                    onChange={(e) => set("whatsapp", e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer nav */}
      <div className="mt-6 flex items-center justify-between">
        {step > 0 ? (
          <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
            <ArrowLeft /> Back
          </Button>
        ) : (
          <Button variant="ghost" onClick={() => router.push("/job-scanner")}>
            <ArrowLeft /> Cancel
          </Button>
        )}

        <div className="flex gap-2">
          {step === STEPS.length - 1 && (
            <Button variant="outline" onClick={() => handleSubmit(true)} disabled={saving}>
              Save as draft
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button
              onClick={() => setStep((s) => s + 1)}
              disabled={step === 0 && (!config.name?.trim() || !config.keyword?.trim())}
            >
              Continue <ArrowRight />
            </Button>
          ) : (
            <Button onClick={() => handleSubmit(false)} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Check />}
              {isEdit ? "Save changes" : "Create scanner"}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function TestRow({
  label,
  jobs,
  value,
  onChange,
  onRun,
  loading,
}: {
  label: string
  jobs: JobOption[]
  value: string
  onChange: (v: string) => void
  onRun: () => void
  loading: boolean
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="flex-1 space-y-1.5">
        <Label>{label}</Label>
        <NativeSelect
          value={value}
          onChange={onChange}
          placeholder="Select job"
          options={jobs.map((j) => ({ value: j.id, label: j.title ?? "Untitled job" }))}
        />
      </div>
      <Button variant="ghost" onClick={onRun} disabled={loading}>
        {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
        Run test
      </Button>
    </div>
  )
}

function TestPreview({ text }: { text: string }) {
  return (
    <div className="whitespace-pre-wrap rounded-2xl bg-muted/50 p-4 text-sm text-muted-foreground">
      {text}
    </div>
  )
}
