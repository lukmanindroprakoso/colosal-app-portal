import { describe, expect, it } from "vitest"
import { looksLikeOwnProfile } from "../lib/own-profile"

const PAGE = `Lukman Prasetyo
Full-Stack Developer | AI Automation & Next.js
Indonesia
$25.00/hr
About
I build products with Next.js and Supabase.`

describe("looksLikeOwnProfile", () => {
  it("matches when the page contains the start of the API headline", () => {
    expect(looksLikeOwnProfile(PAGE, "Full-Stack Developer | AI Automation & Next.js")).toBe(true)
  })

  it("ignores case, extra whitespace and curly quotes", () => {
    expect(looksLikeOwnProfile("FULL-STACK   developer |\nAI Automation", "Full-Stack Developer | AI Automation")).toBe(
      true
    )
    expect(looksLikeOwnProfile("I build “fast” apps and ship them quickly", "I build \"fast\" apps and ship them")).toBe(
      true
    )
  })

  it("is false when the page belongs to someone else", () => {
    expect(looksLikeOwnProfile("Jane Doe\nSenior Data Scientist | Machine Learning", "Full-Stack Developer | AI Automation")).toBe(
      false
    )
  })

  it("is unknown (null) when there is no usable headline", () => {
    expect(looksLikeOwnProfile(PAGE, null)).toBeNull()
    expect(looksLikeOwnProfile(PAGE, "   ")).toBeNull()
    expect(looksLikeOwnProfile(PAGE, "Dev")).toBeNull()
  })
})
