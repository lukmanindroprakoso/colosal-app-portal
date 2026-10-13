import { describe, expect, it } from "vitest"
import { compareToTop, isTop, median, overviewTraits, summarize, type TalentCard } from "../../lib/upwork/benchmark"

const card = (o: Partial<TalentCard> = {}): TalentCard => ({
  headline: "x".repeat(60),
  rate: 20,
  jobSuccess: 100,
  earned: 10000,
  skills: ["a", "b"],
  extraSkills: 8,
  overview: "x".repeat(1000),
  ...o,
})

describe("isTop", () => {
  it("needs Job Success 90+ and earned 5K+", () => {
    expect(isTop(card())).toBe(true)
    expect(isTop(card({ jobSuccess: 89 }))).toBe(false)
    expect(isTop(card({ jobSuccess: null }))).toBe(false)
    expect(isTop(card({ earned: 4999 }))).toBe(false)
    expect(isTop(card({ earned: null }))).toBe(false)
  })
})

describe("median", () => {
  it("handles odd, even, empty and unsorted input", () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([1, 2, 3, 4])).toBe(2.5)
    expect(median([])).toBeNull()
  })
})

describe("overviewTraits", () => {
  it("detects emoji, bullets, concrete numbers and a call to action", () => {
    expect(overviewTraits("Plain text only.")).toEqual({ emoji: false, bullets: false, numbers: false, cta: false })
    expect(overviewTraits("🚀 Hello").emoji).toBe(true)
    expect(overviewTraits("What I do • APIs • Dashboards").bullets).toBe(true)
    expect(overviewTraits("5+ years and 33 clients").numbers).toBe(true)
    expect(overviewTraits("Delivered $3M in revenue").numbers).toBe(true)
    expect(overviewTraits("Message me to discuss").cta).toBe(true)
  })
})

describe("summarize", () => {
  it("returns null when fewer than 3 top profiles are on the page", () => {
    expect(summarize([card(), card(), card({ jobSuccess: 50 })])).toBeNull()
  })

  it("computes medians and trait shares over top profiles only", () => {
    const cards = [
      card({ overview: "🚀 " + "x".repeat(997) }),
      card({ overview: "x".repeat(2000), skills: ["a"], extraSkills: 14 }),
      card({ overview: "x".repeat(3000), headline: "y".repeat(80), rate: 40 }),
      card({ jobSuccess: 10, overview: "ignored" }),
    ]
    const s = summarize(cards)!
    expect(s.sample).toBe(3)
    expect(s.overviewLen).toBe(2000)
    expect(s.headlineLen).toBe(60)
    expect(s.skills).toBe(10)
    expect(s.rate).toBe(20)
    expect(s.emojiPct).toBe(33)
  })
})

describe("compareToTop", () => {
  const stats = summarize([card(), card(), card()])!
  const own = (o = {}) => ({
    headlineLen: 60,
    overviewLen: 1000,
    skills: 10,
    overview: "plain",
    ...o,
  })

  it("marks a metric below when you are under 80% of the top median", () => {
    const rows = compareToTop(own({ overviewLen: 700 }), stats)
    expect(rows.find((r) => r.key === "overviewLen")).toMatchObject({ you: "700", top: "1000", verdict: "below" })
    expect(rows.find((r) => r.key === "headlineLen")!.verdict).toBe("similar")
  })

  it("marks a metric above when you are over 125% of the top median", () => {
    expect(compareToTop(own({ skills: 14 }), stats).find((r) => r.key === "skills")!.verdict).toBe("above")
  })

  it("flags a trait that most top profiles use and you do not", () => {
    const withBullets = summarize([card({ overview: "• a" }), card({ overview: "• b" }), card({ overview: "x" })])!
    const row = compareToTop(own(), withBullets).find((r) => r.key === "bullets")!
    expect(row).toMatchObject({ you: "No", top: "67% use it", verdict: "missing" })
    expect(compareToTop(own({ overview: "• a" }), withBullets).find((r) => r.key === "bullets")!.verdict).toBe("good")
  })
})
