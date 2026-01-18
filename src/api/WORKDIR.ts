/**
 * @fileoverview Git workdir API - High-level user interface
 *
 * This module provides the public API for workdir operations in the Git implementation.
 * It handles parameter validation, file system adaptation, and error handling.
 *
 * @module api/workdir.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// export

/**
 * Get a working directory `Walker`
 *
 * See [walk](./walk.md)
 */
export { WORKDIR } from "../commands/workdir.ts";
