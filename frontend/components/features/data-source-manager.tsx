"use client";

import { toast } from "sonner";
import { Plug } from "lucide-react";

import { useDataSources, useToggleDataSource } from "@/hooks/use-data-sources";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Human label for a provider key. */
export function providerLabel(key: string): string {
  const map: Record<string, string> = {
    mock_ranking: "Mock AI ranking (offline)",
    mock_enrichment: "Mock enrichment (offline)",
    groq_ranking: "Groq AI ranking",
  };
  return map[key] ?? key;
}

/** Partner-only data-source manager (SOURCING_LAYER_PLAN §4.5). Secrets live in .env. */
export function DataSourceManager() {
  const { data } = useDataSources();
  const toggle = useToggleDataSource();

  const items = data?.items ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Plug className="h-4 w-4" /> Data sources ({items.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-muted-foreground">
          Pluggable enrichment + AI ranking providers. Credentials live in the server
          environment and are never shown here. AI ranking is off by default until a partner
          enables it and confirms the data-sharing terms.
        </p>
        <ul className="divide-y">
          {items.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2 text-sm">
              <span className="flex items-center gap-2">
                {providerLabel(c.provider_key)}
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {c.kind}
                </span>
              </span>
              <label className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={c.enabled}
                  onChange={async (e) => {
                    try {
                      await toggle.mutateAsync({ id: c.id, enabled: e.target.checked });
                      toast.success(`${providerLabel(c.provider_key)} ${e.target.checked ? "enabled" : "disabled"}`);
                    } catch {
                      toast.error("Failed to update");
                    }
                  }}
                />
                {c.enabled ? "Enabled" : "Disabled"}
              </label>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
