import type { JobData } from "./types"

export class ParseError extends Error {}

const NOT_JOB = "This is not an Upwork job details page. Open the job you want to apply to."
const MONEY = /^\$[\d,]+(\.\d+)?$/
const BUDGET = /^\$[\d,]+(\.\d+)?(\s*-\s*\$[\d,]+(\.\d+)?)?$/
const LEVEL = /^(Entry level|Intermediate|Expert)$/i
const HOURS_BLOCK = /^(More than|Less than)\s+\d+\s+hrs\/week$/i
const QUESTIONS_END =
  /^(Skills and Expertise|Preferred qualifications|Activity on this job|About the client|Project Type:)/i
const SKILLS_END = /^(Preferred qualifications|Activity on this job|Upgrade your membership)/i

// Parses the visible text of a job detail page (document.body.innerText), anchored on the
// page's own labels rather than CSS classes so Upwork markup changes break less often.
export function parseJobText(title: string, text: string): JobData {
  if (!title.trim()) throw new ParseError("Job title not found.")

  const raw = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
  // Upwork can render a range as separate lines ("$9.00", "-", "$12.00"): merge them.
  const lines: string[] = []
  for (let i = 0; i < raw.length; i++) {
    if (MONEY.test(raw[i]!) && raw[i + 1] === "-" && MONEY.test(raw[i + 2] ?? "")) {
      lines.push(`${raw[i]} - ${raw[i + 2]}`)
      i += 2
    } else {
      lines.push(raw[i]!)
    }
  }

  const idx = (re: RegExp, from = 0) => {
    for (let i = from; i < lines.length; i++) if (re.test(lines[i]!)) return i
    return -1
  }
  // Inline value ("Label: value"), searching in `src`.
  const grab = (re: RegExp, src = lines) => {
    for (const l of src) {
      const m = l.match(re)
      if (m) return m[1]!.trim()
    }
    return undefined
  }
  // Value of a "Label:" that may sit on the same line or on the next one.
  const field = (re: RegExp) => {
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i]!.match(re)
      if (m) return m[1]?.trim() || lines[i + 1]?.trim() || undefined
    }
    return undefined
  }
  const num = (v: string | undefined) => (v === undefined || Number.isNaN(Number(v)) ? undefined : Number(v))

  // Description: from the "Summary" heading (or just after the posted/location lines)
  // up to the first line that starts the metadata block.
  const summary = idx(/^Summary$/i)
  const posted = idx(/^Posted /)
  const start = summary !== -1 ? summary + 1 : posted !== -1 ? posted + 2 : -1
  if (start === -1) throw new ParseError(NOT_JOB)

  const budgetIdx = lines.findIndex(
    (l, i) => i >= start && BUDGET.test(l) && /^(fixed-price|hourly)/i.test(lines[i + 1] ?? "")
  )
  const skillsIdx = idx(/^Skills and Expertise$/, start)
  const stops = [
    idx(HOURS_BLOCK, start),
    budgetIdx,
    idx(/^Project Type:/, start),
    idx(/^You will be asked/, start),
    skillsIdx,
  ].filter((i) => i >= start)
  if (stops.length === 0) throw new ParseError(NOT_JOB)
  const descEnd = Math.min(...stops)
  const description = lines.slice(start, descEnd).join("\n")
  if (!description) throw new ParseError(NOT_JOB)

  const questions: string[] = []
  const q = idx(/^You will be asked/)
  if (q !== -1) {
    // innerText drops list markers, so questions arrive unnumbered; strip a number if present.
    for (let i = q + 1; i < lines.length && questions.length < 20 && !QUESTIONS_END.test(lines[i]!); i++) {
      const question = lines[i]!.replace(/^\d+\.\s*/, "")
      if (question) questions.push(question)
    }
  }

  const skills: string[] = []
  if (skillsIdx !== -1) {
    for (let i = skillsIdx + 1; i < lines.length && skills.length < 30 && !SKILLS_END.test(lines[i]!); i++) {
      skills.push(lines[i]!)
    }
  }

  const experienceLevel = lines.slice(descEnd, skillsIdx === -1 ? undefined : skillsIdx).find((l) => LEVEL.test(l))

  const about = idx(/^About the client$/)
  const client = about === -1 ? [] : lines.slice(about + 1)
  const time = client.findIndex((l) => /\d{1,2}:\d{2}\s*[AP]M$/i.test(l))

  return {
    title: title.trim(),
    description,
    questions,
    skills,
    budget: budgetIdx === -1 ? undefined : `${lines[budgetIdx]} ${lines[budgetIdx + 1]}`,
    experienceLevel,
    projectType: field(/^Project Type:\s*(.*)$/),
    englishLevel: field(/^English level:\s*(.*)$/),
    connectsCost: num(text.match(/Send a proposal for:\s*(\d+)\s*Connects/i)?.[1]),
    activity: {
      proposals: field(/^Proposals:\s*(.*)$/),
      interviewing: num(field(/^Interviewing:\s*(.*)$/)),
      invitesSent: num(field(/^Invites sent:\s*(.*)$/)),
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
      rating: grab(/^Rating is ([\d.]+) out of 5/i, client),
      totalSpent: grab(/^(\$[\d.,]+[KM]?)\s+total spent/i, client),
      hires: num(grab(/^(\d+)\s+hires/i, client)),
      avgHourlyRate: grab(/^(\$[\d.,]+)\s*\/hr avg hourly rate paid/i, client),
    },
  }
}
