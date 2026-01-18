/**
 * @fileoverview normalize-stats utility functions
 *
 * Utility functions for normalize-stats operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/normalize-stats.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { normalizeMode } from "./normalize-mode.ts";

const MAX_UINT32 = 2 ** 32;

interface FileStats {
  ctime?: Date;
  ctimeMs?: number;
  ctimeNanoseconds?: number;
  ctimeSeconds?: number;
  dev: number;
  gid: number;
  ino: number;
  mode: number;
  mtime?: Date;
  mtimeMs?: number;
  mtimeNanoseconds?: number;
  mtimeSeconds?: number;
  size: number;
  uid: number;
}

interface NormalizedStats {
  ctimeNanoseconds: number;
  ctimeSeconds: number;
  dev: number;
  gid: number;
  ino: number;
  mode: number;
  mtimeNanoseconds: number;
  mtimeSeconds: number;
  size: number;
  uid: number;
}



//// export

export function normalizeStats(e: FileStats): NormalizedStats {
  const [ctimeSeconds, ctimeNanoseconds] = SecondsNanoseconds(
    e.ctimeSeconds,
    e.ctimeNanoseconds,
    e.ctimeMs,
    e.ctime
  );

  const [mtimeSeconds, mtimeNanoseconds] = SecondsNanoseconds(
    e.mtimeSeconds,
    e.mtimeNanoseconds,
    e.mtimeMs,
    e.mtime
  );

  return {
    ctimeNanoseconds: ctimeNanoseconds % MAX_UINT32,
    ctimeSeconds: ctimeSeconds % MAX_UINT32,
    dev: e.dev % MAX_UINT32,
    gid: e.gid % MAX_UINT32,
    ino: e.ino % MAX_UINT32,
    mode: normalizeMode(e.mode % MAX_UINT32),
    mtimeNanoseconds: mtimeNanoseconds % MAX_UINT32,
    mtimeSeconds: mtimeSeconds % MAX_UINT32,
    /*** size of -1 happens over a BrowserFS HTTP Backend that doesn’t serve Content-Length headers
    (like the Karma webserver) because BrowserFS HTTP Backend uses HTTP HEAD requests to do fs.stat ***/
    size: e.size > -1 ? e.size % MAX_UINT32 : 0,
    uid: e.uid % MAX_UINT32
  };
}



//// helper

function SecondsNanoseconds(
  givenSeconds?: number,
  givenNanoseconds?: number,
  milliseconds?: number,
  date?: Date
): [number, number] {
  if (givenSeconds !== undefined && givenNanoseconds !== undefined)
    return [givenSeconds, givenNanoseconds];

  if (milliseconds === undefined)
    milliseconds = date?.valueOf() || Date.now();

  const seconds = Math.floor(milliseconds / 1000);
  const nanoseconds = (milliseconds - seconds * 1000) * 1000000;

  return [seconds, nanoseconds];
}
