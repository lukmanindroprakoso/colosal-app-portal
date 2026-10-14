export type Template = { id: string; name: string | null; template: string; ai_instruction: string }
export type TemplateInput = { id?: string; name: string; template: string; ai_instruction: string }

export type JobData = {
  title: string
  description: string
  questions: string[]
  skills: string[]
  budget?: string
  experienceLevel?: string
  projectType?: string
  englishLevel?: string
  connectsCost?: number
  activity?: { proposals?: string; interviewing?: number; invitesSent?: number }
  client?: {
    paymentVerified?: boolean
    country?: string
    jobsPosted?: number
    hireRate?: string
    memberSince?: string
    rating?: string
    totalSpent?: string
    hires?: number
    avgHourlyRate?: string
  }
}

// Result of revising a draft: the confidence from the first generation is kept by the panel.
export type ProposalRevision = Pick<ProposalResult, "coverLetter" | "questionAnswers">

export type Rating = "good" | "neutral" | "poor" | "unknown"

export type ProposalResult = {
  coverLetter: string
  questionAnswers: { question: string; answer: string }[]
  confidence: { score: number | null; factors: { name: string; rating: Rating; note: string }[] }
}

// Colosal profile columns (user_profiles) that profile suggestions map to.
export type ProfileFields = { summary?: string; current_role?: string; skills_text?: string }

export type ScoreItem = { key: string; label: string; points: number; max: number; note: string; evidence?: string }
export type ScoreGroup = { points: number; max: number; items: ScoreItem[] }
export type ProfileScore = {
  total: number
  label: "Needs work" | "Good" | "Strong"
  completeness: ScoreGroup
  quality: ScoreGroup
}

export type BenchmarkRow = {
  key: string
  label: string
  you: string
  top: string
  verdict: "below" | "similar" | "above" | "good" | "missing" | "optional"
}
export type BenchmarkResult = {
  sample: number
  topRate: number | null
  rows: BenchmarkRow[]
  recommendations: string[]
}

export type OptimizeResult = {
  suggestions: { headline: string; overview: string; skills: string[] }
  changes: string[]
}

export type ProfileResult = {
  report: { strengths: string[]; weaknesses: string[] }
  suggestions: { headline: string; overview: string; skills: string[] }
  yourHeadline: string | null
  score: ProfileScore
}
