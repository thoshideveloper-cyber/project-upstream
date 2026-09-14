"use client";

import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

/**
 * The person mark, in one place.
 *
 * Three hand-rolled copies existed before this: `TeamStack` on the projects list, an
 * inline stack in the deal room, and the hashed version on Contacts. The hashing is kept
 * because it is the best idea of the three — the same colleague is the same shade on
 * every screen, so a face becomes recognisable at 24px without a photo. The shades are
 * light neutrals with ink initials (a person is not a state, so they take no hue, and a
 * column of random black discs reads as emphasis nobody meant).
 */

const TONES = [
  "bg-ink-100 text-foreground ring-1 ring-inset ring-border",
  "bg-ink-200 text-foreground",
  "bg-[oklch(0.925_0.004_265)] text-foreground",
] as const;

/** Stable per-name shade. Deterministic, so it survives a reload and a re-sort. */
export function avatarTone(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return TONES[Math.abs(h) % TONES.length];
}

const SIZES = {
  xs: "size-5 text-[9px]",
  sm: "size-6 text-[10px]",
  md: "size-8 text-xs",
  lg: "size-10 text-sm",
} as const;

export type AvatarSize = keyof typeof SIZES;

export function Avatar({
  name,
  size = "sm",
  className,
  title,
}: {
  name: string;
  size?: AvatarSize;
  className?: string;
  /** Defaults to the name; pass a fuller string when the role matters too. */
  title?: string;
}) {
  return (
    <span
      title={title ?? name}
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold tabular-nums",
        SIZES[size],
        avatarTone(name),
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

/**
 * Overlapping stack with a "+N" overflow chip.
 *
 * The list is announced to screen readers as text rather than as a row of initials —
 * "RK" is meaningless read aloud, and the whole point of the stack is the set of people,
 * not the individual marks.
 */
export function AvatarGroup({
  names,
  max = 4,
  size = "sm",
  className,
  label = "Team",
}: {
  names: string[];
  max?: number;
  size?: AvatarSize;
  className?: string;
  label?: string;
}) {
  if (names.length === 0) return null;
  const shown = names.slice(0, max);
  const overflow = names.length - shown.length;

  return (
    <span className={cn("inline-flex items-center", className)}>
      <span className="sr-only">{`${label}: ${names.join(", ")}`}</span>
      <span className="flex -space-x-1.5">
        {shown.map((name) => (
          <Avatar
            key={name}
            name={name}
            size={size}
            className="ring-background ring-2"
          />
        ))}
        {overflow > 0 && (
          <span
            aria-hidden="true"
            title={names.slice(max).join(", ")}
            className={cn(
              "ring-background inline-flex shrink-0 items-center justify-center rounded-full bg-muted font-semibold tabular-nums text-muted-foreground ring-2",
              SIZES[size],
            )}
          >
            +{overflow}
          </span>
        )}
      </span>
    </span>
  );
}
