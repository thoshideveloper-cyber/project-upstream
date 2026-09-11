/**
 * The current: the hero's film, drawn instead of filmed.
 *
 * There is no video file here. The hero's four beats are one deterministic
 * canvas scene whose entire state is a pure function of the scroll progress
 * `p`, which buys three things a generated clip could not:
 *
 *   1. **Scrubbing is exact in both directions.** Nothing is simulated frame to
 *      frame, so there is no drift, no seek gating, no keyframe interval, and
 *      no partial-download problem on the host. Frame `p` is the same picture
 *      every time it is asked for.
 *   2. **It is the right resolution on every screen**, including a 4k monitor,
 *      at a few kilobytes of code.
 *   3. **The same function renders the poster and the social card**, so the
 *      still a phone sees is literally a frame of the film rather than a
 *      separate asset that drifts out of step with it.
 *
 * ── The four beats, and what each one argues ───────────────────────────────
 *
 *   A  0.00-0.28  A wide, uncountable current of pale dashes falling through
 *                 mist. Each dash is a row of a sheet. This is deal flow with
 *                 nothing done to it.
 *   B  0.28-0.52  Walls rise and the current divides into lanes: one sheet per
 *                 mandate. Two dashes in adjacent lanes are the same name, and
 *                 they burn. That is the duplicate approach, drawn.
 *   C  0.52-0.78  The walls dissolve and the lanes converge into one channel.
 *   D  0.78-1.00  The dashes stop wandering and land on a row grid in the right
 *                 half of the frame, which is exactly where the real queue
 *                 panel then resolves, so the panel arrives out of the film
 *                 rather than on top of it.
 *
 * Motion agrees with the scroll throughout: `p` rising moves everything down
 * the frame, so scrolling down reads as the current carrying.
 *
 * ── Composing for the layout (law 7) ──────────────────────────────────────
 * The words live in the left of the frame the whole way down, so the left 46
 * percent of the current is attenuated to about a third of its density. The
 * field still reads as wide and uncountable; the reading lane stays calm. This
 * is done with alpha rather than by moving the dashes, so the current keeps its
 * shape and only its loudness changes.
 */

export type FlowColors = {
  /** The canvas ground. */
  canvas: string;
  /** A dash at rest. */
  tick: string;
  /** The broad currents behind everything. */
  wash: string;
  /** Lane walls in beat B, row rules in beat D. */
  rule: string;
  /** The one warm colour: the duplicate, and the overdue rows in the grid. */
  late: string;
};

export type FlowFrame = {
  ctx: CanvasRenderingContext2D;
  /** CSS pixels, not device pixels. The caller has already scaled the context. */
  w: number;
  h: number;
  /** Scroll progress through the pinned hero, 0 to 1. */
  p: number;
  colors: FlowColors;
  /** Set false for the poster render, which should not fade out at the end. */
  fadeOut?: boolean;
  /**
   * Paint the canvas colour first. False composites the filaments over
   * whatever is already behind the canvas, which is how the hero runs them
   * over the generated footage.
   */
  ground?: boolean;
  /** Global multiplier on every mark, for running as an overlay. */
  alpha?: number;
};

const TAU = Math.PI * 2;
const COUNT = 420;
const LANES = 4;

/** Where the words sit. Everything left of this is held quiet. */
const READING_LANE = 0.46;
/** Where the queue panel lands, and therefore where the grid forms. */
const GRID_LEFT = 0.52;
const GRID_RIGHT = 0.94;

const clamp = (v: number, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
const smoothstep = (p: number, a: number, b: number) => {
  const t = clamp((p - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * The seeded generator. Every "random" offset in the scene is drawn from this
 * at module load, so the film is identical on every machine and every reload,
 * which is what makes a rendered poster match what the visitor scrolls through.
 */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

type Tick = {
  /** Where in its own loop this dash starts. */
  phase: number;
  /** Multiplier on the fall speed, so the current has depth. */
  speed: number;
  /** Which sheet it belongs to once the walls go up. */
  lane: number;
  /** Its horizontal home in the open current, 0 to 1 of the width. */
  home: number;
  /** Dash length as a fraction of a reference width. */
  len: number;
  /** Wander frequency and phase in the open current. */
  wob: number;
  wobPhase: number;
  /** Its column and row once the grid forms. */
  col: number;
  row: number;
  alpha: number;
};

const GRID_ROWS = 9;

const R = rng(20260824);
const TICKS: Tick[] = Array.from({ length: COUNT }, (_, i) => ({
  phase: R(),
  speed: 0.55 + R() * 0.9,
  lane: i % LANES,
  home: R(),
  len: 0.35 + R() * 0.65,
  wob: 0.6 + R() * 1.8,
  wobPhase: R() * TAU,
  col: i % 3,
  row: i % GRID_ROWS,
  alpha: 0.22 + R() * R() * 1.1,
}));

/**
 * The two dashes that are the same company on two different sheets. They are
 * pinned by hand into adjacent lanes at nearly the same height, because the
 * whole argument of beat B is that a reader can see both at once and neither
 * sheet can. The phases are solved so the pair sits in the upper middle of the
 * frame for the whole beat rather than passing behind the header.
 */
const DUPES: [number, number] = [7, 22];
TICKS[DUPES[0]] = { ...TICKS[DUPES[0]], lane: 2, phase: 0.764, speed: 1, home: 0.52, alpha: 1, len: 1, wob: 0.4 };
TICKS[DUPES[1]] = { ...TICKS[DUPES[1]], lane: 3, phase: 0.846, speed: 1, home: 0.78, alpha: 1, len: 1, wob: 0.4 };

/** Beat weights. Each rises as its beat arrives and falls as the next takes over. */
function beats(p: number) {
  return {
    lanes: smoothstep(p, 0.22, 0.34) * (1 - smoothstep(p, 0.5, 0.62)),
    channel: smoothstep(p, 0.48, 0.64),
    grid: smoothstep(p, 0.74, 0.92),
    /** The collision burns brightest in the middle of beat B. */
    dupe: smoothstep(p, 0.3, 0.38) * (1 - smoothstep(p, 0.46, 0.56)),
  };
}

/** One dash's position, so the collision arc can ask for it too. */
function place(t: Tick, p: number, w: number, h: number, b: ReturnType<typeof beats>) {
  const span = h + 160;
  const gridTop = h * 0.24;
  const rowGap = (h * 0.5) / GRID_ROWS;

  const travel = p * (1 - 0.55 * b.grid);
  const cycle = (t.phase + travel * t.speed * 1.35) % 1;
  const wander = Math.sin(t.wobPhase + cycle * TAU * t.wob + p * 3) * w * 0.06;

  const yFlow = cycle * span - 80;
  const yGrid = gridTop + t.row * rowGap + rowGap * 0.5;
  const y = mix(yFlow, yGrid, b.grid);

  const xOpen = w * (0.06 + t.home * 0.88) + wander;
  const xLane = w * (0.1 + (0.8 * (t.lane + 0.5)) / LANES) + wander * 0.2;
  const xChannel = w * 0.5 + (t.home - 0.5) * w * 0.28 + wander * 0.28;
  const xGrid = w * (GRID_LEFT + (t.col / 3) * (GRID_RIGHT - GRID_LEFT) + 0.02);

  let x = mix(xOpen, xLane, b.lanes);
  x = mix(x, xChannel, b.channel);
  x = mix(x, xGrid, b.grid);

  return { x, y, cycle };
}

export function renderFlow({
  ctx,
  w,
  h,
  p,
  colors,
  fadeOut = true,
  ground = true,
  alpha = 1,
}: FlowFrame) {
  const b = beats(p);

  ctx.clearRect(0, 0, w, h);
  if (ground) {
    ctx.fillStyle = colors.canvas;
    ctx.fillRect(0, 0, w, h);
  }

  /* ── The broad currents. Three soft washes that drift with p, so the field
        is moving even where no dash is. Kept faint on purpose: at any real
        strength they read as vertical curtains rather than as water. ────── */
  ctx.save();
  ctx.globalAlpha = 0.34 * alpha;
  for (let i = 0; ground && i < 3; i++) {
    const t = (i + 0.5) / 3;
    const drift = Math.sin(p * 2.2 + t * TAU) * w * 0.05;
    const x = mix(w * (0.18 + t * 0.68), w * (0.42 + t * 0.24), b.channel) + drift;
    const width = mix(w * 0.13, w * 0.06, b.channel);
    const g = ctx.createLinearGradient(x - width, 0, x + width, 0);
    g.addColorStop(0, "transparent");
    g.addColorStop(0.5, colors.wash);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.fillRect(x - width, 0, width * 2, h);
  }
  ctx.restore();

  /* ── Beat B: the walls between the sheets, growing from the middle out.
        Only on the flat canvas. Over footage the picture already carries the
        division, and three hairlines drawn across a photograph read as a
        rendering fault rather than as an argument. ─────────────────────── */
  if (ground && b.lanes > 0.01) {
    ctx.save();
    // The walls carry beat B's whole argument (one sheet per mandate), so they
    // are drawn in the dash colour rather than the fainter rule colour. This is
    // the one place in the field allowed to be legible rather than ambient.
    ctx.globalAlpha = b.lanes * 0.9 * alpha;
    ctx.strokeStyle = colors.tick;
    ctx.lineWidth = 1;
    for (let i = 1; i < LANES; i++) {
      const x = Math.round(w * (0.1 + (0.8 * i) / LANES)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, h * (0.5 - 0.5 * b.lanes));
      ctx.lineTo(x, h * (0.5 + 0.5 * b.lanes));
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ── Beat D: the row grid the dashes come to rest on ─────────────────── */
  const gridTop = h * 0.24;
  const rowGap = (h * 0.5) / GRID_ROWS;
  if (b.grid > 0.01) {
    ctx.save();
    ctx.globalAlpha = b.grid * 0.45 * alpha;
    ctx.strokeStyle = colors.rule;
    ctx.lineWidth = 1;
    for (let r = 0; r <= GRID_ROWS; r++) {
      const y = Math.round(gridTop + r * rowGap) + 0.5;
      ctx.beginPath();
      ctx.moveTo(w * GRID_LEFT, y);
      ctx.lineTo(w * GRID_RIGHT, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ── The dashes ──────────────────────────────────────────────────────── */
  const unit = Math.min(w, 1400);
  const fade = fadeOut ? 1 - smoothstep(p, 0.88, 1) * 0.5 : 1;

  ctx.save();
  ctx.lineCap = "round";
  for (let i = 0; i < COUNT; i++) {
    const t = TICKS[i];
    const { x, y } = place(t, p, w, h, b);

    const len = mix(unit * 0.01 + t.len * unit * 0.028, unit * 0.05 + t.col * unit * 0.03, b.grid);

    const isDupe = i === DUPES[0] || i === DUPES[1];
    // In the grid the top two rows run warm, which is the same ordering the
    // real queue uses: the latest thing first.
    const isLateRow = t.row < 2 && t.col === 0;
    const warm = Math.max(isDupe ? b.dupe : 0, isLateRow ? b.grid : 0);

    // The reading lane. Quiet on the left, full strength on the right.
    const lane = x < w * READING_LANE ? mix(0.3, 1, b.grid * 0.4) : 1;

    ctx.globalAlpha = clamp(t.alpha * lane * 0.72 * fade + warm * 0.35, 0, 1) * alpha;
    ctx.strokeStyle = warm > 0.02 ? colors.late : colors.tick;
    ctx.lineWidth = mix(1.25, 2.25, warm) * (0.75 + Math.min(1, t.alpha) * 0.5);
    ctx.beginPath();
    ctx.moveTo(x - len / 2, Math.round(y) + 0.5);
    ctx.lineTo(x + len / 2, Math.round(y) + 0.5);
    ctx.stroke();
  }
  ctx.restore();

  /* ── The collision. Two lanes, one name, and the line between them is the
        thing neither sheet can see. ─────────────────────────────────────── */
  if (b.dupe > 0.01) {
    const a = place(TICKS[DUPES[0]], p, w, h, b);
    const c = place(TICKS[DUPES[1]], p, w, h, b);
    ctx.save();
    ctx.globalAlpha = b.dupe * 0.9 * alpha;
    ctx.strokeStyle = colors.late;
    ctx.lineWidth = 1.25;
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo((a.x + c.x) / 2 + w * 0.05, (a.y + c.y) / 2, c.x, c.y);
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * Read the scene's colours off the page rather than hard-coding them, so the
 * canvas cannot drift away from the CSS that surrounds it.
 */
export function readColors(el: HTMLElement): FlowColors {
  const s = getComputedStyle(el);
  const v = (n: string, fallback: string) => s.getPropertyValue(n).trim() || fallback;
  return {
    canvas: v("--canvas", "#edf2f0"),
    tick: v("--flow-tick", "#7c9b98"),
    wash: v("--flow-wash", "#dfeae7"),
    rule: v("--flow-rule", "#b6c9c5"),
    late: v("--late", "#c2410c"),
  };
}
