# Bloom Aquatics — Online Store Roadmap & Seasonality Analytics Plan

**Session date:** 2026-07-06 · **Format:** planning document — no code, no diffs.
**Companion doc:** `CODE_REVIEW.md` (the security/quality plan being worked through separately).
This document is the build-from plan for Sonnet/Opus, one piece at a time.

---

## 1. What the owners told me (interview record)

| # | Question | Answer |
|---|----------|--------|
| 1 | Distinct items today | ~27 varieties: ~24 plants (Vallisneria; Cryptocoryne wendtii green/brownie/tropical; C. retrospiralis; Anubias nana; Anubias panda variegated; pino de agua; Limnophila; Sagittaria; Java/weeping/Christmas moss; Ludwigia super red; tiger lotus; Amazon sword; Ozelot; Red Ruby; Red Flame; water lettuce; duckweed; frogbit; others) + 3 shrimp lines (Red Cherry, Red Rili, Blue Velvet). Growth is variable — some plants replenish faster than others (inventory grows biologically, not only by purchasing). |
| 2 | Budget for platform fees | **No.** The business cannot absorb ~$39/mo today. Any recommendation must run at ~$0 fixed cost until the business proves itself. |
| 3 | Time available | **20–25 hours/week**, with constant hands-on involvement (not review-only). This is a lot — it changes the build-vs-buy math. |
| 4 | Shipping live goods | **Plants: yes, ship beyond SoCal. Shrimp: no — local only, not part of the shipping project.** No invasive-species/state-law research has been done yet (assigned below as a required task). |
| 5 | One store or two flows | **One store**, with the plants featured prominently. Per-item shipping eligibility handles the shrimp-stay-local rule inside the single store. |
| 6 | Look & feel | **Family identity matters.** Not a generic template. |
| 7 | Capture time-of-day | **Yes.** Default the timestamp to "now" (she registers immediately after each sale) **with an edit button** for the occasional late entry. Owner already suspects 12pm–5pm is the strong window — the data will confirm or correct that. Historical data has no time signal; the hourly report starts counting from the day this ships. |
| 8 | Sales vs. inquiries | **Time of completed sale** is the question. No inquiry-logging needed for now. |

---

## 2. Part 1 — The store roadmap

### 2.1 The call: build on what you have. Shopify waits.

Forty years of watching shops open and close says the platform question answers itself when you
line up the facts instead of the brochures:

- **You can't carry a fixed fee** (answer #2). Shopify Basic is ~$39/mo before apps; even the $5
  Starter plan plus payment processing is a real cost against $500 months. A fee you pay in slow
  months is rent on a building you don't need yet.
- **You have 20–25 hours/week and a developer in the family** (answer #3). The usual argument for
  Shopify is "your time is scarcer than money." Yours is the opposite case.
- **You already own the hard parts.** A working catalog with photos, descriptions, availability
  flags, and price-visibility controls (Vitrina), a server, a domain, a deploy process. What's
  missing is a public page and an order flow — not a platform.
- **Family identity matters to you** (answer #6). On Shopify that means fighting a theme; on your
  own app it means keeping what you already built.
- **~27 SKUs** (answer #1) is a catalog a homemade store handles trivially.

**But — and write this down — we design everything as if Shopify is coming later**, because it
might be. That's your scalability requirement. Every schema decision below keeps a straight
export path to Shopify's product/variant/order model (§2.5), so if the day comes when volume
makes $39/mo a rounding error and shipping-label busywork is eating your evenings, moving is a
data export, not a rebuild. Platform loyalty is for suckers; **data portability is the actual
strategy.**

### 2.2 Prerequisite (non-negotiable)

**No public store feature ships before `CODE_REVIEW.md` Phase 0 and Phase 1 (auth, upload
hardening, validation, rate limiting) are done.** You cannot bolt a public order form onto a
server that currently lets strangers delete your books. The store roadmap starts where the
security plan ends. (P2-1/P2-2/P2-3 — save reliability, server IDs, sales unification — should
also land before Phase 1 below, since orders will write into that pipeline.)

### 2.3 The phases, with graduation criteria in your own numbers

Thresholds are **starting guesses to revisit**, not laws. They're anchored to your $500 best
month.

**Phase 0 — Today (no build).** Vitrina share-as-text/image, sales settled in person via
Zelle/Venmo/PayPal/cash. Stays exactly as is while the security work finishes.

**Phase 1 — "Reserve & Pickup" page. Running cost: $0.**
A public, read-only catalog page (the cost-stripped Vitrina you already have, given a real URL)
plus an **order-request flow**: a customer picks items, leaves name + phone/email + pickup or
shipping preference, and the items get **reserved** (marked pending in inventory) with a
notification to the owners. **No online payment processing at all** — money still changes hands
the way it does today (Zelle/Venmo/PayPal/cash at pickup). This is deliberate: it gets you a
real store experience, real customer records, and real order data with zero fees, zero PCI
concerns, and zero new monthly costs. New schema: `orders`, `order_items`, `customers` (§2.4).
- *Graduate when:* ~10+ order-requests/month for 2–3 consecutive months, **or** repeated
  requests to ship plants outside the local area, **or** revenue sustains ~2× best month
  (~$1,000/mo).

**Phase 2 — Real checkout + plant shipping. Running cost: still $0 fixed, per-transaction fees only.**
Add payment at order time via **PayPal buttons and/or Stripe payment links** — no monthly fee,
~2.9% + 30¢ per transaction, which is a cost that only exists when money comes in (the only kind
of cost a small shop should love). Add plant shipping: per-item `ships` flag (shrimp stay
local-only badges), flat-rate or calculated USPS via a label reseller (Pirate Ship or similar —
no monthly fee). **Gate: the species-legality research task (§2.6) must be complete before the
first interstate plant ships.**
- *Graduate when:* sustained ~$1,500–2,000/mo (3–4× best month) **and** order volume makes
  manual label/packing/tax handling feel like a second job.

**Phase 3 — The platform decision, revisited with real numbers.**
Now — and only now — Shopify earns a fair hearing: at ~$2,000/mo, $39 is 2% of revenue, and its
shipping/tax automation buys back real hours. Because of §2.5, moving is an export. The honest
alternative at this stage is staying custom and adding the automation piecemeal; decide it then
with that year's data, not today's guesses. **Also at this phase:** if an aquarium/pet shop has
started buying regularly, the `customers` table (already live since Phase 1) grows a wholesale
flag and per-customer pricing — a B2B relationship is a repeat-customer record with different
prices, nothing more exotic.

**Phase 4+ — The chatbot note (parking it, as requested).**
The idea: at high volume, a chatbot answers routine customer questions, and occasionally a real
family member takes over a conversation so it feels like the family attends the business.
Recorded, not designed. When its day comes it lives entirely outside this app — a website chat
widget or WhatsApp Business API, plus routing a fraction of chats to a human. It has no
dependency on anything in this document. Revisit when missed messages are demonstrably costing
sales, not before.

### 2.4 Schema additions (described, not coded — for the implementation model)

- **`customers`** — id, name, contact (phone/email, one free-text field is fine at this scale),
  notes, created_at. Optional on every sale; required on online orders. This also quietly solves
  the "no concept of a customer" gap flagged in the audit.
- **`orders`** — id, customer_id, status (`requested` → `confirmed` → `paid` → `fulfilled` /
  `cancelled`), fulfillment (`pickup` | `ship`), created_at (full timestamp), notes, and later a
  payment reference.
- **`order_items`** — order_id, inventory_id, qty, unit_price_at_order (prices change; the order
  keeps what was quoted).
- **`inventory` additions** — `ships` (boolean; shrimp = false), and eventually a `photos` table
  (one photo per item is fine for Vitrina; a store wants several — don't build it until Phase 1
  actually needs it).
- **Reservation rule:** a `requested` order holds its items (shown as reserved, not sold);
  cancellation releases them. Keep it simple — no expiry timers until abandoned reservations are
  actually a problem.
- **The books stay the books:** when an order completes, it writes an `inventory_sales` row
  (and its money movement) through the **same unified pipeline** from `CODE_REVIEW.md` P2-3 —
  the store never grows a second set of books. Dashboard and Reportes keep working untouched.
  This is the single most important architectural rule in this document.

### 2.5 The portability mapping (so leaving is always cheap)

SQLite remains the **source of truth for everything** — cost basis, harvest history, internal
notes, cost centers. If Shopify ever enters, it gets a **one-way push of public listing data**
(name, description, photos, selling price, stock, ships-or-not as a tag) and sends back **orders
via webhook** into the same `orders` → `inventory_sales` pipeline. Field mapping to plan around:

- `inventory.name/description/selling_price/photo` → Shopify product title/body/price/images. Clean.
- `type` (plant/animal/product/supply) → Shopify product type or tag. Clean.
- `is_available` + `ships` → published status + shipping profile. Clean.
- **Doesn't map cleanly:** the harvest model. Shopify has no "mother plant that keeps producing."
  Treat each plant variety's *sellable portions* as the stock number (qty of portions available
  now), and keep harvest history purely on the Bloom side. Same trick works for shrimp colonies
  if they ever ship. Decide portion-stock counting at Phase 1 build time — it's also what the
  reserve flow needs anyway.
- `purchase_price`, cost centers, internal notes: **never leave the house.** Not Shopify's business.

### 2.6 Required research task before any plant crosses a state line (Phase 2 gate)

This one comes from forty years of watching hobby shops get nasty letters. On your own current
list, the three floaters — **water lettuce (Pistia stratiotes), duckweed (Lemna), and frogbit** —
are exactly the kind of fast-spreading species that sit on multiple states' prohibited/noxious
weed lists, and several states also restrict others common in the trade. I am not certifying the
current legal status of any species — that's the research task: **check every species you'd ship
against the USDA federal noxious weed list and each destination state's department-of-agriculture
prohibited list** (the big aquatics vendors publish "cannot ship to state X" tables you can
sanity-check against). Deliverable: a simple per-species note — "ships anywhere," "excluded
states: …," or "local only" — which Phase 2 turns into checkout rules. Until then, floaters are
local-pickup only, no exceptions. Also, one line from your tax person (oh wait — that's you):
confirm the CDTFA seller's-permit situation for tangible goods before online checkout goes live;
out-of-state economic-nexus thresholds are far above current volume and can be ignored for years.

---

## 3. Part 2 — Seasonality & timing analytics (build against the current app)

### 3.1 Decisions locked in from the interview

- **Capture a full timestamp on every sale going forward.** `inventory_sales` gains a sale
  timestamp (and transactions likewise), **defaulting to "now"** — she records immediately after
  selling — **with an edit control** on the form for late entries. Historical rows have date
  only; every hourly view must handle "no time known" rows gracefully (excluded from hour
  buckets, never guessed). **Ship this first — every week of delay is a week of lost signal that
  can never be recovered.** It should ride along with the P2-3 form changes so the sale form is
  touched once, not twice.
- **"When customers come" = when sales complete.** No inquiry logging. (If that question ever
  changes, it's a one-tap "someone asked" counter — noted, not planned.)
- **Optional customer on a sale:** since the sale form is being touched anyway and Phase 1 of the
  store needs a `customers` table regardless, add the optional customer field to the sale form in
  the same change. It sits unused until a repeat buyer or the wholesale shop shows up — then it's
  already there.

### 3.2 Architecture: one bucketing layer, many views

**Build a single generic aggregation helper, not a pile of one-off queries:** something shaped
like `aggregateBy(rows, bucket, dateField, valueFn)` where bucket ∈ {hour-of-day, day-of-week,
day, week, month, quarter/season, year}, and `valueFn` defaults to revenue but accepts profit or
count. It lives beside the `revenueOf`/`profitOf` helpers planned in `CODE_REVIEW.md` P3-2 and
feeds every view below.

**Compute it in JS, not SQL.** Recommendation with reasons: the frontend already loads all
transactions and inventory at boot; volumes are hundreds to low thousands of rows (a family
business, not a warehouse); JS keeps the logic next to the existing report code and testable
without a server; and SQLite `strftime` pushes date logic into a second place that can drift from
the JS date handling (the app already has careful `T12:00:00` timezone guards — keep one date
brain, not two). Revisit only if the dataset someday makes the Reports tab visibly lag — the
escape hatch is mechanical.

### 3.3 The views (a new "Ritmo" / rhythm tab or section inside Reportes)

1. **Hour-of-day profile** — bars for revenue and sale-count by hour, with a visible note of how
   much data it's based on ("desde 15-jul-2026 · 42 ventas") so nobody over-trusts three weeks of
   data. This is the report that confirms or corrects the 12–5pm instinct.
2. **Day-of-week profile** — same shape, works on **all historical data immediately** (dates
   exist since day one). This is the "which day can we rest" report, available on day one of the
   build.
3. **Calendar heatmap with drill-down** — the centerpiece. Day-of-week columns × week rows,
   shaded by revenue (or profit), one year visible at a time, tap a month to zoom, tap a day for
   its sales. This is the view that can literally show "summer is slow *except the first two
   weeks*" and "winter is fine *except…*" instead of asserting month-level averages.
   **Build it as inline SVG in the style of the existing `BarChart` component — no charting
   library.** A heatmap is rects and fills; a dependency would be the first third-party UI
   library in the whole app, for the easiest chart in the set. Consistency with how this app is
   built wins.
4. **Notable-days layer** — a small hardcoded list of major US holidays (New Year's, Memorial
   Day, July 4th, Labor Day, Thanksgiving + the Friday, Christmas Eve/Day, New Year's Eve) plus
   day-of-week context: the heatmap marks these days, and a small table shows each notable day's
   average vs. an ordinary same-weekday. Their July 4th observation becomes a measured fact, and
   the "Friday/Monday next to a holiday" pattern they already reason about becomes visible. No
   holiday-calendar API — overkill forever at this scale; the list is ~10 lines the owners
   control.
5. **"Safe to rest" synthesis** — the actual point of all of it. A plain-language panel:
   *"Historically your slowest windows are X and Y. If you had closed every [Tuesday] last year
   you'd have missed $Z (N% of revenue)."* Same math answers vacation planning: pick a candidate
   week, see what that week earned in prior years. When the lighting-and-feeding automation
   someday makes stepping away physically possible, **this view is what says when it's
   financially safe** — that automation is a separate project, but this is its calendar.

### 3.4 Recommended additions (named for later prioritization, not built now)

- **Inventory aging / dead stock** — items unsold past a threshold (say 60/90 days, tuned per
  type since plants and strollers age differently). Tells you when to discount, bundle, or stop
  restocking *before* a slow season, not after. With `purchase_date` already stored, this is
  nearly free.
- **Margin by type over time** — plant vs. animal vs. product vs. supply profit trend. Answers
  "what should we buy more of" instead of "what sold most" — those diverge exactly when a
  business starts growing.
- **Cost-center contribution trend** — Carito vs. Eileencita over time, framed as
  who-drives-what so effort can be aimed, not as a scoreboard.
- **Payment-method trend over time** — Reportes has a yearly snapshot; a trend line is the
  evidence for which payment rails matter before Phase 2 wires any of them into checkout.
- **Repeat-buyer view** — lights up automatically once the optional customer field (§3.1)
  accumulates data; becomes essential the day a shop starts buying weekly.

### 3.5 If you spend one weekend on this, spend it like this

1. **Saturday morning:** the timestamp field + edit control + optional customer field on the sale
   form (riding on the P2-3 changes). Tiny build, and it starts the clock on data you can never
   backfill. This is first *because* it's the only part where waiting has a permanent cost.
2. **Rest of the weekend:** the day-of-week profile and the calendar heatmap — they run on ALL
   your existing history the moment they're built, so the family sees real answers immediately
   ("which day can we rest" gets answered this weekend, not in three months).
3. The hour-of-day view ships whenever it's convenient afterward — it'll have nothing to show for
   the first couple of weeks anyway while the new field accumulates data. Notable days and the
   rest-day synthesis follow as the polish on top.

---

## 4. If I were in your kitchen right now

I'd tell you this over the good coffee, not the business coffee.

You asked me whether to get a store, and the honest answer is: **you already have one — it just
can't take orders yet.** So we're not buying a store, we're teaching yours to take orders, for
zero dollars a month, in the hours you already told me you have. Shopify isn't wrong — it's
*early*. The day your problem is "too many orders to pack," you'll pay the $39 with a smile and
your data will walk over there in an afternoon, because we built it to leave. That's the whole
trick: never build so it can't leave.

On the reports: your wife already knows the answers — 12 to 5, slow Fourth of July, good
Decembers. The reports aren't going to tell her something new at first; they're going to let her
**trust what she knows enough to act on it** — to close on the dead Tuesday without guilt, to
book the cabin for the week that never earned anything anyway. That's what the books are *for*.
A $500 month becomes a $2,000 month one boring, well-chosen decision at a time, and every one of
those decisions goes better when the calendar on the wall agrees with the feeling in your gut.

And check the floaters before you ship them. The fine costs more than the plant.

— *the old man, handing back the keys*
