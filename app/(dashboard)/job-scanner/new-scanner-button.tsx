"use client"

import Link from "next/link"
import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"

export function NewScannerButton({ blocked }: { blocked: boolean }) {
  const [open, setOpen] = useState(false)

  if (blocked) {
    return (
      <>
        <Button onClick={() => setOpen(true)}>
          <Plus /> New Configuration
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Free plan limit reached</DialogTitle>
              <DialogDescription>
                You already have 2 active scanners, the limit on the free plan.
                Upgrade to add more.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Close
              </Button>
              <Button asChild>
                <a href="mailto:team@paistudio.dev?subject=Upgrade%20request">Contact us</a>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return (
    <Button asChild>
      <Link href="/job-scanner/new">
        <Plus /> New Configuration
      </Link>
    </Button>
  )
}
