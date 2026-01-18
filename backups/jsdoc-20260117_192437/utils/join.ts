


//// import

import { join as denoJoin } from "jsr:@std/path@1.1.2/join";




//// export

export function join(...paths: string[]): string {
  return denoJoin(...(paths as [string, ...string[]]));
}
