# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Colosal** — a freelancer positioning workspace that helps users scan Upwork for jobs, manage scan configurations, and auto-generate cover letters and question answers. Stack: Next.js 16 · React 19 · Tailwind CSS v4 · Supabase · shadcn/ui.

> **Warning (from AGENTS.md):** This is Next.js 16 with breaking changes. APIs, conventions, and file structure may differ significantly from your training data. Read `node_modules/next/dist/docs/` before writing Next.js-specific code.

## Commands

```bash
npm run dev          # start dev server on :3000
npm run build        # production build
npm run typecheck    # tsc --noEmit (run before committing)
npm run lint         # eslint
npm run format       # prettier --write on all .ts/.tsx
```

No test suite is configured.

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SITE_URL=
UPWORK_CLIENT_ID=
UPWORK_CLIENT_SECRET=
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=   # optional; Settings "Connect" for Telegram is disabled until set
```

## Architecture

### Route Groups

- `(auth)` — `/login`, `/signup` — unauthenticated pages
- `(dashboard)` — `/dashboard`, `/job-scanner`, `/settings` — protected; layout checks auth and onboarding completion, then renders `AppSidebar` + `AppHeader`
- `(onboarding)` — `/onboarding/step-1..3` — post-signup flow (user type → Upwork OAuth → profile sync)
- `app/api/` — API routes for Upwork proxy calls (`/api/upwork/profile`, `/api/upwork/skills`)
- `app/auth/` — OAuth callbacks (`/auth/callback` for Supabase, `/auth/upwork/callback` for Upwork token exchange)

### Middleware (`proxy.ts`)

The middleware file is named `proxy.ts` (not `middleware.ts`). It handles:
1. Unauthenticated users → redirect to `/login`
2. Authenticated users on auth pages → redirect to `/dashboard`
3. Authenticated users without completed onboarding → redirect to the correct onboarding step based on `user_profiles` fields (`user_type`, `access_token`, `onboarding_completed`)

### Supabase

Two clients: `lib/supabase/client.ts` (browser, uses `createBrowserClient`) and `lib/supabase/server.ts` (async server-side, uses `createServerClient` with `cookies()`). Always use the server client in Server Components, Route Handlers, and layouts; use the browser client in `"use client"` components.

Key tables: `user_profiles`, `user_scan_config`, `upwork_jobs`, `attachments`.

### UI Components

shadcn/ui components live in `components/ui/`. Use `components.json` and the `shadcn` CLI to add new components. Layout components (`AppSidebar`, `AppHeader`) are in `components/layout/`. Path alias `@/` maps to the repo root.

### Job Scanner Feature

The core feature. `scanner-form.tsx` is a multi-step `"use client"` form (5 steps: Filters → Cover Letter → Questions → Attachments → Notifications) that writes to `user_scan_config`. The list page (`scanner-list.tsx`) is a server component that joins `upwork_jobs` counts per config. The form uses a `[prompt]…[/prompt]` syntax in cover letter templates to mark AI-filled sections.
