# The four hero stills — prompt for Gemini

Replaces the scrubbed video with four 4K frames, one per scroll position.

**§1 is the whole thing.** Paste it once, unedited. It hands the model the
argument and the constraints and makes it derive the four frames itself, then
generate them in sequence. §3 is a fallback if its derivation comes back wrong.

---

## §1 — The master prompt (paste this)

> **ROLE**
>
> You are art-directing a set of four still frames for the hero section of a
> website. The four frames are not a gallery. They are one location photographed
> at four moments, revealed one after another as the reader scrolls, so the
> reader should feel they are watching a single place change rather than being
> shown four pictures.
>
> **THE ARGUMENT THE FOUR FRAMES CARRY**
>
> The site sells a shared record for deal teams. Its hero makes one argument in
> four beats, and a line of copy sits over each frame:
>
> 1. *"Two analysts. One CFO. Same Tuesday."* — two people, working separately,
>    unknowingly collide on the same outside party. Nobody made a mistake.
> 2. *"One sheet per mandate is one memory per mandate."* — the collision
>    happened because the records are isolated. Each file is blind to the others.
>    This is the cause, not the symptom.
> 3. *"Upstream keeps the whole current."* — the isolation ends. Separate records
>    become one shared body.
> 4. *"Log the email. The rest is derived."* — the merged record at rest,
>    ordered and regular, with a single overdue item visible in it.
>
> **YOUR TASK**
>
> The subject is a braided glacial river — a proglacial sandur, photographed
> from directly overhead. Water is the only variable. **Derive the four water
> states yourself** from the four beats above: work out what a braided channel
> network is doing at each beat, using the behaviour of real braided fluvial
> systems — channel avulsion, bar emergence and submergence, confluence
> turbulence, suspended sediment plumes, flow stage rising and falling.
>
> Before you generate anything, write out the four states you have derived, one
> sentence each, and say in one line why each one carries its beat. Then
> generate the four images in order.
>
> **INVARIANTS — identical in all four frames**
>
> - *Camera:* true orthographic nadir view, optical axis vertical, 90° straight
>   down. Approx. 24mm-equivalent focal length, roughly 400m AGL. No horizon, no
>   sky, no oblique angle. The frame is entirely ground and water.
> - *Altitude and framing must not change between frames.* Same scale, same
>   ground-sample distance, same apparent channel width throughout.
> - *Light:* diffuse overcast skylight, approx. 6500K, flat lighting ratio. No
>   direct sun, no specular highlights, no cast shadows, no golden hour, no warm
>   cast. Late winter, high latitude.
> - *Grade:* high-key, low-contrast, cool-neutral. Deep channels read dark
>   slate-teal, near-petrol. Shallows and wet sand read pale mineral grey-green,
>   milky with glacial rock flour in suspension. Emergent bars read dry, near-
>   white bone and cool sand. **Maintain strong luminance separation: every bar
>   must read as a bright shape against a dark channel.** This separation is
>   non-negotiable — a translucent overlay is applied over these frames later,
>   and low-separation imagery goes completely flat under it.
> - *Optics:* hyperfocal, deep focus at approx. f/8. Critically sharp corner to
>   corner. No bokeh, no motion blur, no tilt-shift. Resolve fine structure
>   everywhere — ripple trains, foam lines, riffles, standing wave trains,
>   sediment laminae, wet-sand ridging at bar margins.
> - *Composition law:* **the left third of every frame stays calm and open** —
>   pale shallows and smooth sand, no strong dark shapes, no structural
>   incident. All structure sits in the centre and right two thirds. A headline
>   is set over the left third in all four frames; a dark mass there destroys
>   its legibility. Treat this as a hard constraint, not a preference.
>
> **OUTPUT**
>
> Four photographic images, 16:9, 3840×2160, sRGB. Photorealistic aerial
> photography — not illustration, not painting, not a 3D render.
>
> **CONSISTENCY PROTOCOL**
>
> Generate frame 1 first. Use it as a visual reference for frames 2, 3 and 4 so
> the location, altitude, light and colour grade carry across unchanged. Only
> the state of the water changes between frames. If a later frame drifts in
> palette, exposure or scale, regenerate it against frame 1 rather than
> accepting it.
>
> **EXCLUDE**
>
> No text, captions, watermarks, logos or graphics. No people, boats, vehicles,
> buildings, bridges, roads or birds. No sky, horizon, sun, shadows, warm light,
> lens flare, vignette or film grain. No blur, soft focus or low resolution. No
> illustration, painting or 3D render.

---

## §2 — Why the constraints are what they are

Worth knowing before you edit anything in §1.

**The left-third rule** is the one people delete first and it is the one that
matters most. The headline sits there at every scroll position. The last set of
imagery needed a heavy translucent veil to hold 4.5:1 contrast, and that veil is
what flattened the picture into a grey smudge. Composing the structure away from
the reading lane is what lets the veil be thin and the picture stay visible.

**Luminance separation between bars and water** is the second. Once any overlay
is applied, two tones that were merely *different in hue* collapse into the same
value and the divided-versus-merged story becomes invisible.

**Fixed altitude and framing** is what makes four frames read as one place. Let
the model reframe between them and you have a slideshow.

---

## §3 — Fallback: the four states, explicit

Use these only if the model's own derivation comes back wrong. Same invariants
block from §1, with one of these appended.

**1 — the collision.** Two separate channels arrive from different directions,
one from the top of frame, one from the right, and meet at a single confluence
just right of centre. Neither is visible from the other until they touch. At the
junction the flow turns turbulent and a pale suspended-sediment plume spreads
downstream. Everywhere else the water is calm. The confluence is the brightest,
busiest incident in the frame.

**2 — the division.** Four channels run the full length of frame, parallel and
evenly spaced, each separated by a long, wide, dry longitudinal bar with a
sharply defined margin. The bars stand clearly above the waterline. No channel
touches another anywhere in frame. Standing wave trains and foam lines build
along every bank. Maximum separation.

**3 — the merge.** Flow stage is rising and the bars are drowning. Two channels
have already coalesced into one wide flow, a third is joining where a bar has
submerged, and a single low bar remains above water near the top of frame.
Submerged bars show as pale shapes beneath moving water. Caught mid-transition —
clearly no longer four, not yet one.

**4 — the register.** One broad current fills the frame, moving as a single
body. Its surface has settled into long, parallel, evenly spaced flow lines,
regular as ruled lines on a page. No bars, no division, no turbulence. Threading
down through it just right of centre is one distinct strand of ferric-oxide-
stained sediment in clear rust orange, unmistakable against the teal.

---

## §4 — Checking them before they go in

1. **Do all four read as the same river?** Hold them side by side. Drift in
   light, altitude or grade and the hero becomes a slideshow.
2. **Is the left third quiet in all four?** That is where the headline lives.
3. **Do the bars read lighter than the water?** Convert to greyscale and check.
   If bars and channels sit at similar values, reject it — the story disappears
   under the overlay.
4. **Any watermark?** The previous set had one burned into every frame.
5. **Critically sharp at 100%?** These get blown up on a retina display.

Save as `hero-1.jpg` … `hero-4.jpg`.

---

## §5 — What changes in the code

Moving from a scrubbed film to four stills deletes a lot. The blob fetch, the
one-seek-in-flight gate, the all-intra encode, the `CUE` table and the `FRAME`
constant all exist only because the hero was scrubbing a video; four images
cross-fading on the same scroll progress needs none of them.

It is also much lighter — roughly 6.3MB of video for about 1.2MB of WebP — and
the static-hero gates simplify, because there is no longer a reason to withhold
the imagery from phones. Hand over the four files and I will wire it.
