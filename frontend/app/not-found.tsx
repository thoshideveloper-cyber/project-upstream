import Link from "next/link";
import { FileQuestion } from "lucide-react";

import { UpstreamMark } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex h-14 items-center px-6">
        <Link href="/dashboard" className="flex items-center gap-2 text-foreground" aria-label="Upstream — home">
          <UpstreamMark size={20} />
          <span className="text-sm font-semibold">Upstream</span>
        </Link>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-20 text-center">
        <div className="mb-4 grid size-10 place-items-center rounded-lg bg-muted ring-1 ring-border">
          <FileQuestion className="size-5 text-muted-foreground" strokeWidth={1.75} />
        </div>
        <p className="text-xs font-medium text-muted-foreground">Error 404</p>
        <h1 className="mt-1 text-xl font-semibold tracking-[-0.015em]">This page doesn&rsquo;t exist</h1>
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          The link may be mistyped, or the record it pointed to has been archived or deleted.
        </p>
        <div className="mt-6 flex items-center gap-2">
          <Link
            href="/dashboard"
            className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-[oklch(0.3_0.008_265)]"
          >
            Go to Home
          </Link>
          <Link
            href="/projects"
            className="inline-flex h-8 items-center rounded-md border border-input bg-card px-3 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-muted"
          >
            Projects
          </Link>
        </div>
      </main>
    </div>
  );
}
