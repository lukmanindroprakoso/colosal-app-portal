// Benchmark of a profile against the top freelancers on an Upwork talent search page.
// Pure module (no imports). "Top" = Job Success 90%+ and earned $5K+. Cards carry no names.

export type TalentCard = {
  headline: string
  rate: number | null
  jobSuccess: number | null
  earned: number | null
  skills: string[]
  extraSkills: number
  overview: string
}

export const isTop = (c: TalentCard) => (c.jobSuccess ?? 0) >= 90 && (c.earned ?? 0) >= 5000

export function median(nums: number[]): number | null {
  if (nums.length === 0) return null
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}

export type OverviewTraits = { emoji: boolean; bullets: boolean; numbers: boolean; cta: boolean }

export function overviewTraits(text: string): OverviewTraits {
  return {
    emoji: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}]/u.test(text),
    bullets: /[•✔✅✓▪●►]|(?:^|\s)[-*]\s+\S/.test(text),
    numbers: /\d+\+?\s*(years?|yrs?|projects?|clients?)\b|\d+%|\$\d/i.test(text),
    cta: /\b(message me|invite me|contact me|get in touch|let'?s (talk|discuss|work|build|chat)|reach out|send me|connect with me|dm me)\b/i.test(
      text
    ),
  }
}

export type BenchmarkStats = {
  sample: number
  headlineLen: number
  skills: number
  overviewLen: number
  rate: number | null
  emojiPct: number
  bulletsPct: number
  numbersPct: number
  ctaPct: number
}

const MIN_SAMPLE = 3

// null when the page has too few top profiles for the numbers to mean anything.
export function summarize(cards: TalentCard[]): BenchmarkStats | null {
  const top = cards.filter(isTop)
  if (top.length < MIN_SAMPLE) return null
  const traits = top.map((c) => overviewTraits(c.overview))
  const pct = (k: keyof OverviewTraits) => Math.round((traits.filter((t) => t[k]).length / top.length) * 100)
  return {
    sample: top.length,
    headlineLen: median(top.map((c) => c.headline.length))!,
    skills: median(top.map((c) => c.skills.length + c.extraSkills))!,
    overviewLen: median(top.map((c) => c.overview.length))!,
    rate: median(top.flatMap((c) => (c.rate === null ? [] : [c.rate]))),
    emojiPct: pct("emoji"),
    bulletsPct: pct("bullets"),
    numbersPct: pct("numbers"),
    ctaPct: pct("cta"),
  }
}

export type BenchmarkRow = {
  key: string
  label: string
  you: string
  top: string
  verdict: "below" | "similar" | "above" | "good" | "missing" | "optional"
}

type Own = { headlineLen: number; overviewLen: number; skills: number; overview: string }

export function compareToTop(own: Own, stats: BenchmarkStats): BenchmarkRow[] {
  const numeric = (key: string, label: string, you: number, top: number): BenchmarkRow => ({
    key,
    label,
    you: String(Math.round(you)),
    top: String(Math.round(top)),
    verdict: top <= 0 ? "similar" : you < top * 0.8 ? "below" : you > top * 1.25 ? "above" : "similar",
  })
  const t = overviewTraits(own.overview)
  const trait = (key: keyof OverviewTraits, label: string, pct: number): BenchmarkRow => ({
    key,
    label,
    you: t[key] ? "Yes" : "No",
    top: `${pct}% use it`,
    verdict: pct >= 50 ? (t[key] ? "good" : "missing") : "optional",
  })
  return [
    numeric("headlineLen", "Headline length (characters)", own.headlineLen, stats.headlineLen),
    numeric("skills", "Skills listed", own.skills, stats.skills),
    numeric("overviewLen", "Overview length (characters)", own.overviewLen, stats.overviewLen),
    trait("bullets", "Overview uses bullet lists", stats.bulletsPct),
    trait("numbers", "Overview cites numbers and results", stats.numbersPct),
    trait("cta", "Overview ends with a call to action", stats.ctaPct),
    trait("emoji", "Overview uses emoji", stats.emojiPct),
  ]
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null)
const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "")

// Cards come from the browser: keep only the known fields, with sane types and sizes.
export function cleanCards(raw: unknown): TalentCard[] {
  return (Array.isArray(raw) ? raw : []).slice(0, 40).map((c) => ({
    headline: text(c?.headline, 300),
    rate: num(c?.rate),
    jobSuccess: num(c?.jobSuccess),
    earned: num(c?.earned),
    skills: (Array.isArray(c?.skills) ? c.skills : []).slice(0, 40).map((s: unknown) => text(s, 60)),
    extraSkills: Math.min(200, Math.max(0, Math.round(num(c?.extraSkills) ?? 0))),
    overview: text(c?.overview, 3000),
  }))
}
