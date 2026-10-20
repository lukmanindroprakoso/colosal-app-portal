import { COLOSAL_URL } from "./config"
import type { TalentCard } from "./parse-talent"
import type {
  BenchmarkResult,
  JobData,
  OptimizeResult,
  ProfileFields,
  ProfileResult,
  ProposalProgress,
  ProposalResult,
  ProposalRevision,
  Template,
  TemplateInput,
} from "./types"

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: "unauth" | "limit" | "error"; message: string }

const HEADERS = { "Content-Type": "application/json", "X-Colosal-Ext": "1" }

async function failure(res: Response): Promise<ApiResult<never>> {
  if (res.status === 401) return { ok: false, status: "unauth", message: "You are not signed in to Colosal." }
  const body = await res.json().catch(() => null)
  if (res.status === 429) {
    return { ok: false, status: "limit", message: body?.error ?? "Daily usage limit reached." }
  }
  return { ok: false, status: "error", message: body?.error ?? "Something went wrong. Please try again." }
}

async function call<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${COLOSAL_URL}${path}`, { credentials: "include", ...init, headers: HEADERS })
    if (!res.ok) return failure(res)
    return { ok: true, data: (await res.json().catch(() => null)) as T }
  } catch {
    return { ok: false, status: "error", message: "Could not connect to Colosal." }
  }
}

// Newline-delimited JSON: progress events, then one "done" or "error".
async function callStream<T>(
  path: string,
  payload: object,
  onProgress: (p: ProposalProgress) => void
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${COLOSAL_URL}${path}`, {
      method: "POST",
      credentials: "include",
      headers: HEADERS,
      body: JSON.stringify({ ...payload, stream: true }),
    })
    if (!res.ok || !res.body) return failure(res)

    let result: T | null = null
    let error: string | null = null
    const handle = (line: string) => {
      if (!line.trim()) return
      const msg = JSON.parse(line)
      if (msg.type === "progress") onProgress(msg)
      else if (msg.type === "done") result = msg.result
      else if (msg.type === "error") error = msg.error
    }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""
      lines.forEach(handle)
    }
    handle(buffer)

    if (error) return { ok: false, status: "error", message: error }
    if (!result) return { ok: false, status: "error", message: "Something went wrong. Please try again." }
    return { ok: true, data: result }
  } catch {
    return { ok: false, status: "error", message: "Could not connect to Colosal." }
  }
}

export const api = {
  templates: () => call<{ templates: Template[]; userId: string }>("/api/ext/templates"),
  proposal: (job: JobData, templateId: string, onProgress?: (p: ProposalProgress) => void) =>
    onProgress
      ? callStream<ProposalResult>("/api/ext/proposal", { job, templateId }, onProgress)
      : call<ProposalResult>("/api/ext/proposal", { method: "POST", body: JSON.stringify({ job, templateId }) }),
  reviseProposal: (job: JobData, templateId: string, feedback: string, previous: ProposalRevision) =>
    call<ProposalRevision>("/api/ext/proposal", {
      method: "POST",
      body: JSON.stringify({ job, templateId, feedback, previous }),
    }),
  saveTemplate: (input: TemplateInput) =>
    call<{ template: Template }>("/api/ext/templates", { method: "POST", body: JSON.stringify(input) }),
  benchmark: (cards: TalentCard[]) =>
    call<BenchmarkResult>("/api/ext/benchmark", { method: "POST", body: JSON.stringify({ cards }) }),
  optimizeWithBenchmark: (cards: TalentCard[]) =>
    call<OptimizeResult>("/api/ext/profile/optimize", { method: "POST", body: JSON.stringify({ cards }) }),
  profile: () => call<ProfileResult>("/api/ext/profile", { method: "POST" }),
  saveProfile: (fields: ProfileFields) =>
    call<{ saved: true; previous: ProfileFields }>("/api/ext/profile/save", {
      method: "POST",
      body: JSON.stringify(fields),
    }),
}
