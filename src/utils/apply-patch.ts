/**
 * @fileoverview apply-patch utility functions
 *
 * Utility functions for apply-patch operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/apply-patch.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */

/*** UTILITY ------------------------------------------ ***/

import { DiffEdit, myersDiff, splitLines } from "./diff-algorithm.ts";

/*** EXPORT ------------------------------------------- ***/

export interface ConflictMarker {
  end: number;
  ours: string[];
  start: number;
  theirs: string[];
}

export interface Patch {
  hunks: PatchHunk[];
  newFile: string;
  oldFile: string;
}

export interface PatchHunk {
  lines: PatchLine[];
  newLines: number;
  newStart: number;
  oldLines: number;
  oldStart: number;
}

export interface PatchLine {
  content: string;
  type: "add" | "context" | "delete";
}

export interface PatchResult {
  conflicts?: ConflictMarker[];
  content?: string;
  success: boolean;
}

export function applyPatch(originalContent: string, patch: Patch): PatchResult {
  const conflicts: ConflictMarker[] = [];
  const lines = splitLines(originalContent);
  const result: string[] = [];
  let lineIndex = 0;

  for (const hunk of patch.hunks) {
    /*** Copy lines before the hunk ***/
    while (lineIndex < hunk.oldStart - 1) {
      if (lineIndex < lines.length)
        result.push(lines[lineIndex]);

      lineIndex++;
    }

    /*** Apply the hunk ***/
    const hunkResult = applyHunk(lines, lineIndex, hunk);

    if (hunkResult.success) {
      result.push(...hunkResult.lines);
      lineIndex = hunkResult.nextIndex;
    } else {
      /*** Conflict detected ***/
      conflicts.push({
        end: result.length + hunkResult.lines.length,
        ours: lines.slice(lineIndex, lineIndex + hunk.oldLines),
        start: result.length,
        theirs: hunkResult.lines
      });

      /*** Add conflict markers ***/
      result.push("<<<<<<< HEAD");
      result.push(...lines.slice(lineIndex, lineIndex + hunk.oldLines));
      result.push("=======");
      result.push(...hunkResult.lines);
      result.push(">>>>>>> cherry-pick");

      lineIndex += hunk.oldLines;
    }
  }

  /*** Copy remaining lines ***/
  while (lineIndex < lines.length) {
    result.push(lines[lineIndex]);
    lineIndex++;
  }

  return {
    conflicts: conflicts.length > 0 ? conflicts : undefined,
    content: result.join("\n"),
    success: conflicts.length === 0
  };
}

export function createPatch(oldContent: string, newContent: string, oldFile: string = "a/file", newFile: string = "b/file"): Patch {
  const oldLines = splitLines(oldContent);
  const newLines = splitLines(newContent);
  const edits = myersDiff(oldLines, newLines);
  const hunks = editsToHunks(oldLines, newLines, edits);

  return {
    hunks,
    newFile,
    oldFile
  };
}

export function threeWayMerge(base: string, ours: string, theirs: string): PatchResult {
  // const baseLines = splitLines(base);
  // const oursLines = splitLines(ours);
  // const theirsLines = splitLines(theirs);

  // Get diffs from base
  // const oursDiff = myersDiff(baseLines, oursLines);
  // const theirsDiff = myersDiff(baseLines, theirsLines);

  // Apply their changes to our version
  const theirsPatch = createPatch(base, theirs);
  return applyPatch(ours, theirsPatch);
}

/*** HELPER ------------------------------------------- ***/

function applyHunk(lines: string[], startIndex: number, hunk: PatchHunk): { success: boolean; lines: string[]; nextIndex: number } {
  const result: string[] = [];
  let currentIndex = startIndex;
  let expectedIndex = 0;

  for (const patchLine of hunk.lines) {
    switch (patchLine.type) {
      case "context": {
        /*** Context line should match ***/
        if (currentIndex >= lines.length || lines[currentIndex] !== patchLine.content) {
          /*** Context doesn’t match - conflict ***/
          return {
            lines: extractHunkAdditions(hunk),
            nextIndex: currentIndex,
            success: false
          };
        }

        result.push(lines[currentIndex]);
        currentIndex++;
        expectedIndex++;

        break;
      }

      case "delete": {
        /*** Line should exist and match ***/
        if (currentIndex >= lines.length || lines[currentIndex] !== patchLine.content) {
          /*** Line to delete doesn’t match - conflict ***/
          return {
            lines: extractHunkAdditions(hunk),
            nextIndex: currentIndex,
            success: false
          };
        }

        /*** Skip the line (delete it) ***/
        currentIndex++;
        expectedIndex++;

        break;
      }

      case "add": {
        /*** Add new line ***/
        result.push(patchLine.content);
        break;
      }
    }
  }

  return {
    lines: result,
    nextIndex: currentIndex,
    success: true
  };
}

function editsToHunks(oldLines: string[], newLines: string[], edits: DiffEdit[], contextLines: number = 3): PatchHunk[] {
  const hunks: PatchHunk[] = [];
  let currentHunk: PatchHunk | null = null;

  for (const edit of edits) {
    if (edit.type === "equal") {
      /*** Add context lines ***/
      if (currentHunk) {
        /*** Add trailing context ***/
        const contextEnd = Math.min(edit.oldEnd, edit.oldStart + contextLines);

        for (let i = edit.oldStart; i < contextEnd; i++) {
          currentHunk.lines.push({
            content: oldLines[i],
            type: "context"
          });

          currentHunk.oldLines++;
          currentHunk.newLines++;
        }

        /*** If we’ve added enough context, close the hunk ***/
        if (edit.oldEnd - edit.oldStart > contextLines * 2) {
          hunks.push(currentHunk);
          currentHunk = null;
        }
      }
    } else {
      /*** Start new hunk if needed ***/
      if (!currentHunk) {
        const contextStart = Math.max(0, edit.oldStart - contextLines);

        currentHunk = {
          lines: [],
          newStart: contextStart + 1,
          newLines: 0,
          oldLines: 0,
          oldStart: contextStart + 1
        };

        /*** Add leading context ***/
        for (let i = contextStart; i < edit.oldStart; i++) {
          currentHunk.lines.push({
            content: oldLines[i],
            type: "context"
          });

          currentHunk.oldLines++;
          currentHunk.newLines++;
        }
      }

      if (edit.type === "delete") {
        for (let i = edit.oldStart; i < edit.oldEnd; i++) {
          currentHunk.lines.push({
            content: oldLines[i],
            type: "delete"
          });

          currentHunk.oldLines++;
        }
      } else if (edit.type === "insert") {
        for (let i = edit.newStart; i < edit.newEnd; i++) {
          currentHunk.lines.push({
            content: newLines[i],
            type: "add"
          });

          currentHunk.newLines++;
        }
      }
    }
  }

  if (currentHunk)
    hunks.push(currentHunk);

  return hunks;
}

function extractHunkAdditions(hunk: PatchHunk): string[] {
  return hunk.lines
    .filter(line => line.type === "add")
    .map(line => line.content);
}
