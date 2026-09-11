# Upstream — the batch brief

One block, pasted once. Every job is self-contained. If your generator has an input limit,
paste JOBS 01 to 13 (images) first and JOBS 14 to 19 (video) second; nothing in the second
half needs text from the first, only the image files it produced.

---

UPSTREAM ASSET GENERATION BRIEF — 19 JOBS

Read this whole brief first, then execute JOB 01 through JOB 19 IN ORDER, one job at a
time. Do not merge jobs. Do not run them in parallel. Finish and save each job's output
before starting the next.

HOW TO READ A JOB
  Each job begins with a line of equals signs and its number.
  TYPE        image or video
  ASPECT      the aspect ratio to generate at
  SIZE        the target pixel size
  OUTPUT      the filename to save as
  START IMAGE the file this job must be generated FROM, or "none"
  OPTIONAL    if yes, skip this job unless asked for it
  PROMPT      everything between "PROMPT >>>" and "<<< END PROMPT", used verbatim
  NEGATIVE    everything between "NEGATIVE >>>" and "<<< END NEGATIVE", into the
              negative prompt field. Video jobs only.
  REJECT IF   inspect the result against this list before moving to the next job. If it
              fails, regenerate the SAME job with the SAME prompt. Do not edit the prompt
              unless three attempts have failed.

STANDING RULES FOR EVERY JOB
  Use the prompt exactly as written. Do not summarise it, rewrite it, or add to it.
  Decline any preset, style filter or "enhance prompt" suggestion the tool offers.
  Video jobs: image-to-video, 1080p, 6 seconds, standard mode, no audio, no motion preset.
  Never render text, letters, numbers, logos or watermarks in any output.
  If a job's START IMAGE is a video, it means that video's FINAL frame, extracted as a
  full-quality PNG before this job runs.

================================================================ JOB 01
TYPE: image
ASPECT: 16:9
SIZE: 2048 x 1152
OUTPUT: hero-river.jpg
START IMAGE: none
OPTIONAL: no
NOTE: This is the most important frame in the set. Four video jobs start from it.

PROMPT >>>
A wide river of pale glacial meltwater seen from directly overhead, running strictly from
the top of the frame to the bottom, with the direction of travel unmistakably vertical and
no diagonal drift. The water fills the frame edge to edge and there is no dry land
anywhere. Along the left the river runs shallow and slack over a pale silt bed, a smooth
unbroken skin of water. Toward the centre and the right it quickens into countless fine
bright filaments of foam and suspended silt, all drawn out vertically, too many to count,
one single current rather than separate channels. One thin thread of rust-orange silt runs
among them right of centre, the only warm colour in the frame. Thin cold vapour drifts
across the surface. Generous calm water across the very top and the very bottom of the
frame.

Colours are the materials themselves and nothing else: chilled mist grey-green water, wet
slate stone, pale silt, dark oxidised copper green in the deep water, and at most one
thread of rust-orange. Light is cold, low and flat: a high overcast with no sun disc and no
lens flare. Photorealistic, cinematic, shot on a long lens, fine natural grain. No text, no
logos, no lettering, no watermarks, no numbers, no UI anywhere in frame. No people, no
boats, no bridges, no buildings, no wildlife.
<<< END PROMPT

REJECT IF: the flow reads diagonal or horizontal rather than top to bottom; there is dry
land, a bank or a shoreline; the left third is not calm; there is a sun disc or a flare;
there is more than one warm thread.

================================================================ JOB 02
TYPE: image
ASPECT: 16:9
SIZE: 2048 x 1152
OUTPUT: cost.jpg
START IMAGE: none
OPTIONAL: no

PROMPT >>>
A river of pale glacial meltwater seen from directly overhead, filling the frame edge to
edge with water and nothing else. No rock, no bank, no moss, no vegetation anywhere in
frame. Along the right the main current runs fast, full of fine bright filaments of foam
drawn out in the direction of travel. Along the left the water slackens into a wide still
eddy where a few of those filaments have peeled away from the current: they are thinning,
going grey and dissolving into pale suspended silt until nothing is left of them. The
change from fast water to slack water is a soft diagonal shear across the middle of the
frame, a gradual blending of two textures, never a hard edge or a step. The whitewater is
fine and low-contrast, more texture than spray.

Colours are the materials themselves and nothing else: chilled mist grey-green water, wet
slate stone, pale silt, dark oxidised copper green in the deep water, and at most one
thread of rust-orange. Light is cold, low and flat: a high overcast with no sun disc and no
lens flare. Photorealistic, cinematic, shot on a long lens, fine natural grain. No text, no
logos, no lettering, no watermarks, no numbers, no UI anywhere in frame. No people, no
boats, no bridges, no buildings, no wildlife.
<<< END PROMPT

REJECT IF: any rock, moss, bank or vegetation appears; the fast and slack water are
separated by a hard edge or a ledge rather than a soft shear; the whitewater is loud and
high-contrast.

================================================================ JOB 03
TYPE: image
ASPECT: 16:9
SIZE: 2048 x 1152
OUTPUT: mechanism.jpg
START IMAGE: none
OPTIONAL: no

PROMPT >>>
A single drop of water striking the surface of a still, shallow, pale pool seen from
directly overhead, caught an instant after impact. Water fills the frame edge to edge: no
rock, no rim, no bank, no vegetation, nothing but water and the pale silt floor beneath it.
One small crown at the point of impact, slightly off centre, and four clean concentric
rings spreading outward from it, each wider and fainter than the last, the outermost
reaching almost to the edges of the frame. Even flat overcast light across the whole
surface with no bright highlight and no vignette in the corners. The rest of the surface is
untouched glass.

Colours are the materials themselves and nothing else: chilled mist grey-green water, wet
slate stone, pale silt, dark oxidised copper green in the deep water, and at most one
thread of rust-orange. Light is cold, low and flat: a high overcast with no sun disc and no
lens flare. Photorealistic, cinematic, shot on a long lens, fine natural grain. No text, no
logos, no lettering, no watermarks, no numbers, no UI anywhere in frame. No people, no
boats, no bridges, no buildings, no wildlife.
<<< END PROMPT

REJECT IF: rock or a pool rim frames the water; there are fewer than four rings; the rings
stop short of the outer half of the frame; there is a bright specular hotspot or a dark
vignette in the corners.

================================================================ JOB 04
TYPE: image
ASPECT: 16:9
SIZE: 2048 x 1152
OUTPUT: record.jpg
START IMAGE: none
OPTIONAL: no

PROMPT >>>
Seen from underwater, looking along two currents where they meet and become one. Two plumes
of suspended silt, one entering from the left and one from the right, braid together into a
single plume that continues away from the camera deep into black-green water and stays
visible far into the distance, longer than the two plumes that made it. The silt is fine
and granular and slightly translucent, made of countless individual particles, never smooth
or woolly or smoke-like. The silt is cold pale grey-green, not warm and not tan. Weak
shafts of cold daylight come down from the surface far above. Everything else is deep
green-black.

Colours are the materials themselves and nothing else: chilled mist grey-green water, wet
slate stone, pale silt, dark oxidised copper green in the deep water, and at most one
thread of rust-orange. Light is cold, low and flat: a high overcast with no sun disc and no
lens flare. Photorealistic, cinematic, shot on a long lens, fine natural grain. No text, no
logos, no lettering, no watermarks, no numbers, no UI anywhere in frame. No people, no
boats, no bridges, no buildings, no wildlife.
<<< END PROMPT

REJECT IF: the plumes read as smoke, wool or cotton rather than granular sediment; the silt
is warm, tan or brown; the single joined plume is shorter than the two that formed it; the
water is blue rather than green-black.

================================================================ JOB 05
TYPE: image
ASPECT: 16:9
SIZE: 2048 x 1152
OUTPUT: access.jpg
START IMAGE: none
OPTIONAL: no

PROMPT >>>
Seen from deep underwater, looking straight up at the underside of a calm river surface far
above. The surface is a pale, cold, luminous sheet seen from beneath, rippling very
slightly, filling the upper third of the frame. Below it the water falls away into dense
black-green, but it is not empty: fine particles of silt hang suspended all through it,
catching the last of the light and thinning out with depth, so the darkness has body and
distance in it rather than reading as flat black. No vignette in the corners.

Colours are the materials themselves and nothing else: chilled mist grey-green water, wet
slate stone, pale silt, dark oxidised copper green in the deep water, and at most one
thread of rust-orange. Light is cold, low and flat: a high overcast with no sun disc and no
lens flare. Photorealistic, cinematic, shot on a long lens, fine natural grain. No text, no
logos, no lettering, no watermarks, no numbers, no UI anywhere in frame. No people, no
boats, no bridges, no buildings, no wildlife.
<<< END PROMPT

REJECT IF: the lower two thirds is flat featureless black with no suspended particles; the
surface fills more than the upper half; the water reads as open sea rather than river; the
corners are vignetted.

================================================================ JOB 06
TYPE: image
ASPECT: 1.6:1
SIZE: 1200 x 750
OUTPUT: master.png
START IMAGE: none
OPTIONAL: no

PROMPT >>>
A data register table filling the frame, seen straight on. A slim header strip across the
top with a title on the left and two small pill controls on the right, one of them filled
in the teal accent. Below it a filter row: a wide search field, two dropdown controls and a
small control group, all outlined, none filled. Then the table: six columns of unequal
width, a light column header row, and about ten data rows separated by hairlines. The
leftmost column is widest and each of its cells holds two stacked marks, a bold one above a
lighter one, like a name above a location. Two of the columns on the right are narrow and
right-aligned, as numbers would be. A handful of small outlined tags sit inside the left
column's cells. Nothing is highlighted, nothing is selected, and the whole table is calm
and evenly spaced.

A clean product interface rendering, shot straight on, filling the frame. The surface is a
very pale cool grey-green, almost white, with hairline dividers and generous even spacing.
Ink is a deep petrol, near black with a green cast. One single accent, a deep teal, used
only on the few live controls. One single warm mark, a rust orange, used only where
something is late. Soft even light, a faint drop shadow under raised panels, gentle rounded
corners of about six pixels, no glass, no gloss, no gradients on the panels themselves.
Every piece of label text and every number is rendered as soft abstracted grey marks at the
size and rhythm of real words: short bars, dashes and dots. There are no readable
letterforms anywhere in the image, no lettering, no logos, no brand marks, no icons of
known companies, no watermarks, no cursor, no browser chrome, no window controls, no
operating system furniture. Photorealistic interface design mockup, high resolution.
<<< END PROMPT

REJECT IF: any readable word or letter-shaped mark appears anywhere; a browser or operating
system window frame is drawn; a cursor appears; the mockup is tilted in perspective rather
than straight on; more than one accent colour is used.

================================================================ JOB 07
TYPE: image
ASPECT: 1.6:1
SIZE: 1200 x 750
OUTPUT: schedule.png
START IMAGE: none
OPTIONAL: no

PROMPT >>>
A task queue interface filling the frame, seen straight on. Across the top, a horizontal
strip divided into eight equal cells by hairlines, each holding a small label mark above a
large number mark, like a row of days; the second cell carries a rust orange number and a
thin rust underline, and one cell near the right is marked with a teal underline. Below the
strip, one row is promoted above the others: it sits on a very pale warm tint, is slightly
taller, and carries a filled rust orange pill button on its right end. Under it, a list of
about six rows separated by hairlines. Each row begins with a small right-aligned number in
rust orange, then two stacked text marks, and ends with a small outlined pill button. The
rust orange numbers get smaller down the list. Everything else on the screen is grey and
quiet, so the warm marks are the only colour that pulls the eye.

A clean product interface rendering, shot straight on, filling the frame. The surface is a
very pale cool grey-green, almost white, with hairline dividers and generous even spacing.
Ink is a deep petrol, near black with a green cast. One single accent, a deep teal, used
only on the few live controls. One single warm mark, a rust orange, used only where
something is late. Soft even light, a faint drop shadow under raised panels, gentle rounded
corners of about six pixels, no glass, no gloss, no gradients on the panels themselves.
Every piece of label text and every number is rendered as soft abstracted grey marks at the
size and rhythm of real words: short bars, dashes and dots. There are no readable
letterforms anywhere in the image, no lettering, no logos, no brand marks, no icons of
known companies, no watermarks, no cursor, no browser chrome, no window controls, no
operating system furniture. Photorealistic interface design mockup, high resolution.
<<< END PROMPT

REJECT IF: any readable word or letter-shaped mark appears; the warm colour spreads beyond
the lateness marks and the one promoted row; a browser frame, cursor or window control is
drawn; the mockup is tilted.

================================================================ JOB 08
TYPE: image
ASPECT: 1.6:1
SIZE: 1200 x 750
OUTPUT: analytics.png
START IMAGE: none
OPTIONAL: no

PROMPT >>>
An analytics screen filling the frame, seen straight on. A slim title strip at the top with
a small outlined dropdown control on the right. Below it, a row of four equal stat cards
separated by hairlines, each holding a small label mark at the top, a large number mark
below it, and a tiny sparkline in the corner; the sparklines are thin, one teal and one
rust orange. Under the cards, one wide chart panel occupying most of the frame: a smooth
filled area curve in warm rust orange rising through the middle and falling toward the
right, with a thin flat teal line running low across the whole width beneath it, over a
faint horizontal gridline set, with small axis marks along the bottom. Below the chart, a
strip divided into three comparison cells. The palette is restrained: one warm curve, one
cool line, everything else grey.

A clean product interface rendering, shot straight on, filling the frame. The surface is a
very pale cool grey-green, almost white, with hairline dividers and generous even spacing.
Ink is a deep petrol, near black with a green cast. One single accent, a deep teal, used
only on the few live controls. One single warm mark, a rust orange, used only where
something is late. Soft even light, a faint drop shadow under raised panels, gentle rounded
corners of about six pixels, no glass, no gloss, no gradients on the panels themselves.
Every piece of label text and every number is rendered as soft abstracted grey marks at the
size and rhythm of real words: short bars, dashes and dots. There are no readable
letterforms anywhere in the image, no lettering, no logos, no brand marks, no icons of
known companies, no watermarks, no cursor, no browser chrome, no window controls, no
operating system furniture. Photorealistic interface design mockup, high resolution.
<<< END PROMPT

REJECT IF: any readable word or number appears; the screen reads as a busy multi-coloured
dashboard with pie charts or many chart types; a browser frame or cursor is drawn; the
mockup is tilted.

================================================================ JOB 09
TYPE: image
ASPECT: 1.6:1
SIZE: 1200 x 750
OUTPUT: send.png
START IMAGE: none
OPTIONAL: yes

PROMPT >>>
A single message composition panel, seen straight on, floating on a pale surface with a
soft shadow. A slim header strip, then three short stacked field rows separated by
hairlines, then a larger body area holding four or five lines of abstracted grey text marks
of decreasing length. At the bottom right, one small filled teal button. To the left of the
panel and slightly behind it, the edge of a list of rows is just visible, cut off by the
frame. The composition panel is fully in focus; the list behind it falls very slightly
soft.

A clean product interface rendering, shot straight on, filling the frame. The surface is a
very pale cool grey-green, almost white, with hairline dividers and generous even spacing.
Ink is a deep petrol, near black with a green cast. One single accent, a deep teal, used
only on the few live controls. One single warm mark, a rust orange, used only where
something is late. Soft even light, a faint drop shadow under raised panels, gentle rounded
corners of about six pixels, no glass, no gloss, no gradients on the panels themselves.
Every piece of label text and every number is rendered as soft abstracted grey marks at the
size and rhythm of real words: short bars, dashes and dots. There are no readable
letterforms anywhere in the image, no lettering, no logos, no brand marks, no icons of
known companies, no watermarks, no cursor, no browser chrome, no window controls, no
operating system furniture. Photorealistic interface design mockup, high resolution.
<<< END PROMPT

REJECT IF: any readable word appears; an email client's real interface is imitated; a
browser frame, cursor or window control is drawn; the panel is tilted.

================================================================ JOB 10
TYPE: image
ASPECT: 16:9
SIZE: 2048 x 1152
OUTPUT: current-still.jpg
START IMAGE: none
OPTIONAL: no
NOTE: JOB 19 is generated from this frame.

PROMPT >>>
The surface of a wide river of pale glacial meltwater seen from directly overhead, calm and
open, moving so slowly it is almost still. A few long filaments of foam and silt lie
stretched along the direction of travel, well spaced, with clear plain water between them.
Thin cold vapour sits on the surface. Even flat light across the whole frame, with no
bright highlight in the centre where a headline will sit.

Colours are the materials themselves and nothing else: chilled mist grey-green water, wet
slate stone, pale silt, dark oxidised copper green in the deep water, and at most one
thread of rust-orange. Light is cold, low and flat: a high overcast with no sun disc and no
lens flare. Photorealistic, cinematic, shot on a long lens, fine natural grain. No text, no
logos, no lettering, no watermarks, no numbers, no UI anywhere in frame. No people, no
boats, no bridges, no buildings, no wildlife.
<<< END PROMPT

REJECT IF: the centre of the frame carries a bright highlight; the water is busy rather
than calm and open.

================================================================ JOB 11
TYPE: image
ASPECT: 16:9
SIZE: 2048 x 1152
OUTPUT: hero-poster.jpg
START IMAGE: none
OPTIONAL: yes
NOTE: Skip if JOB 17 is being run. Extract that video's final frame instead.

PROMPT >>>
A wide river of pale glacial meltwater seen from directly overhead, come completely to
rest. The surface is mirror-flat. In the right two-thirds of the frame a neat stack of long
parallel horizontal lines of foam lies across the water, evenly spaced and perfectly
settled, with clear space between them. Along the left the water is a smooth unbroken skin
over a pale silt bank, calm and plain. One single thin line of rust-orange silt sits near
the top of the stack, the only warm colour in the frame. Generous calm water across the
very top and the very bottom. The faintest breath of cold vapour.

Colours are the materials themselves and nothing else: chilled mist grey-green water, wet
slate stone, pale silt, dark oxidised copper green in the deep water, and at most one
thread of rust-orange. Light is cold, low and flat: a high overcast with no sun disc and no
lens flare. Photorealistic, cinematic, shot on a long lens, fine natural grain. No text, no
logos, no lettering, no watermarks, no numbers, no UI anywhere in frame. No people, no
boats, no bridges, no buildings, no wildlife.
<<< END PROMPT

REJECT IF: the water is still moving or churned; the settled lines are not evenly spaced or
have no clear space between them; the top or bottom of the frame is crowded.

================================================================ JOB 12
TYPE: image
ASPECT: 9:16
SIZE: 1152 x 2048
OUTPUT: hero-poster-portrait.jpg
START IMAGE: none
OPTIONAL: no

PROMPT >>>
A river of pale glacial meltwater seen from directly overhead in a tall vertical frame,
come completely to rest. The upper half of the frame is a smooth unbroken skin of still
water over a pale silt bank, plain and calm. In the lower half a neat stack of long
parallel horizontal lines of foam lies settled across the water, evenly spaced, with one
single thin line of rust-orange silt among them, the only warm colour in the frame.
Mirror-flat surface, the faintest breath of cold vapour.

Colours are the materials themselves and nothing else: chilled mist grey-green water, wet
slate stone, pale silt, dark oxidised copper green in the deep water, and at most one
thread of rust-orange. Light is cold, low and flat: a high overcast with no sun disc and no
lens flare. Photorealistic, cinematic, shot on a long lens, fine natural grain. No text, no
logos, no lettering, no watermarks, no numbers, no UI anywhere in frame. No people, no
boats, no bridges, no buildings, no wildlife.
<<< END PROMPT

REJECT IF: the upper half is not calm and plain; the frame is landscape rather than tall.

================================================================ JOB 13
TYPE: image
ASPECT: 1.91:1
SIZE: 1200 x 630
OUTPUT: og.jpg
START IMAGE: none
OPTIONAL: no
NOTE: A wordmark and a headline are drawn over the LEFT half of this image later, so the
left half must stay plain and even.

PROMPT >>>
A river of pale glacial meltwater seen from directly overhead, at rest, in a wide letterbox
frame. The left half is a smooth unbroken skin of still water over a pale silt bank, plain,
calm and even, with no bright highlight anywhere in it. The right half holds a settled
stack of long parallel horizontal lines of foam lying across the water, evenly spaced, with
one thin line of rust-orange silt among them. Mirror-flat, cold, even light.

Colours are the materials themselves and nothing else: chilled mist grey-green water, wet
slate stone, pale silt, dark oxidised copper green in the deep water, and at most one
thread of rust-orange. Light is cold, low and flat: a high overcast with no sun disc and no
lens flare. Photorealistic, cinematic, shot on a long lens, fine natural grain. No text, no
logos, no lettering, no watermarks, no numbers, no UI anywhere in frame. No people, no
boats, no bridges, no buildings, no wildlife.
<<< END PROMPT

REJECT IF: anything busy or bright sits in the left half; the frame is not letterbox.

================================================================ JOB 14
TYPE: video
ASPECT: 16:9
SIZE: 1080p
LENGTH: 6 seconds
OUTPUT: hero-seg1.mp4
START IMAGE: hero-river.jpg (JOB 01)
OPTIONAL: no

PROMPT >>>
One continuous overhead shot, no cuts, camera locked and perfectly still above a wide river
of pale glacial meltwater. The entire surface travels steadily downward through the frame,
top to bottom, in a straight vertical line, at one constant unhurried speed that never
varies for the whole six seconds. Fine bright filaments of foam and suspended silt fill the
centre and the right of the frame, and they stay alive the whole way down: they stretch,
braid, break apart and reform as they travel, and no two of them move at quite the same
speed, so the current has depth. Along the left third the water runs shallow and slack over
a pale silt bed, breathing with slow low ripples, never breaking into whitewater, holding
calm for the entire shot. A thin layer of cold vapour drifts down across the surface at
roughly half the speed of the water, so the frame carries two layers of motion at different
rates. Light is cold, flat and high overcast, and it does not change at any point. The shot
ends mid-motion with the current still running at full speed, the surface unbroken and the
frame still full of travelling filaments.

Photorealistic, cinematic, long lens, shallow atmospheric haze, fine natural grain, no text
or lettering anywhere.
<<< END PROMPT

NEGATIVE >>>
text, lettering, numbers, watermark, logo, signage, user interface, screen, monitor, phone,
device, paper, documents, people, hands, faces, boats, bridges, buildings, wildlife, fish,
birds, sun disc, lens flare, colour grading shifts, cuts, jump cuts, scene changes, camera
shake, zoom bursts, speed ramps, time-lapse, upward motion, diagonal drift, split screen,
vignette, cartoon, illustration, painting, 3d render look, oversaturation
<<< END NEGATIVE

REJECT IF: the water travels upward, sideways or diagonally; the camera moves, pans or
zooms; the speed changes during the shot; the left third breaks into whitewater; the light
shifts; the shot ends on a still frame.

================================================================ JOB 15
TYPE: video
ASPECT: 16:9
SIZE: 1080p
LENGTH: 6 seconds
OUTPUT: hero-seg2.mp4
START IMAGE: the FINAL frame of hero-seg1.mp4 (JOB 14), extracted as a full-quality PNG
OPTIONAL: no

PROMPT >>>
One continuous overhead shot, no cuts, camera still, picking up exactly where the previous
shot left off and continuing the identical downward travel at the identical speed under the
identical cold flat light. In the first two seconds four long parallel sandbars rise slowly
up out of the water from beneath, each one running vertically with the current from the top
of the frame to the bottom, evenly spaced across the centre and the right. As they surface,
water sheets off their wet dark spines and small standing waves form along their upstream
edges. The river divides around them into four separate channels, and from that moment each
channel carries only its own filaments: nothing crosses from one channel into the next for
the rest of the shot. The slack shallow along the left third stays calm and clear of the
bars throughout. The shot ends mid-motion, the four channels running separately, the whole
surface still travelling downward.

Photorealistic, cinematic, long lens, shallow atmospheric haze, fine natural grain, no text
or lettering anywhere.
<<< END PROMPT

NEGATIVE >>>
text, lettering, numbers, watermark, logo, signage, user interface, screen, monitor, phone,
device, paper, documents, people, hands, faces, boats, bridges, buildings, wildlife, fish,
birds, sun disc, lens flare, colour grading shifts, cuts, jump cuts, scene changes, camera
shake, zoom bursts, speed ramps, time-lapse, upward motion, diagonal drift, split screen,
vignette, cartoon, illustration, painting, 3d render look, oversaturation
<<< END NEGATIVE

REJECT IF: the speed or the light changes from the previous segment; fewer or more than
four sandbars rise; the bars run across the frame rather than with the current; filaments
cross between channels; the shot ends at rest.

================================================================ JOB 16
TYPE: video
ASPECT: 16:9
SIZE: 1080p
LENGTH: 6 seconds
OUTPUT: hero-seg3.mp4
START IMAGE: the FINAL frame of hero-seg2.mp4 (JOB 15), extracted as a full-quality PNG
OPTIONAL: no

PROMPT >>>
One continuous overhead shot, no cuts, camera still, continuing the same downward travel at
the same speed under the same cold flat light. In the first two seconds the four sandbars
sink smoothly back under the surface, as evenly as they rose, and the water closes over
them. As it closes, a sheet of spray crosses the lens: droplets scatter across the glass,
sit there for a beat while the image goes soft, and then clear completely. Behind the
clearing, the four separate channels have merged into one single deep channel that draws
together toward the centre-right of the frame, and the filaments from all four braid into
one dense fast band of current running vertically down the right of frame. The shallow
along the left third settles back into a smooth still skin of water. The shot ends
mid-motion with the single channel running fast and clean.

Photorealistic, cinematic, long lens, shallow atmospheric haze, fine natural grain, no text
or lettering anywhere.
<<< END PROMPT

NEGATIVE >>>
text, lettering, numbers, watermark, logo, signage, user interface, screen, monitor, phone,
device, paper, documents, people, hands, faces, boats, bridges, buildings, wildlife, fish,
birds, sun disc, lens flare, colour grading shifts, cuts, jump cuts, scene changes, camera
shake, zoom bursts, speed ramps, time-lapse, upward motion, diagonal drift, split screen,
vignette, cartoon, illustration, painting, 3d render look, oversaturation
<<< END NEGATIVE

REJECT IF: the spray on the lens never happens or reads as a cut; the channels do not merge
into one; the merged channel sits left of centre; the shot ends at rest.

================================================================ JOB 17
TYPE: video
ASPECT: 16:9
SIZE: 1080p
LENGTH: 6 seconds
OUTPUT: hero-seg4.mp4
START IMAGE: the FINAL frame of hero-seg3.mp4 (JOB 16), extracted as a full-quality PNG
OPTIONAL: no
NOTE: This is the only segment that ends at rest. Its final frame becomes the hero poster
and the share card.

PROMPT >>>
One continuous overhead shot, no cuts, camera still, continuing the same downward travel
and decelerating smoothly and evenly across the whole six seconds until the water comes to
a complete stop. As it slows, the braided filaments straighten out of their braid and
settle into a neat stack of long parallel horizontal lines of foam, lying across the
current in the right two thirds of the frame, evenly spaced, coming to rest like ruled
lines settling onto a page. The shallow along the left third arrives at a full mirror
stillness a moment before the rest. The last thing in the frame to stop moving is one
single thin line of rust orange silt near the top of the stack, the only warm colour
anywhere in twenty four seconds, which settles a beat after all the others. The final frame
is completely still: a pale mirror-flat surface, calm open water across the very top and
the very bottom of the frame, the stack of settled parallel lines held in the right of
frame with clear space between them, and nothing moving but the faintest breath of cold
vapour.

Photorealistic, cinematic, long lens, shallow atmospheric haze, fine natural grain, no text
or lettering anywhere.
<<< END PROMPT

NEGATIVE >>>
text, lettering, numbers, watermark, logo, signage, user interface, screen, monitor, phone,
device, paper, documents, people, hands, faces, boats, bridges, buildings, wildlife, fish,
birds, sun disc, lens flare, colour grading shifts, cuts, jump cuts, scene changes, camera
shake, zoom bursts, speed ramps, time-lapse, upward motion, diagonal drift, split screen,
vignette, cartoon, illustration, painting, 3d render look, oversaturation
<<< END NEGATIVE

REJECT IF: the water is still moving in the final frame; the deceleration is abrupt rather
than smooth; the settled lines are uneven or crowded together; the top or bottom of the
final frame is busy; the warm line is missing or there is more than one.

================================================================ JOB 18
TYPE: video
ASPECT: 16:9
SIZE: 1080p
LENGTH: 10 to 12 seconds
OUTPUT: hero-single.mp4
START IMAGE: hero-river.jpg (JOB 01)
OPTIONAL: yes
NOTE: Run this ONLY if JOBS 14 to 17 cannot be chained. It replaces all four.

PROMPT >>>
One continuous overhead shot, no cuts, camera locked and still above a wide river of pale
glacial meltwater travelling steadily downward through the frame in a straight vertical
line. It begins as one uncountable current, fine bright filaments of foam and silt filling
the centre and right of frame, the left third running shallow and slack and calm. A third
of the way through, four long parallel sandbars rise from beneath and divide the river into
four separate channels that cannot mix. Two thirds of the way through, the bars sink back
under, a sheet of spray crosses the lens and clears, and the four channels merge into one
single deep channel. In the last quarter the whole current decelerates smoothly to a
complete stop, and the filaments straighten into a neat stack of evenly spaced parallel
horizontal lines of foam at rest in the right two thirds of frame, with one single thin
line of rust orange silt among them settling last. The final frame is completely still,
mirror flat, with calm open water across the top and the bottom. The light is cold, flat
and high overcast throughout and never changes.

Photorealistic, cinematic, long lens, shallow atmospheric haze, fine natural grain, no text
or lettering anywhere.
<<< END PROMPT

NEGATIVE >>>
text, lettering, numbers, watermark, logo, signage, user interface, screen, monitor, phone,
device, paper, documents, people, hands, faces, boats, bridges, buildings, wildlife, fish,
birds, sun disc, lens flare, colour grading shifts, cuts, jump cuts, scene changes, camera
shake, zoom bursts, speed ramps, time-lapse, upward motion, diagonal drift, split screen,
vignette, cartoon, illustration, painting, 3d render look, oversaturation
<<< END NEGATIVE

REJECT IF: any of the four stages is missing; there is a visible cut between stages; the
final frame is still moving; the camera moves at any point.

================================================================ JOB 19
TYPE: video
ASPECT: 16:9
SIZE: 1080p
LENGTH: 8 to 12 seconds
OUTPUT: current-loop.mp4
START IMAGE: current-still.jpg (JOB 10)
OPTIONAL: no

PROMPT >>>
One continuous overhead shot, no cuts. The river surface drifts downward through the frame
very slowly, at a fraction of walking pace, so the movement is barely perceptible. The few
filaments of foam stretch and wander gently as they travel. Thin vapour drifts across at
its own slower speed. The light does not change and nothing enters or leaves the frame. The
shot ends as quietly as it began, still drifting, still calm.

Photorealistic, cinematic, long lens, shallow atmospheric haze, fine natural grain, no text
or lettering anywhere.
<<< END PROMPT

NEGATIVE >>>
text, lettering, numbers, watermark, logo, signage, user interface, screen, monitor, phone,
device, paper, documents, people, hands, faces, boats, bridges, buildings, wildlife, fish,
birds, sun disc, lens flare, colour grading shifts, cuts, jump cuts, scene changes, camera
shake, zoom bursts, speed ramps, time-lapse, upward motion, diagonal drift, split screen,
vignette, cartoon, illustration, painting, 3d render look, oversaturation
<<< END NEGATIVE

REJECT IF: the drift is fast enough to notice as movement; anything enters or leaves the
frame; the light changes.

================================================================ END OF BRIEF

DELIVER: 13 image files and 5 or 6 video files, named exactly as each job's OUTPUT line
says, at the sizes each job's SIZE line says.
