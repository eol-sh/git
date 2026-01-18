/**
 * @fileoverview dirname utility functions
 *
 * Utility functions for dirname operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/dirname.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// export

export function dirname(path: string): string {
  const last = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));

  if (last === -1)
    return ".";

  if (last === 0)
    return "/";

  return path.slice(0, last);
}
