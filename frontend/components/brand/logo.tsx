import { cn } from "@/lib/utils";

/**
 * The Upstream mark — a channel "U" whose right arm rises against the current into
 * an arrowhead: the name and the upstream motion in one glyph. The whole mark is drawn
 * in `currentColor`, so it is always the ink of whatever it sits in — white on the
 * navigation rail, black on a page.
 */
export function UpstreamMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M14.5 8 V24 a9.5 9.5 0 0 0 19 0"
        stroke="currentColor"
        strokeWidth="4.6"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M33.5 24 V12.5" stroke="currentColor" strokeWidth="4.6" strokeLinecap="round" fill="none" />
      <path d="M28.7 12.5 L33.5 4 L38.3 12.5 Z" fill="currentColor" />
    </svg>
  );
}

/** Mark + wordmark lockup. Inherits its colour from the surface it sits on. */
export function UpstreamLogo({
  markSize = 22,
  className,
}: {
  markSize?: number;
  className?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2 text-current", className)}>
      <UpstreamMark size={markSize} />
      <span
        className="font-semibold"
        style={{ fontSize: `${Math.round(markSize * 0.8)}px`, letterSpacing: "-0.02em" }}
      >
        Upstream
      </span>
    </span>
  );
}
