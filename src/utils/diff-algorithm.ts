/**
 * Myers Diff Algorithm implementation
 * Efficiently computes the difference between two sequences
 */

export interface DiffEdit {
  type: "equal" | "insert" | "delete";
  oldStart: number;
  oldEnd: number;
  newStart: number;
  newEnd: number;
}

/**
 * Myers diff algorithm - finds shortest edit script between two arrays
 */
export function myersDiff<T>(
  oldArray: T[],
  newArray: T[],
  equals: (a: T, b: T) => boolean = (a, b) => a === b
): DiffEdit[] {
  const N = oldArray.length;
  const M = newArray.length;
  const MAX = N + M;
  
  const v: { [key: number]: number } = { 1: 0 };
  const trace: Array<{ [key: number]: number }> = [];
  
  // Find the shortest edit script
  for (let d = 0; d <= MAX; d++) {
    trace.push({ ...v });
    
    for (let k = -d; k <= d; k += 2) {
      let x: number;
      
      if (k === -d || (k !== d && v[k - 1] < v[k + 1])) {
        x = v[k + 1];
      } else {
        x = v[k - 1] + 1;
      }
      
      let y = x - k;
      
      while (x < N && y < M && equals(oldArray[x], newArray[y])) {
        x++;
        y++;
      }
      
      v[k] = x;
      
      if (x === N && y === M) {
        return backtrack(trace, oldArray, newArray, equals);
      }
    }
  }
  
  return [];
}

/**
 * Backtrack through the trace to build the edit script
 */
function backtrack<T>(
  trace: Array<{ [key: number]: number }>,
  oldArray: T[],
  newArray: T[],
  equals: (a: T, b: T) => boolean
): DiffEdit[] {
  const edits: DiffEdit[] = [];
  
  let x = oldArray.length;
  let y = newArray.length;
  
  for (let d = trace.length - 1; d >= 0 && (x > 0 || y > 0); d--) {
    const v = trace[d];
    const k = x - y;
    
    let prevK: number;
    if (k === -d || (k !== d && v[k - 1] < v[k + 1])) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }
    
    const prevX = v[prevK] || 0;
    const prevY = prevX - prevK;
    
    // Add equal segments
    while (x > prevX && y > prevY && equals(oldArray[x - 1], newArray[y - 1])) {
      x--;
      y--;
    }
    
    if (x > prevX && y > prevY) {
      edits.unshift({
        type: "equal",
        oldStart: prevX,
        oldEnd: x,
        newStart: prevY,
        newEnd: y
      });
    }
    
    // Add insert or delete
    if (prevX === x) {
      edits.unshift({
        type: "insert",
        oldStart: x,
        oldEnd: x,
        newStart: prevY,
        newEnd: y
      });
    } else {
      edits.unshift({
        type: "delete",
        oldStart: prevX,
        oldEnd: x,
        newStart: y,
        newEnd: y
      });
    }
    
    x = prevX;
    y = prevY;
  }
  
  // Merge consecutive edits of the same type
  const merged: DiffEdit[] = [];
  for (const edit of edits) {
    const last = merged[merged.length - 1];
    if (last && last.type === edit.type) {
      last.oldEnd = edit.oldEnd;
      last.newEnd = edit.newEnd;
    } else if (edit.type !== "equal" || edit.oldEnd > edit.oldStart) {
      merged.push(edit);
    }
  }
  
  return merged;
}

/**
 * Split text into lines for diffing
 */
export function splitLines(text: string): string[] {
  if (!text) return [];
  const lines = text.split(/\r?\n/);
  // Keep empty line at end if text ends with newline
  if (text.endsWith("\n") || text.endsWith("\r\n")) {
    lines.push("");
  }
  return lines;
}

/**
 * Create unified diff format from edit script
 */
export function createUnifiedDiff(
  oldLines: string[],
  newLines: string[],
  edits: DiffEdit[],
  contextLines: number = 3
): string[] {
  const result: string[] = [];
  const hunks: Array<{
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    lines: string[];
  }> = [];
  
  let currentHunk: typeof hunks[0] | null = null;
  
  for (const edit of edits) {
    if (edit.type === "equal") {
      const contextStart = Math.max(0, edit.oldEnd - contextLines);
      const contextEnd = Math.min(oldLines.length, edit.oldStart + contextLines);
      
      // Add context before
      if (currentHunk && edit.oldStart - currentHunk.oldStart - currentHunk.oldLines <= contextLines * 2) {
        // Extend current hunk
        for (let i = edit.oldStart; i < Math.min(edit.oldEnd, edit.oldStart + contextLines); i++) {
          currentHunk.lines.push(" " + oldLines[i]);
          currentHunk.oldLines++;
          currentHunk.newLines++;
        }
      } else {
        // Start new hunk if needed
        if (currentHunk) {
          hunks.push(currentHunk);
        }
        if (edit.oldEnd - edit.oldStart > contextLines * 2 && 
            (edits.indexOf(edit) < edits.length - 1)) {
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
        
        // Add context before
        for (let i = contextStart; i < edit.oldStart; i++) {
          currentHunk.lines.push(" " + oldLines[i]);
          currentHunk.oldLines++;
          currentHunk.newLines++;
        }
      }
      
      if (edit.type === "delete") {
        for (let i = edit.oldStart; i < edit.oldEnd; i++) {
          currentHunk.lines.push("-" + oldLines[i]);
          currentHunk.oldLines++;
        }
      } else if (edit.type === "insert") {
        for (let i = edit.newStart; i < edit.newEnd; i++) {
          currentHunk.lines.push("+" + newLines[i]);
          currentHunk.newLines++;
        }
      }
    }
  }
  
  if (currentHunk) {
    hunks.push(currentHunk);
  }
  
  // Format hunks
  for (const hunk of hunks) {
    result.push(
      `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`
    );
    result.push(...hunk.lines);
  }
  
  return result;
}