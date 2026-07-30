"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * In-app confirmation, replacing `window.confirm`.
 *
 * The native dialog can't be styled, can't say what happens next, and on some
 * platforms is suppressible — a poor gate in front of an archive. This keeps the
 * same call shape (`await confirm(...) → boolean`) so a call site changes by one
 * word, but the copy can name the consequence and the reversal ("Archived data
 * is kept, not destroyed").
 */

export interface ConfirmOptions {
  title: string;
  /** What actually happens — including how it can be undone. */
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `destructive` paints the confirm button red and shows the warning glyph. */
  tone?: "default" | "destructive";
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOptions(null);
  }, []);

  const value = useMemo(() => confirm, [confirm]);
  const destructive = options?.tone === "destructive";

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Dialog
        open={options !== null}
        // Backdrop click / Escape resolve as a cancel, never as a silent hang.
        onOpenChange={(open) => {
          if (!open) settle(false);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {destructive && (
                <AlertTriangle aria-hidden className="size-4 shrink-0 text-destructive-ink" />
              )}
              {options?.title}
            </DialogTitle>
          </DialogHeader>
          {options?.description && (
            <p className="text-sm leading-relaxed text-muted-foreground">{options.description}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => settle(false)}>
              {options?.cancelLabel ?? "Cancel"}
            </Button>
            <Button
              type="button"
              autoFocus
              variant={destructive ? "destructive" : "default"}
              className={cn(destructive && "min-w-24")}
              onClick={() => settle(true)}
              data-testid="confirm-accept"
            >
              {options?.confirmLabel ?? "Confirm"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

/**
 * `const confirm = useConfirm()` → `if (!(await confirm({ … }))) return;`
 *
 * Falls back to `window.confirm` when no provider is mounted (e.g. a component
 * rendered in isolation by a unit test), so a call site can never hang.
 */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  return useMemo<ConfirmFn>(
    () =>
      ctx ??
      (async (opts) =>
        typeof window === "undefined" ? false : window.confirm(opts.description ?? opts.title)),
    [ctx],
  );
}
