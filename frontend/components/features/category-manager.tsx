"use client";

import { useState } from "react";
import { Tag, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useConfirm } from "@/components/features/confirm-dialog";

import {
  useCategories,
  useCreateCategory,
  useArchiveCategory,
} from "@/hooks/use-categories";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/** Partner-only manage-categories surface (§7.2). Firms self-serve the vocabulary. */
export function CategoryManager() {
  const { data } = useCategories();
  const create = useCreateCategory();
  const archive = useArchiveCategory();
  const confirm = useConfirm();
  const [name, setName] = useState("");

  const add = async () => {
    if (!name.trim()) return;
    try {
      await create.mutateAsync({ name: name.trim() });
      setName("");
      toast.success("Category added");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to add category");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Tag className="h-4 w-4" /> Counterparty categories ({data?.items.length ?? 0})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-muted-foreground">
          The category vocabulary used to classify companies (PE, PMS, Strategic, …). Add your
          own; archiving keeps existing companies&apos; classification intact.
        </p>
        <ul className="divide-y">
          {data?.items.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2 text-sm">
              <span className="flex items-center gap-2">
                {c.name}
                <span className="text-[10px] text-muted-foreground">{c.code}</span>
              </span>
              <button
                onClick={async () => {
                  const ok = await confirm({
                    title: `Archive the "${c.name}" category?`,
                    description:
                      "It disappears from the pickers. Companies already classified with it keep their classification.",
                    confirmLabel: "Archive",
                    tone: "destructive",
                  });
                  if (!ok) return;
                  try {
                    await archive.mutateAsync(c.id);
                    toast.success("Category archived");
                  } catch {
                    toast.error("Failed to archive");
                  }
                }}
                className="text-muted-foreground hover:text-destructive-ink"
                aria-label={`Archive ${c.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") add(); }}
            placeholder="New category name…"
            className="h-9 text-sm"
          />
          <Button size="sm" className="h-9" onClick={add} disabled={create.isPending || !name.trim()}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
