# Project Upstream — Design System ("Ledger")

The product UI's visual system. Strategy and audience live in `PRODUCT.md`; the tokens
live in `frontend/app/globals.css`; the shared roles live in `frontend/lib/design.ts`.
If a value in this document and the code disagree, the code wins — fix this file.

---

## Visual theme

**Black, white, and state.** A white workspace framed by a near-black navigation rail,
ink typography, crisp solid hairlines, and one filled black action per surface. Colour
appears only where it states a fact about a record.

- Scene: an analyst at a desk monitor in a bright office, eight hours a day, alternating
  with Excel. Light theme, high contrast, dense.
- References, and what is borrowed: Linear (status glyphs, keyboard flow), Stripe
  (tables set like statements), Attio/Affinity (list + record + relationships), Ramp
  (black-and-white restraint with semantic colour).
- Anti-references: floating-card AI dashboards, hero metrics, gradients, glass, pill
  soup, and the previous all-grey Upstream where "late" and "replied" were both grey.

---

## Colour

All values are OKLCH. Neutrals carry a faint cool cast (hue 265, chroma < 0.01).

### Neutrals

| Token | Role |
|---|---|
| `--background` / `--card` / `--popover` | White. The workspace, panels and floating surfaces. |
| `--subtle` | Row hover, recessed wells. |
| `--muted` | Table headers, toolbars, segmented-control tracks. |
| `--accent` | Hover and selected fills on controls and rows. |
| `--border` | The one hairline for panels, rows and dividers (solid, not translucent). |
| `--border-strong` / `--input` | Control edges, hover edges, strong rules. |
| `--foreground` (`ink-900`) | Text, the primary action, anything that must be acted on. |
| `--muted-foreground` | Secondary text. 5.3:1 on white — never alpha-diluted. |
| `ink-100 … ink-700` | Magnitude fills (bars, charts) and skeletons. |

### State — the only colour in the product

Four families, each with a **solid** (dots, bars), an **ink** (text on white), a **soft**
ground and a **line**. Use them through `CHIP_TONE`, `LATE_TOKEN`, `DUE_TOKEN`,
`STATUS_META`, `TASK_STATUS_META`, or the `*-danger` / `*-success` utilities.

| Family | Means | Examples |
|---|---|---|
| **danger** (red) | Time already lost, failure, destruction | `12d late`, overdue tasks, bounced, delete |
| **warning** (amber) | Due soon, blocked, needs a decision | `Today`, `3d`, blocked task, archived banner |
| **success** (green) | An outcome that is good news | replied, interested, done, replies series |
| **info** (blue) | In flight | contacted, in progress, the focus ring |

Rules:

1. A raw palette class (`emerald-500`, `sky-100`…) is a regression.
2. Every coloured mark is paired with a shape or a word, so no state is carried by hue
   alone (WCAG 1.4.1).
3. Categories are not states: deal sides (Sell/Buy/Raise), segments, sources and people
   (avatars) are neutral.
4. Magnitudes are ink. A stage count or a reply-rate bar is a number, not a verdict.
5. Colour marks exceptions. A health bar that is mostly grey is a healthy bar.

### The navigation rail

`--sidebar-*` tokens: near-black ground, white active text, `--sidebar-muted` idle text
(≈8:1). It is the only dark surface — the frame, never the work.

---

## Typography

- **Instrument Sans** for everything: titles, labels, body, figures. Real tabular
  figures (`tnum`), so numbers align in the UI face — `MONO` in `lib/design.ts` is now
  `font-variant-numeric: tabular-nums`, not a monospace family.
- **IBM Plex Mono** only for genuinely code-like strings: keyboard hints, references.
- Product scale, fixed rem: `text-2xs` 11 · `text-xs` 12 · **`text-sm` 13 (the working
  size)** · `text-base` 15 · `text-lg` 18 · `text-xl` 20 (page title) · `text-2xl` 24
  (record title).
- Labels are **sentence case**, 12px medium, muted (`LABEL`). No tracked all-caps
  eyebrows; the only uppercase is data tokens such as `SELL`.
- No italics as a UI voice. "Not started yet" is the dashed glyph, not italic type.

---

## Shape, depth, motion

- Radius: controls 6px (`rounded-md`), panels and menus 8px (`rounded-lg`), dialogs
  10px, chips 4px. Pills are not used for tags or filters.
- Depth: panels are flat (a ring, no shadow). Only floating things cast a shadow —
  menus, popovers, dialogs, the bulk-action bar, toasts (`--shadow-md` / `--shadow-lg`).
- Focus: a visible 2px ring in `--ring` (blue) with offset on every control; the rail
  uses `--sidebar-ring`.
- Motion: 150–220ms, ease-out. Motion conveys state (open, close, row cleared, bar
  rising); no page choreography, no staggered row entrances, no scroll reveals.
  `prefers-reduced-motion` is honoured globally.

---

## Components

| Pattern | Definition |
|---|---|
| Button | `components/ui/button.tsx`. `default` = the page's one primary (ink). `outline` = secondary. `ghost` = toolbars and rows. `destructive` = solid red, confirm-only. |
| Chip | `CHIP` + `CHIP_TONE` — square 4px tags for facts. |
| Status glyph | `.hb` in globals.css: fill = how far, colour = what kind. `hb-dashed` = not started. |
| Late / due | `LATE_TOKEN` (red) and `DUE_TOKEN` (amber). |
| Segmented control | `SEG_GROUP` / `SEG_ITEM_ON` — recessed track, raised white segment. |
| Panel | `PANEL` (+ `PANEL_HEAD`) — white, one ring, 8px. Never nest panels. |
| Metric strip | Figures share hairlines in one ruled strip (`MetricRail`, `BookTape`, `DeskBriefing`) — never a grid of floating stat cards. |
| Table | Header on `--muted`, 12px labels, 13px rows, hairline rules, `hover:bg-subtle`, selected `bg-accent`. Numbers right-aligned and tabular. |
| Page header | `components/layout/page-header.tsx` — breadcrumb, title, one-sentence description, actions (primary last), optional tabs row. |
| Empty state | `EmptyState` — what this holds, why it is empty, the one action that fills it. |

---

## Layout

### Shell

- **Navigation rail** (`components/layout/sidebar.tsx`): firm and brand, Search (⌘/Ctrl
  K), the nav groups (Home · Deals · Outreach · Insights · Workspace), the recent-project
  list with a red dot for anything late, and the account menu with the role on screen.
  Collapses to an icon rail (`[`), remembered per browser. `g` then a letter jumps to a
  section (`g h` Home, `g p` Projects, `g s` Schedule …).
- **Below `md`** the rail becomes a drawer behind a 48px top bar (menu, home, search).
- **The page** (`app/(app)/template.tsx`) owns scroll, padding and the 1680px measure.

### The working register

The register (`/projects/[id]/workspace`) is the centrepiece: a dense, virtualized list
of companies, never a card grid. Four properties are non-negotiable:

1. **Column alignment.** One shared `grid-template-columns` (`GRID_COLS` in
   `components/project/workspace/grid.tsx`) for the header and every row.
2. **Row density.** 20+ companies on one screen; Comfortable 44px / Compact 32px.
3. **Sticky headers.** Column labels and the engagement you are inside stay put.
4. **A count you can scroll to.** A group header that says 47 is followed by 47 rows,
   which is why the register is virtualized and therefore a CSS grid with real
   `role="grid"` / `row` / `gridcell` semantics and `aria-activedescendant`.

Columns respond to **container** width, not the viewport: the peek panel takes ~26rem
from the register without the window moving.

### Cadence cells

Next-due and days-remaining are server-computed (IST, `today_ist()`); the UI only
chooses how loud to say them: red `12d late`, amber `Today`/`3d`, grey date, dashed
`Intro pending`, grey `Cold`.

### Duplicate nudges

A possible cross-mandate duplicate shows as an amber banner on the company dossier, with
the match type and confidence as a chip, and the text "Advisory only — these matches
may or may not be the same entity."

---

## States

Every list and data surface has loading (skeletons shaped like the content, `ink-100`),
empty (teaches the next step), error (red glyph, plain sentence, retry) and no-results
(names the filter that is hiding everything, with a way to clear it).

## Dialogs and confirmation

All dialogs use `components/ui/dialog.tsx` (flat scrim, no blur). Destructive actions go
through `useConfirm()` — never `window.confirm` — and irreversible ones are archive-first
and name-confirmed.

## Keyboard

- ⌘/Ctrl K — command palette (jump to anything, quick actions).
- `g` + letter — go to a section; `[` — fold the rail.
- Registers: ↑/↓ or j/k to move, Enter to open, `/` to search, `N` new project.
