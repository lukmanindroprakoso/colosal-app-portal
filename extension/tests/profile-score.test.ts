import { describe, expect, it } from "vitest"
import {
  QUALITY_KEYS,
  buildScore,
  completenessItems,
  labelFor,
  profileMetrics,
  qualityItems,
} from "../../lib/upwork/profile-score"

const text = (n: number) => "x".repeat(n)
const list = (n: number) => Array.from({ length: n }, (_, i) => ({ i }))
const profile = (o: { title?: string; overview?: number; skills?: number; projects?: number; jobs?: number }) => ({
  personalData: { title: o.title ?? "", description: text(o.overview ?? 0) },
  skills: list(o.skills ?? 0),
  projectList: { projects: list(o.projects ?? 0) },
  employmentRecords: list(o.jobs ?? 0),
})
const points = (o: Parameters<typeof profile>[0]) =>
  Object.fromEntries(completenessItems(profileMetrics(profile(o))).map((i) => [i.key, i.points]))

describe("completeness (40 points)", () => {
  it("is 0 for an empty or missing profile and 40 for a full one", () => {
    const sum = (m: ReturnType<typeof profileMetrics>) => completenessItems(m).reduce((a, i) => a + i.points, 0)
    expect(sum(profileMetrics(null))).toBe(0)
    expect(sum(profileMetrics(profile({})))).toBe(0)
    expect(
      sum(profileMetrics(profile({ title: text(40), overview: 700, skills: 12, projects: 4, jobs: 3 })))
    ).toBe(40)
  })

  it("scores the headline by length: 25-70 is full", () => {
    expect(points({ title: text(24) }).headline).toBe(3)
    expect(points({ title: text(25) }).headline).toBe(6)
    expect(points({ title: text(70) }).headline).toBe(6)
    expect(points({ title: text(71) }).headline).toBe(3)
  })

  it("scores the overview at 200 and 600 characters", () => {
    expect(points({ overview: 199 }).overview).toBe(2)
    expect(points({ overview: 200 }).overview).toBe(6)
    expect(points({ overview: 599 }).overview).toBe(6)
    expect(points({ overview: 600 }).overview).toBe(10)
  })

  it("scores skills, portfolio and history by count", () => {
    expect([0, 1, 4, 5, 9, 10].map((n) => points({ skills: n }).skills)).toEqual([0, 2, 2, 5, 5, 8])
    expect([0, 1, 2, 3, 6].map((n) => points({ projects: n }).portfolio)).toEqual([0, 3, 5, 8, 8])
    expect([0, 1, 2, 5].map((n) => points({ jobs: n }).history)).toEqual([0, 4, 8, 8])
  })
})

describe("quality (60 points)", () => {
  const levels = (n: number) =>
    Object.fromEntries(QUALITY_KEYS.map((k) => [k.key, { level: n, evidence: "e", advice: "a" }]))

  it("maps level 0-4 to 0, 3, 5, 8, 10 points per criterion", () => {
    expect(QUALITY_KEYS).toHaveLength(6)
    const total = (n: number) => qualityItems(levels(n)).reduce((a, i) => a + i.points, 0)
    expect([0, 1, 2, 3, 4].map(total)).toEqual([0, 18, 30, 48, 60])
  })

  it("clamps and sanitizes levels coming from the model", () => {
    const raw = { ...levels(2), headline: { level: 9, evidence: "e", advice: "a" }, hook: { level: -3 }, proof: { level: "x" } }
    const items = Object.fromEntries(qualityItems(raw).map((i) => [i.key, i.points]))
    expect(items.headline).toBe(10)
    expect(items.hook).toBe(0)
    expect(items.proof).toBe(0)
  })

  it("treats a missing criterion as level 0", () => {
    const partial = { headline: { level: 4, evidence: "e", advice: "a" } }
    expect(qualityItems(partial).find((i) => i.key === "depth")!.points).toBe(0)
  })
})

describe("buildScore", () => {
  it("adds completeness and quality and labels the total", () => {
    const m = profileMetrics(profile({ title: text(40), overview: 700, skills: 12, projects: 4, jobs: 3 }))
    const q = Object.fromEntries(QUALITY_KEYS.map((k) => [k.key, { level: 4, evidence: "e", advice: "a" }]))
    const score = buildScore(m, q)
    expect(score.total).toBe(100)
    expect(score.label).toBe("Strong")
    expect(score.completeness.max).toBe(40)
    expect(score.quality.max).toBe(60)
  })

  it("labels by range: below 50, 50-74, 75 and up", () => {
    expect([0, 49, 50, 74, 75, 100].map(labelFor)).toEqual([
      "Needs work",
      "Needs work",
      "Good",
      "Good",
      "Strong",
      "Strong",
    ])
  })
})
