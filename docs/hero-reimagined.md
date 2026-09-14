# The hero, reimagined — the cold open

Companion to `hero-film-brief.md`, which holds the diagnosis of the current
take, the model prices and the encode recipe. This one covers the section
redesign and the footage it needs. Mock at `/mock` (temporary, delete it once
the direction is settled).

## Why the section changes, not just the footage

The current hero is a full-bleed photograph with text laid over it. That has one
structural fault no amount of resolution fixes: **the type needs 4.5:1 over the
picture, and the veil that buys the contrast is what kills the picture.** The
mist ramp in `film.tsx` is tuned to hold sublines at 5.5:1, and the cost is that
the film reads as a pale grey smudge. Four screens of scroll, four megabytes of
video, and the visible change between beat one and beat three is almost nil.

Three more faults follow from the same decision:

- **The imagery is generic.** A grey river could front a bank, a water utility
  or a meditation app. Every other fold on this page is specific — the ledger of
  four failures, the event log, Tata Power sitting on two mandates with opposite
  answers. The hero is the only section that could belong to anyone.
- **420vh buys very little.** Four headlines, four screens, and the payoff — the
  queue — arrives only at the very end.
- **The film's direction fights the reader's.** The take is landscape and its
  water runs across frame. The reader is going down.

## The reimagining

**Split the hero. Copy on clean canvas at left; the film in a contained plate at
right, uncovered.** No veil, because no type sits on it.

    ┌──────────────────────────────┬─────────────────────────────┐
    │  Y Upstream       nav …      │  ← nav crosses both         │
    │                              │▓▓▓▓  ▓▓▓▓  ▓▓▓▓  ▓▓▓▓       │
    │                              │ ▓▓    ▓▓    ▓▓    ▓▓        │  four channels
    │  DEAL FLOW, KEPT             │ ▓▓    ▓▓    ▓▓    ▓▓        │  running down
    │                              │ ▓▓    ▓▓    ▓▓    ▓▓        │
    │  Two analysts. One           │  ▓▓▓  ▓▓▓  ▓▓▓  ▓▓▓         │
    │  CFO. Same Tuesday.          │   ▓▓▓▓▓▓    ▓▓▓▓▓▓          │  bars going under
    │                              │    ▓▓▓▓▓▓▓▓▓▓▓▓▓▓           │
    │  Nobody did anything wrong.  │     ▓▓▓▓▓▓▓▓▓▓▓▓            │  one current
    │  The client still remembers. │     ▓▓▓▓▓▓▓▓▓▓▓▓            │
    │                              │     ▓▓▓▓▓▓▓▓▓▓▓▓            │
    │  ──  ──  ··  ··   01 / 04    │              ┌───────────┐  │
    │                              │              │ Outreach  │  │  payoff, last beat
    └──────────────────────────────┴──────────────┴───────────┴──┘
       46%, canvas, full ink          54%, film at full contrast

What this wins:

- **The film becomes visible.** Full contrast, no veil. You can finally see the
  channels, the bars and the rust strand.
- **The type gets stronger, not weaker.** Ink on mist is ~15:1 instead of 5.5:1,
  so the display face can run at its real weight instead of being propped up.
- **The resolution bar drops.** The plate is ~778 CSS px wide, so 1556 device px
  at 2×. A 3:4 source at 2K is 1536×2048 — effectively exact. The 40-credit
  option is now comfortably enough; 4K stops being necessary.
- **A signature that is true.** The water runs top to bottom and merges as it
  descends. **The reader's scroll and the river's direction become the same
  gesture** — you drive the merge by going down.
- ~~**Shorter.** ~260vh instead of 420vh.~~ **Wrong — corrected.** The flick
  test says every beat holds 5 full 120px wheel notches at 420vh, and 260vh
  would leave about 2.5. Dwell is a function of how long the copy takes to read,
  which the layout does not change. Height stays 420vh; see
  `hero-build-brief.md`.

Kept as they are: the four bands of copy, the five static-hero gates, the queue
card, the CUE table's job (though new footage cut to the beats may not need one).

New, small: a four-rule descent marker at the foot of the copy column, filling
as the channels close. It counts the same four beats the film does — structure
that encodes something true, not decoration.

## The video script — "The descent"

**Format.** 3:4 portrait. 10 seconds. Silent. Locked-off. One unbroken take.
Straight down on a braided glacial river filling the full height of frame.

Portrait is the whole point. The channels run the height of the plate and merge
downward, so the film moves the way the reader does.

**Beat 1 — 0 to 2.5s — over "Two analysts. One CFO. Same Tuesday."**
Four channels run straight down the frame, parallel and evenly spaced, divided
by four long pale sediment bars. Each channel carries its own current and its
own standing waves. Nothing crosses. Four rivers that never learn about each
other, top of frame to bottom.

**Beat 2 — 2.5 to 5s — over "One sheet per mandate is one memory per mandate."**
The separation deepens. The bars widen and dry, their edges sharpen, white
standing waves build along every bank. The channels narrow and run faster,
cutting deeper. Maximum division. The problem, stated in water.

**Beat 3 — 5 to 8s — over "Upstream keeps the whole current."**
The water rises and the bars submerge **from the bottom of frame upward**, so
resolution arrives first where the reader is heading. Each drowned bar joins two
channels into one: four become three, three become two, two become one. By 8s
the lower two thirds is a single body and the last bar is going under at the top.

**Beat 4 — 8 to 10s — over "Log the email. The rest is derived."**
One current fills the frame. Its surface settles into long parallel flow lines
running the full height, evenly spaced, like ruled lines on a page. One strand
of rust-orange iron sediment threads down through it just right of centre — the
one late row in an ordered book.

The film only ever goes many to one. It never re-divides, never loops, never
resets.

## The prompt

Paste as one block. Settings: **3:4, 10 seconds, audio off.** MiniMax H3 at 2K
(40 credits) is now sufficient; Seedance 2.0 at 1080p (90) if you want headroom.
Generate two variants.

> Locked-off overhead aerial, vertical portrait framing. Single unbroken
> 10-second take.
>
> A braided glacial river seen from directly above, perfectly top-down. The
> river runs the full height of the vertical frame, flowing downward, from the
> top edge to the bottom edge. The camera is bolted in place — mounted, not
> flown. Over the full ten seconds it does not push in, pull out, pan, tilt,
> roll, orbit or drift by a single pixel. No parallax, no handheld float, no
> drone movement. The edges of the frame hold absolutely still; only the water
> inside them changes.
>
> Colour: cold glacial. The deep channels are dark slate-teal, almost petrol
> (#0f2b2b). The water is pale mineral grey-green, milky with rock flour
> (#dbe6e3). The exposed sediment bars are dry bone and cool sand (#e8ede9) —
> clearly LIGHTER than the water, so every bar reads as a hard bright shape
> against a dark channel. Strong tonal separation between water and land. Flat
> overcast Icelandic daylight. No sun glare, no hard shadows, no golden hour, no
> warm light.
>
> The ten seconds, in this order, moving only in this direction:
>
> 0–2.5s: Four separate channels run straight down the full height of the frame,
> parallel and evenly spaced, divided by four long sharp-edged sediment bars.
> Four separate rivers, not one. Each channel carries its own current and its own
> standing waves. The bars are wide, dry and clearly above water. Nothing
> crosses between the channels.
>
> 2.5–5s: The separation deepens. The bars widen and dry out, their edges
> sharpen, white standing waves and foam lines build along every bank. The
> channels narrow and run faster, cutting deeper. Four systems, further apart
> than before.
>
> 5–8s: The water rises and the sediment bars submerge, starting at the BOTTOM
> of the frame and progressing upward. As each bar drowns, the two channels
> either side merge into one wider flow — four become three, three become two,
> two become one. By the end of this beat the lower two thirds of the frame is a
> single body of water and the last bar is going under near the top.
>
> 8–10s: One single current fills the whole frame. Its surface settles into long
> parallel evenly spaced flow lines running the full height of the frame, like
> ruled lines on a page. One strand of oxidised iron sediment — clear rust orange
> (#c2410c) — threads down through the settled current just right of centre,
> distinct against the teal.
>
> Detail: razor sharp throughout, deep focus, every ripple resolved. Fine
> surface structure everywhere — standing waves, foam streaks, sediment plumes,
> braided ripple texture across the shallows, wet ridged sand at the bar edges.
> High detail, high bitrate, no softness.
>
> Nothing else in frame: no people, no boats, no birds, no vehicles, no
> buildings, no bridges, no text, no captions, no logos, no graphics, no
> interface, no lens flare, no vignette, no film grain, no letterboxing.
>
> The water only ever goes from many to one. It never re-divides, never loops,
> never resets, never reverses.

**Negative prompt**

> camera movement, drone flight, flying, push in, zoom, pan, tilt, orbit,
> parallax, handheld, shaky, cut, scene change, jump cut, transition, dissolve,
> time lapse, speed ramp, people, boats, birds, buildings, text, watermark,
> logo, subtitles, interface, graphics, lens flare, vignette, film grain,
> letterbox, horizontal composition, landscape orientation, blur, soft focus,
> motion blur, low resolution, sunset, golden hour, warm light, harsh shadows

## Accepting the footage

Same five checks as the landscape brief, plus one:

6. **Do the channels run down, not across?** A model handed a portrait frame
   will often shoot a landscape river and crop it. The channels must run from
   the top edge to the bottom edge, or the scroll alignment is lost.
