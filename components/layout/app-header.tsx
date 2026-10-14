"use client"

import { useRouter, usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LogOut, Settings } from "lucide-react"
import Link from "next/link"

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/job-scanner": "Job Scanner",
  "/proposals": "Proposals",
  "/settings": "Settings",
}

interface AppHeaderProps {
  username?: string | null
  email?: string | null
}

export function AppHeader({ username, email }: AppHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const pageTitle =
    PAGE_TITLES[pathname] ??
    PAGE_TITLES[
      Object.keys(PAGE_TITLES).find((p) => p !== "/dashboard" && pathname.startsWith(p)) ?? ""
    ] ??
    "Colosal"

  const initials = username
    ? username.slice(0, 2).toUpperCase()
    : email?.slice(0, 2).toUpperCase() ?? "?"

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <header className="flex h-14 items-center justify-between border-b px-6">
      <h1 className="text-lg font-semibold">{pageTitle}</h1>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium hidden sm:inline">{username ?? email}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem asChild>
            <Link href="/settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive flex items-center gap-2"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
