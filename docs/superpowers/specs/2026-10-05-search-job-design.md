# Search Job: create a scanner from a job search

## Intent

Second way to create a scanner. Today a user clicks "New Configuration" and fills a 5-step form. New flow mirrors Upwork saved searches: the user searches jobs, refines with filters, sees results with a match score, and saves the search as a scanner config.

Decided with the user:
- New top-level page "Search Job" in the sidebar, Google/Upwork-style keyword search.
- Results load only after the user types a keyword and clicks Search.
- Filters sit in a sidebar next to the results and narrow them live.
- Each result shows a job match score.
- A "Save as scanner" button on the results page asks for a name, inserts a `Draft` `user_scan_config` holding the keyword and active filters, then redirects to the existing `/job-scanner/[id]/edit` to finish cover letter, questions, attachments, notifications.
- The existing form flow and "New Configuration" button stay unchanged.

## Design

### Navigation
Add `{ href: "/search-job", label: "Search Job", icon: Search }` to `components/layout/app-sidebar.tsx`, next to "Job Scanner". Route: `app/(dashboard)/search-job/`.

### Page `/search-job`
- Server `page.tsx`: loads `user_profiles.skills_text` and `email`/`phone` defaults, passes them to the client component.
- Client `search-job.tsx`, two states:
  - **Before search:** centered keyword input and Search button. Enter also submits.
  - **After search:** compact search bar on top, filter sidebar on the left, results on the right, header with result count, "Save as scanner" button in the header.
- Click Search: one `GET /api/upwork/jobs-search?keyword=...&all=1` call. Results held in client state (up to 50, recency order).
- **Live filters:** filtering is client-side over the fetched results, so it is instant and costs no extra Upwork calls. Filters: hourly rate min/max, budget min/max, experience level, contract type, skills. Category is a filter too, applied client-side when the API returns the job category. Changing the keyword needs a new Search click.
- **Result card:** title, short description, posted time, budget or hourly range, experience level, skills, match score badge. Score badge styling reuses `matchScoreStyle` from `app/(dashboard)/job-scanner/[id]/job-list.tsx` (move it to a shared util if needed). Sort option: best match / newest.
- **States:** loading, empty ("No jobs found"), error, Upwork not connected.
- **Save as scanner:** dialog asks for a name. Inserts `name`, `keyword`, and the currently applied filters into the matching `user_scan_config` columns (same mapping as `scanner-form.tsx`), `status: "Draft"`, default `email`/`whatsapp` as in `new/page.tsx`. Then `router.push(/job-scanner/${id}/edit)`. Draft does not count toward the free-plan active cap, so no block is needed.

### Match score (no AI cost)
`score = round(100 * matched / jobSkills.length)` where `jobSkills` are the job's skill names and `matched` counts those present in the user's skills. Matching is case-insensitive on trimmed names. User skills come from `user_profiles.skills_text` split on commas. No job skills or no user skills gives `null`, shown as no badge. Pure function in `lib/search-job/match-score.ts`, computed client-side. This is rough by design: it does not understand synonyms or job text.

### API
Extend `GET /api/upwork/jobs-search`:
- `all=1`: skip the screening-question filter and return rich cards: id (ciphertext), title, description, createdDateTime, contract type, budget/hourly range, experience level, category, skills (names), plus `totalCount`.
- Without `all=1` the response is unchanged, so the form's test-job picker keeps working.
- Only `keyword` is sent upstream. Filters are applied client-side, so no filter param mapping is needed in this version.
- Verify the GraphQL node field names (budget, hourly range, experience, skills, category) against the Upwork schema before implementing.

### Filter component
Extract the filter inputs from `scanner-form.tsx` into a shared `scanner-filters.tsx` only if the search sidebar can reuse them as-is. Otherwise build the sidebar separately. Do not refactor the form for its own sake.

## Error handling
401 unauthenticated, 400 Upwork not connected, 502 Upwork failure (existing behavior). UI shows inline error. Save failure shows the Supabase error message in a toast.

## Testing
No test suite in repo. One small runnable check for `match-score.ts` (assert-based). Plus `npm run typecheck`, `npm run lint`, and a manual run: search, filter, save, land on edit form with filters prefilled.

## Out of scope
Pagination beyond first 50 results, job detail view, bookmarking individual jobs, server-side filtering, AI scoring, changes to the existing form flow.
