import { extGuard } from "@/lib/ext-auth"
import { extJson, extOptions } from "@/lib/ext-cors"

export async function OPTIONS(req: Request) {
  return extOptions(req)
}

export async function GET(req: Request) {
  const g = await extGuard(req)
  if ("error" in g) return g.error

  const { data, error } = await g.supabase
    .from("proposal_templates")
    .select("id, name")
    .eq("user_id", g.user.id)
    .order("created_at", { ascending: true })
  if (error) return extJson(req, { error: "Gagal memuat template." }, 500)

  return extJson(req, { templates: data ?? [] })
}
