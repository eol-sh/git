/**
 * @fileoverview assert-parameter utility functions
 *
 * Utility functions for assert-parameter operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/assert-parameter.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */

/*** UTILITY ------------------------------------------ ***/

import { MissingParameterError } from "../errors/missing-parameter.ts";

/*** EXPORT ------------------------------------------- ***/

export function assertParameter(name: string, value: any): void {
  if (value === undefined)
    throw new MissingParameterError(name);
}
