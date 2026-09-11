# Upstream — video jobs, continued

An add-on to `prompts-batch.md`. Same schema, same rules, numbering continues from JOB 19.

JOBS 20 to 23 animate the four fold stills so every fold moves, not just the hero. They are
BACKGROUNDS: text is read over them. Every one of them is deliberately slower than feels
right in isolation. If a clip is interesting on its own, it is too strong for the page.

Paste this block after the first brief, or on its own.

---

UPSTREAM ASSET GENERATION BRIEF, PART TWO — 4 JOBS

Execute JOB 20 through JOB 23 IN ORDER, one at a time. Same reading rules as part one:
everything between "PROMPT >>>" and "<<< END PROMPT" is used verbatim, everything between
"NEGATIVE >>>" and "<<< END NEGATIVE" goes in the negative prompt field, and each job's
START IMAGE is a file produced earlier.

STANDING RULES FOR ALL FOUR
  Image-to-video, 1080p, 6 seconds, standard mode, no audio, no motion preset.
  The camera NEVER moves: no pan, no tilt, no zoom, no push, no drift, no parallax.
  There is no cut, no transition and no scene change at any point.
  The light does not change: same colour, same direction, same intensity, start to end.
  Nothing enters the frame and nothing leaves it.
  The motion is barely perceptible. A viewer glancing at a single second should not be
  certain the picture is moving at all.
  The shot ends as quietly as it began, still in motion, never freezing.

================================================================ JOB 20
TYPE: video
ASPECT: 16:9
SIZE: 1080p
LENGTH: 6 seconds
OUTPUT: cost-loop.mp4
START IMAGE: cost.jpg (JOB 02)
OPTIONAL: no
USE: behind the turn fold

PROMPT >>>
One continuous overhead shot, no cuts, camera locked and completely still. The fast current
on the right of frame keeps travelling, its fine filaments of foam stretching, braiding and
reforming as they pass, but the whole surface moves slowly, at a fraction of the speed it
looks capable of. Along the soft diagonal shear where the fast water meets the slack water,
a few filaments peel away from the current, cross the shear line, and slow almost to a stop
in the still water on the left, where they thin out, go grey and dissolve into the pale
suspended silt until nothing is left of them. Two or three do this over the six seconds,
one after another, unhurried. The slack water on the left barely moves at all: it breathes,
and nothing more. The light stays cold and flat and does not change. The shot ends with the
current still running and one filament still dissolving.

Photorealistic, cinematic, long lens, shallow atmospheric haze, fine natural grain, no text
or lettering anywhere.
<<< END PROMPT

NEGATIVE >>>
text, lettering, numbers, watermark, logo, signage, user interface, screen, device, paper,
people, hands, faces, boats, bridges, buildings, wildlife, fish, birds, sun disc, lens
flare, colour grading shifts, cuts, jump cuts, scene changes, camera movement, camera
shake, pan, tilt, zoom, push in, dolly, parallax, speed ramps, time-lapse, rapids, crashing
waves, splashing, split screen, vignette, cartoon, illustration, painting, 3d render look,
oversaturation
<<< END NEGATIVE

REJECT IF: the camera moves at all; the water reads as rapids or churns; the shear line
itself moves across the frame; the left side is not almost perfectly still; the clip is
eventful enough to pull the eye off text laid over it.

================================================================ JOB 21
TYPE: video
ASPECT: 16:9
SIZE: 1080p
LENGTH: 6 seconds
OUTPUT: mechanism-loop.mp4
START IMAGE: mechanism.jpg (JOB 03)
OPTIONAL: no
USE: behind the mechanism fold. This is the one clip on the page that is an argument: one
     act, and everything that follows from it.

PROMPT >>>
One continuous overhead shot, no cuts, camera locked and completely still above a shallow
pale pool. The frame opens on the instant after a single drop has struck: a small crown of
water stands at the point of impact. Over the six seconds the crown collapses gently back
into the surface, and the concentric rings already on the water travel outward, each one
widening and fading as it goes, the outermost passing out of the frame, one ring following
another in an even unhurried sequence. As the last rings pass, the surface behind them
returns to perfect untouched glass. Nothing else disturbs the water. No second drop falls.
The pale silt floor beneath the water stays in focus and does not move. The light is even,
cold and flat and does not change. The shot ends with the last ring still spreading and the
centre of the pool already returned to stillness.

Photorealistic, cinematic, long lens, shallow atmospheric haze, fine natural grain, no text
or lettering anywhere.
<<< END PROMPT

NEGATIVE >>>
text, lettering, numbers, watermark, logo, signage, user interface, screen, device, paper,
people, hands, faces, rain, multiple drops, downpour, splashing, boats, wildlife, fish,
birds, sun disc, lens flare, colour grading shifts, cuts, jump cuts, scene changes, camera
movement, camera shake, pan, tilt, zoom, push in, dolly, parallax, speed ramps, time-lapse,
split screen, vignette, cartoon, illustration, painting, 3d render look, oversaturation
<<< END NEGATIVE

REJECT IF: a second drop falls, or rain starts; the rings collapse inward instead of
spreading outward; the camera moves; the surface does not return to stillness behind the
rings; the crown re-forms.

================================================================ JOB 22
TYPE: video
ASPECT: 16:9
SIZE: 1080p
LENGTH: 6 seconds
OUTPUT: record-loop.mp4
START IMAGE: record.jpg (JOB 04)
OPTIONAL: no
USE: behind the record fold

PROMPT >>>
One continuous underwater shot, no cuts, camera locked and completely still. The two plumes
of suspended silt keep flowing slowly toward the point where they meet, and where they meet
they braid: fine granular sediment from the left plume folds into sediment from the right,
turning over itself in slow heavy curls, and the single joined plume carries on away from
the camera into the deep water beyond. The movement is thick and slow, the way sediment
moves in cold water, never fast and never wispy. Individual particles drift through the
weak shafts of light coming down from far above. The shafts themselves shift only very
slightly. The water is otherwise still and the light does not change. The shot ends with
the plumes still braiding.

Photorealistic, cinematic, long lens, shallow atmospheric haze, fine natural grain, no text
or lettering anywhere.
<<< END PROMPT

NEGATIVE >>>
text, lettering, numbers, watermark, logo, signage, user interface, screen, device, paper,
people, divers, hands, faces, boats, wildlife, fish, birds, bubbles rising, smoke, ink in
water, sun disc, lens flare, colour grading shifts, cuts, jump cuts, scene changes, camera
movement, camera shake, pan, tilt, zoom, push in, dolly, parallax, speed ramps, time-lapse,
split screen, vignette, cartoon, illustration, painting, 3d render look, oversaturation
<<< END NEGATIVE

REJECT IF: the sediment moves like smoke or ink rather than like heavy silt; the two plumes
stop being distinguishable before they meet; the camera moves; bubbles rise through the
frame; the plumes disperse completely before the six seconds are up.

================================================================ JOB 23
TYPE: video
ASPECT: 16:9
SIZE: 1080p
LENGTH: 6 seconds
OUTPUT: access-loop.mp4
START IMAGE: access.jpg (JOB 05)
OPTIONAL: no
USE: as the band across the top of the access fold

PROMPT >>>
One continuous underwater shot looking straight up, no cuts, camera locked and completely
still. The underside of the surface far above ripples very slowly, its pale luminous sheet
flexing and re-forming as long low swells pass across it, so the light coming through
shifts gently and unevenly across the top of the frame. In the dark water below, the fine
suspended particles of silt drift downward almost imperceptibly, catching the last of the
light as they fall and disappearing into the black-green depth. Nothing swims, nothing
rises, nothing breaks the surface. The overall brightness does not change. The shot ends
with the surface still flexing and the particles still drifting.

Photorealistic, cinematic, long lens, shallow atmospheric haze, fine natural grain, no text
or lettering anywhere.
<<< END PROMPT

NEGATIVE >>>
text, lettering, numbers, watermark, logo, signage, user interface, screen, device, paper,
people, divers, hands, faces, boats, hulls, wildlife, fish, birds, bubbles rising, rain
hitting the surface, sun disc, sunbeams as hard rays, lens flare, colour grading shifts,
cuts, jump cuts, scene changes, camera movement, camera shake, pan, tilt, zoom, push in,
dolly, parallax, speed ramps, time-lapse, split screen, vignette, cartoon, illustration,
painting, 3d render look, oversaturation
<<< END NEGATIVE

REJECT IF: anything breaks the surface from above; bubbles rise; the ripple is fast enough
to read as choppy water; the camera moves; the frame gets brighter or darker overall.

================================================================ END OF PART TWO

DELIVER: four video files, named exactly as each job's OUTPUT line says.

---

## What these cost the page, and the rule that pays for it

Four background clips is four more video files on a marketing page. They earn their place
only if they are loaded the way the closing clip already is:

- never for reduced motion, never for a coarse pointer, never on a metered connection,
- `preload="none"` until those checks pass,
- started by an IntersectionObserver when the fold arrives, not at page load,
- played once and left resting, with the still underneath them as the true state,
- and the fold complete and correct if the clip never arrives at all.

Anything less and they are four megabytes of decoration charged to a visitor's phone plan.
