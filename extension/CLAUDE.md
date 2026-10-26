# CLAUDE.md (extension)

Guidance for Claude Code when working in `extension/`. The repo root `CLAUDE.md` covers the Next.js app; this file covers the Chrome extension and the backend routes it depends on.

## What this is

**Colosal**: a Chrome side-panel extension (Manifest V3) for freelancers. It generates Upwork proposals on a job page, scores and optimizes the user's own Upwork profile, and benchmarks the profile against top freelancers on a talent search page. Everything needs a signed-in Colosal account; the extension is only a UI plus page reader. All AI work happens on the Colosal server (`app/api/ext/*`).

Stack: WXT 0.2x, React 19, TypeScript (strict, `noUncheckedIndexedAccess`), Vitest. No UI library, no Tailwind: plain CSS in `entrypoints/sidepanel/style.css`.

## Commands

Run inside `extension/`:

```bash
npm run dev          # WXT dev build with reload
npm run build        # .output/chrome-mv3 (load unpacked at chrome://extensions)
npm test             # vitest run (parsers, scoring, benchmark, page-kind...)
npm run typecheck    # tsc --noEmit
npm run zip          # .output/colosal-extension-<version>-chrome.zip
```

Build-time env vars (the release flow sets them in the shell):

| Var | Effect |
|---|---|
| `WXT_COLOSAL_URL` | Colosal origin the extension talks to. Default `http://localhost:3000`. Also becomes the manifest `host_permissions` entry. |
| `WXT_OMIT_KEY=1` | Leaves the dev `key` out of the manifest. Required for Chrome Web Store builds (the store assigns its own ID). |

Store build: `WXT_COLOSAL_URL=https://app.colosal.xyz WXT_OMIT_KEY=1 npm run zip`.

**`wxt zip` overwrites `.output/chrome-mv3`.** After zipping, run `npm run build` again so the loaded dev extension keeps the dev key and `localhost` host.

## Architecture

```
entrypoints/
  background.ts            opens the side panel (action click, and the floating button's message)
  floating-button.content.ts  draggable launcher on upwork.com (shadow DOM, plain DOM, no React)
  sidepanel/               React UI: App, ProposalTab, ProfileTab, Benchmark, Suggestions, TemplateForm...
lib/
  api.ts                   the only place that calls the Colosal API (fetch + NDJSON stream)
  page.ts                  snapshotActiveTab(): visible text of the active Upwork tab via chrome.scripting
  page-kind.ts             URL -> "job" | "profile" | "talent-search" | "other-upwork" | "outside"; jobIdFromUrl
  use-page-kind.ts         hook: current tab's kind + job id (tab switch, SPA navigation, window focus)
  use-persistent-state.ts  useState backed by chrome.storage; adoptSessionUser, clearSession
  parse-job.ts / parse-talent.ts   text parsers for job pages and talent search pages
  own-profile.ts, placeholders.ts, prompt-markers.ts, auth-cookie.ts   small pure helpers
  types.ts                 API response shapes (duplicated from the server on purpose)
tests/                     vitest; fixtures in tests/fixtures
```

### Panel behaviour

- Three tabs: **Proposal**, **Profile**, **Benchmark**. Opening a job, your profile (`/freelancers/~...`) or a talent search (`/nx/search/talent`) selects the matching tab.
- **Page rules apply to actions, not to results.** Generating needs a job page, scanning needs your profile page, benchmarking needs a talent search page. A result that already exists stays visible (see persistence). When an action does not apply, show `PageState`, never hide stored results.
- The side panel reads the page only when the user clicks a button, through `snapshotActiveTab()` (`chrome.scripting.executeScript`, `document.body.innerText`). There is no always-on content script besides the floating button, and the extension never writes to Upwork pages.
- Auth gate in `App.tsx`: `api.templates()` doubles as the session check. It re-runs on panel focus and (debounced) when the Colosal Supabase cookie changes (`chrome.cookies.onChanged`, matched by `isAuthCookieFor`). `chrome.cookies` may be undefined if Chrome has not applied the permission yet, so it is always called with `?.`.

### Persistence (`use-persistent-state.ts`)

`usePersistentState(key, initial, area = "session")`:

- `chrome.storage.session` (default): profile scan, benchmark, optimize results, suggestion save/undo state. Cleared when the browser closes.
- `chrome.storage.local`: proposals, one entry per job: `proposal.result.<jobId>`, `proposal.generated.<jobId>`, `proposal.feedback.<jobId>`. A job's details page and apply page share the `~0...` id, so the proposal follows the user to the apply form and survives a browser restart. Never pruned (quota ~10 MB).
- Switching key reloads that key's value. A request that finishes after the user moved to another job is written straight to storage under the job it started for (`save()` in `ProposalTab`).
- Per-account isolation: `adoptSessionUser(userId)` (the user id comes from `GET /api/ext/templates`) clears session storage and all `proposal.*` keys when a different account signs in; `clearSession()` does the same on logout. `App` bumps an `epoch` key to remount the tabs.
- `Suggestions` stores its save/undo state with a fingerprint of the suggestion text, so a new result starts clean.

### Calling the API (`lib/api.ts`)

- Every request: `credentials: "include"` and header `X-Colosal-Ext: 1`. The user's Supabase session cookie is the only credential.
- **Chrome omits the `Origin` header on GET requests from extension pages** (observed: `origin: null`). The server therefore cannot rely on `Origin`; it requires the `X-Colosal-Ext` header, and if an `Origin` is present it must equal `EXTENSION_ORIGIN`. A page on another site cannot send that custom header without a preflight, and the preflight only succeeds for `EXTENSION_ORIGIN`.
- `api.proposal(job, templateId, onProgress)` streams newline-delimited JSON (`{type:"progress"|"done"|"error"}`) so the UI can show the review loop steps. Revisions with feedback (`reviseProposal`) use plain JSON.
- Error mapping: `401` -> `unauth` (login gate), `429` -> `limit`, anything else -> `error` with the server's message. All user-facing strings are English.

## Backend counterparts (live in the repo root)

| Route | Purpose |
|---|---|
| `GET/POST /api/ext/templates` | list (with `userId`) / create or update a proposal template. Delete stays in the web app. |
| `POST /api/ext/proposal` | generate (optionally NDJSON stream) or revise a proposal. Generation runs `lib/ai/refine.ts`: three reviewers + a style lint, up to 2 rewrites, 30 s budget. A user-requested revision skips the review loop. |
| `POST /api/ext/profile` | scan: reads the user's own profile from the Upwork API (`lib/upwork/talent-profile.ts`), returns report, suggestions and the 0-100 score. |
| `POST /api/ext/profile/save` | the only writer to `user_profiles` (summary, current_role, skills_text); returns the previous values for undo. |
| `POST /api/ext/benchmark` | compares the profile with the top cards parsed from a talent search page. |
| `POST /api/ext/profile/optimize` | rewrites headline/overview/skills toward the benchmark; unknown proof becomes `[add: ...]`. |

Shared server code: `lib/ext-auth.ts` (origin/header check, session, daily limit via `ext_usage`: free 10, paid 100 per 24 h, fails closed with 503), `lib/ext-cors.ts` (CORS + NDJSON helper), `lib/ai/sumopod.ts` (LLM client, `gpt-4o-mini`), `lib/upwork/profile-score.ts`, `lib/upwork/benchmark.ts`. `/api/ext` is a public path in `proxy.ts` (routes do their own auth and answer 401 JSON, never a redirect).

`EXTENSION_ORIGIN` (server env) must be `chrome-extension://<extension id>`. Dev id comes from the pinned `key` in `wxt.config.ts`; the Chrome Web Store build has a different id that must be set in production.

## Conventions and rules

- **Privacy is part of the contract.** Never send or store other freelancers' names or countries (`parse-talent.ts` drops them before anything leaves the browser). Do not log page text. Do not add analytics or third-party requests.
- **Keep the published API compatible.** Store updates lag behind deploys, so older extension versions keep calling the server. Add fields and routes; do not remove or change the meaning of existing ones without a transition.
- Types in `lib/types.ts` mirror the server's response shapes by hand (e.g. `TalentCard` is duplicated in `parse-talent.ts` and `lib/upwork/benchmark.ts`). Change both sides together. Do not import root `lib/` modules from extension code (the extension bundle must not reach outside its folder); tests may, via relative paths.
- Pure logic goes in `lib/` with a test; components stay thin. New UI strings are English; formal tone, no emoji.
- Styling: tokens and spacing rhythm live at the top and bottom of `style.css` (dark blue theme, 12 px between blocks, 16 px between groups inside a card). Reuse `.card`, `.row`, `.btn`, `.link`, `.muted`, `.warn`, `.err` before adding classes.
- WXT auto-imports `defineBackground` / `defineContentScript`. `tsconfig.json` sets `types: ["chrome"]`; use the `chrome.*` promise APIs, not `browser.*`.
- No new runtime dependencies without a strong reason (the panel is React + plain CSS on purpose).

## Parsers depend on Upwork's text, so test against real text

`parse-job.ts` and `parse-talent.ts` parse `document.body.innerText`, anchored on visible labels, not CSS classes. Things learned the hard way:

- `innerText` has **no list numbers** ("1.", "2."): screening questions arrive as plain lines; strip a number if present.
- Label values can be on the next line (`English level:` then `Fluent`); a budget range can be split (`$9.00`, `-`, `$12.00`, `Hourly`); experience level can appear before the budget.
- Talent cards start at a `Status away|offline|online` line; skills sit between `Start of list.` and `End of list.` with a trailing `+N`.

When a parser breaks: get the real text (`copy(document.body.innerText)` in DevTools), add it as a trimmed, anonymized fixture in `tests/fixtures/`, write the failing test, then fix the parser. Never commit real people's names or text.

## Releasing to the Chrome Web Store

1. Bump `version` in `package.json` (the store rejects a repeated version).
2. `npm run typecheck && npm test`.
3. Build the ZIP with the store command above, then open the ZIP's `manifest.json` and confirm: no `key`, `host_permissions` only `https://*.upwork.com/*` and the production Colosal origin, no `localhost` anywhere in the JS.
4. Rebuild the dev build (`npm run build`).
5. Production env `EXTENSION_ORIGIN` = the store item's `chrome-extension://<id>`, then redeploy. A `403 Forbidden` in the panel on load almost always means this is unset or wrong.
6. Deploy the matching server code before the extension update is approved (new clients may call new routes or flags such as `stream: true`).

## Known limits

- Upwork can change its page text at any time; parsers fail loudly (explicit `ParseError` messages) rather than guessing.
- The daily limit is count-then-insert, not atomic: a burst can overshoot by a few calls.
- Own-profile detection (`own-profile.ts`) is a heuristic and only warns; the scan always analyzes the connected account's profile.
- Reading Upwork pages sits in a grey area of Upwork's terms. Keep it user-triggered; do not add crawling or background scraping.
