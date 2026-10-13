import { extGuard } from "@/lib/ext-auth"
import { extJson, extOptions } from "@/lib/ext-cors"

const LIMITS = { name: 200, template: 10000, ai_instruction: 2000 } as const

export async function OPTIONS(req: Request) {
  return extOptions(req)
}

export async function GET(req: Request) {
  const g = await extGuard(req)
  if ("error" in g) return g.error

  const { data, error } = await g.supabase
    .from("proposal_templates")
    .select("id, name, template, ai_instruction")
    .eq("user_id", g.user.id)
    .order("created_at", { ascending: true })
  if (error) return extJson(req, { error: "Failed to load templates." }, 500)

  return extJson(req, { templates: data ?? [] })
}

// Create (no id) or update (id) one of the user's templates. Deleting stays in the web app.
export async function POST(req: Request) {
  const g = await extGuard(req)
  if ("error" in g) return g.error

  const body = await req.json().catch(() => null)
  const name = typeof body?.name === "string" ? body.name.trim() : ""
  const template = typeof body?.template === "string" ? body.template.trim() : ""
  const ai_instruction = typeof body?.ai_instruction === "string" ? body.ai_instruction.trim() : ""
  const id = typeof body?.id === "string" ? body.id : undefined

  if (!name || !template) return extJson(req, { error: "Name and template are required." }, 400)
  if (
    name.length > LIMITS.name ||
    template.length > LIMITS.template ||
    ai_instruction.length > LIMITS.ai_instruction
  ) {
    return extJson(req, { error: "One of the fields is too long." }, 400)
  }

  const fields = { name, template, ai_instruction }
  const query = id
    ? g.supabase.from("proposal_templates").update(fields).eq("id", id).eq("user_id", g.user.id)
    : g.supabase.from("proposal_templates").insert({ ...fields, user_id: g.user.id })
  const { data, error } = await query.select("id, name, template, ai_instruction").maybeSingle()

  if (error) {
    console.error("save template failed", error)
    return extJson(req, { error: "Failed to save the template. Please try again." }, 500)
  }
  if (!data) return extJson(req, { error: "Template not found." }, 404)

  return extJson(req, { template: data })
}
