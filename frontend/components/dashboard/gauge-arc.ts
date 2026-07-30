/** Shared SVG arc math for the dashboard instruments (gauge, rings).
 *  Angles are in degrees, measured clockwise from 12 o'clock. */

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  // 0° = top (12 o'clock), sweeping clockwise.
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

/** Build an SVG path `d` for an arc from `startDeg` to `endDeg` (clockwise). */
export function arcPath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
): string {
  const start = polar(cx, cy, r, startDeg);
  const end = polar(cx, cy, r, endDeg);
  const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}
