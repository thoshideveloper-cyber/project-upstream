"use client";

/**
 * The workspace toolbar: Search · View · Filter · Arrange · Display.
 *
 * The order is the order of the question they answer — what am I looking at (view),
 * which of it (filter), how is it stacked and ordered (arrange), how tightly (display).
 * The View button is the primary control and says the name of the lens you are in;
 * everything else is secondary and stays quiet until used.
 */

import { useState } from "react";
import {
  ArrowDownUp,
  Check,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Rows3,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { INK_LINK, LABEL, MONO } from "@/lib/design";
import {
  BUILTIN_VIEWS,
  SORT_LABEL,
  type FilterGroup,
  type SavedView,
  type SortKey,
  type ViewDef,
} from "@/lib/project-views";
import type { GroupBy } from "@/lib/project";
import { cn } from "@/lib/utils";

import { FilterBuilder, FilterChips } from "./filter-builder";
import type { OptionMap } from "./options";

/**
 * The built-ins, split by what they are for.
 *
 * "Working" views answer *what do I do next* and are therefore flat and priority-sorted;
 * "Structure" views answer *how is this book arranged* and are grouped and name-sorted.
 */
const WORKING = ["attention", "follow-ups", "replied", "due-soon", "intro-pending", "cold", "blocked"];
const STRUCTURE = ["all", "by-engagement", "by-band", "by-category", "by-status"];

const GROUP_LABEL: Record<GroupBy, string> = {
  "band-category": "Band → Category",
  band: "Band",
  category: "Category",
  status: "Status",
  none: "Engagement only",
  flat: "No grouping",
};

const GROUP_ORDER: GroupBy[] = ["band-category", "band", "category", "status", "none", "flat"];
const SORT_ORDER: SortKey[] = ["priority", "name", "overdue", "next", "status", "recent"];

/** The toolbar's secondary control: an outline button at 32px, one family with Button. */
const TOOL =
  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-input bg-card px-2.5 text-sm text-foreground shadow-xs transition-colors hover:border-border-strong hover:bg-muted data-[popup-open]:border-border-strong data-[popup-open]:bg-muted";

export interface ViewState {
  viewKey: string;
  filter: FilterGroup;
  group: GroupBy;
  sort: SortKey;
  q: string;
  dense: boolean;
}

/* ── View picker ───────────────────────────────────────────────────────────── */

function ViewPicker({
  current,
  dirty,
  saved,
  onPick,
  onSave,
  onDeleteSaved,
}: {
  current: ViewDef;
  dirty: boolean;
  saved: SavedView[];
  onPick: (v: ViewDef) => void;
  onSave: (name: string) => void;
  onDeleteSaved: (key: string) => void;
}) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

  const group = (keys: string[]) =>
    keys.map((k) => BUILTIN_VIEWS.find((v) => v.key === k)).filter((v): v is ViewDef => !!v);

  const Row = ({ v, onDelete }: { v: ViewDef; onDelete?: () => void }) => (
    <DropdownMenuItem
      onClick={() => onPick(v)}
      className="group/row flex items-start gap-2 py-1.5"
    >
      <Check
        className={cn(
          "mt-0.5 h-3.5 w-3.5 shrink-0",
          v.key === current.key && !dirty ? "text-foreground" : "invisible",
        )}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-foreground">{v.label}</span>
        <span className="block truncate text-xs text-muted-foreground">{v.hint}</span>
      </span>
      {onDelete && (
        <span
          role="button"
          tabIndex={-1}
          aria-label={`Delete the saved view ${v.label}`}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-danger-ink group-hover/row:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
        </span>
      )}
    </DropdownMenuItem>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button type="button" className={cn(TOOL, "font-medium")} data-testid="view-picker" />
        }
      >
        <Rows3 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <span className="max-w-[12rem] truncate">{current.label}</span>
        {dirty && (
          <span
            className="rounded-[3px] bg-warning-soft px-1 text-[11px] font-medium leading-4 text-warning-ink ring-1 ring-inset ring-warning-line"
            title="This view has unsaved changes"
          >
            Edited
          </span>
        )}
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="z-50 w-80">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Working views</DropdownMenuLabel>
          {group(WORKING).map((v) => (
            <Row key={v.key} v={v} />
          ))}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Structure</DropdownMenuLabel>
          {group(STRUCTURE).map((v) => (
            <Row key={v.key} v={v} />
          ))}
        </DropdownMenuGroup>

        {saved.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Saved</DropdownMenuLabel>
              {saved.map((v) => (
                <Row key={v.key} v={v} onDelete={() => onDeleteSaved(v.key)} />
              ))}
            </DropdownMenuGroup>
          </>
        )}

        {dirty && (
          <>
            <DropdownMenuSeparator />
            {naming ? (
              <form
                className="flex items-center gap-1.5 p-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  const n = name.trim();
                  if (!n) return;
                  onSave(n);
                  setName("");
                  setNaming(false);
                }}
              >
                <Input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Name this view"
                  aria-label="Name this view"
                  className="h-7 text-xs"
                  onKeyDown={(e) => e.stopPropagation()}
                />
                <Button type="submit" size="sm">
                  Save
                </Button>
              </form>
            ) : (
              <DropdownMenuItem
                closeOnClick={false}
                onClick={() => {
                  setName(`${current.label} (mine)`);
                  setNaming(true);
                }}
              >
                <Star className="text-muted-foreground" aria-hidden />
                Save as a new view
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ── Option list inside the Arrange popover ─────────────────────────────────── */

function OptionList<T extends string>({
  label,
  options,
  current,
  labelFor,
  onPick,
}: {
  label: string;
  options: T[];
  current: T;
  labelFor: (o: T) => string;
  onPick: (o: T) => void;
}) {
  return (
    <div>
      <p className={cn(LABEL, "px-2 pb-1 pt-1.5")}>{label}</p>
      <div className="flex flex-col" role="radiogroup" aria-label={label}>
        {options.map((o) => {
          const on = current === o;
          return (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onPick(o)}
              className={cn(
                "flex items-center gap-2 rounded-[5px] px-2 py-1.5 text-left text-sm transition-colors",
                on ? "bg-accent font-medium text-foreground" : "text-foreground hover:bg-accent",
              )}
            >
              <Check className={cn("h-3.5 w-3.5", on ? "text-foreground" : "invisible")} aria-hidden />
              {labelFor(o)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── The bar ───────────────────────────────────────────────────────────────── */

export function ViewBar({
  state,
  view,
  dirty,
  saved,
  options,
  anyClosed,
  onPatch,
  onPickView,
  onSaveView,
  onDeleteSavedView,
  onToggleExpand,
}: {
  state: ViewState;
  view: ViewDef;
  dirty: boolean;
  saved: SavedView[];
  options: OptionMap;
  anyClosed: boolean;
  onPatch: (p: Partial<ViewState>) => void;
  onPickView: (v: ViewDef) => void;
  onSaveView: (name: string) => void;
  onDeleteSavedView: (key: string) => void;
  onToggleExpand: () => void;
}) {
  const grouped = state.group !== "flat";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={state.q}
            onChange={(e) => onPatch({ q: e.target.value })}
            placeholder="Search companies, contacts, HQ"
            aria-label="Search this project's companies"
            data-testid="grid-search"
            className="w-56 pl-8 pr-8 transition-[width] focus:w-72"
          />
          {state.q && (
            <button
              onClick={() => onPatch({ q: "" })}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
        </div>

        <ViewPicker
          current={view}
          dirty={dirty}
          saved={saved}
          onPick={onPickView}
          onSave={onSaveView}
          onDeleteSaved={onDeleteSavedView}
        />

        <FilterBuilder
          filter={state.filter}
          options={options}
          onChange={(filter) => onPatch({ filter })}
        />

        {/* Group and sort are one popover, not two more toolbar buttons: they are the
            same decision seen twice ("how is this arranged"). */}
        <Popover>
          <PopoverTrigger
            render={<button type="button" className={cn(TOOL, "text-muted-foreground")} data-testid="group-by" />}
          >
            <ArrowDownUp className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden text-foreground sm:inline">
              {grouped ? GROUP_LABEL[state.group] : "No grouping"}
              <span className="text-muted-foreground"> · {SORT_LABEL[state.sort]}</span>
            </span>
            <span className="text-foreground sm:hidden">Arrange</span>
          </PopoverTrigger>
          <PopoverContent className="w-60 p-1" align="start">
            <OptionList
              label="Group by"
              options={GROUP_ORDER}
              current={state.group}
              labelFor={(g) => GROUP_LABEL[g]}
              onPick={(g) => onPatch({ group: g })}
            />
            <div className="my-1 h-px bg-border" />
            <OptionList
              label="Sort by"
              options={SORT_ORDER}
              current={state.sort}
              labelFor={(s) => SORT_LABEL[s]}
              onPick={(s) => onPatch({ sort: s })}
            />
          </PopoverContent>
        </Popover>

        <div className="ml-auto flex items-center gap-2">
          {grouped && (
            <Button variant="ghost" onClick={onToggleExpand} className="text-muted-foreground">
              {anyClosed ? (
                <ChevronsUpDown className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <ChevronsDownUp className="h-3.5 w-3.5" aria-hidden />
              )}
              <span className="hidden sm:inline">{anyClosed ? "Expand all" : "Collapse all"}</span>
            </Button>
          )}

          {/* Display is a choice between two named row heights. */}
          <DropdownMenu>
            <DropdownMenuTrigger render={<button type="button" className={TOOL} />}>
              {state.dense ? "Compact" : "Comfortable"}
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="z-50 w-44">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Row height</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => onPatch({ dense: false })}>
                  <Check className={cn(state.dense ? "invisible" : "text-foreground")} aria-hidden />
                  Comfortable
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onPatch({ dense: true })}>
                  <Check className={cn(state.dense ? "text-foreground" : "invisible")} aria-hidden />
                  Compact
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <FilterChips
        filter={state.filter}
        options={options}
        onChange={(filter) => onPatch({ filter })}
      />
    </div>
  );
}

/* ── The caption — what you are looking at, in one line ────────────────────── */

export function ResultCaption({
  shown,
  total,
  hint,
  onClear,
}: {
  shown: number;
  total: number;
  hint: string;
  onClear?: () => void;
}) {
  const narrowed = shown !== total;
  return (
    <p className="text-xs text-muted-foreground" data-testid="result-caption">
      <span className="font-semibold text-foreground" style={MONO}>
        {shown}
      </span>
      {narrowed && (
        <>
          {" of "}
          <span style={MONO}>{total}</span>
        </>
      )}{" "}
      {shown === 1 ? "company" : "companies"} · {hint}
      {narrowed && onClear && (
        <>
          {" · "}
          <button onClick={onClear} className={INK_LINK}>
            Clear
          </button>
        </>
      )}
    </p>
  );
}
