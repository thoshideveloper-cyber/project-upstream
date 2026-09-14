/**
 * The asset bench's camera.
 *
 * Photographs `/render` to produce every static asset the site ships, so the
 * poster, the share card and the ambient clip are all frames of the same scene
 * the hero draws live. Change the palette and re-run this; nothing drifts.
 *
 *   public/og.jpg             1200x630  share card
 *   public/current-still.jpg  1600x900  the frame under the closing fold
 *   public/current-loop.webm  1280x720  the ambient clip, recorded off the
 *                                       canvas with MediaRecorder, no encoder
 *                                       and no image model involved
 *
 * The clip is recorded as one monotonic drift that ENDS on exactly the frame
 * `current-still.jpg` holds, so it plays once, comes to rest, and the still
 * behind it takes over invisibly. That is also why it does not loop: a looping
 * flow field has a visible seam unless every particle's period divides the loop
 * length, and playing once and resting is better than solving that.
 *
 * Usage:  node scripts/render-assets.mjs [baseUrl]
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import pw from "file:///D:/work/Qplus/Qplus_code/upstream/frontend/node_modules/@playwright/test/index.js";

const { chromium } = pw;
const here = dirname(fileURLToPath(import.meta.url));
const pub = join(here, "..", "public");
const base = process.argv[2] || "http://localhost:3101";

const CLIP_SECONDS = 12;
const CLIP_FROM = 0.16;
const CLIP_TO = 0.42; // the frame current-still.png holds

const browser = await chromium.launch({
  args: ["--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage({
  viewport: { width: 1700, height: 1000 },
  deviceScaleFactor: 2,
});

await page.goto(`${base}/render`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200); // let the webfonts land before anything is photographed

const shoot = async (sel, file, opts = {}) => {
  const el = await page.$(sel);
  if (!el) throw new Error(`missing ${sel} on the bench`);
  await el.screenshot({ path: join(pub, file), ...opts });
  console.log("wrote", file);
};

// JPEG for all three: they are smooth gradient fields, where PNG spends four
// megabytes on a file nobody can tell from a 200KB one, and the poster is the
// first paint a phone gets.
await shoot("#og", "og.jpg", { type: "jpeg", quality: 88 });
await shoot("#still", "current-still.jpg", { type: "jpeg", quality: 84 });

/* ── The clip ────────────────────────────────────────────────────────────
   Recorded straight off the canvas element. No frame dump, no encoder
   install, and the file is what the browser itself considers cheap to play. */
console.log(`recording ${CLIP_SECONDS}s clip...`);
const b64 = await page.evaluate(
  async ({ seconds, from, to }) => {
    const canvas = document.querySelector("#loop canvas");
    const drive = window.__still;
    if (!canvas || !drive) throw new Error("bench canvas not ready");

    const stream = canvas.captureStream(30);
    const type = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";
    const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 2_600_000 });
    const chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.start();

    const t0 = performance.now();
    await new Promise((done) => {
      const step = (now) => {
        const t = Math.min(1, (now - t0) / (seconds * 1000));
        // Ease the very start so the clip does not begin on a jerk.
        const e = t < 0.12 ? (t / 0.12) * (t / 0.12) * 0.12 : t;
        drive(from + (to - from) * e);
        if (t < 1) requestAnimationFrame(step);
        else done();
      };
      requestAnimationFrame(step);
    });

    rec.stop();
    const blob = await new Promise((r) => (rec.onstop = () => r(new Blob(chunks, { type }))));
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = "";
    for (let i = 0; i < buf.length; i += 0x8000) {
      s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    }
    return btoa(s);
  },
  { seconds: CLIP_SECONDS, from: CLIP_FROM, to: CLIP_TO },
);

writeFileSync(join(pub, "current-loop.webm"), Buffer.from(b64, "base64"));
console.log("wrote current-loop.webm");

await browser.close();
