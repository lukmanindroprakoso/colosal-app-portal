import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { AppHeader } from "@/components/layout/app-header"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [{ data: profile }, { data: sub }] = await Promise.all([
    supabase.from("user_profiles").select("username").eq("user_id", user.id).single(),
    supabase.from("user_subscriptions").select("plan, status").eq("user_id", user.id).maybeSingle(),
  ])
  const isPaid = sub?.plan === "paid" && sub.status !== "cancelled"

  return (
    <div className="flex h-screen overflow-hidden bg-muted/30 p-3 gap-3">
      <AppSidebar isPaid={isPaid} />
      <div className="flex flex-1 flex-col overflow-hidden rounded-xl bg-background">
        <AppHeader username={profile?.username} email={user.email} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
