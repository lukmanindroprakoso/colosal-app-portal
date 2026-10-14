"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function OnboardingStep2() {
  const upworkOAuthUrl =
    `https://www.upwork.com/ab/account-security/oauth2/authorize` +
    `?response_type=code` +
    `&client_id=${process.env.NEXT_PUBLIC_UPWORK_CLIENT_ID}` +
    `&redirect_uri=${process.env.NEXT_PUBLIC_SITE_URL}/auth/upwork/callback`

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-1">
          <p className="text-sm text-muted-foreground">Step 2 of 3</p>
          <h1 className="text-3xl font-bold">Connect Upwork</h1>
          <p className="text-muted-foreground">
            We&apos;ll pull your profile data so you don&apos;t have to type it all manually
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-[#6FDA44]" aria-hidden="true">
                <path d="M18.561 13.158c-1.102 0-2.135-.467-3.074-1.227l.228-1.076.008-.042c.207-1.143.849-3.06 2.839-3.06 1.492 0 2.703 1.212 2.703 2.703-.001 1.489-1.212 2.702-2.704 2.702zm0-8.14c-2.539 0-4.51 1.649-5.31 4.366-1.22-1.834-2.148-4.036-2.687-5.892H7.828v7.112c-.002 1.406-1.141 2.546-2.547 2.546-1.405 0-2.543-1.14-2.546-2.546V3.492H0v7.112c0 2.914 2.37 5.303 5.281 5.303 2.913 0 5.283-2.389 5.283-5.303v-1.19c.529 1.107 1.182 2.229 1.974 3.221l-1.673 7.873h2.797l1.213-5.71c1.063.679 2.285 1.109 3.686 1.109 3 0 5.439-2.452 5.439-5.45 0-3-2.439-5.439-5.439-5.439z"/>
              </svg>
              Upwork Account
            </CardTitle>
            <CardDescription>
              We only request read access to your public profile — skills, bio, and work history.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a href={upworkOAuthUrl}>
              <Button className="w-full">Connect Upwork</Button>
            </a>
          </CardContent>
        </Card>

        <div className="text-center">
          <Link
            href="/onboarding/step-3"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Skip for now — I&apos;ll fill my profile manually
          </Link>
        </div>
      </div>
    </div>
  )
}
