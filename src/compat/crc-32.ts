/**
 * @fileoverview crc-32 implementation
 *
 * Implementation of crc-32 functionality for the Git system.
 *
 * @module compat/crc-32.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { CRC32 } from "../utils/deno-native.ts";

const crc32 = {
  buf: (data: Uint8Array) => CRC32.calculate(data),
  str: (text: string) => CRC32.calculate(new TextEncoder().encode(text))
};



//// export

export default crc32;
