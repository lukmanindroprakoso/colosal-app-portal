import { COLOSAL_URL } from "./config"
import type { JobData, ProfileResult, ProposalResult, Template } from "./types"

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: "unauth" | "limit" | "error"; message: string }

async function call<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${COLOSAL_URL}${path}`, {
      credentials: "include",
      ...init,
      headers: { "Content-Type": "application/json", "X-Colosal-Ext": "1" },
    })
    if (res.status === 401) return { ok: false, status: "unauth", message: "You are not signed in to Colosal." }
    const body = await res.json().catch(() => null)
    if (res.status === 429) {
      return { ok: false, status: "limit", message: body?.error ?? "Daily usage limit reached." }
    }
    if (!res.ok) return { ok: false, status: "error", message: body?.error ?? "Something went wrong. Please try again." }
    return { ok: true, data: body as T }
  } catch {
    return { ok: false, status: "error", message: "Could not connect to Colosal." }
  }
}

export const api = {
  templates: () => call<{ templates: Template[] }>("/api/ext/templates"),
  proposal: (job: JobData, templateId: string) =>
    call<ProposalResult>("/api/ext/proposal", { method: "POST", body: JSON.stringify({ job, templateId }) }),
  profile: () => call<ProfileResult>("/api/ext/profile", { method: "POST" }),
}
