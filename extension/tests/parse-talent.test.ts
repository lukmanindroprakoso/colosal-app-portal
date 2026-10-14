import { describe, expect, it } from "vitest"
import { ParseError } from "../lib/parse-job"
import { parseTalentCards } from "../lib/parse-talent"
import { TALENT_TEXT } from "./fixtures/talent-search"

describe("parseTalentCards", () => {
  it("parses every card on the page and never keeps names", () => {
    const cards = parseTalentCards(TALENT_TEXT)
    expect(cards).toHaveLength(4)
    expect(JSON.stringify(cards)).not.toContain("Dev A.")
  })

  it("reads headline, rate, job success, earned and skills", () => {
    const [a, b] = parseTalentCards(TALENT_TEXT)
    expect(a).toMatchObject({
      headline: "Full Stack NextJS & React Developer | AI, SaaS, CMS, B2B",
      rate: 10,
      jobSuccess: 100,
      earned: 10000,
      skills: ["Next.js", "TypeScript", "Tailwind CSS"],
      extraSkills: 7,
    })
    expect(a!.overview).toContain("What I Can Help You With")
    expect(b).toMatchObject({ rate: 5, extraSkills: 6, skills: ["Next.js", "JavaScript"] })
  })

  it("drops the 'has worked N jobs' line and the 'People also searched for' block from the overview", () => {
    const c = parseTalentCards(TALENT_TEXT)[2]!
    expect(c.overview).toBe("I build SaaS apps. Delivered projects generating $3M+ in revenue. 33 satisfied clients.")
    expect(c.earned).toBe(20000)
  })

  it("keeps a card without Job Success and reads small earned amounts", () => {
    const d = parseTalentCards(TALENT_TEXT)[3]!
    expect(d.jobSuccess).toBeNull()
    expect(d.earned).toBe(400)
    expect(d.overview).toBe("I'm a full-stack JavaScript developer.")
  })

  it("throws ParseError when the page has no freelancer cards", () => {
    expect(() => parseTalentCards("Search\nHome\nMessages")).toThrow(ParseError)
  })
})
