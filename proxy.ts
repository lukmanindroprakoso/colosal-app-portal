import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  const publicPaths = [
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/auth/callback",
    "/auth/upwork/callback",
  ]
  const isPublicPath = publicPaths.some((p) => pathname.startsWith(p))

  // Unauthenticated → redirect to login
  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  // Authenticated on auth pages → redirect to dashboard
  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  // Authenticated on / → redirect to dashboard
  if (user && pathname === "/") {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  // Check onboarding completion for protected pages
  if (user && (pathname.startsWith("/dashboard") || pathname.startsWith("/settings"))) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("onboarding_completed, user_type, access_token")
      .eq("user_id", user.id)
      .single()

    if (!profile?.onboarding_completed) {
      const url = request.nextUrl.clone()
      // Resume from the right onboarding step
      if (!profile?.user_type) {
        url.pathname = "/onboarding/step-1"
      } else if (!profile?.access_token) {
        url.pathname = "/onboarding/step-2"
      } else {
        url.pathname = "/onboarding/step-4"
      }
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
