/**
 * @fileoverview worth-walking utility functions
 *
 * Utility functions for worth-walking operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/worth-walking.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// export

export const worthWalking = (filepath: string, root?: string | null): boolean => {
  if (filepath === "." || root == null || root.length === 0 || root === ".")
    return true;

  if (root.length >= filepath.length)
    return root.startsWith(filepath);
  else
    return filepath.startsWith(root);
};
