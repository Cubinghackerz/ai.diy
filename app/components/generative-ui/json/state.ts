/**
 * Local card state for interactive json-render specs (sliders, toggles, tabs of
 * values). It is plain data, never code: a spec declares a few named values, and
 * props may read one with `{ "$state": "/name" }`. Only primitives, one flat
 * level, and bounded sizes are accepted, so a model cannot reach into the
 * store with arbitrary paths or smuggle objects through it.
 */

export const STATE_KEY = /^[A-Za-z][A-Za-z0-9_]{0,31}$/;
export const MAX_STATE_KEYS = 40;
const MAX_STATE_STRING = 200;

export type StateValue = number | string | boolean;
export type SpecState = Record<string, StateValue>;

export function isStateKey(key: unknown): key is string {
    return typeof key === "string" && STATE_KEY.test(key) && key !== "__proto__";
}

/** One state value: a finite number, a short string, or a boolean. Anything else is dropped. */
export function cleanStateValue(value: unknown): StateValue | undefined {
    if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
    if (typeof value === "boolean") return value;
    if (typeof value === "string") return value.slice(0, MAX_STATE_STRING);
    return undefined;
}

/** Keeps valid entries of a model-supplied state object. */
export function cleanState(raw: unknown): SpecState {
    const out: SpecState = {};
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
        if (Object.keys(out).length >= MAX_STATE_KEYS) break;
        const clean = cleanStateValue(value);
        if (isStateKey(key) && clean !== undefined) out[key] = clean;
    }
    return out;
}

/** `{ "$state": "/name" }` with a single-level key; returns the key. */
export function stateExpressionKey(value: unknown): string | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const keys = Object.keys(value);
    if (keys.length !== 1 || keys[0] !== "$state") return null;
    const path = (value as { $state?: unknown }).$state;
    if (typeof path !== "string" || !path.startsWith("/")) return null;
    const key = path.slice(1);
    return isStateKey(key) ? key : null;
}

export type StateExpression = { path: (string | number)[]; key: string };

/** Every `$state` expression inside a props value, with where it sits. */
export function findStateExpressions(
    value: unknown,
    path: (string | number)[] = [],
    out: StateExpression[] = [],
): StateExpression[] {
    const key = stateExpressionKey(value);
    if (key) {
        out.push({ path, key });
    } else if (Array.isArray(value)) {
        value.forEach((item, index) => findStateExpressions(item, [...path, index], out));
    } else if (value && typeof value === "object") {
        for (const [name, item] of Object.entries(value)) {
            if (name === "__proto__") continue;
            findStateExpressions(item, [...path, name], out);
        }
    }
    return out;
}

/** Deep copy of JSON-shaped data with one leaf replaced. */
export function setAt(root: unknown, path: (string | number)[], leaf: unknown): unknown {
    if (path.length === 0) return leaf;
    const [head, ...rest] = path;
    if (Array.isArray(root)) {
        const copy = [...root];
        copy[head as number] = setAt(copy[head as number], rest, leaf);
        return copy;
    }
    const copy = { ...(root as Record<string, unknown>) };
    copy[head as string] = setAt(copy[head as string], rest, leaf);
    return copy;
}
