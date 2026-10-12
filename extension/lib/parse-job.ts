import type { JobData } from "./types"

export class ParseError extends Error {}

const NOT_JOB = "Halaman ini bukan halaman detail job Upwork. Buka job yang ingin Anda lamar."
const BUDGET = /^\$[\d,]+(\.\d+)?(\s*-\s*\$[\d,]+(\.\d+)?)?$/
const SKILLS_END = /^(Preferred qualifications|Activity on this job|Upgrade your membership)/i

// Parses the visible text of a job detail page (document.body.innerText), anchored on the
// page's own labels rather than CSS classes so Upwork markup changes break less often.
export function parseJobText(title: string, text: string): JobData {
  if (!title.trim()) throw new ParseError("Judul job tidak ditemukan.")

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
  const idx = (re: RegExp, from = 0) => {
    for (let i = from; i < lines.length; i++) if (re.test(lines[i]!)) return i
    return -1
  }
  const grab = (re: RegExp, src = lines) => {
    for (const l of src) {
      const m = l.match(re)
      if (m) return m[1]!.trim()
    }
    return undefined
  }
  const num = (v: string | undefined) => (v === undefined ? undefined : Number(v))

  // Description: from the "Summary" heading (or just after the posted/location lines)
  // up to the first line that starts the metadata block.
  const summary = idx(/^Summary$/i)
  const posted = idx(/^Posted /)
  const start = summary !== -1 ? summary + 1 : posted !== -1 ? posted + 2 : -1
  if (start === -1) throw new ParseError(NOT_JOB)

  const budgetIdx = lines.findIndex(
    (l, i) => i >= start && BUDGET.test(l) && /^(fixed-price|hourly)/i.test(lines[i + 1] ?? "")
  )
  const stops = [
    budgetIdx,
    idx(/^Project Type:/, start),
    idx(/^You will be asked/, start),
    idx(/^Skills and Expertise$/, start),
  ].filter((i) => i >= start)
  if (stops.length === 0) throw new ParseError(NOT_JOB)
  const description = lines.slice(start, Math.min(...stops)).join("\n")
  if (!description) throw new ParseError(NOT_JOB)

  const questions: string[] = []
  const q = idx(/^You will be asked/)
  if (q !== -1) {
    for (let i = q + 1; i < lines.length; i++) {
      const m = lines[i]!.match(/^\d+\.\s+(.+)$/)
      if (!m) break
      questions.push(m[1]!)
    }
  }

  const skills: string[] = []
  const s = idx(/^Skills and Expertise$/)
  if (s !== -1) {
    for (let i = s + 1; i < lines.length && skills.length < 30 && !SKILLS_END.test(lines[i]!); i++) {
      skills.push(lines[i]!)
    }
  }

  const experienceLevel =
    budgetIdx === -1
      ? undefined
      : lines.slice(budgetIdx + 2, budgetIdx + 4).find((l) => /^(Entry level|Intermediate|Expert)$/i.test(l))

  const about = idx(/^About the client$/)
  const client = about === -1 ? [] : lines.slice(about + 1)
  const time = client.findIndex((l) => /^\d{1,2}:\d{2}\s*[AP]M$/i.test(l))

  return {
    title: title.trim(),
    description,
    questions,
    skills,
    budget: budgetIdx === -1 ? undefined : `${lines[budgetIdx]} ${lines[budgetIdx + 1]}`,
    experienceLevel,
    projectType: grab(/^Project Type:\s*(.+)$/),
    englishLevel: grab(/^English level:\s*(.+)$/),
    connectsCost: num(text.match(/Send a proposal for:\s*(\d+)\s*Connects/i)?.[1]),
    activity: {
      proposals: grab(/^Proposals:\s*(.+)$/),
      interviewing: num(grab(/^Interviewing:\s*(\d+)/)),
      invitesSent: num(grab(/^Invites sent:\s*(\d+)/)),
    },
    client: {
      paymentVerified: client.some((l) => /^Payment method not verified/i.test(l))
        ? false
        : client.some((l) => /^Payment method verified/i.test(l))
          ? true
          : undefined,
      country: time > 0 ? client[time - 1] : undefined,
      jobsPosted: num(grab(/^(\d+)\s+jobs?\s+posted/i, client)),
      hireRate: grab(/^(\d+%)\s+hire rate/i, client),
      memberSince: grab(/^Member since\s+(.+)$/i, client),
    },
  }
}
