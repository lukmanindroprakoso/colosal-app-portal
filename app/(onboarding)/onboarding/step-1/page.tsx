"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const USER_TYPES = [
  {
    value: "freelancer",
    label: "Personal Freelancer",
    description: "I work independently and manage my own clients",
  },
  {
    value: "agency",
    label: "Agency",
    description: "I run or work at an agency with a team",
  },
  {
    value: "other",
    label: "Other",
    description: "Something else — I'll describe it",
  },
]

export default function OnboardingStep1() {
  const router = useRouter()
  const [selected, setSelected] = useState<string | null>(null)
  const [customType, setCustomType] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleNext() {
    if (!selected) return
    if (selected === "other" && !customType.trim()) {
      setError("Please describe how you work")
      return
    }
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
      .update({ user_type: selected, custom_type: selected === "other" ? customType : null })
      .eq("user_id", user.id)
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    router.push("/onboarding/step-2")
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-1">
          <p className="text-sm text-muted-foreground">Step 1 of 3</p>
          <h1 className="text-3xl font-bold">How do you work?</h1>
          <p className="text-muted-foreground">This helps us tailor your Colosal experience</p>
        </div>

        <div className="grid gap-3">
          {USER_TYPES.map((type) => (
            <Card
              key={type.value}
              className={`cursor-pointer transition-colors ${
                selected === type.value
                  ? "border-primary bg-primary/5"
                  : "hover:border-muted-foreground/50"
              }`}
              onClick={() => setSelected(type.value)}
            >
              <CardHeader className="py-4">
                <div className="flex items-center gap-3">
                  <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                    selected === type.value ? "border-primary" : "border-muted-foreground"
                  }`}>
                    {selected === type.value && (
                      <div className="h-2 w-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-base">{type.label}</CardTitle>
                    <CardDescription className="text-sm">{type.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>

        {selected === "other" && (
          <div className="space-y-1">
            <Label htmlFor="custom-type">Describe how you work</Label>
            <Input
              id="custom-type"
              placeholder="e.g. Solo consultant, Co-founder, Creative studio…"
              value={customType}
              onChange={(e) => setCustomType(e.target.value)}
            />
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          className="w-full"
          onClick={handleNext}
          disabled={!selected || loading}
        >
          {loading ? "Saving…" : "Continue"}
        </Button>
      </div>
    </div>
  )
}
