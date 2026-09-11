# Upstream landing page — the generation prompts

Every AI-generated asset the page can carry, in the order you would generate them. Written
to the hero-video laws: the motion agrees with the scroll, one subject travels one
continuous journey, the ending is composed before anything is generated, the subjects are
forgiving ones (water, silt, mist, light, no anatomy), and the layout is composed for
before the first credit moves.

The page currently ships code-rendered versions of all of these (`lib/flow.ts` plus
`app/render` and `scripts/render-assets.mjs`). These prompts replace them one for one.

---

## 0. The house block

Paste this into every prompt. It carries the palette as materials and light rather than as
hex codes, which is the only way a model can act on it, and it carries the standing guards.

```
Colours are the materials themselves and nothing else: chilled mist grey-green
water, wet slate stone, pale silt, dark oxidised copper green in the deep
water, and at most one thread of rust-orange. Light is cold, low and flat: a
high overcast with no sun disc and no lens flare. Photorealistic, cinematic,
shot on a long lens, fine natural grain. No text, no logos, no lettering,
no watermarks, no numbers, no UI anywhere in frame. No people, no boats, no
bridges, no buildings, no wildlife.
```

**The negative-space trap.** Where a prompt reserves a calm region for the page's words, it
describes that region as part of the world: slack shallow water over a pale silt bank, a
smooth unbroken skin. Never as "empty space", "darkness" or "room for text". Ask for empty
darkness and the model paints a literal black panel, and that costs a re-roll.

**Preflight everything.** `get_cost: true` is free. Check the exact call before it runs, and
check the same planned video across the top two or three video models: the spread on
identical parameters has measured about five to one.

**Standard video settings** unless a prompt says otherwise: image-to-video, 1080p (never 4K,
the web copy is re-encoded anyway), 6 seconds, standard mode, no audio.

---

## 1. The hero film

The hero is a four-beat journey, and each beat exists because a band of copy needs it:

| Beat | The copy it carries | What the water does |
|---|---|---|
| 1 | "Two analysts. One CFO. Same Tuesday." | one uncountable current, running |
| 2 | "One sheet per mandate is one memory per mandate." | sandbars rise and split it into four channels |
| 3 | "Upstream keeps the whole current." | the bars sink, the channels merge into one |
| 4 | "Log the email. The rest is derived." | the current settles into ruled parallel lines and stops |

Four chained segments of 6 seconds, about 24 seconds of film across 540vh of pinned scroll.

**The layout the film must respect.** The page's words live in the left of the frame the
whole way down, and the outreach-desk panel resolves in the right of the frame at the
settle. So the left of every frame stays a calm, plain, unbroken surface, and the action
stays right of centre.

**The chain.** Generate segment 1 from the start frame below. Then, for each next segment:
extract the approved segment's final frame as a full-quality PNG (`ffmpeg -sseof -0.1 -i
seg1.mp4 -frames:v 1 -q:v 1 seg1-last.png`; a review-grade jpg is not good enough to chain
from), `media_upload` it, `PUT` the raw bytes to the presigned URL it returns,
`media_confirm`, and pass the confirmed id as `start_image` for the next call. Gate each
segment on its own: a rejected segment is one cheap re-roll, not a redo of the journey.

**The seams.** Segments 1 to 3 end mid-motion on purpose. Fine texture does not carry across
a generation, so a rest-to-rest join on specific water texture shows as a visible cut even
when the motion vector is perfect. Beat 3 also carries a deliberate spray-across-the-lens
moment, which both sells the boundary crossing and gives the join a reason to refresh
texture.

### 1.0 The start frame (image, 16:9, 2K, about 2 credits)

```
A wide, slow river of pale glacial meltwater seen from directly overhead at
first light, composed as the first moment of a motion that will carry the
whole surface downward through the frame. The water fills the frame edge to
edge as one continuous surface. Along the left of the frame the river runs
shallow and slack over a pale silt bank, a smooth unbroken skin of water
catching flat morning light. Toward the centre and the right the current
quickens into countless fine bright filaments of foam and suspended silt, all
drawn out in the direction of travel and too many to count. Thin cold vapour
drifts across the surface. Generous calm water across the very top and the
very bottom of the frame.

[HOUSE BLOCK]
```

Inspect before animating: no shoreline, no objects, no sun disc, the left really is a plain
unbroken skin of water, and there is no literal dark panel on either side. A bad frame is a
2-credit fix now or a whole video's credits wasted later.

### 1.1 Segment 1 — the current, running

```
One continuous overhead shot, no cuts. The entire river surface travels
steadily downward through the frame, top to bottom, at one constant unhurried
speed, as if the camera holds still above a current that never stops. The
filaments of foam and silt stay alive the whole way: they stretch, braid,
break and reform as they pass. The slack water along the left breathes with
slow ripples and never breaks into whitewater. Thin vapour drifts downstream
across the surface at its own slower speed, so the frame carries two layers of
motion at once. The light stays cold and flat and does not change. The shot
ends mid-motion, the current still running, the surface unbroken and the frame
still full of travelling filaments.

No text or lettering anywhere.
```

### 1.2 Segment 2 — one sheet per mandate

Start image: the final frame of segment 1.

```
One continuous overhead shot, no cuts, picking up exactly where the previous
shot left off and continuing the same downward travel at the same speed in the
same cold flat light. As the surface keeps moving, four long parallel sandbars
rise slowly out of the water from beneath, running with the current from the
top of frame to the bottom, and divide the river into four separate channels.
The water parts around them. Each channel now carries its own filaments and
nothing crosses from one channel to the next. The bars surface wet and dark
with water sheeting off their spines and small standing waves forming along
their upstream edges. The slack shallow along the left of frame stays calm and
clear of the bars. The shot ends mid-motion with the four channels running
separately and the whole surface still travelling.

No text or lettering anywhere.
```

### 1.3 Segment 3 — the whole current, kept

Start image: the final frame of segment 2.

```
One continuous overhead shot, no cuts, continuing the same downward travel at
the same speed in the same cold flat light. The four sandbars sink back under
the surface as smoothly as they rose, and the four separate channels merge
back into one single deep channel that draws together toward the centre-right
of the frame. As the bars go under, the water closes over them and a sheet of
spray crosses the lens: a scatter of droplets sits on the glass for a beat and
the image goes soft, then clears. The filaments from all four channels braid
into one dense band of current running down the right of frame. The shallow
along the left settles back into a smooth still skin of water. The shot ends
mid-motion with the single channel running fast and clean.

No text or lettering anywhere.
```

### 1.4 Segment 4 — the settle (the composed ending)

Start image: the final frame of segment 3. This is the only segment that ends at rest, and
its last frame is where the whole page comes to rest, so it is also the hero poster and the
share card.

```
One continuous overhead shot, no cuts, continuing the same downward travel and
decelerating smoothly and evenly to a complete stop. The single channel slows
until the water is barely moving, and the braided filaments straighten out into
a neat stack of long parallel horizontal lines of foam lying across the current
in the right two-thirds of the frame, evenly spaced, settling like ruled lines
onto a page. The shallow along the left comes to a full mirror stillness. The
last thing to move is one thin line of rust-orange silt near the top of the
stack, the only warm colour anywhere in the frame, which settles a moment after
all the others. The shot ends fully at rest: a still, pale, mirror-flat surface
with generous calm water across the very top and the very bottom of the frame,
the stack of settled parallel lines held in the right of frame, and nothing
moving but the faintest breath of vapour.

No text or lettering anywhere.
```

Why the ending is shaped this way: the site header sits over the top of the frame and the
page cover-crops the edges on wider and shorter screens, so the top and bottom carry
generous margin. The settled parallel lines are where the outreach-desk panel lands, so the
panel arrives out of the film instead of on top of it. The one rust-orange line is the
overdue row, and it is the only warm mark in twenty-four seconds.

Verify the last frame with the header mocked over it, at a wide window and a short one,
before approving.

---

## 2. The hero poster (still hero: phones, reduced motion)

**Preferred: extract it, do not generate it.** The poster should be a real frame of the film
or the still and the scroll journey drift apart the first time either is re-rolled.

```
ffmpeg -sseof -0.1 -i hero-seg4.mp4 -frames:v 1 -q:v 2 marketing/public/hero-poster.jpg
```

Generate a standalone poster only if you want the still composed differently from the film's
ending. 16:9, 2K:

```
A wide river of pale glacial meltwater seen from directly overhead, come
completely to rest. The surface is mirror-flat. In the right two-thirds of the
frame a neat stack of long parallel horizontal lines of foam lies across the
water, evenly spaced and perfectly settled. Along the left the water is a
smooth unbroken skin over a pale silt bank, calm and plain. One single thin
line of rust-orange silt sits near the top of the stack, the only warm colour
in the frame. Generous calm water across the very top and the very bottom.
The faintest breath of cold vapour.

[HOUSE BLOCK]
```

### 2a. The portrait poster (9:16 or 3:4)

A phone crops the 16:9 poster to its busiest band, so the portrait cut is worth its own two
credits rather than a crop.

```
A river of pale glacial meltwater seen from directly overhead in a tall
vertical frame, come completely to rest. The upper half of the frame is a
smooth unbroken skin of still water over a pale silt bank, plain and calm. In
the lower half a neat stack of long parallel horizontal lines of foam lies
settled across the water, evenly spaced, with one single thin line of
rust-orange silt among them, the only warm colour in the frame. Mirror-flat
surface, the faintest breath of cold vapour.

[HOUSE BLOCK]
```

The calm half is where the headline and the buttons sit. Vertical framing, 9:16.

---

## 3. The share card background (1200x630)

Generate at 16:9 and crop, or ask for 1.91:1 directly. The wordmark and the headline are
drawn over it by `app/render`, so this is the ground only and it must stay quiet on the left.

```
A river of pale glacial meltwater seen from directly overhead, at rest, in a
wide letterbox frame. The left half is a smooth unbroken skin of still water
over a pale silt bank, plain, calm and even. The right half holds a settled
stack of long parallel horizontal lines of foam lying across the water, evenly
spaced, with one thin line of rust-orange silt among them. Mirror-flat, cold,
even light with no bright highlight anywhere in the left half.

[HOUSE BLOCK]
```

Then re-run `node scripts/render-assets.mjs` so the card is composited with the real type.

---

## 4. The closing fold's ambient clip

Plays once when the fold arrives, then rests. It is decorative and it is never loaded for
reduced motion, a coarse pointer or a metered connection.

### 4.0 Start frame (image, 16:9, 2K)

```
The surface of a wide river of pale glacial meltwater seen from directly
overhead, calm and open, moving so slowly it is almost still. A few long
filaments of foam and silt lie stretched along the direction of travel, well
spaced, with clear plain water between them. Thin cold vapour sits on the
surface. Even flat light across the whole frame, no bright highlight in the
centre where a headline will sit.

[HOUSE BLOCK]
```

### 4.1 The clip (image-to-video, 1080p, 8 to 12 seconds if the model allows, no audio)

```
One continuous overhead shot, no cuts. The river surface drifts downward
through the frame very slowly, at a fraction of walking pace, so the movement
is barely perceptible. The few filaments of foam stretch and wander gently as
they travel. Thin vapour drifts across at its own slower speed. The light does
not change and nothing enters or leaves the frame. The shot ends as quietly as
it began, still drifting, still calm.

No text or lettering anywhere.
```

Save it to `marketing/public/current-loop.webm` (or `.mp4`, and update the source in
`components/site/closing.tsx`), and extract the clip's FIRST frame to
`marketing/public/current-still.jpg`. First frame, not last: the still is what shows before
the clip loads, so matching it to frame zero means the clip starts with no jump.

```
ffmpeg -i current-loop.mp4 -frames:v 1 -q:v 2 marketing/public/current-still.jpg
```

---

## 5. The fold stills

Four folds can carry a still each. Generate all four or none: a fold with an image beside
three without one reads as a hole to a first-time visitor. Each ships as a quiet ground
behind the fold at low opacity with a soft mask, never as a picture in a box.

Sizes: 16:9, 2K, about 2 credits each.

### 5.1 The cost fold — what a desk loses

Four ways a desk loses what it already earned. The image is the loss itself: water that
leaves the current and is not recovered.

```
A river of pale glacial meltwater seen from directly overhead. Along the right
the main current runs strong, full of fine bright filaments of foam. Along the
left a few of those filaments have peeled away from the main flow into a wide
slack eddy of still water, where they are slowing, thinning, going grey and
dissolving into the pale silt until nothing is left of them. Clear plain water
between the eddy and the current. Cold flat light.

[HOUSE BLOCK]
```

### 5.2 The mechanism fold — one act, four consequences

The reader holds a button, logs one email, and four things derive themselves. This is that,
in water, and it is the most forgiving subject in the set.

```
A single drop of water striking the surface of a perfectly still, shallow pale
pool, seen from directly overhead, caught an instant after impact. One small
crown of water at the point of impact and four clean concentric rings spreading
outward from it across the mirror-flat surface, each ring wider and fainter
than the last, reaching most of the way to the edges of the frame. Pale silt
floor under clear water. The rest of the surface is untouched glass. Cold flat
light, one soft highlight on the crown.

[HOUSE BLOCK]
```

### 5.3 The record fold — the second mandate (deep act)

This fold is underwater, so the still is too: a confluence seen from below, two histories
becoming one.

```
Seen from underwater, looking along two currents where they meet and become
one. Two distinct plumes of pale suspended silt, one entering from the left and
one from the right, braid together into a single darker plume that continues
away from the camera into deep black-green water. Shafts of weak cold daylight
come down from the surface far above. Everything is deep green-black except the
pale silt in the plumes. Slow, heavy, quiet water. Fine suspended particles
drifting through the light.

[HOUSE BLOCK]
```

### 5.4 The access fold — below the waterline (deep act)

```
Seen from deep underwater, looking straight up at the underside of a calm river
surface far above. The surface is a pale, cold, luminous sheet seen from
beneath, rippling very slightly. Everything below it falls away into dense
black-green water, and the light does not reach the camera. A few fine
particles of silt hang suspended in the near-black water. No surface detail is
readable from below, only pale light.

[HOUSE BLOCK]
```

---

## 6. What must never be generated

- **`public/product/master.png`, `schedule.png`, `analytics.png`.** These are screenshots of
  the running app, and the desk fold's own caption says so. Generating a picture of a
  product that does not look like the product is the one lie a page like this cannot tell.
  If they look dated, retake them from the app, in its Daylight theme.
- **The wordmark and the favicon.** Two strokes joining into one, drawn by hand in
  `components/site/nav.tsx`. A generated logo is a raster with a model's fingerprints on it.
- **The channel in the left margin.** An SVG path in `components/site/fold.tsx` that draws
  itself against scroll. It has to be geometry, not an image.

---

## 7. The order to run it in, and what it costs

1. Preflight the start frame. Say its price out loud. Generate it (about 2 credits).
2. Inspect it yourself: trademarks the model sneaked in, a black panel on the left, a sun
   disc, any object on the water. Re-roll at 2 credits rather than animating a bad frame.
3. Preflight the SAME planned 6-second shot across the top two or three video models and
   pick with the real numbers in hand. At the top-priced model a hero segment is about 54
   credits, so a four-segment chain is roughly 216 plus the stills; a mid-priced model can
   turn that into a number a trial balance survives.
4. Segment 1 → inspect start, middle and end frames → gate it → chain.
5. Repeat for segments 2, 3, 4. Gate each one separately.
6. Concat the four raw segments in ONE encode (never encode twice, and never join clips
   encoded with different settings, or every seam glitches).
7. Poster and share card from segment 4's final frame.
8. The closing clip and its first frame.
9. The four fold stills, all four, inspected against the palette before anything is built
   with them.

## 8. What changes in the code

The fold stills, the poster, the share card and the closing clip are drop-in: same
filenames, same slots, and `scripts/render-assets.mjs` only needs to stop overwriting the
ones you now generate.

The hero film is **not** a drop-in. Today the hero is a canvas whose frame is a pure
function of scroll (`lib/flow.ts`), which is why it needs no loader, no seek gate and no
poster juggling. Swapping in a real video means wiring the scrub pipeline properly:

- fetch the encoded file as a Blob (many hosts silently lack HTTP Range, and without it
  every seek clamps to zero and scrubbing does nothing on the live site while working
  perfectly on localhost), streamed behind a progress ring since a 24-second chain will be
  well over 8 MB,
- re-encode with a short keyframe interval (`-g 8`) or the scrub will feel rough in Chrome
  no matter how well the rest is written,
- gate the seeks so two never overlap, with the busy flag reset on error so the gate cannot
  deadlock,
- keep the existing dt-normalised lerp, the delta-gated band writes and all five
  static-hero gates exactly as they are.

That is a real piece of work, not a config change. Worth doing once the footage is
approved, and not before.

---

## 9. Round one: what shipped, and the re-rolls

Five images generated 2026-08-24 and wired in. Each one got the job it was generated for,
and no image is used twice.

| File | Slot | Treatment |
|---|---|---|
| `scene/hero-river.jpg` | the still hero (phones, reduced motion), the ground under the canvas if it never paints, and the share card | full strength |
| `scene/cost.jpg` | the turn fold, the light act's one photographic moment | 0.50 under a 0.34 mist wash, masked right |
| `scene/mechanism.jpg` | the mechanism fold, rings spreading from where the reader presses | 0.32 under a 0.70 mist wash |
| `scene/record.jpg` | the record fold, full ground | 0.50, full-bleed mask, left column scrimmed |
| `scene/access.jpg` | the access fold, a band across the top | 0.72, band mask, gone before the copy |

**What the measurement changed.** The worst-pixel audit (hide the glyphs, screenshot the
real composited page, find the worst pixel inside the text's box) failed in the deep act
before any of this was tuned: pale body text over the access image's surface caustics read
**1.90:1** against a 4.5 floor, and the record fold's body read 3.33:1. Two fixes, and
neither of them was "turn the image down until it disappears":

- a **left column scrim** on the record fold, so the water keeps full strength on the right
  where the eye goes and gives way only under the reading,
- the access image moved to a **band above the copy** rather than behind it, because no
  scrim saves pale text sitting on caustics. The reader now passes through the surface and
  then reads in the dark, which is what that fold is about anyway.

After: 8.56, 4.55, 14.45, 8.00, 5.06, 6.80, 6.37. All pass.

### The re-rolls

Each is a complete replacement prompt, about 2 credits, same slot, same filename. None of
these is a blocker: what is wired in works. They are the difference between good stock and
this brand's own world.

**9.1 · `cost.jpg` — the eddy.** Round one framed it with mossy olive rock and split the
frame with a hard ledge at dead centre, so it reads as two photographs joined and it carries
a green that is not in the palette.

```
A river of pale glacial meltwater seen from directly overhead, filling the
frame edge to edge with water and nothing else. No rock, no bank, no moss, no
vegetation anywhere in frame. Along the right the main current runs fast, full
of fine bright filaments of foam drawn out in the direction of travel. Along
the left the water slackens into a wide still eddy where a few of those
filaments have peeled away from the current: they are thinning, going grey and
dissolving into pale suspended silt until nothing is left of them. The change
from fast water to slack water is a soft diagonal shear across the middle of
the frame, a gradual blending of two textures, never a hard edge or a step. The
whitewater is fine and low-contrast, more texture than spray.

[HOUSE BLOCK]
```

**9.2 · `mechanism.jpg` — the drop.** Round one is a rock pool with a heavy dark frame, a
studio hotspot and three short rings. The brief wanted water filling the frame and four
rings reaching the edges.

```
A single drop of water striking the surface of a still, shallow, pale pool seen
from directly overhead, caught an instant after impact. Water fills the frame
edge to edge: no rock, no rim, no bank, no vegetation, nothing but water and the
pale silt floor beneath it. One small crown at the point of impact, slightly off
centre, and four clean concentric rings spreading outward from it, each wider
and fainter than the last, the outermost reaching almost to the edges of the
frame. Even flat overcast light across the whole surface with no bright
highlight and no vignette in the corners. The rest of the surface is untouched
glass.

[HOUSE BLOCK]
```

**9.3 · `record.jpg` — the confluence.** The strongest of the five. The only faults are that
the silt reads as wool rather than as suspended sediment, it runs warm against a cold
palette, and the single plume after the join is too short to read as "they became one".

```
Seen from underwater, looking along two currents where they meet and become one.
Two plumes of suspended silt, one entering from the left and one from the right,
braid together into a single plume that continues away from the camera deep into
black-green water and stays visible far into the distance, longer than the two
plumes that made it. The silt is fine and granular and slightly translucent,
made of countless individual particles, never smooth or woolly or smoke-like.
The silt is cold pale grey-green, not warm and not tan. Weak shafts of cold
daylight come down from the surface far above. Everything else is deep
green-black.

[HOUSE BLOCK]
```

**9.4 · `access.jpg` — the underside of the surface.** Close to right. The only fault is
that the lower two-thirds is a flat black field with no information in it, which limits how
it can be used.

```
Seen from deep underwater, looking straight up at the underside of a calm river
surface far above. The surface is a pale, cold, luminous sheet seen from
beneath, rippling very slightly, filling the upper third of the frame. Below it
the water falls away into dense black-green, but it is not empty: fine
particles of silt hang suspended all through it, catching the last of the light
and thinning out with depth, so the darkness has body and distance in it rather
than reading as flat black. No vignette in the corners.

[HOUSE BLOCK]
```

**9.5 · `hero-river.jpg` — the current.** Beautiful, and it carries the single rust-orange
thread the palette is built around. Two faults, one of them structural: the flow runs
diagonally across the frame rather than top to bottom, and a hero that scrubs with the
scroll needs the motion axis to agree with the scroll, or scrolling down fights the picture.
The other is that the calm left third is a dry sandbar rather than water.

```
A wide river of pale glacial meltwater seen from directly overhead, running
strictly from the top of the frame to the bottom, with the direction of travel
unmistakably vertical and no diagonal drift. The water fills the frame edge to
edge and there is no dry land anywhere. Along the left the river runs shallow
and slack over a pale silt bed, a smooth unbroken skin of water. Toward the
centre and the right it quickens into countless fine bright filaments of foam
and suspended silt, all drawn out vertically, too many to count, one single
current rather than separate channels. One thin thread of rust-orange silt runs
among them right of centre, the only warm colour in the frame. Thin cold vapour
drifts across the surface. Generous calm water across the very top and the very
bottom of the frame.

[HOUSE BLOCK]
```

---

## 10. The product surfaces

Round one of this document said never to generate these. That was the right default and it is
now overridden deliberately: the three real screenshots are the app's dark theme sitting on a
light page, and matching the page is worth more here than photographic literalism.

**The caption must change with them.** `DESK_LEDE` in `content/site.ts` currently reads
"Screenshots of the running app against a demo book, not renderings." Replace it with one of:

> "Interface renderings of the three working screens, drawn on a demo book."
> "The three working screens, rendered on a demo book."

Do not leave the old line standing over generated art.

**The text problem, and the rule that solves it.** Image models cannot render legible
interface text; they produce letter-shaped noise that the eye catches instantly. So every
prompt below asks for label text as **abstracted marks**: soft grey bars and dashes at the
right size and rhythm for the words they stand in for, with no readable letterforms
anywhere. An interface reads as an interface from its geometry, not its copy. Numbers get
the same treatment, which also keeps the page's no-invented-metrics rule intact.

**The strongest option is still not an image.** The hero's outreach-desk panel is real DOM:
on palette, crisp at any size, animatable, and true by construction. The same could be built
for all three surfaces. Generated art is the faster path and these prompts do it well; the
built path is the better one when there is time.

### The interface block

Paste into all three, in place of the house block.

```
A clean product interface rendering, shot straight on, filling the frame. The
surface is a very pale cool grey-green, almost white, with hairline dividers
and generous even spacing. Ink is a deep petrol, near black with a green cast.
One single accent, a deep teal, used only on the few live controls. One single
warm mark, a rust orange, used only where something is late. Soft even light,
a faint drop shadow under raised panels, gentle rounded corners of about six
pixels, no glass, no gloss, no gradients on the panels themselves.

Every piece of label text and every number is rendered as soft abstracted grey
marks at the size and rhythm of real words: short bars, dashes and dots. There
are no readable letterforms anywhere in the image, no lettering, no logos, no
brand marks, no icons of known companies, no watermarks, no cursor, no browser
chrome, no window controls, no operating system furniture. Photorealistic
interface design mockup, 4:2.5 aspect, high resolution.
```

Slot size: **1200 x 750**, replacing `public/product/master.png`, `schedule.png` and
`analytics.png`. Keep the filenames; nothing in the code changes.

### 10.1 · The master list

The real screen is a register: one row per company, and the row carries the whole firm's
knowledge of that name. It must read as dense and calm, the opposite of a dashboard.

```
A data register table filling the frame, seen straight on. A slim header strip
across the top with a title on the left and two small pill controls on the
right, one of them filled in the teal accent. Below it a filter row: a wide
search field, two dropdown controls and a small control group, all outlined,
none filled. Then the table: six columns of unequal width, a light column
header row, and about ten data rows separated by hairlines. The leftmost column
is widest and each of its cells holds two stacked marks, a bold one above a
lighter one, like a name above a location. Two of the columns on the right are
narrow and right-aligned, as numbers would be. A handful of small outlined tags
sit inside the left column's cells. Nothing is highlighted, nothing is
selected, and the whole table is calm and evenly spaced.

[INTERFACE BLOCK]
```

### 10.2 · The outreach desk

This is the one screen that must feel like pressure. It is a queue ordered by lateness, and
the warm mark earns its only appearance here.

```
A task queue interface filling the frame, seen straight on. Across the top, a
horizontal strip divided into eight equal cells by hairlines, each holding a
small label mark above a large number mark, like a row of days; the second cell
carries a rust orange number and a thin rust underline, and one cell near the
right is marked with a teal underline. Below the strip, one row is promoted
above the others: it sits on a very pale warm tint, is slightly taller, and
carries a filled rust orange pill button on its right end. Under it, a list of
about six rows separated by hairlines. Each row begins with a small
right-aligned number in rust orange, then two stacked text marks, and ends with
a small outlined pill button. The rust orange numbers get smaller down the
list. Everything else on the screen is grey and quiet, so the warm marks are
the only colour that pulls the eye.

[INTERFACE BLOCK]
```

### 10.3 · Analytics

The chart is a by-product of the log, so the screen should look like a readout, not a
business-intelligence dashboard.

```
An analytics screen filling the frame, seen straight on. A slim title strip at
the top with a small outlined dropdown control on the right. Below it, a row of
four equal stat cards separated by hairlines, each holding a small label mark
at the top, a large number mark below it, and a tiny sparkline in the corner;
the sparklines are thin, one teal and one rust orange. Under the cards, one
wide chart panel occupying most of the frame: a smooth filled area curve in
warm rust orange rising through the middle and falling toward the right, with a
thin flat teal line running low across the whole width beneath it, over a
faint horizontal gridline set, with small axis marks along the bottom. Below
the chart, a strip divided into three comparison cells. The palette is
restrained: one warm curve, one cool line, everything else grey.

[INTERFACE BLOCK]
```

### 10.4 · The send, optional

The page has no image of the moment an email is logged, and that moment is the product's
whole claim. This one is worth generating even though no slot exists for it yet: it belongs
beside the mechanism fold.

```
A single message composition panel, seen straight on, floating on a pale
surface with a soft shadow. A slim header strip, then three short stacked field
rows separated by hairlines, then a larger body area holding four or five lines
of abstracted grey text marks of decreasing length. At the bottom right, one
small filled teal button. To the left of the panel and slightly behind it, the
edge of a list of rows is just visible, cut off by the frame. The composition
panel is fully in focus; the list behind it falls very slightly soft.

[INTERFACE BLOCK]
```

### Inspecting these

Reject on any of: a readable word or a letter-shaped mark anywhere, a recognisable logo, a
browser or operating-system window frame, a cursor, more than one accent colour, warm marks
anywhere except lateness, a dashboard look with many coloured chart types, or a perspective
tilt. Straight on, always: a tilted interface mockup is the stock-photo tell.

---

## 11. The hero video, in full

The four generated stills are sequenced as the hero today. This is what replaces them.

### 11.0 The specification

| | |
|---|---|
| Structure | four chained segments, one continuous shot, no cuts anywhere |
| Duration | 6 seconds each, about 24 seconds total, carried across 540vh of pinned scroll |
| Settings | image-to-video, 1080p, standard mode, no audio, no motion presets |
| Start frame | the re-rolled `hero-river` from section 9.5, whose flow axis is vertical |
| Chain | each segment starts from the previous segment's final frame, extracted as a full-quality PNG |
| Ending | composed, at rest, and text-safe top and bottom |

**Why the axis matters more than anything else here.** The hero is scrubbed: scroll position
drives playback position. If the water travels diagonally or upward, scrolling down fights
the picture and the whole hero feels wrong without the visitor being able to say why. Fix
9.5 first. Everything else in this section assumes a strictly vertical current.

**The layout the film must respect.** The words live in the left of the frame the whole way
down. The left third of every frame stays a calm, plain, unbroken surface. The action lives
right of centre. And the last frame keeps its right side quiet and orderly, because the live
outreach-desk panel comes to rest there.

**Nothing in the footage depicts the product.** No screens, no panels, no interface, no
device, no paper, no text. The film is water; the product arrives as real markup on top of
it at the settle.

### 11.1 The negative prompt

Most video models take one. Use it on every segment.

```
text, lettering, numbers, watermark, logo, signage, user interface, screen,
monitor, phone, device, paper, documents, people, hands, faces, boats, bridges,
buildings, wildlife, fish, birds, sun disc, lens flare, colour grading shifts,
cuts, jump cuts, scene changes, camera shake, zoom bursts, speed ramps,
time-lapse, upward motion, diagonal drift, split screen, vignette, cartoon,
illustration, painting, 3d render look, oversaturation
```

### 11.2 Segment one · the current, running

Carries: "Two analysts. One CFO. Same Tuesday."

```
One continuous overhead shot, no cuts, camera locked and perfectly still above
a wide river of pale glacial meltwater. The entire surface travels steadily
downward through the frame, top to bottom, in a straight vertical line, at one
constant unhurried speed that never varies for the whole six seconds. Fine
bright filaments of foam and suspended silt fill the centre and the right of
the frame, and they stay alive the whole way down: they stretch, braid, break
apart and reform as they travel, and no two of them move at quite the same
speed, so the current has depth. Along the left third the water runs shallow
and slack over a pale silt bed, breathing with slow low ripples, never breaking
into whitewater, holding calm for the entire shot. A thin layer of cold vapour
drifts down across the surface at roughly half the speed of the water, so the
frame carries two layers of motion at different rates. Light is cold, flat and
high overcast, and it does not change at any point. The shot ends mid-motion
with the current still running at full speed, the surface unbroken and the
frame still full of travelling filaments.

Photorealistic, cinematic, long lens, shallow atmospheric haze, fine natural
grain, no text or lettering anywhere.
```

### 11.3 Segment two · one sheet per mandate

Start image: segment one's final frame. Carries: "One sheet per mandate is one memory per
mandate."

```
One continuous overhead shot, no cuts, camera still, picking up exactly where
the previous shot left off and continuing the identical downward travel at the
identical speed under the identical cold flat light. In the first two seconds
four long parallel sandbars rise slowly up out of the water from beneath, each
one running vertically with the current from the top of the frame to the
bottom, evenly spaced across the centre and the right. As they surface, water
sheets off their wet dark spines and small standing waves form along their
upstream edges. The river divides around them into four separate channels, and
from that moment each channel carries only its own filaments: nothing crosses
from one channel into the next for the rest of the shot. The slack shallow
along the left third stays calm and clear of the bars throughout. The shot ends
mid-motion, the four channels running separately, the whole surface still
travelling downward.

Photorealistic, cinematic, long lens, shallow atmospheric haze, fine natural
grain, no text or lettering anywhere.
```

### 11.4 Segment three · the whole current, kept

Start image: segment two's final frame. Carries: "Upstream keeps the whole current."

```
One continuous overhead shot, no cuts, camera still, continuing the same
downward travel at the same speed under the same cold flat light. In the first
two seconds the four sandbars sink smoothly back under the surface, as evenly
as they rose, and the water closes over them. As it closes, a sheet of spray
crosses the lens: droplets scatter across the glass, sit there for a beat while
the image goes soft, and then clear completely. Behind the clearing, the four
separate channels have merged into one single deep channel that draws together
toward the centre-right of the frame, and the filaments from all four braid
into one dense fast band of current running vertically down the right of frame.
The shallow along the left third settles back into a smooth still skin of
water. The shot ends mid-motion with the single channel running fast and clean.

Photorealistic, cinematic, long lens, shallow atmospheric haze, fine natural
grain, no text or lettering anywhere.
```

### 11.5 Segment four · the settle

Start image: segment three's final frame. Carries: "Log the email. The rest is derived."
This is the only segment that ends at rest, and its final frame is also the hero poster and
the share card.

```
One continuous overhead shot, no cuts, camera still, continuing the same
downward travel and decelerating smoothly and evenly across the whole six
seconds until the water comes to a complete stop. As it slows, the braided
filaments straighten out of their braid and settle into a neat stack of long
parallel horizontal lines of foam, lying across the current in the right two
thirds of the frame, evenly spaced, coming to rest like ruled lines settling
onto a page. The shallow along the left third arrives at a full mirror
stillness a moment before the rest. The last thing in the frame to stop moving
is one single thin line of rust orange silt near the top of the stack, the only
warm colour anywhere in twenty four seconds, which settles a beat after all the
others. The final frame is completely still: a pale mirror-flat surface, calm
open water across the very top and the very bottom of the frame, the stack of
settled parallel lines held in the right of frame with clear space between
them, and nothing moving but the faintest breath of cold vapour.

Photorealistic, cinematic, long lens, shallow atmospheric haze, fine natural
grain, no text or lettering anywhere.
```

**Why the ending is shaped exactly this way.** The site header sits over the top of the
frame and wide or short screens cover-crop the edges, so the top and bottom carry generous
margin. The settled parallel lines in the right two thirds are where the live outreach-desk
panel comes to rest, so the panel arrives out of the film rather than on top of it, and the
clear space between the lines is what lets it. The single rust line is the overdue row. If
you decide the settle should stand alone with no panel at all, the frame still works: it is
a composed still either way.

### 11.6 If the model only gives you one shot

Some models will not chain well. A single 10 to 12 second take, same laws, compressed:

```
One continuous overhead shot, no cuts, camera locked and still above a wide
river of pale glacial meltwater travelling steadily downward through the frame
in a straight vertical line. It begins as one uncountable current, fine bright
filaments of foam and silt filling the centre and right of frame, the left
third running shallow and slack and calm. A third of the way through, four long
parallel sandbars rise from beneath and divide the river into four separate
channels that cannot mix. Two thirds of the way through, the bars sink back
under, a sheet of spray crosses the lens and clears, and the four channels
merge into one single deep channel. In the last quarter the whole current
decelerates smoothly to a complete stop, and the filaments straighten into a
neat stack of evenly spaced parallel horizontal lines of foam at rest in the
right two thirds of frame, with one single thin line of rust orange silt among
them settling last. The final frame is completely still, mirror flat, with calm
open water across the top and the bottom. The light is cold, flat and high
overcast throughout and never changes.

Photorealistic, cinematic, long lens, shallow atmospheric haze, fine natural
grain, no text or lettering anywhere.
```

### 11.7 Gates, in order

1. Preflight the start frame. Generate it. **Inspect it yourself** before animating: vertical
   axis, calm left third, no dry land, no sun disc, no sneaked-in logo. A bad frame is a
   2-credit fix now or a whole video wasted later.
2. Preflight the same planned shot across the top two or three video models and choose with
   real numbers. The spread on identical parameters has measured about five to one.
3. Generate segment one. Extract its first, middle and last frames and look at all three:
   does the motion read as vertical, is the left third calm, does it end mid-motion.
4. **The video gate.** Save it where it can be double-clicked, outside the deploy folder,
   and watch it before anything is built around it. If a concept fails three attempts, the
   concept is wrong, not the prompt.
5. Chain, gate, repeat. A rejected segment is one cheap re-roll, never a redo of the journey.
6. Join the four **raw** segments in a single encode. Never encode twice, and never join
   clips encoded with different settings, or every seam glitches.
7. Re-encode the joined file for scrubbing with a short keyframe interval (`-g 8`).
8. Poster and share card from the final frame.

### 11.8 What changes in the code when the footage lands

The film component (`components/site/film.tsx`) is what the video replaces, and the swap is
not a drop-in. The scrub pipeline has to be wired properly:

- fetch the encoded file as a Blob, streamed behind a progress ring, because many hosts
  silently lack HTTP Range support and without it every seek clamps to zero: it works
  perfectly on localhost and does nothing on the live site,
- gate the seeks so two never overlap, with the busy flag reset on error so the gate cannot
  deadlock,
- keep the existing dt-normalised lerp, the delta-gated writes, the four-layer legibility
  system and all five static-hero gates exactly as they are,
- keep the filament canvas as the overlay: it is what holds the frame alive at any playback
  position and it still resolves into the queue's rows at the settle.
