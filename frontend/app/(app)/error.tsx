"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Error boundary for the authenticated app group. Catches render/runtime errors
 * in any (app) route and offers a recovery path.
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
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/12">
        <AlertTriangle className="size-6 text-destructive-ink" />
      </div>
      <div>
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          An unexpected error occurred while loading this page.
        </p>
      </div>
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" onClick={() => (window.location.href = "/dashboard")}>
          Go to dashboard
        </Button>
      </div>
    </div>
  );
}
