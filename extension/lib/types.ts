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

export type Rating = "good" | "neutral" | "poor" | "unknown"

export type ProposalResult = {
  coverLetter: string
  questionAnswers: { question: string; answer: string }[]
  confidence: { score: number | null; factors: { name: string; rating: Rating; note: string }[] }
}

// Colosal profile columns (user_profiles) that profile suggestions map to.
export type ProfileFields = { summary?: string; current_role?: string; skills_text?: string }

export type ProfileResult = {
  report: { strengths: string[]; weaknesses: string[] }
  suggestions: { headline: string; overview: string; skills: string[] }
  yourHeadline: string | null
}
