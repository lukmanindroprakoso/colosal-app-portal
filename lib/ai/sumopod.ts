const MODEL = "gpt-4o-mini"

export class AiError extends Error {
  constructor(
    public status: 500 | 502,
    message: string
  ) {
    super(message)
  }
}

export async function chatJson<T>(
  system: string,
  user: string
): Promise<{ data: Partial<T>; tokens: number | null }> {
  const base = process.env.SUMOPOD_BASE_URL
  const key = process.env.SUMOPOD_API_KEY
  if (!base || !key) {
    console.error("missing SUMOPOD_BASE_URL or SUMOPOD_API_KEY")
    throw new AiError(500, "AI service is not configured.")
  }

  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    })
    if (!res.ok) {
      console.error("sumopod failed", res.status, await res.text().catch(() => ""))
      throw new AiError(502, "Failed to generate the result. Please try again.")
    }
    const json = await res.json()
    return {
      data: JSON.parse(json?.choices?.[0]?.message?.content?.trim() ?? "{}"),
      tokens: json?.usage?.total_tokens ?? null,
    }
  } catch (e) {
    if (e instanceof AiError) throw e
    console.error("sumopod error", e)
    throw new AiError(502, "Failed to generate the result. Please try again.")
  }
}
