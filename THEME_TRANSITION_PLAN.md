# Upstream — UI Theme Transition Plan

**Codename:** "Floating Light SaaS" (amber edition)
**Author:** design/eng
**Status:** proposal — awaiting sign-off on §7 decisions
**Source of truth:** the 4 reference clips in `theme fixer/` (`ref1/2/3.mp4`, `red3.mp4`), reviewed frame-by-frame.

---

## 0. Purpose & non-negotiables

Re-skin the **entire** Upstream CRM to match the look of the reference videos — a light, floating, rounded SaaS interface — **without changing a single feature, route, or business rule**, and **keeping our amber palette** (not the reference's teal).

**Hard constraints (do not break):**
1. **Zero feature/logic change.** This is presentational only. Every page, endpoint, hook, and the cadence/append-only/visibility rules stay exactly as they are.
2. **Amber stays primary.** The reference's *warm secondary* (Orange `#FFB01B`, Yellow `#FFDE68`, "Orange wave" gradient) already matches our brand — we keep amber as the accent and only borrow the reference's *structure*, not its teal.
3. **Both themes survive.** We make **light the hero** (that's the reference look) but keep a dark variant working.
4. **Our new logo (the amber "U") stays** — it drops perfectly onto the light rail/topbar.
5. **Token-driven, not page-by-page rewrites.** Ship via design tokens + app shell + shared components so feature pages inherit the look for free.

---

## 1. Design inputs harvested from the videos

Everything below was read directly off the reference frames.

### 1.1 Reference color tokens (exact, from the ref1 palette panel)

| Name | Hex | Role in reference |
|---|---|---|
| Orange | `#FFB01B` | warm accent / chart |
| Yellow | `#FFDE68` | warm accent / chart / bars |
| Gray | `#F4F4F4` | **canvas** behind the floating window |
| White | `#FFFFFF` | window + cards |
| Teal | `#00BEAA` | **primary** (buttons, active nav, links) |
| Dark Teal | `#007F78` | primary-hover / gradients |
| Dark Forest | `#203233` | **icon rail** background, ink |
| Black | `#000000` | tooltips, deepest ink |
| *Gradient* "Orange wave" | orange→yellow | decorative banners / glow |
| *Gradient* "Summer breeze" | green→yellow→orange | decorative banners |
| *Gradient* "Teal shades" | teal→dark-teal | decorative banners |

### 1.2 Layout & shell (seen in every ref1/2/3 frame)
- The whole app is a **floating rounded window** (corner radius ≈ 16–20px) sitting on a **soft gray canvas** (`#F4F4F4`).
- A soft, wide **gradient glow** hugs the window's outer edge (green→yellow in theirs; **amber** for us).
- Inside: a narrow **icon rail** (dark forest, ~56px) on the left, a **white top bar** across the top, then the content area.
- Content is white with generous padding; everything is on **rounded white cards** with hairline borders + soft shadows.

### 1.3 Navigation
- **Icon rail:** icon-only, ~56px, dark background, active item = a filled rounded square (teal→**amber**). Logo (U-wave mark) pinned at top.
- **Top bar:** logo + a combined **"All ▾ | Search"** pill (scope dropdown + search) + filter icon; right side = **notification bell** + **avatar with name + role + chevron**.

### 1.4 Component system inventory (mostly from `red3.mp4`)
- **Buttons:** primary solid (teal→amber, rounded), secondary light-gray, a split **"Create ▾"** dropdown button, icon buttons, and a **segmented icon-button row** (active = filled square).
- **Status pills** (soft-tint + dot/icon): `New`, `Active`, `Paused`, `Completed`, `Due Soon`, `Overdue`, `Cancelled`.
- **Segmented tabs** ("Project operations event / Verification events") and **segmented toggles** ("Emission / Offsets").
- **Search + filters:** search field, filter icon, removable **filter chips** ("Categories 3 items ×"), "Reset filters", "Save search".
- **Stat trio:** big tabular numbers with small labels (`3 This week · 13 This month · 8 Overdue`).
- **List rows:** a **colored left accent bar** (amber = pending, blue = selected) + title + subtitle + **date chip** (e.g. `THU 22`) or date range on the right.
- **Activity feed:** avatar + colored event badge + text + timestamp.
- **Detail page:** hero **cover image**, breadcrumb, **metadata chips** (status dropdown, type, ID, registry, methodology, location), horizontal **tab bar** (Activity / Inventory / Events / Documents / Photos / Reports / Overview), stacked **side cards** ("Photos 123 files", "Documents 123 files"), **tables** (Crediting periods), **file rows** with download.
- **Pricing sidebar** (marketplace): price, refreshed date, dropdown, quantity stepper, stock, primary action, secondary actions, tinted callout cards.
- **Map** with region fill + pins + a black tooltip card.

### 1.5 Data-viz
- **Donut** (Project Summary) with a color-coded legend.
- **Soft bar chart** (Emissions) — amber/yellow bars + muted gray "future" bars, rounded tops.
- **Thin line charts** (Scope 1/2/3 in blue/pink/purple; price history) — small, low-ink, with a big number + "% of Total".
- All charts are **low-saturation, rounded, generous whitespace**.

### 1.6 Motion & polish
- The clips are smooth product-showcase pans/zooms — the aesthetic reads **calm and premium**: soft shadows, rounded everything, restrained color, lots of air.
- Decorative **gradient banner cards** (sunset/mountain/wave wallpapers) are used sparingly as section headers.

### 1.7 Screens observed (proves breadth)
Dashboard (donut + stat tiles + emissions bars + location list + upcoming events), Project detail (cover + tabs + metadata + description + crediting-periods table + side cards), Location/map view, Marketplace list (filter rail + map + featured), Marketplace product detail (carousel + pricing sidebar + description + price history + transactions + SDG goals + project info + certification + validation docs), Activity feed, and full **mobile** treatments (phone frames).

---

## 2. Palette mapping (reference → Upstream amber)

We keep our tokens; we only **re-point** them to the reference's structure. Because the reference's warm colors already equal our amber, the mapping is clean.

| Reference token | Upstream token (new/updated) | Value (light hero) | Notes |
|---|---|---|---|
| Teal `#00BEAA` (primary) | `--primary` | `oklch(0.66 0.15 56)` (existing amber) | **keep amber** — do not adopt teal |
| Dark Teal `#007F78` | `--primary-hover` (new) | `oklch(0.60 0.15 54)` | button hover / gradient stop |
| Gray `#F4F4F4` (canvas) | `--canvas` (new) | `oklch(0.95 0.005 75)` | the "desk" behind the window |
| White `#FFFFFF` (window/cards) | `--card`, `--background` | `oklch(0.995 0.002 85)` | near-white window + cards |
| Dark Forest `#203233` (rail) | `--rail`, `--rail-foreground` (new) | `oklch(0.22 0.012 60)` warm charcoal | icon rail; warm, not teal |
| Orange `#FFB01B` | `--warning` / `--chart-1` | `oklch(0.72 0.16 58)` | already our amber family |
| Yellow `#FFDE68` | `--chart-2-warm` (new) | `oklch(0.86 0.11 90)` | soft bar/secondary chart |
| "Orange wave" gradient | `--glow-amber` (new) | radial amber, low alpha | the window edge glow (we already glow amber) |
| Black `#000000` | `--tooltip` | existing foreground | tooltips |

**Dark variant:** keep the existing "Obsidian Amber" values; just add the new structural tokens (`--canvas`, `--rail`, radius/shadow scale) with dark equivalents so the floating-window shell works in dark too.

---

## 3. The Upstream design language (target spec)

Concrete numbers so execution is unambiguous.

**Surfaces (light hero)**
- `--canvas` soft warm gray — the body background behind the app window.
- `--window`/`--card` near-white — the floating window + all cards.
- `--rail` warm charcoal — the icon rail.
- Elevation: `canvas < window < card < popover`.

**Radius scale** (bump up — reference is rounder than us today)
- `--radius: 0.75rem` (was 0.5). Derived: card 12px, control 8–10px, pill 999px, **window 20px**, tile 14px.

**Shadow scale** (new tokens)
- `--shadow-card: 0 1px 2px rgb(0 0 0/.04), 0 1px 1px rgb(0 0 0/.03)`
- `--shadow-pop: 0 8px 24px rgb(0 0 0/.10)`
- `--shadow-window: 0 24px 60px rgb(0 0 0/.14)` + a hairline ring
- `--glow-amber:` wide radial `oklch(0.72 0.16 58 / .10)` bleeding off the window edge.

**Spacing / density**
- Base gap 16–20px between cards; card padding 20–24px; the reference is **airier** than today — increase page paddings one step.

**Typography (decision in §7)**
- **Recommended:** keep **Cormorant** serif for big page titles (our signature — it beats the generic-SaaS sans), use **Outfit** for all UI/body (matches the reference's clean sans). Numbers stay tabular.
- Alt: go full-sans (Outfit everywhere) to match the reference exactly.

**Iconography:** lucide (already in use), 1.5–2px stroke, 16–18px in rows, 20px in the rail.

---

## 4. Where it lands in the codebase (impact map)

| Layer | Files | Change |
|---|---|---|
| **Tokens** | `frontend/app/globals.css` | add `--canvas`, `--rail(+fg)`, `--primary-hover`, shadow scale, glow, bump `--radius`; add light-hero + dark values |
| **App shell** | `frontend/app/(app)/layout.tsx`, `template.tsx` | wrap content in the **floating window** on `--canvas` + glow; compose rail + topbar |
| **Rail** | `frontend/components/layout/sidebar.tsx`, `nav.ts` | convert labeled sidebar → **icon rail** (tooltips), keep section grouping as dividers; keep `visibleNavSections` logic |
| **Top bar** | `frontend/components/layout/topbar.tsx` | logo + "All ▾ Search" pill + bell + avatar (mostly there already) |
| **Brand** | `frontend/components/brand/logo.tsx` | reuse as-is (amber U) |
| **Primitives** | `frontend/components/ui/{button,card,badge,input,tabs,table,dropdown-menu,dialog,label}.tsx` | restyle to new radius/shadow/tint; **no API changes** |
| **Shared features** | `frontend/components/features/{status-badge,stat-card,data-table,empty-state,page-header,candidate-card,sourcing-kanban}.tsx` | map to the reference patterns (status pills already match!) |
| **Pages (polish only)** | dashboard, sourcing(+import/analytics), projects(+[id]/grid), companies, master, contacts, schedule, analytics(+projects), settings, login | inherit tokens/components; light per-page spacing/hero pass |
| **Charts** | recharts usages (dashboard, analytics, sourcing analytics) | theme to muted amber/soft palette + rounded bars/thin lines |

**Good news from our codebase:** we already have `status-badge.tsx` (a status + cadence pill system that maps 1:1 to the reference pills), `stat-card.tsx` (the stat tiles), `data-table.tsx`, `empty-state.tsx`, a CSS-var token system, and a warm-paper light theme + amber accent. ~70% of the "design system" the video shows already exists — we're **re-shaping and re-shelling**, not building from zero.

---

## 5. Phased execution plan

Each phase is independently shippable and ends with a screenshot check. Do it on a branch behind nothing riskier than a branch (see §7 rollback).

### Phase 0 — Foundations (tokens & primitives) — *no visible layout change yet*
- [ ] Add new tokens to `globals.css`: `--canvas`, `--rail`, `--rail-foreground`, `--primary-hover`, `--shadow-card/-pop/-window`, `--glow-amber`; bump `--radius` to `0.75rem`; wire into `@theme inline`.
- [ ] Add the same tokens to the dark block (Obsidian) so both themes have a canvas/rail.
- [ ] Update `ui/card.tsx`, `ui/button.tsx`, `ui/badge.tsx`, `ui/input.tsx` to consume the new radius/shadow/hover tokens.
- **Accept:** app still looks ~normal but rounder/softer; `npm run build` + vitest green; no visual regressions on existing pages.

### Phase 1 — The shell (the signature move)
- [ ] `layout.tsx`: body → `bg-[--canvas]`; render the app inside a **floating rounded window** (`rounded-[20px]`, `--shadow-window`, hairline ring) with the amber `--glow-amber` bleeding off its edges; max-width + centered on large screens.
- [ ] `sidebar.tsx` → **icon rail** (56px, `--rail` bg, icon-only, active = amber filled square, tooltips on hover); keep `visibleNavSections` role logic and section order (render group breaks as subtle dividers).
- [ ] `topbar.tsx`: logo + **"All ▾ | Search"** combined pill + bell + avatar; sits inside the window's top.
- [ ] Mobile: rail collapses to the existing drawer; window goes full-bleed under a breakpoint.
- **Accept:** every page now renders inside the floating window with the icon rail; nav still works for analyst + partner; screenshot vs `ref2` frame.

### Phase 2 — Core component pass
- [ ] `status-badge.tsx`: align tints/shape to the reference pill kit (New/Active/Paused/Completed/Due Soon/Overdue/Cancelled → our Status + Cadence sets); dot + optional icon.
- [ ] `stat-card.tsx`: big tabular number + small label + tiny delta; soft card.
- [ ] `data-table.tsx` + `ui/table.tsx`: hairline rows, generous cells, left-accent option for list rows, date-chip cell.
- [ ] `page-header.tsx`: title (serif) + description + actions; optional hero-cover slot for detail pages.
- [ ] `ui/tabs` + a **segmented control** component for the reference's tab/toggle pattern.
- [ ] `empty-state.tsx`, `button` "Create ▾" split variant, filter-chip component ("x" removable), search-with-scope input.
- **Accept:** a components storybook page (or the sourcing + grid pages) shows the full kit matching `red3`.

### Phase 3 — Page polish (inherit + tune)
Order by visibility:
- [ ] **Dashboard** — stat tiles, donut/"today's focus" list with left accents + date chips, outreach-trend chart (matches the reference dashboard most directly).
- [ ] **Sourcing** (workspace + funnel + import + analytics) — our recent redesign already fits; re-tint to the new tokens.
- [ ] **Projects + [id] + grid** — cover/hero header on project detail; the grid's band/category bars adopt the new card/accent language.
- [ ] **Master, Contacts, Schedule, Analytics(+projects), Settings** — spacing/hero/token pass.
- [ ] **Login** — floating card already close; put it on the canvas with the amber glow + our U mark.
- **Accept:** each page screenshotted light + dark; no functional diff (spot-check add/log/push/score flows).

### Phase 4 — Charts, motion, responsive
- [ ] Theme recharts: muted amber/soft palette, rounded bars, thin lines, low grid ink, tabular tooltips.
- [ ] Motion: keep our existing entrance animations; add soft card hover-lift; respect `prefers-reduced-motion` (already handled in globals).
- [ ] Responsive sweep down to mobile (rail→drawer, window→full-bleed, tables→scroll/stack).
- **Accept:** charts read like the reference; mobile frames match `ref1`'s phone mocks; Lighthouse/RTL a11y unaffected.

### Phase 5 — QA & cutover
- [ ] Full `npm run build`, `tsc`, vitest, and the e2e critical paths.
- [ ] Visual QA both themes, both roles; keyboard focus visible; contrast AA on amber-on-white.
- [ ] Update `PROGRESS.md`; flip light to default theme.
- **Accept:** the §8 checklist passes.

---

## 6. Component-by-component crosswalk (reference → ours)

| Reference element | Our component | Action |
|---|---|---|
| Floating window + glow | `layout.tsx` | new |
| Icon rail | `sidebar.tsx` | reshape (keep logic) |
| Top search "All ▾" | `topbar.tsx` + new search | build search-with-scope |
| Status pills | `features/status-badge.tsx` | re-tint (already exists) |
| Stat trio | `features/stat-card.tsx` | restyle |
| List row + date chip | `data-table.tsx` / dashboard list | add left-accent + chip |
| Segmented tabs/toggle | `ui/tabs.tsx` + new segmented | build segmented |
| Filter chips | new `ui/filter-chip.tsx` | build |
| Create ▾ | `ui/button.tsx` split variant | add |
| Donut / bars / lines | recharts wrappers | theme |
| Detail hero + tabs + side cards | `projects/[id]`, `companies/[id]` | apply pattern |
| Pricing/side panel | reuse card patterns | n/a (no marketplace) |

*(We have no marketplace/map/carbon features — those reference screens are style references only, not features to add.)*

---

## 7. Decisions to confirm (blockers before Phase 1)

1. **Light-hero, dark kept?** → recommend **yes** (light is the reference look; keep dark working).
2. **Icon rail vs. labeled sidebar?** → recommend **icon rail + hover tooltips**, section grouping preserved as dividers. (Alt: keep short labels for lower learning curve.)
3. **Serif page titles or full-sans?** → recommend **keep Cormorant serif titles** (our signature) + Outfit UI. (Alt: full-sans to mirror the reference exactly.)
4. **Floating window shell?** → recommend **yes** (the signature); costs a little vertical space.
5. **Rail color:** warm charcoal (recommended) vs. deep amber vs. keep obsidian.

---

## 8. Risks, rollback, effort

**Risks & mitigations**
- *Contrast:* amber-on-white for small text can fail AA → use amber only for fills/accents, keep ink text; audit in Phase 5.
- *Vertical space:* the floating window eats height → cap glow/padding on short viewports; full-bleed under a breakpoint.
- *Scope creep:* "make it match" can spiral → tokens + shared components first; pages only get a spacing/hero pass, never logic edits.
- *Dark theme parity:* the look is light-native → treat dark as "supported," not pixel-matched to the video.

**Rollback:** all work on a `feat/theme-revamp` branch; tokens are additive; the shell change is one layout file. Revert = merge nothing / checkout main. Optionally gate the shell behind a `NEXT_PUBLIC_NEW_SHELL` flag during rollout.

**Effort (rough):** Phase 0–1 ≈ the bulk of the "wow"; 2 ≈ the component grind; 3 ≈ broad but shallow; 4–5 ≈ polish + QA. Because it's token/shell-driven, the long tail of pages is cheap.

---

## 9. Acceptance checklist

- [ ] App renders as a floating rounded window on a soft canvas with an amber edge glow (light).
- [ ] Icon rail with working role-based nav (analyst + partner) and tooltips.
- [ ] Top bar: logo + scoped search + bell + avatar.
- [ ] Cards/buttons/badges/inputs/tables use the new radius/shadow/tint; amber primary throughout.
- [ ] Status pills match the reference kit; stat tiles + list rows + date chips present.
- [ ] Charts themed (muted amber, rounded bars, thin lines).
- [ ] Dark theme still functional.
- [ ] **No feature/route/logic changed;** build + tsc + vitest + e2e green.
- [ ] Screenshots of Dashboard, Sourcing, Grid, Project detail, Login side-by-side with the reference frames.

---

## 10. Recommended first step (POC, not big-bang)

Build a **single-page proof of concept** — the **Dashboard** — through Phases 0→1→(dashboard slice of 2–3), so you can put it next to the videos and lock §7 before we touch the other 19 pages. One page of effort de-risks the whole cutover.

> Reference frames for QA live in `theme fixer/`; extracted contact sheets were used to compile §1.
