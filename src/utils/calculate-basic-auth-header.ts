/**
 * @fileoverview calculate-basic-auth-header utility functions
 *
 * Utility functions for calculate-basic-auth-header operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/calculate-basic-auth-header.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import type { AuthOptions } from "../types.ts";



//// export

export function calculateBasicAuthHeader({ password = "", username = "" }: AuthOptions): string {
  return `Basic ${btoa(`${username}:${password}`)}`;
}
