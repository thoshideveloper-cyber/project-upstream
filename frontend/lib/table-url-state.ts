/**
 * Pure, React-free core for URL-persisted table state (P2 DataTable pattern).
 *
 * A table declares a *spec* — one codec per query param — and this module
 * decodes the current `?query` into typed state and re-encodes state back into a
 * clean query string. "Clean" means a param at its default value is omitted, so a
 * pristine table has a bare URL and only deviations from default appear (shareable,
 * reload-stable). Foreign params already in the URL (e.g. `?deal=3`, an OAuth
 * `?email_connected` flag) are preserved untouched.
 *
 * The logic lives here, free of `window`/hooks, so it is unit-testable in isolation;
 * `hooks/use-table-url-state.ts` is the thin React binding.
 */

export interface ParamCodec<T> {
  /** The value used when the param is absent or unparseable — also the value that
   *  gets omitted from the URL to keep it clean. */
  fallback: T;
  decode: (raw: string | null) => T;
  /** Return `null` to omit the param from the URL (used when value === fallback). */
  encode: (value: T) => string | null;
}

export function stringParam(fallback = ""): ParamCodec<string> {
  return {
    fallback,
    decode: (raw) => (raw == null ? fallback : raw),
    encode: (v) => (v && v !== fallback ? v : null),
  };
}

export function intParam(fallback = 0): ParamCodec<number> {
  return {
    fallback,
    decode: (raw) => {
      if (raw == null) return fallback;
      const n = Number(raw);
      return Number.isFinite(n) ? n : fallback;
    },
    encode: (v) => (v === fallback ? null : String(v)),
  };
}

export function boolParam(fallback = false): ParamCodec<boolean> {
  return {
    fallback,
    decode: (raw) => (raw == null ? fallback : raw === "1" || raw === "true"),
    encode: (v) => (v === fallback ? null : v ? "1" : "0"),
  };
}

export function enumParam<T extends string>(allowed: readonly T[], fallback: T): ParamCodec<T> {
  return {
    fallback,
    decode: (raw) => (raw != null && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback),
    encode: (v) => (v === fallback || !(allowed as readonly string[]).includes(v) ? null : v),
  };
}

// `ParamCodec<T>` is invariant in T (its `encode` consumes T), so a `<unknown>`
// index signature would reject concrete codecs. `<any>` keeps the map open while
// `StateOf` still recovers the precise per-key type via inference.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ParamSpec = Record<string, ParamCodec<any>>;

export type StateOf<S extends ParamSpec> = {
  [K in keyof S]: S[K] extends ParamCodec<infer T> ? T : never;
};

/** Read every spec param out of a `?query` string into typed state. */
export function decodeState<S extends ParamSpec>(spec: S, search: string): StateOf<S> {
  const params = new URLSearchParams(search);
  const out: Record<string, unknown> = {};
  for (const key in spec) {
    out[key] = spec[key].decode(params.get(key));
  }
  return out as StateOf<S>;
}

/**
 * Encode state back into a query string (no leading `?`), preserving any foreign
 * params present in `baseSearch` that the spec doesn't own. Params at their default
 * value are dropped so the URL stays minimal.
 */
export function encodeQuery<S extends ParamSpec>(spec: S, state: StateOf<S>, baseSearch = ""): string {
  const params = new URLSearchParams(baseSearch);
  for (const key in spec) {
    const raw = spec[key].encode(state[key]);
    if (raw == null) params.delete(key);
    else params.set(key, raw);
  }
  return params.toString();
}
