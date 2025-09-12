


//// util

import { fromValue } from "../utils/from-value.ts";

type IterableLike<T> =
  | AsyncIterable<T>
  | globalThis.Iterable<T>
  | AsyncIterator<T>
  | Iterator<T>
  | T;



//// export

export function getIterator<T>(iterable: IterableLike<T>): AsyncIterator<T> | Iterator<T> {
  if ((iterable as any)[Symbol.asyncIterator])
    return (iterable as AsyncIterable<T>)[Symbol.asyncIterator]();

  if ((iterable as any)[Symbol.iterator])
    return (iterable as globalThis.Iterable<T>)[Symbol.iterator]();

  if ((iterable as any).next)
    return iterable as AsyncIterator<T> | Iterator<T>;

  return fromValue(iterable as T);
}
