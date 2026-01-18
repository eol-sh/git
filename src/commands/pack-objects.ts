/**
 * @fileoverview Git pack-objects command implementation
 *
 * Internal implementation of the pack-objects Git operation. This module contains
 * the core logic and should not be used directly - use the API layer instead.
 *
 * @module commands/pack-objects.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 * @internal
 */


//// import

import { Buffer } from "node:buffer";

//// util

import { _pack } from "./pack.ts";
import { collect } from "../utils/collect.ts";
import { join } from "../utils/join.ts";

import type { Cache, FsInterface, PackObjectsResult } from "../types.ts";

interface PackObjectsOptions {
  cache: Cache;
  fs: FsInterface;
  gitdir: string;
  oids: string[];
  write: boolean;
}



//// export

export async function _packObjects({ cache, fs, gitdir, oids, write }: PackObjectsOptions): Promise<PackObjectsResult> {
  const buffers = await _pack({ cache, fs, gitdir, oids });
  const packfile = Buffer.from(await collect(buffers as any));
  const packfileSha = packfile.slice(-20).toString("hex");
  const filename = `pack-${packfileSha}.pack`;

  if (write) {
    await fs.writeFile(join(gitdir, `objects/pack/${filename}`), packfile);
    return { filename };
  }

  return {
    filename,
    packfile: new Uint8Array(packfile)
  };
}
