


//// util

import { arrayRange } from "../utils/array-range.ts";
import { flat } from "../utils/flat.ts";
import { GitWalkSymbol } from "../utils/symbols.ts";
import { unionOfIterators } from "../utils/union-of-iterators.ts";

import type { Cache, FsInterface, Walker, WalkerEntry } from "../types.ts";

type WalkerMap = (fullpath: string, entries: (WalkerEntry | null)[]) => Promise<unknown>;
type WalkerReduce = (parent: unknown, children: unknown[]) => Promise<unknown>;
type WalkerIterate = (walk: (root: unknown) => Promise<unknown>, children: Iterable<unknown>) => Promise<unknown[]>;

interface WalkOptions {
  cache: Cache;
  dir?: string;
  fs: FsInterface;
  gitdir?: string;
  iterate?: WalkerIterate;
  map?: WalkerMap;
  reduce?: WalkerReduce;
  trees: Walker[];
}

interface UnionWalkerResult {
  children: Iterable<unknown>;
  entries: (WalkerEntry | null)[];
}



//// export

export function _walk({
  cache,
  dir,
  fs,
  gitdir,
  /*** The default iterate function walks all children concurrently ***/
  iterate = (walk, children) => Promise.all([...children].map(walk)),
  /*** Default map function ***/
  map = (_: string, entry: unknown) => Promise.resolve(entry),
  /*** The default reducer is a flatmap that filters out undefineds. ***/
  reduce = (parent: unknown, children: unknown[]) =>
    Promise.resolve((() => {
      const flatten = flat(children as unknown[][]);

      if (parent !== undefined)
        flatten.unshift(parent);

      return flatten;
    })()),
  trees
}: WalkOptions): Promise<unknown> {
  const walkers = trees.map((proxy) => proxy[GitWalkSymbol]({ cache, dir, fs, gitdir }));
  const root = new Array(walkers.length).fill(".");
  const range = arrayRange(0, walkers.length);

  const unionWalkerFromReaddir = async(entries: unknown[]): Promise<UnionWalkerResult> => {
    range.map((i) => {
      const entry = entries[i];
      entries[i] = entry && new walkers[i].ConstructEntry(entry);
    });

    const subdirs = await Promise.all(
      range.map((i) => {
        const entry = entries[i];

        return entry ?
          walkers[i].readdir(entry) :
          [];
      })
    );

    /*** Process child directories ***/
    const iterators = subdirs.map((array) => {
      return (array === null ? [] : array)[Symbol.iterator]();
    });

    return {
      children: unionOfIterators(iterators),
      entries: entries as any
    };
  };

  const walk = async(root: unknown): Promise<unknown> => {
    const { children, entries } = await unionWalkerFromReaddir(root as unknown[]);
    const foundEntry = entries.find((entry) => entry && (entry as any)._fullpath);
    const fullpath = foundEntry ? (foundEntry as any)._fullpath : undefined;
    const parent = await map(fullpath, entries);

    if (parent !== null) {
      let walkedChildren = await iterate(walk, children);
      walkedChildren = walkedChildren.filter((x) => x !== undefined);

      return reduce(parent, walkedChildren);
    }

    return undefined;
  };

  return walk(root);
}
