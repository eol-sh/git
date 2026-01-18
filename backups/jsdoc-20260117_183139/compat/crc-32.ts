


//// util

import { CRC32 } from "../utils/deno-native.ts";

const crc32 = {
  buf: (data: Uint8Array) => CRC32.calculate(data),
  str: (text: string) => CRC32.calculate(new TextEncoder().encode(text))
};



//// export

export default crc32;
