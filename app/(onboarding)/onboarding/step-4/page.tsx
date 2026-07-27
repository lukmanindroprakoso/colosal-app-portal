"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Check } from "lucide-react"
import { SkillTagInput, type Skill } from "@/app/(dashboard)/job-scanner/skill-tag-input"
import { Checkbox, NativeSelect, EXPERIENCE_LEVELS } from "@/app/(dashboard)/job-scanner/scanner-form"
import { DEFAULT_PROPOSAL_TEMPLATE } from "@/lib/upwork/default-template"

interface UpworkCategory {
  id: string
  preferredLabel: string
  subcategories: { id: string; preferredLabel: string }[]
}

export default function OnboardingStep4() {
  const router = useRouter()
  const supabase = createClient()

  const [name, setName] = useState("")
  const [keyword, setKeyword] = useState("")
  const [contractType, setContractType] = useState<string[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [experienceLevel, setExperienceLevel] = useState<string | null>(null)
  const [category, setCategory] = useState<string | null>(null)
  const [hireRate, setHireRate] = useState<number | null>(null)
  const [categories, setCategories] = useState<UpworkCategory[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadCategories() {
      const res = await fetch("/api/upwork/categories")
      const json = await res.json().catch(() => null)
      if (res.ok) setCategories(json?.categories ?? [])
    }
    loadCategories()
  }, [])

  const categoryOptions = categories.flatMap((cat) =>
    cat.subcategories.map((sub) => ({
      value: sub.id,
      label: `${cat.preferredLabel} — ${sub.preferredLabel}`,
    }))
  )

  function toggleContract(type: "FIXED" | "HOURLY", on: boolean) {
    const current = new Set(contractType)
    if (on) current.add(type)
    else current.delete(type)
    setContractType(Array.from(current))
  }

  async function ensureDefaultTemplate(userId: string): Promise<string | null> {
    const { data: existing } = await supabase
      .from("proposal_templates")
      .select("id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle()
    if (existing) return existing.id

    const { data, error } = await supabase
      .from("proposal_templates")
      .insert({ ...DEFAULT_PROPOSAL_TEMPLATE, user_id: userId })
      .select("id")
      .single()
    if (error || !data) {
      setError(error?.message ?? "Failed to create default template")
      setSaving(false)
      return null
    }
    return data.id
  }

  async function finishOnboarding(redirectTo: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push("/login")
      return
    }
    const { error } = await supabase
      .from("user_profiles")
      .update({ onboarding_completed: true })
      .eq("user_id", user.id)
    if (error) {
      setError(error.message)
      setSaving(false)
      return
    }
    router.push(redirectTo)
  }

  async function handleCreate() {
    if (!name.trim()) {
      setError("Give your scanner a name")
      return
    }
    setSaving(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push("/login")
      return
    }
    const templateId = await ensureDefaultTemplate(user.id)
    if (!templateId) return
    const { data, error } = await supabase
      .from("user_scan_config")
      .insert({
        user_id: user.id,
        name,
        keyword: keyword || null,
        contract_type: contractType.length ? contractType : null,
        skills,
        experience_level: experienceLevel || null,
        category: category || null,
        client_hire_rate: hireRate ?? 0,
        proposal_template_id: templateId,
        status: "Active",
        notif_email: false,
        email: "",
        notif_whatsapp: false,
        whatsapp: "",
      })
      .select("id")
      .single()
    if (error || !data) {
      setError(error?.message ?? "Failed to create scanner")
      setSaving(false)
      return
    }
    await finishOnboarding(`/job-scanner/${data.id}`)
  }

  async function handleSkip() {
    setSaving(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push("/login")
      return
    }
    const templateId = await ensureDefaultTemplate(user.id)
    if (!templateId) return
    await finishOnboarding("/dashboard")
  }

  const hasHourly = contractType.includes("HOURLY")
  const hasFixed = contractType.includes("FIXED")

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="mx-auto max-w-lg space-y-6">
        <div className="text-center space-y-1">
          <p className="text-sm text-muted-foreground">Step 4 of 4</p>
          <h1 className="text-3xl font-bold">Set up a job scanner</h1>
          <p className="text-muted-foreground">
            Tell us what jobs to look for — you can fine-tune everything else later
          </p>
        </div>

        <div className="space-y-5 rounded-4xl bg-card p-6 shadow-md ring-1 ring-foreground/5 dark:ring-foreground/10">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              placeholder="Input config name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Keyword</Label>
            <Input
              placeholder="Input your keyword"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            <Checkbox checked={hasFixed} onChange={(v) => toggleContract("FIXED", v)} label="Fixed Contract" />
            <Checkbox checked={hasHourly} onChange={(v) => toggleContract("HOURLY", v)} label="Hourly Contract" />
          </div>

          <div className="space-y-1.5">
            <Label>Skill</Label>
            <SkillTagInput value={skills} onChange={setSkills} />
          </div>

          <div className="space-y-1.5">
            <Label>Experience Level</Label>
            <NativeSelect
              value={experienceLevel}
              onChange={setExperienceLevel}
              placeholder="Select experience level"
              options={EXPERIENCE_LEVELS}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Category</Label>
            <NativeSelect
              value={category}
              onChange={setCategory}
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
              value={hireRate != null ? Math.round(hireRate * 100 * 1e6) / 1e6 : ""}
              onChange={(e) => {
                if (!e.target.value) {
                  setHireRate(null)
                  return
                }
                const pct = Math.min(100, Math.max(0, Number(e.target.value)))
                setHireRate(Math.round((pct / 100) * 1e6) / 1e6)
              }}
            />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex flex-col gap-3">
          <Button className="w-full" onClick={handleCreate} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : <Check />}
            Create scanner & finish
          </Button>
          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={handleSkip}
            disabled={saving}
          >
            Skip for now — set up later in Job Scanner
          </Button>
        </div>
      </div>
    </div>
  )
}
