# Project Upstream — Design Rationale

## Philosophy

This is a financial deal-sourcing tool, not a consumer app. The decisions below
reflect what that context demands: high information density, operational calm,
keyboard-driven navigation, and a visual language that signals competence and
trustworthiness to the bankers using it every day.

The primary inspiration set: **Bloomberg Terminal** (density + monochrome authority),
**Affinity CRM** (relationship-aware layout), **Linear** (keyboard-first, no clutter),
**Stripe Dashboard** (restrained colour use, surgical typography).

---

## Aesthetic direction

**Dense, calm, trustworthy.** Analysts spend eight or more hours inside this tool on
deal days. The UI must never feel playful or promotional. Rounded corners are used
sparingly; borders are 1px/neutral; whitespace is generous within components but
tight between them.

### Colour

- **Neutral background.** `--background` and `--muted` cover 95% of all surfaces.
  No coloured sidebars or hero sections.
- **Single accent.** Only `--primary` (shadcn/ui's default neutral-900 in light mode,
  neutral-50 in dark) is used for interactive affordances. No multi-colour dashboard
  celebrations.
- **Semantic status colours** (§7.3 authoritative map, replicated here):
  | State              | Colour intent    | Tailwind example              |
  |-------------------|-----------------|-------------------------------|
  | Responded          | Green            | `bg-emerald-100 text-emerald-700` |
  | Interested         | Blue             | `bg-blue-100 text-blue-700`   |
  | Declined           | Amber            | `bg-amber-100 text-amber-700` |
  | Bounced            | Red              | `bg-red-100 text-red-700`     |
  | Contacted          | Slate            | `bg-slate-100 text-slate-600` |
  | Not contacted      | Grey             | `bg-zinc-100 text-zinc-500`   |
  | Overdue (cadence)  | Red pill         | `bg-red-100 text-red-600`     |
  | Due soon (≤7d)     | Amber pill       | `bg-amber-100 text-amber-700` |
  | Needs initial      | Violet pill      | `bg-violet-100 text-violet-700` |
  | Cold (exhausted)   | Blue pill        | `bg-blue-100 text-blue-600`   |

### Typography

- **Tailwind defaults** — `font-sans` (system stack). No custom webfonts; they add
  loading jitter on slow connections inside secure banking networks.
- `text-xs` (12px) is standard for dense table cells. `text-sm` (14px) for body copy.
  `text-base` and above only for page-level headers.
- `tabular-nums` everywhere numbers appear. Figures must never jump as data refreshes.
- `font-medium` weight for values; `text-muted-foreground` for labels. This visual
  split — lighter labels, heavier values — lets the analyst scan numbers without
  reading every label.

---

## Layout

### Shell

- **Persistent left sidebar** — always visible on desktop; collapses to icon-only at
  `md` breakpoint. This mirrors the Bloomberg/Affinity pattern: navigation is never
  more than one click away, and the current location is always clear.
- **Top bar** — firm name + user menu + role badge. The role badge (PARTNER / ANALYST)
  is always visible because role affects which numbers the user trusts.
- **Content area** — full height, individually scrollable. The grid page uses a flex
  column so the sticky table header stays in place while rows scroll.

### Responsive / mobile degradation

The app is designed desktop-first; M&A analysts don't close deals on phones. However
the UI does not break on small screens — tables degrade to scrollable horizontal
overflow, stat strips wrap, and dialogs are `sm:max-w-md` with `w-full` fallback.
The grid page header and summary strip use `flex-wrap` so they reflow at narrow widths
rather than overflowing.

---

## Information density

### Working grid

The grid (`/projects/[id]/grid`) is the centrepiece. It is a dense HTML `<table>`,
not a card grid or flexbox layout. The choice of `<table>` is deliberate:

1. **Column alignment.** Numbers in the same column align vertically across all rows.
   Cards cannot achieve this. Analysts compare figures across rows — the table layout
   makes that effortless.
2. **Keyboard navigation.** Native table keyboard semantics (Tab, arrow keys) work
   without any JavaScript.
3. **Row density.** The grid fits 20+ companies on one screen. Cards would require
   4× as much vertical space.
4. **Sticky column headers.** `sticky top-0 z-10` keeps column labels visible while
   scrolling through hundreds of rows — a requirement for any serious data tool.

Category sections (`STRATEGIC`, `PRIVATE_EQUITY`, etc.) are collapsible `<tbody>`
groups. This mirrors the Excel pattern analysts already know (grouped rows with
hide/show), making migration from spreadsheets lower-friction.

### Cadence columns

- **Next due** and **Days remaining** are server-computed (IST, `today_ist()`). The
  "↻" icon next to "Days" labels the column as a computed value, signalling to the
  analyst that the number is live. This is important for trust: analysts must know
  whether they're looking at a live computation or a stale cache.
- **Cadence badge** + tooltip explains WHY a company is overdue, cold, or awaiting
  outreach. A tooltip on hover provides the reasoning without cluttering the row.
- **Cold companies** show a snowflake icon (❄) alongside the badge. The icon is
  language-agnostic and immediately recognisable as "frozen / stalled".

### Fuzzy duplicate nudges

Cross-mandate duplicate warnings are surfaced in two places:
1. **Company detail** — a `DuplicateBanner` with the matching company name, its
   mandate, current status, and a confidence pill (`exact name`, `same domain`, or
   `similar name · 87%`). The confidence label tells the analyst how certain the
   match is, so they can triage without clicking through.
2. **Working grid** — a dismissible `DupNudgeBanner` appears immediately below the
   category section after an inline-add that returns warnings. The nudge is inline
   (not a floating toast) so it persists until the analyst consciously dismisses it.

Advisory framing: both nudge components include the text "Advisory only — these
matches may or may not be the same entity." This is honest about the limits of
fuzzy matching and protects analyst trust in the system.

---

## Component conventions

### States (§7.3 rule)

Every list and data surface has three states, all implemented:

| State   | Treatment                                                       |
|---------|----------------------------------------------------------------|
| Loading | `animate-pulse` skeleton blocks that mirror the shape of content |
| Empty   | Centred text with a CTA (e.g., "Add company to get started")   |
| Error   | Muted text with a retry action; 403 shown as "access denied"   |

Skeleton blocks mirror the shape of real content so loading feels fast and predictable
rather than blank-screen jarring.

### Optimistic updates

TanStack Query `onMutate` / `onSettled` callbacks provide optimistic updates on the
most latency-sensitive mutations:
- **Log outreach event** — the grid's company data is immediately invalidated so the
  cadence badge updates without a manual refresh.
- **Create company (inline add)** — the query cache for the mandate's company list is
  invalidated immediately after the API call settles (success or error).

Mutation state (`isPending`) disables submit buttons to prevent double-submits.

### Dialog patterns

- All dialogs use shadcn/ui `<Dialog>`. No `alert()` or `confirm()` — they block the
  tab and break keyboard navigation.
- Confirmation on destructive actions (`confirm(...)` is used only as a stopgap in the
  current implementation; production should migrate to a `<Dialog>` confirmation).
- Forms use React Hook Form + Zod for client-side validation before sending. Backend
  validation errors are surfaced via `toast.error`.

---

## Keyboard-first

The grid is the analyst's primary interaction surface. It supports:
- **Tab** to move between "Log" action buttons
- **Enter** to submit the inline-add form
- **Escape** to cancel the inline form
- Collapse/expand section headers are focusable `<button>` elements

No action requires a mouse beyond the initial click to open a dialog.

---

## Colour theme

Both light and dark modes are handled via shadcn/ui's CSS variable system. The design
defaults to light mode (standard for financial tooling in boardroom presentations) but
dark mode works identically — all colours use the `dark:` variant.

---

## Token reference (plan.md §7.3 excerpt)

> Aesthetic: restrained, data-dense financial SaaS. Generous whitespace, one accent
> colour, neutral greys, crisp 1px borders.
>
> States: every list has a loading skeleton, an empty state with a CTA, and an error
> state.
>
> Layout: persistent left sidebar; top bar with firm name + user menu + role badge.
>
> Responsive: desktop-first (analyst tool); tables degrade to cards on narrow screens.

These are met in the implementation. Where a decision in the codebase diverges from
a generic default, the rationale above explains why.
