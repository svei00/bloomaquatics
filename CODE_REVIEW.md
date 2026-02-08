# Bloom Aquatics — Code Review & Implementation Plan

**Audit date:** 2026-07-03 · **Auditor:** Claude (Fable 5) · **Status of this doc:** handoff for incremental implementation

## How to use this document

Work through the phases **in order, one task at a time**. Each phase is small enough to be a single
sitting and each task is safe to commit on its own — the app keeps working after every step.
Check the boxes as you go. Any implementation model (Sonnet / Opus) can pick up any unchecked task:
each task states the issue, why it matters, and the fix, with acceptance criteria. No task depends
on conversation context outside this file.

Suggested workflow per task: read the task → implement → run `npm run build` + manual smoke test of
the affected tab → commit with the task ID in the message (e.g. `P0-1: define DetailModal`).

---

## Confirmed decisions (from the owner)

These were open questions during the audit; the owner has since decided:

1. **Authentication: required.** The app is internet-exposed (nginx + Certbot + DuckDNS) and the
   owner's VPS has been compromised before. Login is a must, with minimal friction (log in once per
   device, long-lived session).
2. **Dual sales recording: unintentional — unify it.** A sale can currently be recorded two ways
   (an `inventory_sales` row via "Marcar Vendido"/"Registrar Cosecha", or an income `transaction`
   via Registro). Keep **one** pipeline. Recommendation (adopt unless the owner objects):
   **keep `inventory_sales` as the source of truth for item sales**, and keep Registro/transactions
   **only for income/expenses not tied to an inventory item** (gas, generic income, etc.).
   Rationale: `inventory_sales` carries per-item structure (harvest history, platform, per-item
   profit) that transactions can't represent; Reports already needs it. See task P2-3 for the
   exact migration steps.

---

## Phase 0 — Critical fixes (do first; ~1 short session)

### P0-1 · Fix the `DetailModal` crash 🔴 app-breaking
- **Issue:** `src/bloomaquatics.jsx:1001` renders `<DetailModal item={detail} …/>` but no
  `DetailModal` component is defined or imported anywhere. Tapping **any item in the Vitrina tab**
  throws `ReferenceError: DetailModal is not defined` and white-screens the app.
- **Why:** Vitrina is the client-facing showcase — its main tap target crashes the whole app.
- **Fix:** Implement a `DetailModal` component (use the existing `Modal` wrapper): large photo,
  name, type badge, client description, selling price, availability, cost-center name, and — for
  plants/animals — the sales/harvest history list. Match the visual style of `SaleModal`'s header
  card. Alternatively (quick stopgap) remove the three `onClick={()=>setDetail(item)}` handlers
  and the `detail` state until the modal exists.
- **Accept:** tapping every item in grid, list, and detail view modes opens (or does nothing) —
  never crashes.

### P0-2 · Fix git file casing + Vite config name 🔴 breaks Linux deploys & dev proxy
- **Issue:** git tracks `Index.html` and `Vite.config` (capital letters, no `.js`) while the
  files on disk are `index.html` / `vite.config`. On the case-sensitive DietPi server a fresh
  clone produces wrongly-named files: Vite can't find its `index.html` entry, and `Vite.config`
  is never loaded (Vite only reads `vite.config.js`). Even on Windows the missing `.js` extension
  means the config — React plugin + the `/api` dev proxy — is **silently ignored**, so
  `npm run dev` can't reach the backend.
- **Fix:** `git mv Index.html index.html` and `git mv Vite.config vite.config.js` (on Windows this
  may need a two-step rename via a temp name, e.g. `git mv Index.html index2.html` then
  `git mv index2.html index.html`). Commit. Then delete the README's manual-rename workaround
  (step 2 of First-Time Setup and the "vite.config not found" troubleshooting entry).
- **Accept:** `git ls-files` shows `index.html` and `vite.config.js`; `npm run dev` proxies
  `/api` to :4567 successfully.

### P0-3 · Add `.gitignore` 🔴 privacy guard
- **Issue:** no `.gitignore` exists. On the server, `bloom.db` (the family's complete financial
  data), `uploads/` (household photos), `backups/`, `dist/`, and `node_modules/` sit untracked in
  the repo folder — one careless `git add .` publishes them to GitHub.
- **Fix:** add a `.gitignore` covering: `node_modules/`, `dist/`, `bloom.db`, `bloom.db-*`
  (WAL/SHM files), `uploads/`, `backups/`, `.env`.
- **Accept:** `git status` on the server shows a clean tree with the app running.

---

## Phase 1 — Security (the owner's top concern; can be split across sessions)

### P1-1 · Session-based login
- **Issue:** every API endpoint — including all DELETEs and photo upload — is open to the
  internet. Anyone can read or destroy the data.
- **Design (minimal friction, per owner requirement):**
  - Single shared family password (per-person passwords optional later).
  - `express-session` with an SQLite-backed session store (e.g. `better-sqlite3-session-store`),
    cookie flags `httpOnly`, `SameSite=Lax`, `Secure`; rolling expiry ~90 days refreshed on
    activity → each phone logs in **once** and never again in practice.
  - Password stored as a bcrypt (or argon2) hash, sourced from an environment variable or a
    config file **outside git** — never hardcoded in `server.js`.
  - Auth middleware guarding every `/api/*` route; `POST /api/login` and `POST /api/logout` are
    the only open endpoints. Unknown session → JSON 401.
  - Frontend: on any 401, show a login screen (logo + one password field, styled like the
    existing modals); on success, reload data. No visible session machinery anywhere else —
    implementation details stay out of the UI.
  - Rate-limit `/api/login` hard (e.g. 5 attempts/min/IP) so a single shared password is safe
    against online guessing.
- **Optional refinement (decide during implementation):** a deliberately public, read-only,
  cost-stripped vitrina endpoint if the family ever wants to share a live catalog link with
  customers. Default: everything private.
- **Accept:** unauthenticated `curl` to any `/api/*` route (except login) returns 401; after
  login on a phone, no prompt reappears for months.

### P1-2 · Harden photo upload (two real vulnerabilities)
- **(a) Stored XSS via extension:** the saved filename uses `path.extname(file.originalname)`
  (`server.js:191`) and the filter only trusts the client-supplied `mimetype`. Uploading a file
  named `x.html` with a spoofed `image/png` type stores `{itemId}.html`, which `express.static`
  then serves as HTML from your origin → attacker script on the family's domain.
  **Fix:** allowlist extensions (`.jpg .jpeg .png .webp`), reject anything else in `fileFilter`;
  serve `/uploads` with `X-Content-Type-Options: nosniff` and explicit image content types.
- **(b) Path traversal via `itemId`:** the route param goes straight into the filename
  (`server.js:193`); a URL-encoded `%2F` can decode to a path separator and write outside
  `uploads/`. **Fix:** validate `itemId` (and `ccId` in the cost-center uploader) against
  `^[a-z0-9]+$` before use, and 404 if the inventory row / cost center doesn't exist (also
  prevents orphan files).
- **Accept:** uploading a `.html`/`.svg` file is rejected with 400; a request with `..%2F` in the
  id is rejected; upload for a nonexistent item returns 404.

### P1-3 · Input validation + error handling + `NODE_ENV`
- **Issue:** no route validates its body; missing fields reach better-sqlite3 as `undefined`,
  which throws — and with `NODE_ENV` unset, **Express's default handler returns the full stack
  trace** (file paths, query text) to the caller.
- **Fix:** small per-route validation (required fields present, `amount` is a finite number ≥ 0,
  `type` in its allowed set, strings length-capped, dates match `YYYY-MM-DD`) returning JSON 400s;
  a final error-handling middleware that logs internally and returns a generic JSON 500; a JSON
  404 for unknown `/api/*` paths (currently they fall through to the HTML catch-all); set
  `NODE_ENV=production` in the PM2 ecosystem/start command.
- **Accept:** posting `{}` to `/api/transactions` returns a clean 400 with no stack trace.

### P1-4 · Rate limiting + security headers
- **Fix:** `helmet` with a minimal CSP (no third-party scripts exist); a generous global rate
  limiter on `/api/*` plus the strict login limiter from P1-1. Do **not** add a permissive
  `cors()` — same-origin-only is currently correct.
- **Note (outside app scope, worth doing given the prior VPS hack):** fail2ban on SSH, key-only
  SSH auth, and an off-device copy of `backups/` (weekly `scp`/rclone cron) — backups on the same
  SD card don't survive device death or another compromise.

---

## Phase 2 — Data reliability

### P2-1 · Stop silent data loss on failed saves
- **Issue:** every mutation in `App` (`bloomaquatics.jsx:1794-1805`) updates local state first and
  fires the API call with `.catch(console.error)`. If the server rejects, the UI shows the entry
  as saved and it silently disappears on the next reload. Worst possible failure mode for a
  finance tracker.
- **Fix:** await the server response; on failure, revert the optimistic state change and show a
  visible error (a simple toast/banner component reused across tabs). Keep the optimistic update —
  the snappiness is a feature — just add the rollback + message.
- **Accept:** stop the server, add a transaction → UI shows an error and the entry is not left in
  the list.

### P2-2 · Server-generated IDs
- **Issue:** the client generates `id`s (`uid()`) and the server inserts them verbatim; a
  duplicate throws a 500 while the optimistic UI shows success.
- **Fix:** server generates the id (same base36 scheme or `crypto.randomUUID()`), returns it in
  the response; client updates its optimistic row with the returned id. Do together with P2-1.

### P2-3 · Unify the sales pipeline (owner-confirmed: remove the duplicate path)
- **Decision:** `inventory_sales` is the source of truth for item sales; transactions remain for
  non-item income and all expenses.
- **Steps:**
  1. In `TxnModal`, when the income description is linked to an inventory item (via `AutoDesc`
     pick or exact-name fallback), **redirect the save**: create an `inventory_sales` row for
     that item instead of an income transaction (reuse the `SaleModal` save path; carry over
     date, amount → salePrice, payment, notes; platform = "Otro" or ask). Unlinked income and
     all expenses keep saving as transactions, unchanged.
  2. Update Reports "performers" to read from `inventory_sales` (it currently reads only
     transactions, so SaleModal sales never appear in the ranking — that's the other half of
     the bug).
  3. Monthly totals (`calcM`, `ccStats`) already sum transactions + inventory sales; once step 1
     stops creating duplicates, the double-count risk is gone for new data.
  4. **One-time data cleanup:** extend `scripts/backfill-linked-items.js` (or add a sibling
     script, same dry-run/--apply/--undo discipline) to find historical income transactions whose
     `linked_item_id` matches an inventory item that ALSO has an `inventory_sales` row on the
     same date with the same amount → those are double-recorded; report them for manual review
     before deleting the transaction copy. Anything ambiguous stays untouched and listed.
- **Accept:** recording a sale from either entry point produces exactly one record; Reportes
  monthly totals and the performers ranking agree with each other.

### P2-4 · Protect cost-center deletion
- **Issue:** `DELETE /api/cost-centers/:id` orphans that person's transactions and inventory
  (no FK on `cc_id`); dashboards then show blank names.
- **Fix:** server refuses to delete a cost center that has transactions or inventory (409 with a
  clear message), OR accepts a `reassignTo` target id and moves the rows first. UI: replace the
  current confirm() with a small dialog offering reassignment.

---

## Phase 3 — Refactor & performance (safe to do gradually, one extraction per commit)

### P3-1 · Fix `photoUrl` cache-busting (quick perf win — do first in this phase)
- **Issue:** `photoUrl` (`bloomaquatics.jsx:16`) appends `?t=${Date.now()}` → a new URL on every
  render → **every photo re-downloads on every re-render** (typing one letter in Vitrina search
  refetches all visible images). Heavy on a phone talking to a Raspberry-class server.
- **Fix:** cache-bust with a stable version that changes only when the photo changes — e.g. store
  `photoVersion` (timestamp) in state, bump it in `updatePhoto`/upload success; or have the server
  include the file mtime in the inventory payload and use that.

### P3-2 · Split the monolith
Extract in this order (each is one commit, app working after each):
1. `src/api/client.js` — the `api` object.
2. `src/lib/format.js` — `fmt`, `uid`, `today`, `inMY`, `inY`, `daysSince`.
3. `src/lib/inventory.js` — `isMulti`, `typeIcon`, `typeLabel`, `normName`, plus **new**
   `revenueOf(item)` / `profitOf(item)` (the `(item.sales||[]).reduce(...)` expression is
   currently re-implemented ~10 times) and `periodTotals(...)` (shared by Dashboard `ccStats`
   and Reports `calcM`, which duplicate the same aggregation).
4. `src/theme.js` — see P3-4.
5. `src/components/` — `Avatar`, `Chip`, `StatBox`, `Modal`, `PhotoThumb`, `PhotoUpload`,
   `AutoDesc`, `BarChart`.
6. `src/features/{dashboard,transactions,inventory,vitrina,reports,settings}/` — one folder per
   tab with its modals. Merge `InvModal` + `EditInvModal` into one `InventoryForm` (they are ~90%
   identical) parameterized by initial values / availability toggle / submit handler.
7. Server side: `db/connection.js`, `db/migrations.js` (numbered migrations + `schema_version`
   table replacing the try/catch-per-column pattern), `db/repositories/` (all prepared statements;
   routes never touch SQL), `routes/` per resource, `services/backup.js`.

### P3-3 · Dead code & small fixes (one sweep commit)
- Delete unused module const `MONTHS_S` (line 4); make Reports use it instead of its local
  duplicate `MONTHS_S2`.
- Delete the shadowing local `SUPPLY_UNITS` in `InvModal` (:263) and `EditInvModal` (:393) —
  use the module const.
- `SaleModal` hardcodes platform/payment arrays inline (:373, :377) — use `PLATFORMS`/`PAYMENTS`.
- Remove duplicate comment banners (:257-261, :1588-1590); remove unused `inventory` prop from
  `Transactions`.
- Guard `Avatar` against empty `name` (`name[0]` at :57 crashes on "").
- Rename cryptic setters `setSI/setPI/setEI/setFO/setAF` → `setSaleItem/setPhotoItem/…`.
- Align versions: package.json says 3.0.0, Settings UI says "v4.0" — pick one; add
  `"engines": { "node": ">=22" }` (README requires Node 22 for better-sqlite3).
- Move `react`/`react-dom` from devDependencies to dependencies (convention).
- Add an error boundary around the tab content area so one render error doesn't white-screen
  the whole app.
- Add ESLint with `eslint-plugin-react-hooks` (it would have caught the `DetailModal` bug and
  the unused vars at commit time).

### P3-4 · Centralize styling into theme tokens
- **Issue:** the `S` object is a good start, but the palette is hardcoded at every use site —
  `#7c3aed`, `#16a34a`, `#dc2626`, `#6b7280`, `#9ca3af`, `#0891b2` each appear dozens of times
  across the JSX, the canvas-drawing code, and `index.html`. Re-theming means ~100 edits.
- **Fix:** one `src/theme.js` exporting semantic tokens — `colors.brand`, `colors.income`,
  `colors.expense`, `colors.info`, `colors.textMuted`, `colors.border`, plus spacing/radius/
  font-size scales — with the existing `S` styles folded in. Everything (including the canvas
  generator) imports from it. A JS module beats CSS variables here because the codebase is 100%
  inline styles and canvas needs JS values anyway — don't convert to CSS files just for this.
- **Contrast fixes while touching it:** `#9ca3af` on white (≈2.5:1) is used for 9–11px text (nav
  labels :1877, stat labels, hints) — below WCAG AA. Bump muted text to `#6b7280`/`#4b5563`;
  reserve `#9ca3af` for disabled states. Consider removing `user-scalable=no` from the viewport
  meta (`index.html:13`) — it blocks pinch-zoom; the 16px inputs already prevent iOS auto-zoom.

### P3-5 · Scaling notes (do only when data grows — not now)
- `GET /api/inventory` matches sales to items in JS per item (O(n·m)) — switch to a Map or SQL
  join when item count grows.
- No pagination/date filtering on the list endpoints; frontend loads everything at boot. Fine at
  family scale; add month-range params if it ever feels slow.
- Wrap Reports/Vitrina derived computations in `useMemo` if typing in search ever lags.

---

## Phase 4 — Polish

- **P4-1:** Re-save `README.md` as UTF-8 (it is currently UTF-16 LE — renders garbled in many
  tools). Fix content: remove the vite.config rename workaround (after P0-2), document
  `scripts/backfill-linked-items.js`, add a short DB schema overview, document the new login,
  update the structure diagram.
- **P4-2:** Delete unreferenced assets from `public/` (~8 MB copied into every build):
  `Image_zfh09wzfh09wzfh0.png` (6.8 MB), `PWA-install-icons.png` (281 KB), and `full_logo.png`
  (803 KB — keep only if it's a needed source asset, then move it out of `public/`).
- **P4-3:** Decide the income-green story: `#16a34a` vs `#1d4ed8` are both used for "positive" —
  tokens (P3-4) force the decision once.

---

## What is already good (don't break these)

- **All SQL is parameterized** — zero injection exposure, including the backfill script. Keep it
  that way in the new repositories layer.
- **Backups done right:** WAL mode, 7-day rolling weekday backups, startup snapshots pruned to
  last 5, using better-sqlite3's online `backup()` API (not file copies of a live DB).
- **Migrations done right:** additive ALTERs plus a correct full table-rebuild (FKs off, in a
  transaction) for the CHECK-constraint change — textbook SQLite. P3-2's migration runner
  formalizes this, it doesn't replace the technique.
- **Careful data tooling:** the backfill script is dry-run by default with `--apply`/`--undo`
  and ambiguity detection. Follow the same discipline in P2-3's cleanup script.
- **Clean API boundary:** snake_case → camelCase mapping at the server edge.
- **Mobile-first care:** `100dvh`, safe-area insets, 40px+ touch targets, camera capture, Web
  Share API with clipboard/download fallbacks, canvas-generated shareable catalogs, boot
  loading/error states with retry.
