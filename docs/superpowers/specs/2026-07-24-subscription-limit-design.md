# Subscription tier + free-plan active-scanner cap

## Problem

All users currently have unlimited active job scan configs. We want a
free/paid split: free users capped at 2 *Active* scan configs. Paid access is
sold manually (contact us) — no payment processing in this iteration.

## Data model

New table `user_subscriptions`:

| column | type | notes |
|---|---|---|
| `id` | uuid, PK, default `gen_random_uuid()` | |
| `user_id` | uuid, unique, FK `auth.users.id` | one row per user |
| `plan` | text, check in (`free`,`paid`), default `free` | |
| `status` | text, check in (`active`,`requested`,`cancelled`), default `active` | `requested` reserved for future in-app request flow, unused in this iteration |
| `created_at` | timestamptz, default `now()` | |
| `updated_at` | timestamptz, default `now()` | |

RLS: user can `select` their own row. No `insert`/`update`/`delete` policy
for authenticated role — rows are created by trigger and edited only by
admin via Supabase Studio (service role bypasses RLS).

A trigger on `auth.users` (`AFTER INSERT`) creates the `user_subscriptions`
row with defaults, mirroring the existing `user_profiles` creation pattern.
For any user missing a row (pre-existing accounts), the limit-check trigger
below treats a missing row as `plan = 'free'`.

## Enforcement

A `BEFORE INSERT OR UPDATE` trigger on `user_scan_config`:

1. If `NEW.status <> 'Active'`, allow (no check).
2. Look up the user's plan from `user_subscriptions` (missing row = `free`).
3. If plan is `paid`, allow.
4. If plan is `free`: count rows in `user_scan_config` where `user_id =
   NEW.user_id` and `status = 'Active'`, excluding `NEW.id` (relevant on
   update, where the row being saved may already be counted). If count >= 2,
   raise exception with a fixed message prefix `SCAN_LIMIT_REACHED` (e.g.
   `RAISE EXCEPTION 'SCAN_LIMIT_REACHED: free plan allows up to 2 active
   scanners'`).

This lives at the DB layer so it holds for the existing client-side Supabase
insert/update in `scanner-form.tsx` (app/(dashboard)/job-scanner/scanner-form.tsx:357-358)
regardless of future callers.

## Frontend changes

**`scanner-form.tsx`** — on save error, check if `error.message` starts with
`SCAN_LIMIT_REACHED`. If so, show an upgrade dialog/toast with static contact
info (WhatsApp/email link) instead of the raw Postgres message. Other errors
keep the existing `toast.error(error.message)` behavior.

**`scanner-list.tsx`** — for free-plan users, show a small badge/banner
"X/2 active scanners" reflecting current active count, with the same contact
link. Fetch the user's plan and active-config count alongside the existing
list query. Paid users see no badge.

## Out of scope

- Payment processing / Stripe integration.
- In-app "request upgrade" button writing to `user_subscriptions.status =
  'requested'` (schema supports it, not built now).
- Admin UI for managing subscriptions (done manually via Supabase Studio).
- Limits on total scan configs (Draft/Inactive) — only `Active` status is
  capped.

## Testing

- Free user creating/activating a 3rd Active config is rejected with
  `SCAN_LIMIT_REACHED`; form shows upgrade prompt.
- Free user editing an existing Active config (not changing status) is not
  blocked by its own row.
- Free user with exactly 2 Active configs can still create/edit Draft or
  Inactive configs.
- Paid user (manually flipped in Supabase Studio) can exceed 2 Active
  configs.
- New signup gets a `user_subscriptions` row with `plan = 'free'`.
