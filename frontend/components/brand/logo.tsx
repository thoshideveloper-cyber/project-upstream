import { cn } from "@/lib/utils";

/**
 * The Upstream mark — a channel "U" whose right arm rises against the current
 * into an amber tip: the name, the upstream motion, and the amber signal in one
 * glyph. The U inherits `currentColor`; the rising tip uses the theme's amber
 * (`--primary`) so it holds on both the Obsidian (dark) and Daylight (light) themes.
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
      <path d="M33.5 24 V12.5" stroke="var(--primary)" strokeWidth="4.6" strokeLinecap="round" fill="none" />
      <path d="M28.7 12.5 L33.5 4 L38.3 12.5 Z" fill="var(--primary)" />
    </svg>
  );
}

/** The mark inside a rounded amber tile — the app-icon / avatar lockup. */
export function UpstreamTile({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-[28%] bg-gradient-to-br from-[#f4b563] to-[#d97e26]",
        "shadow-[0_8px_20px_rgba(233,151,63,0.28)]",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <path
          d="M14.5 9 V24 a9.5 9.5 0 0 0 19 0"
          stroke="#1a1206"
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
        />
        <path d="M33.5 24 V13" stroke="#1a1206" strokeWidth="5" strokeLinecap="round" fill="none" />
        <path d="M28.5 13 L33.5 4.5 L38.5 13 Z" fill="#1a1206" />
      </svg>
    </span>
  );
}

/** Mark + wordmark lockup used in the sidebar, mobile drawer, and login. */
export function UpstreamLogo({ markSize = 24, className }: { markSize?: number; className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <UpstreamMark size={markSize} className="text-foreground" />
      <span
        className="text-foreground font-semibold tracking-tight"
        style={{ fontFamily: "var(--font-display)", fontSize: "20px", letterSpacing: "-0.3px" }}
      >
        Upstream
      </span>
    </span>
  );
}
