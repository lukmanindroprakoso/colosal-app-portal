# Job Scanner Detail Page — Full-Width Redesign

## Goal

Original two-column layout (`docs/superpowers/specs/2026-07-14-job-scanner-detail-design.md`) caps at `max-w-6xl` and further caps job cards at `max-w-3xl` inside the remaining grid column. On HD/wide monitors this leaves large dead space on both sides and inside the job list column. Redesign to a full-width, stacked layout that scales with viewport.

## Layout

Single-column, full-width (no `max-w-6xl` cap on the page). Stacked sections, top to bottom:

1. **Back link** — unchanged, `← Back to Job Scanner`.
2. **Config chip strip** (replaces old left sidebar card and the `<h1>Scanner Detail</h1>` heading).
3. **Stat tiles row** — replaces counts previously embedded in tab labels.
4. **Tab pills** — unchanged behavior, now a pure filter control (counts live in tiles).
5. **Job list** — full width, wide single-column rows (no `max-w-3xl` cap).

Responsive: chip strip wraps its chip groups on narrow widths; stat tiles wrap to 2-column grid below `sm`; job rows already stack their internals via `flex-wrap`, unaffected.

## Component: config chip strip

Rewrite `config-summary.tsx` from a vertical sidebar card into a horizontal strip component (same file, same exported `ConfigSummary` name and `ScanConfigDetail` type — no changes to the type or to `page.tsx`'s construction of `configDetail`).

Single `rounded-3xl bg-card` bar, `flex flex-wrap items-center gap-x-4 gap-y-3` container, contents in this order:

- Status badge (`STATUS_STYLES[config.status]`, unchanged) + scanner name (`config.name`, replaces the dropped `<h1>` as the page's primary heading — render as the `Edit` link is now placed at the strip's right edge instead of the old sidebar's top-right)
- Filter chips, one per non-empty field, each a small `Badge variant="outline"` with `label: value` text: Keyword, Category, Experience Level, Contract Type (join array), Budget range, Hourly range. Skip chips whose value is `—`/empty (don't render placeholder chips).
- Skills as a wrapped tag row (unchanged rendering from old `Section`/skills block, same `Badge variant="outline"` per skill).
- Schedule chips: Last scan, Next scan (formatted via existing `formatDateTime`), Last result if present — same three, now inline chips instead of a boxed `Row` list.
- Notification icons: two small inline items (Mail / MessageCircle icon + value + on/off `Badge`), same content as current `Section title="Notification"` block, laid out inline instead of stacked.
- Edit button (`Button variant="outline" size="sm"`, links to `/job-scanner/[id]/edit`) — pinned to the strip's right side via `ml-auto` on its wrapper.

Drop the `Section`/`Row` helper components (no longer used in strip layout); drop the `space-y-*` vertical stack styling. Keep `formatCurrency`, `formatRange`, `formatDateTime` helpers as-is.

## Component: stat tiles (new)

New file `app/(dashboard)/job-scanner/[id]/stat-tiles.tsx`, presentational, `"use client"` not required (no interactivity):

```ts
export function StatTiles({ counts }: { counts: Record<ApplyStatusTab, number> })
```

Renders a `grid grid-cols-2 gap-3 sm:grid-cols-4` of 4 tiles — Total, New, Applied, Dismissed — each a small `rounded-2xl bg-card p-4 ring-1 ring-foreground/5` block with the count (large, `font-heading`) and label (small, `text-muted-foreground`). Reuses `counts` already computed in `page.tsx` (`ApplyStatusTab` type imported from `job-list.tsx`) — no new data fetching. No avg-match-score tile (not in current data shape; skip rather than fake).

## Component: job list

`job-list.tsx` — remove `max-w-3xl` from the job card wrapper `className` (job-list.tsx:148). No other change; cards already use `flex` internals that scale with available width.

## `page.tsx` changes

- Remove `mx-auto w-full max-w-6xl` and `mx-auto max-w-6xl` wrapper divs; replace with plain full-width stacked divs (keep the existing `flex h-full flex-col` / `min-h-0 flex-1 overflow-y-auto` scroll structure — only the width constraints and grid split are removed).
- Remove the `<h1 className="mb-2 font-heading text-3xl font-semibold">Scanner Detail</h1>` line.
- Remove the `grid grid-cols-1 gap-6 pb-6 lg:grid-cols-[340px_1fr]` split and the `lg:sticky lg:top-0 lg:self-start` sidebar wrapper — `ConfigSummary` and `StatTiles`/tabs/`JobList` become sequential full-width blocks instead.
- Add `<StatTiles counts={counts} />` between `ConfigSummary` and `JobListTabs`. Final order: back link → `ConfigSummary` (chip strip) → `StatTiles` → `JobListTabs` → `JobList`.
- No changes to data fetching (queries, `configDetail` construction, counts computation) — this is a presentation-only restructure.

## Files

- `app/(dashboard)/job-scanner/[id]/page.tsx` (edit — layout restructure only)
- `app/(dashboard)/job-scanner/[id]/config-summary.tsx` (rewrite — sidebar card → horizontal chip strip)
- `app/(dashboard)/job-scanner/[id]/stat-tiles.tsx` (new)
- `app/(dashboard)/job-scanner/[id]/job-list.tsx` (edit — drop `max-w-3xl` cap)

## Explicitly out of scope

- Table-layout or multi-column grid job rows — wide single-column rows only.
- Collapsible/toggleable config panel — chip strip is always fully visible.
- Avg match score tile or any new derived stat not already computed server-side.
- Any change to data fetching, `ScanConfigDetail` type, or edit/create forms.
