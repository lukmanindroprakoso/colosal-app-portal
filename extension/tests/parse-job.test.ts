import { describe, expect, it } from "vitest"
import { ParseError, parseJobText } from "../lib/parse-job"
import { JOB_TEXT, JOB_TITLE } from "./fixtures/job-fixed"

describe("parseJobText", () => {
  it("parses a full fixed-price job page", () => {
    const job = parseJobText(JOB_TITLE, JOB_TEXT)
    expect(job.title).toBe(JOB_TITLE)
    expect(job.description.startsWith("Project Overview:")).toBe(true)
    expect(job.description.endsWith("without prior written permission.")).toBe(true)
    expect(job.budget).toBe("$2,500.00 Fixed-price")
    expect(job.experienceLevel).toBe("Expert")
    expect(job.projectType).toBe("Ongoing project")
    expect(job.questions).toEqual([
      "Describe your recent experience with similar projects",
      "Please list any certifications related to this project",
      "What frameworks have you worked with?",
      "Include a link to your GitHub profile and/or website",
    ])
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
      .filter((l) => !/^You will be asked|^\d\. /.test(l))
      .join("\n")
    expect(parseJobText(JOB_TITLE, text).questions).toEqual([])
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
