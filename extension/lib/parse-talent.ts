import { ParseError } from "./parse-job"

// Same shape as TalentCard in lib/upwork/benchmark.ts (kept separate so the extension bundle
// does not import from outside its folder). Names and countries are deliberately not kept.
export type TalentCard = {
  headline: string
  rate: number | null
  jobSuccess: number | null
  earned: number | null
  skills: string[]
  extraSkills: number
  overview: string
}

const STATUS = /^Status (away|offline|online)\b/i
const PAGE_END = /^(People also searched for|Pagination|Footer navigation)$/i
const WORKED = /has worked \d+ jobs? related to your search\.?$/i

const amount = (n: string, unit: string) =>
  Number(n.replace(/,/g, "")) * (unit.toUpperCase() === "K" ? 1e3 : unit.toUpperCase() === "M" ? 1e6 : 1)

// Parses the freelancer cards of an Upwork talent search page (document.body.innerText).
// Each card starts with its "Status ..." line, followed by name, headline and country.
export function parseTalentCards(text: string): TalentCard[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
  const starts = lines.flatMap((l, i) => (STATUS.test(l) ? [i] : []))

  const cards: TalentCard[] = []
  starts.forEach((start, n) => {
    let chunk = lines.slice(start + 1, starts[n + 1] ?? lines.length)
    const end = chunk.findIndex((l) => PAGE_END.test(l))
    if (end !== -1) chunk = chunk.slice(0, end)
    const [, headline, , ...rest] = chunk // [name, headline, country, ...]
    if (!headline) return

    const find = (re: RegExp) => rest.map((l) => l.match(re)).find(Boolean)
    const rate = find(/^\$([\d,.]+)\/hr$/)
    const jss = find(/^(\d+)% Job Success$/)
    const earned = find(/^\$([\d,.]+)([KM]?)\+ earned$/)

    const from = rest.findIndex((l) => l === "Start of list.")
    const to = rest.findIndex((l) => l === "End of list.")
    const listed = from !== -1 && to > from ? rest.slice(from + 1, to) : []
    const more = listed.length ? listed[listed.length - 1]!.match(/^\+(\d+)$/) : null
    const skills = more ? listed.slice(0, -1) : listed
    const overview = (to !== -1 ? rest.slice(to + 1) : [])
      .filter((l) => !WORKED.test(l))
      .join(" ")

    cards.push({
      headline,
      rate: rate ? Number(rate[1]!.replace(/,/g, "")) : null,
      jobSuccess: jss ? Number(jss[1]) : null,
      earned: earned ? amount(earned[1]!, earned[2] ?? "") : null,
      skills,
      extraSkills: more ? Number(more[1]) : 0,
      overview,
    })
  })

  if (cards.length === 0) throw new ParseError("No freelancer cards found. Open a freelancer search results page on Upwork.")
  return cards
}
