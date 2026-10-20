"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"

const FALLBACK = "Untitled scanner"
const STYLE = "font-heading -mx-2 w-[calc(100%+1rem)] rounded-md px-2 py-0.5 text-lg font-semibold"

export function EditableName({ id, name }: { id: string; name: string | null }) {
  const router = useRouter()
  const [saved, setSaved] = useState(name ?? "")
  const [draft, setDraft] = useState(saved)
  const [editing, setEditing] = useState(false)

  async function commit() {
    setEditing(false)
    const next = draft.trim()
    if (!next || next === saved) {
      setDraft(saved)
      return
    }
    const { error } = await createClient().from("user_scan_config").update({ name: next }).eq("id", id)
    if (error) {
      toast.error(error.message)
      setDraft(saved)
      return
    }
    setSaved(next)
    setDraft(next)
    toast.success("Scanner renamed")
    router.refresh()
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        maxLength={100}
        aria-label="Scanner name"
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur()
          if (e.key === "Escape") {
            setDraft(saved)
            setEditing(false)
          }
        }}
        className={`${STYLE} bg-transparent outline-none ring-2 ring-ring`}
      />
    )
  }

  return (
    <button
      type="button"
      title="Click to rename"
      onClick={() => setEditing(true)}
      className={`${STYLE} cursor-text text-left transition-colors hover:bg-muted`}
    >
      {saved || FALLBACK}
    </button>
  )
}
