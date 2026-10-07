"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function DashboardSearch() {
  const router = useRouter()
  const [keyword, setKeyword] = useState("")
  const [pending, startTransition] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const k = keyword.trim()
    // the transition stays pending until the search page has rendered with its results
    if (k && !pending) startTransition(() => router.push(`/search-job?q=${encodeURIComponent(k)}`))
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-xl gap-2">
      <Input
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder="Search for jobs, e.g. react developer"
        className="h-11"
      />
      <Button type="submit" size="lg" disabled={pending || !keyword.trim()}>
        {pending ? <Loader2 className="animate-spin" /> : <Search />} Search
      </Button>
    </form>
  )
}
