import { describe, expect, it } from "vitest"
import { ParseError, parseJobText } from "../lib/parse-job"
import { JOB_TEXT, JOB_TITLE } from "./fixtures/job-fixed"
import { REAL_TEXT, REAL_TITLE } from "./fixtures/job-hourly-real"

const QUESTION_LINES = [
  "Describe your recent experience with similar projects",
  "Please list any certifications related to this project",
  "What frameworks have you worked with?",
  "Include a link to your GitHub profile and/or website",
]

describe("parseJobText", () => {
  it("parses a full fixed-price job page", () => {
    const job = parseJobText(JOB_TITLE, JOB_TEXT)
    expect(job.title).toBe(JOB_TITLE)
    expect(job.description.startsWith("Project Overview:")).toBe(true)
    expect(job.description.endsWith("without prior written permission.")).toBe(true)
    expect(job.budget).toBe("$2,500.00 Fixed-price")
    expect(job.experienceLevel).toBe("Expert")
    expect(job.projectType).toBe("Ongoing project")
    expect(job.questions).toEqual(QUESTION_LINES)
    expect(job.skills).toEqual(["Stripe", "Supabase", "PostgreSQL", "JavaScript", "API Integration"])
    expect(job.englishLevel).toBe("Conversational")
    expect(job.connectsCost).toBe(13)
    expect(job.activity).toEqual({ proposals: "50+", interviewing: 0, invitesSent: 0 })
    expect(job.client).toEqual({
      paymentVerified: false,
      country: "United States",
      jobsPosted: 1,
      hireRate: "0%",
      memberSince: "Oct 12, 2026",
    })
  })

  it("returns empty questions when the screening block is absent", () => {
    const text = JOB_TEXT.split("\n")
      .filter((l) => !/^You will be asked/.test(l) && !QUESTION_LINES.includes(l))
      .join("\n")
    expect(parseJobText(JOB_TITLE, text).questions).toEqual([])
  })

  it("accepts numbered questions as well (markers present in the text)", () => {
    const text = JOB_TEXT.split("\n")
      .map((l) => (QUESTION_LINES.includes(l) ? `${QUESTION_LINES.indexOf(l) + 1}. ${l}` : l))
      .join("\n")
    expect(parseJobText(JOB_TITLE, text).questions).toEqual(QUESTION_LINES)
  })

  it("parses a budget range split over several lines", () => {
    const text = JOB_TEXT.replace("$2,500.00\nFixed-price", "$9.00\n-\n$12.00\nHourly")
    expect(parseJobText(JOB_TITLE, text).budget).toBe("$9.00 - $12.00 Hourly")
  })

  it("parses an hourly budget range", () => {
    const text = JOB_TEXT.replace("$2,500.00\nFixed-price", "$20.00 - $40.00\nHourly")
    const job = parseJobText(JOB_TITLE, text)
    expect(job.budget).toBe("$20.00 - $40.00 Hourly")
    expect(job.experienceLevel).toBe("Expert")
  })

  it("throws ParseError on a page that is not a job detail", () => {
    expect(() => parseJobText("Find work", "Search\nHome\nMessages\nSaved jobs")).toThrow(ParseError)
  })

  it("throws ParseError when the title is empty", () => {
    expect(() => parseJobText("  ", JOB_TEXT)).toThrow(ParseError)
  })
})

describe("parseJobText on a real hourly page", () => {
  it("extracts every field, including values on the line after their label", () => {
    const job = parseJobText(REAL_TITLE, REAL_TEXT)
    expect(job.title).toBe(REAL_TITLE)
    expect(job.description.startsWith("We are seeking an experienced AI-Focused")).toBe(true)
    expect(job.description.endsWith("- Location: Remote")).toBe(true)
    expect(job.description).not.toContain("More than 6 months")
    expect(job.budget).toBe("$9.00 - $12.00 Hourly")
    expect(job.experienceLevel).toBe("Expert")
    expect(job.projectType).toBe("Ongoing project")
    expect(job.questions).toEqual([
      "How many years of experience do you have as a Full-Stack Developer?",
      "How many years of experience do you have working with AI/LLM tools such as OpenAI or Claude?",
      "Have you built any AI-powered applications? If yes, please briefly describe one.",
      "Can you provide a link to your GitHub, portfolio, or examples of your previous AI projects?",
    ])
    expect(job.skills).toEqual([
      "LangChain",
      "Next.js",
      "GitHub",
      "Vercel",
      "LlamaIndex",
      "LLM API",
      "Python",
      "Node.js",
      "API",
      "React",
    ])
    expect(job.englishLevel).toBe("Fluent")
    expect(job.connectsCost).toBe(21)
    expect(job.activity).toEqual({ proposals: "5 to 10", interviewing: 0, invitesSent: 0 })
    expect(job.client).toEqual({
      paymentVerified: true,
      country: "United States",
      jobsPosted: 307,
      hireRate: "14%",
      memberSince: "Jan 10, 2022",
      rating: "5.0",
      totalSpent: "$81K",
      hires: 44,
      avgHourlyRate: "$5.81",
    })
  })
})
