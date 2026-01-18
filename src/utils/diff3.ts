/**
 * @fileoverview diff3 utility functions
 *
 * Utility functions for diff3 operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/diff3.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import onp from "./onp.ts";

interface ConflictBlock<T> {
  a: T[];
  aIndex: number;
  b: T[];
  bIndex: number;
  o: T[];
  oIndex: number;
}

interface ConflictBlockWrapper<T> {
  conflict: ConflictBlock<T>;
}

interface OkBlock<T> {
  ok: T[];
}

type MergeResult<T> = OkBlock<T> | ConflictBlockWrapper<T>;

type Hunk = [number, number, number, number, number];
type MergeIndex = [number, number, number] | [-1, number, number, number, number, number, number];
type Region = [number, number, number, number];



//// program

function diff3Merge<T>(a: T[], o: T[], b: T[]): MergeResult<T>[] {
  // Applies the output of diff3MergeIndices to actually
  // construct the merged file; the returned result alternates
  // between "ok" and "conflict" blocks.

  const files = [a, o, b];
  const indices = diff3MergeIndices(a, o, b);
  const result: MergeResult<T>[] = [];
  let okLines: T[] = [];

  function flushOk(): void {
    if (okLines.length)
      result.push({ ok: okLines });

    okLines = [];
  }

  function isTrueConflict(rec: MergeIndex): boolean {
    if (rec[0] !== -1)
      return false;

    if (rec[2] !== rec[6])
      return true;

    const aoff = rec[1];
    const boff = rec[5];

    for (let j = 0; j < rec[2]; j++) {
      if (a[j + aoff] !== b[j + (boff || 0)])
        return true;
    }

    return false;
  }

  function pushOk(xs: T[]): void {
    for (let j = 0; j < xs.length; j++) {
      okLines.push(xs[j]);
    }
  }

  for (let i = 0; i < indices.length; i++) {
    const x = indices[i];
    const side = x[0];

    if (side === -1) {
      if (!isTrueConflict(x)) {
        pushOk(files[0].slice(x[1], x[1] + x[2]));
      } else {
        flushOk();
        result.push({
          conflict: {
            a: a.slice(x[1]!, x[1]! + x[2]!),
            aIndex: x[1]!,
            b: b.slice(x[5]!, x[5]! + x[6]!),
            bIndex: x[5] || 0,
            o: o.slice(x[3]!, x[3]! + x[4]!),
            oIndex: x[3] || 0
          }
        });
      }
    } else {
      pushOk(files[side].slice(x[1], x[1] + x[2]));
    }
  }

  flushOk();
  return result;
}

function diff3MergeIndices<T>(a: T[], o: T[], b: T[]): MergeIndex[] {
  // Given three files, A, O, and B, where both A and B are
  // independently derived from O, returns a fairly complicated
  // internal representation of merge decisions it’s taken. The
  // interested reader may wish to consult
  //
  // Sanjeev Khanna, Keshav Kunal, and Benjamin C. Pierce. "A
  // Formal Investigation of Diff3." In Arvind and Prasad,
  // editors, Foundations of Software Technology and Theoretical
  // Computer Science (FSTTCS), December 2007.
  //
  // (http://www.cis.upenn.edu/~bcpierce/papers/diff3-short.pdf)

  const m1 = onp(o, a).compose();
  const m2 = onp(o, b).compose();
  const hunks: Hunk[] = [];

  function addHunk(h: { file1: [number, number]; file2: [number, number] }, side: 0 | 2): void {
    hunks.push([h.file1[0], side, h.file1[1], h.file2[0], h.file2[1]]);
  }

  for (let i = 0; i < m1.length; i++) {
    addHunk(m1[i], 0);
  }

  for (let i = 0; i < m2.length; i++) {
    addHunk(m2[i], 2);
  }

  hunks.sort((x, y) => x[0] - y[0]);

  const result: MergeIndex[] = [];
  let commonOffset = 0;

  function copyCommon(targetOffset: number): void {
    if (targetOffset > commonOffset) {
      result.push([1, commonOffset, targetOffset - commonOffset]);
      commonOffset = targetOffset;
    }
  }

  for (let hunkIndex = 0; hunkIndex < hunks.length; hunkIndex++) {
    const firstHunkIndex = hunkIndex;
    let hunk = hunks[hunkIndex];

    const regionLhs = hunk[0];
    let regionRhs = regionLhs + hunk[2];

    while (hunkIndex < hunks.length - 1) {
      const maybeOverlapping = hunks[hunkIndex + 1];
      const maybeLhs = maybeOverlapping[0];

      if (maybeLhs > regionRhs)
        break;

      regionRhs = Math.max(regionRhs, maybeLhs + maybeOverlapping[2]);
      hunkIndex++;
    }

    copyCommon(regionLhs);

    if (firstHunkIndex === hunkIndex) {
      // The "overlap" was only one hunk long, meaning that
      // there’s no conflict here. Either a and o were the
      // same, or b and o were the same.
      if (hunk[4] > 0)
        result.push([hunk[1], hunk[3], hunk[4]]);
    } else {
      // A proper conflict. Determine the extents of the
      // regions involved from a, o and b. Effectively merge
      // all the hunks on the left into one giant hunk, and
      // do the same for the right; then, correct for skew
      // in the regions of o that each side changed, and
      // report appropriate spans for the three sides.
      const regions: Record<0 | 2, Region> = {
        0: [a.length, -1, o.length, -1],
        2: [b.length, -1, o.length, -1],
      };

      for (let i = firstHunkIndex; i <= hunkIndex; i++) {
        hunk = hunks[i];

        const side = hunk[1] as 0 | 2;
        const r = regions[side];
        const oLhs = hunk[0];
        const oRhs = oLhs + hunk[2];
        const abLhs = hunk[3];
        const abRhs = abLhs + hunk[4];

        r[0] = Math.min(abLhs, r[0]);
        r[1] = Math.max(abRhs, r[1]);
        r[2] = Math.min(oLhs, r[2]);
        r[3] = Math.max(oRhs, r[3]);
      }

      const aLhs = regions[0][0] + (regionLhs - regions[0][2]);
      const aRhs = regions[0][1] + (regionRhs - regions[0][3]);
      const bLhs = regions[2][0] + (regionLhs - regions[2][2]);
      const bRhs = regions[2][1] + (regionRhs - regions[2][3]);

      result.push([
        -1,
        aLhs,
        aRhs - aLhs,
        regionLhs,
        regionRhs - regionLhs,
        bLhs,
        bRhs - bLhs
      ]);
    }

    commonOffset = regionRhs;
  }

  copyCommon(o.length);
  return result;
}



//// export

export default diff3Merge;
export { diff3MergeIndices };
export type { ConflictBlock, ConflictBlockWrapper, MergeResult, OkBlock };



/*** adapted from https://github.com/Axosoft/diff3/blob/master/diff3.js ***/
