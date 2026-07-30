"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FlaskConical, Loader2, ShieldCheck } from "lucide-react";

import {
  useConnectSandbox,
  useEmailAccount,
  useOAuthStart,
} from "@/hooks/use-email";
import { cn } from "@/lib/utils";

/** Brand glyphs kept as tiny inline SVGs — no external assets. */
export function GmailGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path fill="#EA4335" d="M12 11.1 3.6 5.4v.9L12 12l8.4-5.7v-.9L12 11.1Z" />
      <path fill="#4285F4" d="M20.4 5.4 12 11.1 3.6 5.4C3.6 4.6 4.2 4 5 4h14c.8 0 1.4.6 1.4 1.4Z" opacity=".9" />
      <path fill="#34A853" d="M3.6 6.3V18c0 .8.6 1.4 1.4 1.4h1.8V9.9L3.6 6.3Z" />
      <path fill="#FBBC04" d="M20.4 6.3 17.2 9.9v9.5H19c.8 0 1.4-.6 1.4-1.4V6.3Z" />
      <path fill="#C5221F" d="M6.8 9.9 12 13.5l5.2-3.6v9.5H6.8V9.9Z" opacity=".18" />
    </svg>
  );
}

export function OutlookGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="10" y="5" width="10" height="14" rx="1.2" fill="#1066B5" opacity=".85" />
      <rect x="11.5" y="7" width="7" height="4.5" fill="#fff" opacity=".85" />
      <ellipse cx="8" cy="12" rx="6" ry="6.5" fill="#0F78D4" />
      <ellipse cx="8" cy="12" rx="2.6" ry="3.1" fill="#fff" />
    </svg>
  );
}

interface Props {
  /** Compact = inside the compose sheet; full = settings card. */
  compact?: boolean;
  onConnected?: () => void;
}

/** Provider chooser + the honest one-paragraph deliverability explanation. */
export function EmailConnectPanel({ compact, onConnected }: Props) {
  const { data: account } = useEmailAccount();
  const oauth = useOAuthStart();
  const sandbox = useConnectSandbox();
  const [busy, setBusy] = useState<string | null>(null);

  const providers = account?.providers ?? {};

  const connectSandbox = async () => {
    setBusy("sandbox");
    try {
      await sandbox.mutateAsync();
      toast.success("Sandbox mailbox connected — sends are simulated");
      onConnected?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not connect");
    } finally {
      setBusy(null);
    }
  };

  const startOAuth = (provider: "google" | "microsoft") => {
    setBusy(provider);
    oauth.mutate(provider, { onError: () => setBusy(null) });
  };

  const options: {
    key: string;
    label: string;
    sub: string;
    icon: React.ReactNode;
    available: boolean;
    onClick: () => void;
  }[] = [
    {
      key: "google",
      label: "Connect Gmail",
      sub: providers.google ? "Google Workspace or personal" : "Not configured on this install",
      icon: <GmailGlyph className="h-5 w-5" />,
      available: !!providers.google,
      onClick: () => startOAuth("google"),
    },
    {
      key: "microsoft",
      label: "Connect Outlook",
      sub: providers.microsoft ? "Microsoft 365 or Outlook.com" : "Not configured on this install",
      icon: <OutlookGlyph className="h-5 w-5" />,
      available: !!providers.microsoft,
      onClick: () => startOAuth("microsoft"),
    },
    {
      key: "sandbox",
      label: "Use the sandbox",
      sub: "Simulated sends — try the full flow safely",
      icon: <FlaskConical className="h-5 w-5 text-indigo-600 dark:text-indigo-400" aria-hidden />,
      available: !!providers.sandbox,
      onClick: connectSandbox,
    },
  ];

  return (
    <div className={cn("flex flex-col", compact ? "gap-2.5" : "gap-3")}>
      {options.map((o) => (
        <button
          key={o.key}
          onClick={o.onClick}
          disabled={!o.available || busy !== null}
          className={cn(
            "flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring",
            o.available
              ? "hover:border-primary/40 hover:bg-muted/40 active:scale-[0.995]"
              : "cursor-not-allowed opacity-45",
          )}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
            {busy === o.key ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : o.icon}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold">{o.label}</span>
            <span className="block truncate text-xs text-muted-foreground">{o.sub}</span>
          </span>
        </button>
      ))}
      <p className="mt-1 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden />
        Emails send from your own mailbox through {`Google or Microsoft's`} official API —
        signed by your domain, saved to your Sent folder, replies land in your inbox.
        Recipients see a normal 1-to-1 email, never a relay or a bot.
      </p>
    </div>
  );
}
