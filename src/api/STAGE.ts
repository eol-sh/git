/**
 * @fileoverview Git stage API - High-level user interface
 *
 * This module provides the public API for stage operations in the Git implementation.
 * It handles parameter validation, file system adaptation, and error handling.
 *
 * @module api/stage.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// export

/**
 * Get a git index Walker
 *
 * See [walk](./walk.md)
 */
export { STAGE } from "../commands/stage.ts";
