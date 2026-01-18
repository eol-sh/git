


//// export

export function isFunction(obj: unknown) {
  return typeof obj === "function";
}

export function isObject(obj: unknown): obj is object {
  return obj !== null && typeof obj === "object";
}

export function isPromiseLike(obj: unknown): obj is Promise<unknown> {
  return isObject(obj) &&
    "then" in obj &&
    isFunction((obj as any).then) &&
    "catch" in obj &&
    isFunction((obj as any).catch);
}
