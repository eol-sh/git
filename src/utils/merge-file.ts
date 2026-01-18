/**
 * @fileoverview merge-file utility functions
 *
 * Utility functions for merge-file operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/merge-file.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// import

import diff3Merge from "diff3";

//// util

const LINEBREAKS = /^.*(\r?\n|$)/gm;

interface MergeFileOptions {
  branches: [string, string, string]; /*** [base, ours, theirs] ***/
  contents: [string, string, string]; /*** [base, ours, theirs] ***/
}

interface MergeFileResult {
  cleanMerge: boolean;
  mergedText: string;
}



//// export

export function mergeFile({ branches, contents }: MergeFileOptions): MergeFileResult {
  const ourName = branches[1];
  const theirName = branches[2];

  const baseContent = contents[0];
  const ourContent = contents[1];
  const theirContent = contents[2];

  const ours = ourContent.match(LINEBREAKS) || [];
  const base = baseContent.match(LINEBREAKS) || [];
  const theirs = theirContent.match(LINEBREAKS) || [];

  /*** Here we let the diff3 library do the heavy lifting. ***/
  const result = diff3Merge(ours, base, theirs);
  const markerSize = 7;

  /*** Here we note whether there are conflicts and format the results ***/
  let mergedText = "";
  let cleanMerge = true;

  for (const item of result) {
    if ((item as any).ok)
      mergedText += (item as any).ok.join("");

    if ((item as any).conflict) {
      cleanMerge = false;

      mergedText += `${"<".repeat(markerSize)} ${ourName}\n`;
      mergedText += (item as any).conflict.a.join("");
      mergedText += `${"=".repeat(markerSize)}\n`;
      mergedText += (item as any).conflict.b.join("");
      mergedText += `${">".repeat(markerSize)} ${theirName}\n`;
    }
  }

  return { cleanMerge, mergedText };
}
