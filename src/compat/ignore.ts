/**
 * @fileoverview ignore implementation
 *
 * Implementation of ignore functionality for the Git system.
 *
 * @module compat/ignore.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { createGitIgnore } from "../utils/gitignore-native.ts";

function ignore() {
  return createGitIgnore();
}



//// export

export default ignore;
