/* global DecompressionStream */



//// util

import pako from "../compat/pako.ts";

let supportsDecompressionStream: boolean | null = null;



//// export

export function inflate(buffer: Uint8Array): Promise<Uint8Array> {
  if (supportsDecompressionStream === null)
    supportsDecompressionStream = testDecompressionStream();

  return supportsDecompressionStream ?
    browserInflate(buffer) :
    pako.inflate(buffer);
}



//// helper

async function browserInflate(buffer: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("deflate");
  const d = new Blob([new Uint8Array(buffer)]).stream().pipeThrough(ds);

  return new Uint8Array(await new Response(d).arrayBuffer());
}

function testDecompressionStream(): boolean {
  try {
    const ds = new DecompressionStream("deflate");

    if (ds)
      return true;
  } catch {
    /*** no bother ***/
  }

  return false;
}
