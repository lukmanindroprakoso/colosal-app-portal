"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type ProfileFields = {
  summary: string
  current_role: string
  previous_experience: string
  skills_text: string
  portfolio: string
  key_proof_points: string
  positioning_notes: string
}

interface EmploymentRecord {
  companyName?: string | null
  jobTitle?: string | null
  startDateTime?: string | null
  endDateTime?: string | null
  description?: string | null
}

interface PortfolioProject {
  title?: string | null
  description?: string | null
  projectUrl?: string | null
}

function formatDate(raw: string | null | undefined): string {
  if (!raw) return "Present"
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? raw : d.toLocaleDateString("en-US", { month: "short", year: "numeric" })
}

function formatEmploymentRecords(records: EmploymentRecord[] | null | undefined): string | null {
  if (!records || records.length === 0) return null
  return records
    .map((r) => {
      const header = [r.jobTitle, r.companyName].filter(Boolean).join(" at ")
      const dates = `${formatDate(r.startDateTime)} - ${formatDate(r.endDateTime)}`
      return [header, dates, r.description].filter(Boolean).join("\n")
    })
    .join("\n\n")
}

function formatProjects(projects: PortfolioProject[] | null | undefined): string | null {
  if (!projects || projects.length === 0) return null
  return projects
    .map((p) => [p.title, p.projectUrl, p.description].filter(Boolean).join(" — "))
    .join("\n")
}

const FIELDS: { key: keyof ProfileFields; label: string; description: string; placeholder: string }[] = [
  {
    key: "summary",
    label: "Summary",
    description: "Your elevator pitch — who you are and what you do best",
    placeholder: "I help SaaS companies scale their outbound by writing cold emails that actually convert…",
  },
  {
    key: "current_role",
    label: "Current Role",
    description: "Your current title or focus",
    placeholder: "Freelance Copywriter specializing in B2B SaaS",
  },
  {
    key: "previous_experience",
    label: "Previous Experience",
    description: "Roles, industries, or backgrounds that shaped you",
    placeholder: "3 years in-house at a Series B fintech, then 2 years freelance...",
  },
  {
    key: "skills_text",
    label: "Skills",
    description: "Your core skills and tools",
    placeholder: "Cold email copywriting, HubSpot, Apollo, A/B testing, Notion…",
  },
  {
    key: "portfolio",
    label: "Portfolio",
    description: "Links to work samples, case studies, or projects",
    placeholder: "https://yourportfolio.com, notion link, Dribbble...",
  },
  {
    key: "key_proof_points",
    label: "Key Proof Points",
    description: "Metrics, results, or achievements that back your claims",
    placeholder: "Increased open rates from 18% → 42% for a $2M ARR SaaS client…",
  },
  {
    key: "positioning_notes",
    label: "Positioning Notes",
    description: "How you stand out from others in your niche",
    placeholder: "I focus only on Series A–C SaaS, never take on e-commerce clients…",
  },
]

export default function OnboardingStep3() {
  const router = useRouter()
  const [fields, setFields] = useState<ProfileFields>({
    summary: "",
    current_role: "",
    previous_experience: "",
    skills_text: "",
    portfolio: "",
    key_proof_points: "",
    positioning_notes: "",
  })
  const [loading, setLoading] = useState(false)
  const [prefilling, setPrefilling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function prefillFromUpwork() {
      setPrefilling(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("access_token")
        .eq("user_id", user.id)
        .single()

      if (!profile?.access_token) {
        setPrefilling(false)
        return
      }

      try {
        const res = await fetch("/api/upwork/profile")
        if (res.ok) {
          const data = await res.json()
          const p = data.profile
          setFields((prev) => ({
            ...prev,
            summary: p?.personalData?.description ?? prev.summary,
            current_role: p?.personalData?.title ?? prev.current_role,
            skills_text:
              p?.skills?.map((s: { prettyName: string }) => s.prettyName).filter(Boolean).join(", ") ??
              prev.skills_text,
            previous_experience: formatEmploymentRecords(p?.employmentRecords) ?? prev.previous_experience,
            portfolio: formatProjects(p?.projectList?.projects) ?? prev.portfolio,
          }))
        }
      } catch {
        // Prefill failed silently — user fills manually
      }
      setPrefilling(false)
    }
    prefillFromUpwork()
  }, [])

  function update(key: keyof ProfileFields, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push("/login")
      return
    }
    const { error } = await supabase
      .from("user_profiles")
      .update(fields)
      .eq("user_id", user.id)
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    router.push("/onboarding/step-4")
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="text-center space-y-1">
          <p className="text-sm text-muted-foreground">Step 3 of 3</p>
          <h1 className="text-3xl font-bold">Build your profile</h1>
          <p className="text-muted-foreground">
            {prefilling ? "Pulling your Upwork data…" : "Fill in what you know — you can always edit this later"}
          </p>
        </div>

        <div className="space-y-5">
          {FIELDS.map(({ key, label, description, placeholder }) => (
            <div key={key} className="space-y-1">
              <Label htmlFor={key} className="text-base font-medium">{label}</Label>
              <p className="text-sm text-muted-foreground">{description}</p>
              <Textarea
                id={key}
                placeholder={placeholder}
                value={fields[key]}
                onChange={(e) => update(key, e.target.value)}
                className="min-h-[80px] resize-y"
                disabled={prefilling}
              />
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex flex-col gap-3">
          <Button
            className="w-full"
            onClick={() => handleSave()}
            disabled={loading || prefilling}
          >
            {loading ? "Saving…" : "Continue"}
          </Button>
          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={() => handleSave()}
            disabled={loading || prefilling}
          >
            Skip for now — complete later in Settings
          </Button>
        </div>
      </div>
    </div>
  )
}
