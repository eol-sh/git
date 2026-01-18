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
 *//**
 * Patch application utilities for cherry-pick and revert
 */

import { DiffEdit, myersDiff, splitLines } from "./diff-algorithm.ts";

export interface Patch {
  oldFile: string;
  newFile: string;
  hunks: PatchHunk[];
}

export interface PatchHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: PatchLine[];
}

export interface PatchLine {
  type: "context" | "add" | "delete";
  content: string;
}

export interface PatchResult {
  success: boolean;
  content?: string;
  conflicts?: ConflictMarker[];
}

export interface ConflictMarker {
  start: number;
  end: number;
  ours: string[];
  theirs: string[];
}

/**
 * Apply a patch to a file content
 */
export function applyPatch(
  originalContent: string,
  patch: Patch
): PatchResult {
  const lines = splitLines(originalContent);
  const result: string[] = [];
  let lineIndex = 0;
  const conflicts: ConflictMarker[] = [];

  for (const hunk of patch.hunks) {
    // Copy lines before the hunk
    while (lineIndex < hunk.oldStart - 1) {
      if (lineIndex < lines.length) {
        result.push(lines[lineIndex]);
      }
      lineIndex++;
    }

    // Apply the hunk
    const hunkResult = applyHunk(lines, lineIndex, hunk);

    if (hunkResult.success) {
      result.push(...hunkResult.lines);
      lineIndex = hunkResult.nextIndex;
    } else {
      // Conflict detected
      conflicts.push({
        start: result.length,
        end: result.length + hunkResult.lines.length,
        ours: lines.slice(lineIndex, lineIndex + hunk.oldLines),
        theirs: hunkResult.lines
      });

      // Add conflict markers
      result.push("<<<<<<< HEAD");
      result.push(...lines.slice(lineIndex, lineIndex + hunk.oldLines));
      result.push("=======");
      result.push(...hunkResult.lines);
      result.push(">>>>>>> cherry-pick");

      lineIndex += hunk.oldLines;
    }
  }

  // Copy remaining lines
  while (lineIndex < lines.length) {
    result.push(lines[lineIndex]);
    lineIndex++;
  }

  return {
    success: conflicts.length === 0,
    content: result.join("\n"),
    conflicts: conflicts.length > 0 ? conflicts : undefined
  };
}

/**
 * Apply a single hunk
 */
function applyHunk(
  lines: string[],
  startIndex: number,
  hunk: PatchHunk
): { success: boolean; lines: string[]; nextIndex: number } {
  const result: string[] = [];
  let currentIndex = startIndex;
  let expectedIndex = 0;

  for (const patchLine of hunk.lines) {
    switch (patchLine.type) {
      case "context":
        // Context line should match
        if (currentIndex >= lines.length ||
            lines[currentIndex] !== patchLine.content) {
          // Context doesn't match - conflict
          return {
            success: false,
            lines: extractHunkAdditions(hunk),
            nextIndex: currentIndex
          };
        }
        result.push(lines[currentIndex]);
        currentIndex++;
        expectedIndex++;
        break;

      case "delete":
        // Line should exist and match
        if (currentIndex >= lines.length ||
            lines[currentIndex] !== patchLine.content) {
          // Line to delete doesn't match - conflict
          return {
            success: false,
            lines: extractHunkAdditions(hunk),
            nextIndex: currentIndex
          };
        }
        // Skip the line (delete it)
        currentIndex++;
        expectedIndex++;
        break;

      case "add":
        // Add new line
        result.push(patchLine.content);
        break;
    }
  }

  return {
    success: true,
    lines: result,
    nextIndex: currentIndex
  };
}

/**
 * Extract only the additions from a hunk
 */
function extractHunkAdditions(hunk: PatchHunk): string[] {
  return hunk.lines
    .filter(line => line.type === "add")
    .map(line => line.content);
}

/**
 * Create a patch from two file contents
 */
export function createPatch(
  oldContent: string,
  newContent: string,
  oldFile: string = "a/file",
  newFile: string = "b/file"
): Patch {
  const oldLines = splitLines(oldContent);
  const newLines = splitLines(newContent);

  const edits = myersDiff(oldLines, newLines);
  const hunks = editsToHunks(oldLines, newLines, edits);

  return {
    oldFile,
    newFile,
    hunks
  };
}

/**
 * Convert diff edits to patch hunks
 */
function editsToHunks(
  oldLines: string[],
  newLines: string[],
  edits: DiffEdit[],
  contextLines: number = 3
): PatchHunk[] {
  const hunks: PatchHunk[] = [];
  let currentHunk: PatchHunk | null = null;

  for (const edit of edits) {
    if (edit.type === "equal") {
      // Add context lines
      if (currentHunk) {
        // Add trailing context
        const contextEnd = Math.min(edit.oldEnd, edit.oldStart + contextLines);
        for (let i = edit.oldStart; i < contextEnd; i++) {
          currentHunk.lines.push({
            type: "context",
            content: oldLines[i]
          });
          currentHunk.oldLines++;
          currentHunk.newLines++;
        }

        // If we've added enough context, close the hunk
        if (edit.oldEnd - edit.oldStart > contextLines * 2) {
          hunks.push(currentHunk);
          currentHunk = null;
        }
      }
    } else {
      // Start new hunk if needed
      if (!currentHunk) {
        const contextStart = Math.max(0, edit.oldStart - contextLines);
        currentHunk = {
          oldStart: contextStart + 1,
          oldLines: 0,
          newStart: contextStart + 1,
          newLines: 0,
          lines: []
        };

        // Add leading context
        for (let i = contextStart; i < edit.oldStart; i++) {
          currentHunk.lines.push({
            type: "context",
            content: oldLines[i]
          });
          currentHunk.oldLines++;
          currentHunk.newLines++;
        }
      }

      if (edit.type === "delete") {
        for (let i = edit.oldStart; i < edit.oldEnd; i++) {
          currentHunk.lines.push({
            type: "delete",
            content: oldLines[i]
          });
          currentHunk.oldLines++;
        }
      } else if (edit.type === "insert") {
        for (let i = edit.newStart; i < edit.newEnd; i++) {
          currentHunk.lines.push({
            type: "add",
            content: newLines[i]
          });
          currentHunk.newLines++;
        }
      }
    }
  }

  if (currentHunk) {
    hunks.push(currentHunk);
  }

  return hunks;
}

/**
 * Three-way merge for cherry-pick
 */
export function threeWayMerge(
  base: string,
  ours: string,
  theirs: string
): PatchResult {
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
