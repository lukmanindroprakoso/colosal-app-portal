"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { Send } from "lucide-react"

type Profile = {
  username: string
  phone: string
  summary: string
  current_role: string
  previous_experience: string
  skills_text: string
  portfolio: string
  key_proof_points: string
  positioning_notes: string
  access_token: string | null
  last_used: string | null
  telegram_chat_id: string | null
}

const PROFILE_FIELDS: { key: keyof Profile; label: string; description: string; multiline?: boolean }[] = [
  { key: "summary", label: "Summary", description: "Your elevator pitch", multiline: true },
  { key: "current_role", label: "Current Role", description: "Your current title or focus" },
  { key: "previous_experience", label: "Previous Experience", description: "Roles and backgrounds", multiline: true },
  { key: "skills_text", label: "Skills", description: "Core skills and tools" },
  { key: "portfolio", label: "Portfolio", description: "Work samples and links", multiline: true },
  { key: "key_proof_points", label: "Key Proof Points", description: "Metrics and achievements", multiline: true },
  { key: "positioning_notes", label: "Positioning Notes", description: "How you stand out", multiline: true },
]

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile>({
    username: "", phone: "",
    summary: "", current_role: "", previous_experience: "",
    skills_text: "", portfolio: "", key_proof_points: "", positioning_notes: "",
    access_token: null, last_used: null, telegram_chat_id: null,
  })
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setEmail(user.email ?? "")
      const { data } = await supabase
        .from("user_profiles")
        .select("username, phone, summary, current_role, previous_experience, skills_text, portfolio, key_proof_points, positioning_notes, access_token, last_used, telegram_chat_id")
        .eq("user_id", user.id)
        .single()
      if (data) setProfile(data as Profile)
      setLoading(false)
    }
    load()
  }, [])

  // After tapping Start in Telegram the bot links the chat; pick it up when the tab regains focus.
  useEffect(() => {
    async function refreshTelegram() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from("user_profiles")
        .select("telegram_chat_id")
        .eq("user_id", user.id)
        .single()
      if (data) setProfile((prev) => ({ ...prev, telegram_chat_id: data.telegram_chat_id }))
    }
    window.addEventListener("focus", refreshTelegram)
    return () => window.removeEventListener("focus", refreshTelegram)
  }, [])

  function update(key: keyof Profile, value: string) {
    setProfile((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase
      .from("user_profiles")
      .update({
        username: profile.username,
        phone: profile.phone,
        summary: profile.summary,
        current_role: profile.current_role,
        previous_experience: profile.previous_experience,
        skills_text: profile.skills_text,
        portfolio: profile.portfolio,
        key_proof_points: profile.key_proof_points,
        positioning_notes: profile.positioning_notes,
      })
      .eq("user_id", user.id)
    setSaving(false)
    if (error) {
      toast.error("Failed to save changes")
    } else {
      toast.success("Settings saved")
    }
  }

  async function handleDisconnectUpwork() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase
      .from("user_profiles")
      .update({ access_token: null, refresh_token: null, last_used: null })
      .eq("user_id", user.id)
    setProfile((prev) => ({ ...prev, access_token: null, last_used: null }))
    toast.success("Upwork disconnected")
  }

  const telegramBot = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME

  async function handleConnectTelegram() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    // One-time token: the n8n bot matches it on /start <token>, saves the chat id and clears it.
    const token = crypto.randomUUID()
    const { error } = await supabase
      .from("user_profiles")
      .update({ telegram_link_token: token })
      .eq("user_id", user.id)
    if (error) {
      toast.error("Failed to start Telegram connection")
      return
    }
    window.open(`https://t.me/${telegramBot}?start=${token}`, "_blank", "noopener")
  }

  async function handleDisconnectTelegram() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase
      .from("user_profiles")
      .update({ telegram_chat_id: null, telegram_link_token: null })
      .eq("user_id", user.id)
    setProfile((prev) => ({ ...prev, telegram_chat_id: null }))
    toast.success("Telegram disconnected")
  }

  const upworkOAuthUrl =
    `https://www.upwork.com/ab/account-security/oauth2/authorize` +
    `?response_type=code` +
    `&client_id=${process.env.NEXT_PUBLIC_UPWORK_CLIENT_ID}` +
    `&redirect_uri=${process.env.NEXT_PUBLIC_SITE_URL}/auth/upwork/callback`

  if (loading) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">Loading…</div>
  }

  return (
    <div className="mx-auto max-w-2xl space-y-10 pb-16">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm">Manage your account and profile</p>
      </div>

      {/* Account */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Account</h2>
        <Separator />
        <div className="space-y-1">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            value={profile.username ?? ""}
            onChange={(e) => update("username", e.target.value)}
            placeholder="yourname"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={email} disabled className="opacity-50" />
          <p className="text-xs text-muted-foreground">Email cannot be changed here</p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="phone">WhatsApp number</Label>
          <Input
            id="phone"
            value={profile.phone ?? ""}
            onChange={(e) => update("phone", e.target.value)}
            placeholder="+1 555 000 0000"
          />
        </div>
        <div className="space-y-1">
          <Label>Telegram</Label>
          <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
            <div className="flex items-center gap-2 text-sm">
              <Send className="h-4 w-4 text-[#26A5E4]" aria-hidden="true" />
              {profile.telegram_chat_id
                ? "Connected"
                : telegramBot
                  ? "Not connected"
                  : "Bot not configured yet"}
            </div>
            {profile.telegram_chat_id ? (
              <Button variant="outline" size="sm" onClick={handleDisconnectTelegram}>
                Disconnect
              </Button>
            ) : (
              <Button size="sm" onClick={handleConnectTelegram} disabled={!telegramBot}>
                Connect
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Telegram needs a one-time link: press Start in the bot chat to receive notifications.
          </p>
        </div>
      </section>

      {/* Profile */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Profile</h2>
        <Separator />
        {PROFILE_FIELDS.map(({ key, label, description, multiline }) => (
          <div key={key} className="space-y-1">
            <Label htmlFor={key}>{label}</Label>
            <p className="text-xs text-muted-foreground">{description}</p>
            {multiline ? (
              <Textarea
                id={key}
                value={(profile[key] as string) ?? ""}
                onChange={(e) => update(key, e.target.value)}
                className="min-h-[80px] resize-y"
              />
            ) : (
              <Input
                id={key}
                value={(profile[key] as string) ?? ""}
                onChange={(e) => update(key, e.target.value)}
              />
            )}
          </div>
        ))}
      </section>

      {/* Connected accounts */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Connected Accounts</h2>
        <Separator />
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-[#6FDA44]" aria-hidden="true">
              <path d="M18.561 13.158c-1.102 0-2.135-.467-3.074-1.227l.228-1.076.008-.042c.207-1.143.849-3.06 2.839-3.06 1.492 0 2.703 1.212 2.703 2.703-.001 1.489-1.212 2.702-2.704 2.702zm0-8.14c-2.539 0-4.51 1.649-5.31 4.366-1.22-1.834-2.148-4.036-2.687-5.892H7.828v7.112c-.002 1.406-1.141 2.546-2.547 2.546-1.405 0-2.543-1.14-2.546-2.546V3.492H0v7.112c0 2.914 2.37 5.303 5.281 5.303 2.913 0 5.283-2.389 5.283-5.303v-1.19c.529 1.107 1.182 2.229 1.974 3.221l-1.673 7.873h2.797l1.213-5.71c1.063.679 2.285 1.109 3.686 1.109 3 0 5.439-2.452 5.439-5.45 0-3-2.439-5.439-5.439-5.439z"/>
            </svg>
            <div>
              <p className="text-sm font-medium">Upwork</p>
              <p className="text-xs text-muted-foreground">
                {profile.access_token
                  ? `Connected${profile.last_used ? ` · ${new Date(profile.last_used).toLocaleDateString()}` : ""}`
                  : "Not connected"}
              </p>
            </div>
          </div>
          {profile.access_token ? (
            <Button variant="outline" size="sm" onClick={handleDisconnectUpwork}>
              Disconnect
            </Button>
          ) : (
            <a href={upworkOAuthUrl}>
              <Button size="sm">Connect</Button>
            </a>
          )}
        </div>
      </section>

      <Button className="w-full" onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save changes"}
      </Button>
    </div>
  )
}
