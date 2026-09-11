"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Error boundary for the authenticated app group. Catches render/runtime errors in any
 * (app) route and offers a recovery path. The navigation rail stays usable around it,
 * so "go somewhere else" is always one click away as well.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the error for debugging; in prod this would go to a logger.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <div className="mb-4 grid size-10 place-items-center rounded-lg bg-danger-soft ring-1 ring-inset ring-danger-line">
        <AlertTriangle className="size-5 text-danger-ink" strokeWidth={1.75} />
      </div>
      <h1 className="text-lg font-semibold tracking-[-0.01em]">This page couldn&rsquo;t load</h1>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Something failed while rendering it. Nothing you saved has been lost — try again, or
        head back to Home.
      </p>
      {error.digest && (
        <p className="mt-3 rounded-md bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground ring-1 ring-inset ring-border">
          Reference {error.digest}
        </p>
      )}
      <div className="mt-6 flex gap-2">
        <Button onClick={reset}>
          <RotateCcw aria-hidden />
          Try again
        </Button>
        <Button variant="outline" onClick={() => (window.location.href = "/dashboard")}>
          Go to Home
        </Button>
      </div>
    </div>
  );
}
