"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

/**
 * Panel states — the app's vocabulary, verbatim, so Analytics stops dead-ending.
 * Error = AlertTriangle + "Couldn't load X." + "Try again" (refetch); empty = a
 * directional line that points at the fix.
 */

export function PanelError({ label, onRetry }: { label: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <AlertTriangle className="h-5 w-5 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Couldn&rsquo;t load {label}.</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs font-medium text-primary-ink underline-offset-2 hover:underline"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function PanelEmpty({
  icon,
  line,
  cta,
  href,
}: {
  icon?: React.ReactNode;
  line: string;
  cta?: string;
  href?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      {icon}
      <p className="text-sm text-muted-foreground">{line}</p>
      {cta && href && (
        <Link href={href} className="text-xs font-medium text-primary-ink underline-offset-2 hover:underline">
          {cta} →
        </Link>
      )}
    </div>
  );
}
