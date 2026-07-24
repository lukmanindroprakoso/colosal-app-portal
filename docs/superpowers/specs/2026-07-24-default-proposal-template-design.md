# Default Proposal Template on Onboarding — Design

## Purpose

Every new user currently finishes onboarding with zero rows in
`proposal_templates`. The scanner's Cover Letter step (`scanner-form.tsx`)
and the Apply flow (`docs/superpowers/specs/2026-07-24-proposal-generation-design.md`)
both require a `proposal_template_id` to work, so a fresh user hits a dead
end ("Set a proposal template on this scanner first") until they manually
visit `/proposals/templates/new`. Seed one default template automatically
when onboarding completes so Apply works out of the box.

## Approach

Static, hardcoded default — no AI call, no extra round trip, zero cost.
Created client-side in `app/(onboarding)/onboarding/step-4/page.tsx`, the
same file that already writes `user_scan_config` and flips
`onboarding_completed`.

### `ensureDefaultTemplate(supabase, userId): Promise<string>`

New helper in `step-4/page.tsx`:

1. `SELECT id FROM proposal_templates WHERE user_id = :userId LIMIT 1`.
2. If a row exists, return its `id` (idempotent — safe if called more than
   once, e.g. user double-clicks or navigates back to step-4).
3. Else `INSERT` one row:
   - `name`: `"General Template"`
   - `template`:
     ```
     Hi,

     [prompt]Open with a line connecting your experience directly to what this job is asking for.[/prompt]

     [prompt]Briefly describe relevant past work or results that prove you can do this.[/prompt]

     I'd love to discuss the details and get started. Looking forward to hearing from you.

     Best,
     [prompt]Your name[/prompt]
     ```
   - `ai_instruction`: `"Keep the tone direct and confident, avoid generic filler, and reference the freelancer's actual background fields where relevant."`
   - `user_id`: `userId`
   - Return the new row's `id`.

### Call sites

Both existing finish paths in `step-4/page.tsx` call it before completing
onboarding:

- **`handleCreate`** (user fills the scanner form and clicks "Create scanner
  & finish"): call `ensureDefaultTemplate` first, then include
  `proposal_template_id: templateId` in the `user_scan_config` insert
  payload (currently missing from that insert). The scanner is Apply-ready
  immediately.
- **`handleSkip`** ("Skip for now"): call `ensureDefaultTemplate` too. No
  scan config exists yet to link it to, but the template is there, waiting
  in `/proposals?tab=templates`, and gets picked up whenever the user
  creates a scanner later.

`finishOnboarding` (sets `onboarding_completed = true` and redirects) is
unchanged — template creation happens in the caller before
`finishOnboarding` runs, not inside it.

## Error handling

If the template insert fails, surface it the same way existing errors in
this file are surfaced (`setError(error.message); setSaving(false); return`)
and do not proceed to create the scan config or mark onboarding complete —
matches the existing pattern in `handleCreate`.

## Out of scope

- AI-personalized starter template content (explicitly rejected — static
  default per requirements).
- Any change to `template-form.tsx`, `template-list.tsx`, or the
  `proposal_templates` schema.
- Backfilling default templates for existing users who already completed
  onboarding without one.
- Preventing users from deleting the seeded default afterward — normal
  template delete rules apply (blocked only if referenced by a scan config,
  per existing `template-list.tsx` behavior).

## Files touched

```
app/(onboarding)/onboarding/step-4/page.tsx   add ensureDefaultTemplate + wire into handleCreate/handleSkip
```
