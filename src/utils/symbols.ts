/**
 * @fileoverview symbols utility functions
 *
 * Utility functions for symbols operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/symbols.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// export

// This is part of an elaborate system to facilitate code-splitting / tree-shaking.
// commands/walk.js can depend on only this, and the actual Walker classes exported
// can be opaque - only having a single property (this symbol) that is not enumerable,
// and thus the constructor can be passed as an argument to walk while being "unusable"
// outside of it.
export const GitWalkSymbol = Symbol("GitWalkSymbol");
