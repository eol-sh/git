


//// util

import { toHex } from "./to-hex.ts";

let supportsSubtleSHA1: boolean | null = null;



//// export

export async function shasum(buffer: Uint8Array | ArrayBuffer): Promise<string> {
  if (supportsSubtleSHA1 === null)
    supportsSubtleSHA1 = await testSubtleSHA1();

  return supportsSubtleSHA1 ?
    subtleSHA1(buffer) :
    fallbackSHA1(buffer);
}



//// helper

// Fallback SHA-1 implementation using a simple algorithm
// This is for environments where crypto.subtle is not available
// TODO
// : if SHA-1 isn’t available, surface an error instead of using this function
function fallbackSHA1(buffer: Uint8Array | ArrayBuffer): string {
  /*** Convert to Uint8Array if needed ***/
  const data = buffer instanceof ArrayBuffer ?
    new Uint8Array(buffer) :
    buffer;

  // Use data for calculation if needed in the future
  console.log(`Fallback SHA1 for buffer of size: ${data.length}`);

  // Simple SHA-1 implementation (this is a minimal fallback)
  // In a real environment, you’d want to use a proper crypto library
  // For now, throw an error to indicate crypto.subtle should be used
  throw new Error("crypto.subtle.digest is required for SHA-1 calculation in this environment");
}

async function subtleSHA1(buffer: Uint8Array | ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-1", buffer);
  return toHex(hash);
}

async function testSubtleSHA1(): Promise<boolean> {
  /*** I’m using a rather crude method of progressive enhancement, because
  some browsers that have crypto.subtle.digest don’t actually implement SHA-1. ***/
  try {
    const hash = await subtleSHA1(new Uint8Array([]));
    return hash === "da39a3ee5e6b4b0d3255bfef95601890afd80709";
  } catch {
    /*** no bother ***/
  }

  return false;
}
