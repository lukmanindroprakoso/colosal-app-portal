import { useState } from "react"

// Card header with a chevron toggle; `actions` (Copy, Edit...) stay clickable beside it.
export default function Collapsible({
  title,
  actions,
  children,
  defaultOpen = true,
}: {
  title: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <>
      <div className={`row collapse-head${open ? "" : " closed"}`}>
        <h3>
          <button type="button" className="collapse-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
            {title}
          </button>
        </h3>
        {actions}
      </div>
      {open && children}
    </>
  )
}
