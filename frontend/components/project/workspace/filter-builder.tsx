"use client";

/**
 * The filter builder — conditions, not dropdowns.
 *
 * The workspace used to carry four fixed selects across its toolbar. Four selects can
 * express exactly four questions, and every fifth one an analyst had ("late, in this
 * band, more than 30 days over") was simply unaskable. A condition list can express all
 * of them and takes no permanent room in the toolbar: closed, it is one button.
 *
 * Two deliberate restraints, both from watching how Attio and Linear ship this:
 *
 *   1. **One join for the whole group.** AND/OR is a single toggle at the top, not a
 *      per-row operator, so the filter can be read as one English sentence.
 *   2. **No nesting.** Nested condition groups are the feature that turns a filter into
 *      a query builder, and a query builder is a thing users open once. If nesting is
 *      ever genuinely needed it is additive — `matchesFilter` already recurses cleanly.
 *
 * Simple stays simple: the quick views set filters without anybody opening this, and a
 * one-condition filter reads as a chip in the toolbar with an × on it.
 */

import { useId } from "react";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LABEL, MONO, SELECT_CLS, TOGGLE_OFF, TOGGLE_ON } from "@/lib/design";
import {
  FILTER_FIELDS,
  FIELD_BY_KEY,
  OP_LABEL,
  isEmptyFilter,
  type FilterCondition,
  type FilterField,
  type FilterGroup,
  type FilterOp,
} from "@/lib/project-views";
import { cn } from "@/lib/utils";

import { labelFor, type OptionMap } from "./options";

let seq = 0;
const nextId = () => `c${(seq += 1)}`;

/** A field is offerable only if the project can actually answer it. */
function usableFields(options: OptionMap): typeof FILTER_FIELDS {
  return FILTER_FIELDS.filter((f) => {
    if (f.kind === "number") return true;
    return (options[f.field]?.length ?? 0) > 0;
  });
}

function defaultCondition(field: FilterField): FilterCondition {
  const def = FIELD_BY_KEY[field];
  return {
    id: nextId(),
    field,
    op: def.ops[0],
    // Number fields open with a sensible magnitude rather than an empty box that
    // filters nothing and looks broken; enum fields open empty, awaiting a choice.
    values: def.kind === "number" ? [field === "overdueBy" ? 14 : 7] : [],
  };
}

/* ── One condition row ─────────────────────────────────────────────────────── */

function ConditionRow({
  condition,
  options,
  fields,
  onChange,
  onRemove,
}: {
  condition: FilterCondition;
  options: OptionMap;
  fields: typeof FILTER_FIELDS;
  onChange: (next: FilterCondition) => void;
  onRemove: () => void;
}) {
  const def = FIELD_BY_KEY[condition.field];
  const values = condition.values.map(String);
  const list = options[condition.field] ?? [];

  return (
    <div className="flex items-start gap-1.5">
      <select
        value={condition.field}
        onChange={(e) => onChange(defaultCondition(e.target.value as FilterField))}
        className={cn(SELECT_CLS, "h-7 w-[7.5rem] shrink-0 text-xs")}
        aria-label="Field"
      >
        {fields.map((f) => (
          <option key={f.field} value={f.field}>
            {f.label}
          </option>
        ))}
      </select>

      <select
        value={condition.op}
        onChange={(e) => onChange({ ...condition, op: e.target.value as FilterOp })}
        className={cn(SELECT_CLS, "h-7 w-[6.5rem] shrink-0 text-xs")}
        aria-label="Operator"
      >
        {def.ops.map((op) => (
          <option key={op} value={op}>
            {OP_LABEL[op]}
          </option>
        ))}
      </select>

      {def.kind === "number" ? (
        <span className="flex h-7 min-w-0 flex-1 items-center gap-1.5">
          <input
            type="number"
            min={0}
            value={String(condition.values[0] ?? "")}
            onChange={(e) => onChange({ ...condition, values: [Number(e.target.value) || 0] })}
            className={cn(SELECT_CLS, "h-7 w-16 px-2 text-xs tabular-nums")}
            style={MONO}
            aria-label={def.label}
          />
          <span className="text-xs text-muted-foreground">{def.unit}</span>
        </span>
      ) : (
        // A multi-select rather than a native <select multiple>: the native control
        // requires ctrl-click to add a second value, which nobody discovers, and it
        // cannot show a per-option count.
        <div className="min-w-0 flex-1 rounded-md border border-input">
          <div className="max-h-36 overflow-y-auto p-0.5">
            {list.map((o) => {
              const on = values.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() =>
                    onChange({
                      ...condition,
                      values: on
                        ? condition.values.filter((v) => String(v) !== o.value)
                        : [...condition.values, o.value],
                    })
                  }
                  aria-pressed={on}
                  className={cn(
                    "flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-xs transition-colors",
                    on ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-3 w-3 shrink-0 place-items-center rounded-[3px] border",
                      on ? "border-primary bg-primary" : "border-input",
                    )}
                    aria-hidden
                  >
                    {on && (
                      <svg viewBox="0 0 10 10" className="h-2 w-2 text-primary-foreground">
                        <path
                          d="M1.5 5.2 4 7.5 8.5 2.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  {o.count != null && (
                    <span className="shrink-0 tabular-nums text-[10px] text-muted-foreground" style={MONO}>
                      {o.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove the ${def.label} condition`}
        className="mt-0.5 shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}

/* ── The builder ───────────────────────────────────────────────────────────── */

export function FilterBuilder({
  filter,
  options,
  onChange,
}: {
  filter: FilterGroup;
  options: OptionMap;
  onChange: (next: FilterGroup) => void;
}) {
  const fields = usableFields(options);
  const empty = isEmptyFilter(filter);
  // Only conditions that actually narrow anything are counted. A row the user has
  // opened but not answered yet filters nothing (see `matchesCondition`), and a badge
  // that says "2" while the list is unchanged is a badge nobody believes again.
  const count = filter.conditions.filter((c) => c.values.length > 0).length;
  const joinId = useId();

  const patch = (i: number, next: FilterCondition) =>
    onChange({ ...filter, conditions: filter.conditions.map((c, j) => (j === i ? next : c)) });

  const remove = (i: number) =>
    onChange({ ...filter, conditions: filter.conditions.filter((_, j) => j !== i) });

  const add = () => {
    const used = new Set(filter.conditions.map((c) => c.field));
    const next = fields.find((f) => !used.has(f.field)) ?? fields[0];
    if (!next) return;
    onChange({ ...filter, conditions: [...filter.conditions, defaultCondition(next.field)] });
  };

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-colors",
              // Inverted while anything is narrowing the book: a filter that is on must
              // be impossible to miss, or 200 hidden rows read as missing data.
              count === 0 ? TOGGLE_OFF : TOGGLE_ON,
            )}
            data-testid="filter-button"
          />
        }
      >
        <Plus className={cn("h-3.5 w-3.5", count > 0 && "hidden")} aria-hidden />
        Filter
        {count > 0 && (
          <span className="tabular-nums" style={MONO}>
            {count}
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent className="w-[30rem] max-w-[calc(100vw-2rem)] p-3" align="start">
        <div className="flex items-center justify-between gap-2 pb-2">
          <p className={LABEL}>Show companies where</p>
          {count > 1 && (
            <span className="flex items-center gap-1 text-[11px]">
              <label htmlFor={joinId} className="sr-only">
                Combine conditions with
              </label>
              <select
                id={joinId}
                value={filter.join}
                onChange={(e) => onChange({ ...filter, join: e.target.value as "and" | "or" })}
                className={cn(SELECT_CLS, "h-6 px-1.5 text-[11px]")}
              >
                <option value="and">all match</option>
                <option value="or">any match</option>
              </select>
            </span>
          )}
        </div>

        {empty ? (
          <p className="py-1 text-xs text-muted-foreground">
            No conditions yet — the whole book is showing.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {filter.conditions.map((c, i) => (
              <ConditionRow
                key={c.id}
                condition={c}
                options={options}
                fields={fields}
                onChange={(next) => patch(i, next)}
                onRemove={() => remove(i)}
              />
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2.5">
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={add}>
            <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
            Add condition
          </Button>
          {!empty && (
            <button
              type="button"
              onClick={() => onChange({ join: "and", conditions: [] })}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Clear all
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ── The chip row — the filter, read back in the toolbar ───────────────────── */

/**
 * Every active condition, spelled out under the toolbar with its own ×.
 *
 * This is the half of a filter system that products usually skip, and skipping it is
 * what makes filters frightening: a hidden filter that removes 200 rows looks like
 * missing data. If a condition is narrowing the list, it says so on screen.
 */
export function FilterChips({
  filter,
  options,
  onChange,
}: {
  filter: FilterGroup;
  options: OptionMap;
  onChange: (next: FilterGroup) => void;
}) {
  // A condition with no values chosen yet is not narrowing anything, so it gets no
  // chip. Printing "Engagement is any of —" describes the builder's internal state,
  // not the list, and the chip row exists to explain the list.
  const shown = filter.conditions
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.values.length > 0);

  if (isEmptyFilter(filter) || shown.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {shown.map(({ c, i }) => {
        const def = FIELD_BY_KEY[c.field];
        const vals =
          def.kind === "number"
            ? `${c.values[0]} ${def.unit ?? ""}`.trim()
            : c.values.map((v) => labelFor(options, c.field, v)).join(", ");
        return (
          <span
            key={c.id}
            className="inline-flex h-6 max-w-full items-center gap-1 rounded-md bg-card pl-2 pr-1 text-xs shadow-xs ring-1 ring-inset ring-border"
          >
            {i > 0 && (
              <span className="mr-0.5 font-medium text-muted-foreground">{filter.join}</span>
            )}
            <span className="text-muted-foreground">{def.label}</span>
            <span className="text-muted-foreground">{OP_LABEL[c.op]}</span>
            <span className="min-w-0 truncate font-medium text-foreground">{vals}</span>
            <button
              type="button"
              onClick={() =>
                onChange({ ...filter, conditions: filter.conditions.filter((_, j) => j !== i) })
              }
              aria-label={`Remove ${def.label} filter`}
              className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          </span>
        );
      })}
    </div>
  );
}
