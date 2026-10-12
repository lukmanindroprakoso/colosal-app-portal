export type Template = { id: string; name: string | null }

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
  }
}

export type Rating = "good" | "neutral" | "poor" | "unknown"

export type ProposalResult = {
  coverLetter: string
  questionAnswers: { question: string; answer: string }[]
  confidence: { score: number | null; factors: { name: string; rating: Rating; note: string }[] }
}

export type ProfileResult = {
  report: { strengths: string[]; weaknesses: string[] }
  suggestions: { headline: string; overview: string; skills: string[] }
}
