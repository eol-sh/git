/**
 * @fileoverview sleep utility functions
 *
 * Utility functions for sleep operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/sleep.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// export

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
