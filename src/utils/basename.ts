/**
 * @fileoverview basename utility functions
 *
 * Utility functions for basename operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/basename.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// export

export function basename(path: string): string {
  const last = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));

  if (last > -1)
    path = path.slice(last + 1);

  return path;
}
