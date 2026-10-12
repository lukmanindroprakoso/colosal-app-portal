import { NextResponse } from "next/server"

// Only the one configured extension origin gets CORS headers.
function corsHeaders(req: Request): Record<string, string> {
  const allowed = process.env.EXTENSION_ORIGIN
  const origin = req.headers.get("origin")
  if (!allowed || origin !== allowed) return {}
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    Vary: "Origin",
  }
}

export function extJson(req: Request, body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders(req) })
}

export function extOptions(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) })
}
