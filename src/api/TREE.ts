/**
 * @fileoverview Git tree API - High-level user interface
 *
 * This module provides the public API for tree operations in the Git implementation.
 * It handles parameter validation, file system adaptation, and error handling.
 *
 * @module api/tree.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// export

/**
 * Get a git commit `Walker`
 *
 * See [walk](./walk.md)
 */
export { TREE } from "../commands/tree.ts";
