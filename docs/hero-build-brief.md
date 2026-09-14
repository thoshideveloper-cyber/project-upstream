# Build brief — the cold open

Replace the full-bleed hero with a two-column split: copy on clean canvas at
left, the film in a contained plate at right, uncovered. Mock at `/mock`
(temporary — delete the route as part of this work). The footage this is built
around is specified in `hero-reimagined.md`; the diagnosis of the current take
and the encode recipe are in `hero-film-brief.md`.

**The one-line reason:** the type needs 4.5:1 over the picture, the veil that
buys it is what kills the picture, and moving the type off the film ends the
argument. Nothing else in the hero is broken.

---

## Keep exactly as they are — do not re-derive

- `content/site.ts`: `BANDS` (four bands, their ranges, their `entrance`
  values), `STATIC_HERO`, `HERO_CTA`, `QUEUE`, `CTA_HREF`, `ASSET_PREFIX`.
- `components/site/split.tsx` — `SplitHead` and its four entrances.
- `components/site/queue.tsx` — the queue card, rows and caption.
- The blob fetch, the one-seek-in-flight gate, the `CUE` table and the `FRAME`
  constant in `hero.tsx`. Scroll drives the playhead; that machinery is correct
  and measured. `FRAME` must stay in step with the encode's frame rate (16fps →
  `1 / 16`).
- The five static-hero gates as a *mechanism*: live `matchMedia` change
  listeners, `saveData` respected, query strings repeated character for
  character between `GATES` in `hero.tsx` and `globals.css`. One query string
  changes value — see below.
- `prefetch={false}` on every internal `<Link>`. Next 16's static export writes
  `__next.route/__PAGE__.txt` and the router asks for `__next.route.__PAGE__.txt`.

## Layout

At ≥900px, one pinned stage, two columns, no gap:

    ┌──────────────────────────────┬─────────────────────────────┐
    │  Y Upstream       nav …      │  ← nav crosses both         │
    │                              │▓▓▓▓  ▓▓▓▓  ▓▓▓▓  ▓▓▓▓       │
    │  DEAL FLOW, KEPT             │ ▓▓    ▓▓    ▓▓    ▓▓        │
    │                              │ ▓▓    ▓▓    ▓▓    ▓▓        │
    │  Two analysts. One           │  ▓▓▓  ▓▓▓  ▓▓▓  ▓▓▓         │
    │  CFO. Same Tuesday.          │   ▓▓▓▓▓▓    ▓▓▓▓▓▓          │
    │                              │    ▓▓▓▓▓▓▓▓▓▓▓▓▓▓           │
    │  Nobody did anything wrong.  │     ▓▓▓▓▓▓▓▓▓▓▓▓            │
    │  The client still remembers. │     ▓▓▓▓▓▓▓▓▓▓▓▓            │
    │                              │              ┌───────────┐  │
    │  ──  ──  ··  ··   01 / 04    │              │ Outreach  │  │
    └──────────────────────────────┴──────────────┴───────────┴──┘
       46%, --canvas, full ink        54%, film at full contrast

- **Left column, 46%.** Background `--canvas`. Horizontal padding
  `clamp(2rem, 5vw, 5.5rem)`. Content vertically centred; the descent marker
  absolutely positioned at the foot.
- **Right column, 54%.** `border-left: 1px solid var(--hair)` — the page rules
  everything with hairlines and this edge should be one of them. The film fills
  it with `object-fit: cover`.
- **Below 900px** the static hero takes over. Change gate one from
  `(max-width: 720px)` to `(max-width: 900px)` in **both** `GATES` and
  `globals.css`. This is deliberate: a 46/54 split below 900px leaves a copy
  column under 420px, and a third layout branch is not worth building and
  testing when the composed still already reads well. Widening the gate is the
  cheaper correct answer.

## The film plate

- No mist ramp. Delete the horizontal gradient in `film.tsx` entirely — it
  exists only to hold type over the picture, and no type sits there now.
- Keep **one** short fade, at the top only: `height: 5rem`, `linear-gradient(to
  bottom, color-mix(in oklab, var(--canvas) 85%, transparent), transparent)`, so
  the plate meets the nav without a seam. No bottom fade — it eats picture for
  nothing.
- Poster underneath, same transform as the video, so the still and the film
  never disagree about where the frame is while the fetch is in flight.
- `objectPosition: "50% 50%"`. The old `62%` existed to push structure away from
  the reading lane. There is no reading lane on the film now.
- Keep a reduced drift so the plate never reads as a static image between
  seeks: `scale(1.04 - 0.02p) translate3d(0, -0.8 + 1.6p %, 0)`, down from the
  current `1.06 - 0.03p` / `-1.2 + 2.4p`.
- The `<video>` stays client-only, `muted playsInline preload="none" aria-hidden
  tabIndex={-1}`, src assigned only after the gates pass.

## The copy column

Type, as measured against the mock — this is a narrower measure than the
full-bleed hero, so the display face steps down:

| role | spec |
|---|---|
| eyebrow (band 1 only) | `--font-data`, 0.68rem, uppercase, `tracking 0.18em`, `--fg-muted` |
| head | `--font-display`, `clamp(2.1rem, 3.5vw, 3.15rem)`, 600, `leading 1.06`, `tracking -0.022em`, `--fg` |
| sub | `--font-body`, 1.02rem, `leading 1.55`, `max-width 34ch`, `--fg-muted` |
| CTA (band 4 only) | existing `CTAPrimary` / `CTAGhost` |

The four bands cross-fade in place, driven by `p`, exactly as they do now.
`SplitHead` keeps each band's `entrance`. Because the type sits on canvas rather
than over water, it runs at full ink — roughly 15:1 rather than the 5.5:1 the
veil was buying. Do not reintroduce a scrim to "help" it.

## The descent marker

New, and the only new element. Four hairline rules, `1px × 2.25rem`, gap
`0.625rem`, anchored bottom-left of the copy column. Rules at or before the
current band are `--accent`; the rest are `--hair`. Followed by
`01 / 04` in `--font-data`, 0.64rem, `tracking 0.14em`, `--fg-muted`.

It counts the same four beats the film counts — the channels closing and the
rules filling are the same fact twice. That is why it earns its place; do not
add a second progress affordance anywhere in the hero.

## The payoff

`<Queue />` resolves in over the **lower right of the plate** on band 4 only,
inset `clamp(1.5rem, 3vw, 3rem)` from the right and `clamp(2rem, 7vh, 4.5rem)`
from the bottom, width `clamp(19rem, 26vw, 23rem)`. It sits on `--surface` with
a hairline border, so it reads as a real surface lifted off the water.

The film's fourth beat clears the bottom of frame first (the merge propagates
upward), which is what makes room for it.

## Scroll mechanics

- **Height stays 420vh.** Do not shorten it. `hero-reimagined.md` proposed
  260vh; that was wrong and the flick test says so — at 420vh every beat holds
  **5 full 120px wheel notches** (6 for the last), and 260vh would halve the
  scrub span to about 2.5. Dwell is a function of how long the copy takes to
  read, and the layout does not change that. If you want it shorter, re-run the
  flick harness and hold **MIN ≥ 4 at a 120px step**.
- Drive loop unchanged: scroll sets `target`, a rAF loop eases `shown` toward
  it, dt-normalised to a 60fps reference, resting when converged and when the
  hero is off screen. Every write delta-gated.
- Band ranges unchanged: `[0, 0.22] [0.24, 0.47] [0.49, 0.72] [0.74, 1.0]`.
- If the new footage is cut to the beats as specified, **try deleting the `CUE`
  table** and mapping `p` to film time linearly. It exists only to hide the
  current take's wrong beat order. Keep it only if a linear map visibly
  misaligns a band.

## What gets deleted

- The horizontal mist ramp and the bottom vertical fade in `film.tsx`.
- **The hero's canvas layer.** Today it draws the register over the film across
  the last third at 0.62 alpha. The queue card now states that explicitly and
  the film's fourth beat states it again in water; three renderings of one idea
  is two too many. Remove the canvas element, its rAF draw call and the
  `readColors` / `renderFlow` imports **from `hero.tsx` only**.
- **Do not delete `lib/flow.ts`** — `components/site/flow-still.tsx` still uses
  it. Check that file before touching the module.
- `app/mock/page.tsx` and `public/mock/*` — the bench for this decision.

## Quality floor

- Contrast measured, not judged: hide the glyphs, screenshot, worst pixel in
  each text box. Headings and sublines are on canvas now, so the numbers should
  jump; anything under 4.5:1 means something is still overlapping the plate.
- Visible keyboard focus on both CTAs. The plate is `aria-hidden`; the film is
  `tabIndex={-1}`.
- Reduced motion gets the static hero, and fetches no video.
- `saveData` fetches no video.
- The page must be complete with the film blocked: poster visible, `h1` present,
  no console errors.
- No horizontal overflow at 375, 414, 768, 1024, 1280, 1440, 1600.

## Files

    marketing/components/site/hero.tsx      layout, canvas removal, gate string
    marketing/components/site/film.tsx      ramp removal, objectPosition, drift
    marketing/app/globals.css               gate one 720px -> 900px
    marketing/app/mock/page.tsx             delete
    marketing/public/mock/                  delete

`content/site.ts`, `split.tsx`, `queue.tsx`, `primitives.tsx`, `nav.tsx` and
`lib/flow.ts` should not need to change.

## Acceptance

Run against the dev server **and** the static export; both must pass.

| harness | must hold |
|---|---|
| `sweep.mjs` | 18/18 — folds, scene decode, no stuck reveal, deep tokens, nav lands + marks current fold, no overflow, axe clean at 1440 and 390, no console errors, no failed requests, all five gates fetch no film, saveData fetches no film, complete without the film |
| `contrast.mjs` | 0 failures; headings and sublines should now measure far above the 5.4–5.7:1 the veil was holding |
| `flick.mjs` | MIN ≥ 4 fully-readable flicks per beat at a 120px step |
| `profile.mjs` | longest freeze ≤ 2 animation frames while scrolling; ≥ 45% of the film's frames shown during a continuous read |
| `interact.mjs` | 7/7 |
| build | `npm run build` and `PAGES_EXPORT=1 npm run build` both clean |

Then check the link chain in the export: every CTA resolves to
`/version_zero/coming-soon/`, and that page carries `APP_URL`.
