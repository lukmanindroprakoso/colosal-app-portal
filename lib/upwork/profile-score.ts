// Profile score (0-100) = completeness (40, fixed rules) + quality (60, six criteria the model rates
// 0-4 against anchored definitions). The model only returns levels and evidence; every number below
// is computed here so the same levels always give the same score. Pure module: no imports.

export type TalentProfile = {
  personalData?: { title?: string | null; description?: string | null } | null
  employmentRecords?: unknown[] | null
  projectList?: { projects?: unknown[] | null } | null
  skills?: unknown[] | null
} | null

export type ScoreItem = { key: string; label: string; points: number; max: number; note: string; evidence?: string }

export type ProfileMetrics = {
  headline: string
  overview: string
  headlineLen: number
  overviewLen: number
  skills: number
  projects: number
  jobs: number
}

export function profileMetrics(p: TalentProfile | undefined): ProfileMetrics {
  const headline = (p?.personalData?.title ?? "").trim()
  const overview = (p?.personalData?.description ?? "").trim()
  return {
    headline,
    overview,
    headlineLen: headline.length,
    overviewLen: overview.length,
    skills: p?.skills?.length ?? 0,
    projects: p?.projectList?.projects?.length ?? 0,
    jobs: p?.employmentRecords?.length ?? 0,
  }
}

// Picks the points for the first band the value reaches (bands sorted from the highest threshold down).
const band = (value: number, bands: [number, number, string][], fallback: [number, string]) => {
  for (const [min, points, note] of bands) if (value >= min) return { points, note }
  return { points: fallback[0], note: fallback[1] }
}

export function completenessItems(m: ProfileMetrics): ScoreItem[] {
  const headline =
    m.headlineLen === 0
      ? { points: 0, note: "No headline. Add a clear role and niche (25-70 characters)." }
      : m.headlineLen >= 25 && m.headlineLen <= 70
        ? { points: 6, note: "Headline length is good." }
        : { points: 3, note: "Aim for 25-70 characters so the headline is not cut off or too thin." }

  const overview = band(
    m.overviewLen,
    [
      [600, 10, "Overview has enough room to make your case."],
      [200, 6, "Overview is short. Aim for 600+ characters."],
      [1, 2, "Overview is very short. Aim for 600+ characters."],
    ],
    [0, "No overview. Write 600+ characters about who you help and how."]
  )
  const skills = band(
    m.skills,
    [
      [10, 8, "Good number of skills."],
      [5, 5, "Add more skills, up to 15."],
      [1, 2, "Very few skills. Add up to 15 relevant ones."],
    ],
    [0, "No skills listed. Add up to 15 relevant ones."]
  )
  const portfolio = band(
    m.projects,
    [
      [3, 8, "Portfolio has several projects."],
      [2, 5, "Add at least one more project."],
      [1, 3, "Only one project. Add at least three."],
    ],
    [0, "No portfolio projects. Add at least three."]
  )
  const history = band(
    m.jobs,
    [
      [2, 8, "Work history is filled in."],
      [1, 4, "Add another role to your work history."],
    ],
    [0, "No work history. Add your relevant roles."]
  )

  return [
    { key: "headline", label: "Headline", max: 6, ...headline },
    { key: "overview", label: "Overview length", max: 10, ...overview },
    { key: "skills", label: "Skills", max: 8, ...skills },
    { key: "portfolio", label: "Portfolio", max: 8, ...portfolio },
    { key: "history", label: "Work history", max: 8, ...history },
  ]
}

export const QUALITY_KEYS = [
  { key: "headline", label: "Headline clarity" },
  { key: "hook", label: "Overview opening" },
  { key: "proof", label: "Proof and results" },
  { key: "client_focus", label: "Client focus" },
  { key: "consistency", label: "Consistency" },
  { key: "depth", label: "Portfolio and history detail" },
] as const

const LEVEL_POINTS = [0, 3, 5, 8, 10]

type RawQuality = Record<string, { level?: unknown; evidence?: unknown; advice?: unknown } | undefined>

export function qualityItems(raw: RawQuality): ScoreItem[] {
  return QUALITY_KEYS.map(({ key, label }) => {
    const r = raw[key]
    const n = Number(r?.level)
    const level = Number.isFinite(n) ? Math.min(4, Math.max(0, Math.round(n))) : 0
    const evidence = typeof r?.evidence === "string" ? r.evidence.slice(0, 200) : ""
    return {
      key,
      label,
      points: LEVEL_POINTS[level]!,
      max: 10,
      note: typeof r?.advice === "string" ? r.advice.slice(0, 300) : "",
      ...(evidence ? { evidence } : {}),
    }
  })
}

export const labelFor = (total: number) => (total >= 75 ? "Strong" : total >= 50 ? "Good" : "Needs work")

export function buildScore(m: ProfileMetrics, rawQuality: RawQuality) {
  const completeness = completenessItems(m)
  const quality = qualityItems(rawQuality)
  const sum = (items: ScoreItem[]) => items.reduce((a, i) => a + i.points, 0)
  const total = sum(completeness) + sum(quality)
  return {
    total,
    label: labelFor(total),
    completeness: { points: sum(completeness), max: 40, items: completeness },
    quality: { points: sum(quality), max: 60, items: quality },
  }
}

export type ProfileScore = ReturnType<typeof buildScore>
