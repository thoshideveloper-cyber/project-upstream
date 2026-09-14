# The hero film — what to generate, and why the last one failed

The hero is not a background. Scroll position is the playhead: the reader's
scroll drives the film frame by frame, forwards and backwards, and each frame is
looked at as a still. That makes the requirements unusual and strict. Read the
diagnosis before the prompt — three of the four faults are not resolution.

## What is wrong with the take we have

Measured, not guessed.

**1. It carries the generator's watermark.** A four-pointed sparkle burned into
every frame at (1182, 620), confirmed by averaging all 240 frames — it survives
the average, so it is in every one. It was also in `hero-film-poster.jpg` and
`scene/hero-river.jpg`, which means it was on the phone hero and the share card
too. **No prompt removes this.** It is the free tier's stamp. Generating on a
paid tier is the only fix. (Cropped out for now, at the cost of 10% of frame.)

**2. The camera is not locked off.** It is a travelling drone shot: the terrain
translates through frame. A moving camera fights a scroll-driven playhead — the
reader scrolls to move time, and the picture is already moving without them.

**3. The beats run in the wrong order, and repeat.** The film goes undivided →
four bars → undivided → bars again. The page argues the opposite, and only once:
separate → more separate → merging → one. The `CUE` table in `hero.tsx` is seven
hand-placed (scroll, film-time) pairs that pick around the footage to hide this.
Footage cut to the beats would not need it.

**4. It is 1280×720, and low-detail even for 720p.** The hero puts it on a
1440×900 retina screen at roughly 2.5× blow-up. The water has no fine structure
to survive that — no standing waves, no foam lines, just a smear.

## Settings

Silent, 16:9, 10 seconds. Audio off always: the element is muted, and audio only
adds weight. Priced from the account on 2026-08-25:

| Model | Resolution | Credits |
|---|---|---|
| MiniMax H3 | 2K (2560×1440) | **40** |
| Seedance 2.0 (std, bitrate high) | 1080p | 90 |
| Seedance 2.0 (std, bitrate high) | 4K | 220 |

The hero needs about 3200px of source width to fully cover a retina 1440 screen,
so 4K covers it outright and 2K covers about 80% — still double what we have. On
a 1× or 1.5× laptop, 2K is already more than enough. **MiniMax H3 at 2K is the
value pick; Seedance at 4K is the right one if the budget is there.** Generate
two variants — beat order is what models get wrong, and a second roll is cheaper
than a re-prompt.

## Prompt A — "the braid closes"

Cut to the four bands of copy that scroll over it. This is the direct
replacement: it keeps every wire in the page as it is.

> Locked-off overhead aerial. Single unbroken 10-second take.
>
> A wide braided glacial river seen from directly above, perfectly top-down,
> filling the frame. The camera is bolted in place — mounted, not flown. Over
> the full ten seconds it does not push in, pull out, pan, tilt, roll, orbit or
> drift by a single pixel. No parallax, no handheld float, no drone movement.
> The edges of the frame hold absolutely still; only the water inside them
> changes.
>
> Composition: the left third of the frame is open, uninterrupted meltwater —
> smooth, pale, no sediment bars, no dark shapes, nothing structural. All
> structure sits in the centre and right two thirds.
>
> Colour: cold glacial. Deep channels are dark slate-teal, almost petrol
> (#0f2b2b). The water between them is pale mineral grey-green, milky with rock
> flour (#dbe6e3). The exposed sediment bars are dry bone and cool sand
> (#e8ede9) — clearly LIGHTER than the water, so every bar reads as a hard
> bright shape against a dark channel. Strong tonal separation between water and
> land. Flat overcast Icelandic daylight. No sun glare, no hard shadows, no
> golden hour, no warm light.
>
> The ten seconds, in this order, moving only in this direction:
>
> 0–2s: Four distinct parallel channels run the length of the frame, cleanly
> separated by four long sharp-edged sediment bars. Four separate rivers, not
> one. Each channel carries its own current and its own standing waves. The bars
> are wide, dry, and clearly above water.
>
> 2–4s: The separation deepens. The bars grow more defined, the channels narrow
> and run faster, white standing waves and foam lines build along each bar's
> edge. Four systems, further apart than before.
>
> 4–6.5s: The water rises. The bars submerge from their downstream ends,
> smoothly and continuously. As each bar drowns, the two channels either side
> merge into one wider flow. The merging is gradual and unmistakable.
>
> 6.5–8.5s: The last bar goes under. One single wide current now fills the whole
> frame, moving as one body.
>
> 8.5–10s: The single current settles. Its surface calms into long parallel
> evenly spaced flow lines running the length of the frame like ruled lines. One
> strand of oxidised iron sediment — clear rust orange (#c2410c) — threads
> through the settled current just right of centre, distinct against the teal.
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
> letterbox, blur, soft focus, motion blur, low resolution, sunset, golden hour,
> warm light, harsh shadows

## Prompt B — "the confluence", if A comes back wrong twice

A different direction, same argument. Two rivers of different colour meet and
run side by side, each still traceable, before becoming one body of water. It
says the record fold's line — one name, two mandates, one history — more
literally than the braid does. Costs a new `CUE` table, a new poster and a new
fold still, so it is the fallback, not the default.

> Locked-off overhead aerial. Single unbroken 10-second take. Fixed camera,
> perfectly top-down, no movement of any kind for the entire shot.
>
> The confluence of two rivers. From the left, a pale mineral grey-green glacial
> river milky with rock flour (#dbe6e3). From the right, a darker slate-teal
> river running clear and deep (#0f2b2b). They meet in the centre of frame.
>
> 0–2.5s: The two rivers run separately, a hard clean line where they touch,
> neither mixing into the other. Two distinct bodies of water.
>
> 2.5–6s: They begin to braid at the seam. Fingers of each colour reach into the
> other, marbling along the boundary, but both colours stay readable — you can
> still see which water came from which river.
>
> 6–10s: They become one body, a single settled current carrying both, its
> surface calming into long parallel flow lines running the length of the frame.
> The two origins remain faintly traceable as strands within the one river.
>
> Flat overcast daylight, no sun glare, no shadows. Razor sharp, deep focus,
> fine surface detail — standing waves, foam lines, sediment plumes. The left
> third of frame is open, calm water with no strong dark shapes.
>
> Nothing else in frame: no people, no boats, no birds, no buildings, no text,
> no logos, no graphics, no lens flare, no vignette, no grain.

Use the same negative prompt.

## Checking what comes back

Before it is worth wiring in, hold the first and last frame side by side:

1. **Does the frame edge hold still?** Any terrain sliding through frame and it
   is a fly-over, not a locked-off shot. This is the one models fail most.
2. **Does it go many to one, once?** Scrub it by hand. If it re-divides or
   repeats, reject it — the copy will not sit on it.
3. **Any watermark?** Average the frames; a stamp survives the average.
4. **Is the left third quiet?** The copy sits there under a mist veil. A strong
   dark shape at left fights the type.
5. **Do the bars read lighter than the water?** If they are the same value, the
   divided-versus-merged read is invisible at hero scale.

Hand over the raw file. From there: re-cut the `CUE` table to the real beats (or
delete it, if the beats land where the copy does), re-encode all-intra at 16fps,
re-cut the poster, the fold still and the share card from the same film, then
re-measure contrast, scroll and the sweep.

## The encode, once there is new footage

The film is scrubbed, never played, so a frame is read as a still. Trading frame
rate for per-frame detail is therefore strictly correct, and measured:

| encode | SSIM vs source | size | frames |
|---|---|---|---|
| 24fps crf26 (what shipped) | 0.9707 | 4.62 MB | 240 |
| **16fps crf23** | **0.9809** | **4.54 MB** | 160 |
| 12fps crf21 | 0.9862 | 4.52 MB | 120 |

16fps is the knee: sharper and smaller than 24fps, and still a new frame every
18px of scroll. 12fps is sharper again but steps visibly under a slow trackpad
drag. All-intra is non-negotiable — every frame a keyframe, so a seek decodes
exactly one picture.

    ffmpeg -i SOURCE.mp4 -an -vf "fps=16" -c:v libx264 -preset veryslow -crf 23 \
      -g 1 -keyint_min 1 -sc_threshold 0 -pix_fmt yuv420p -movflags +faststart \
      public/hero-film.mp4

Keep `FRAME` in `components/site/hero.tsx` in step with the frame rate — the
seek gate drops requests closer together than half a frame, and a stale constant
either wastes decodes or skips pictures.

---

## Resolved (2026-08-25) — real footage swapped in

The generation prompts above were never spent — before generating anything, a
real 4K aerial clip was found on Pexels that fits without any of the four
faults this brief diagnosed: **"Iceland's Winter Aerial Views of Icy River"**
by Sergey Guk (https://www.pexels.com/video/29454566/), Pexels License (free
for commercial use, no attribution required; credited anyway). A single
locked-off top-down shot of a braided glacial delta, no camera movement across
its full length, no watermark (checked by averaging 100 frames — nothing
survives), and sharp at native 2560x1440.

Trimmed to a clean 10s window (3s-13s, visually identical framing throughout),
re-encoded all-intra at 896px wide / 16fps / crf20 — 6.0MB, SSIM 0.971 against
the 4K source. That is heavier than the AI clip's 4.5MB because real footage
carries fine detail everywhere in frame, not just at a focal point, and
compresses worse. Worth it: nothing in this file needs the encode's SSIM to be
read charitably.

**One structural consequence:** this footage is not cut to a narrative. It is
one locked frame with only the current moving — nothing divides, nothing
merges. The `CUE` table in `hero.tsx`, which existed entirely to hide the old
clip's wrong beat order, is now identity: `p` maps straight to film time. If a
future clip is shot or generated to the four-beat script, that is where the
remap goes back in.

The generation prompts (both 16:9 and the 3:4 portrait variant for the split
hero) are left in place above — they're the right prompts if a narrative take
is ever wanted, and the diagnosis of what to check for is unchanged.
