


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

// Fallback SHA-1 implementation using pure JavaScript
// This is for environments where crypto.subtle is not available
function fallbackSHA1(buffer: Uint8Array | ArrayBuffer): string {
  /*** Convert to Uint8Array if needed ***/
  const data = buffer instanceof ArrayBuffer ?
    new Uint8Array(buffer) :
    buffer;

  return sha1Pure(data);
}

/**
 * Pure JavaScript SHA-1 implementation
 * Based on RFC 3174 specification
 */
function sha1Pure(data: Uint8Array): string {
  // SHA-1 constants
  const h = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0];
  
  // Pre-processing: padding message
  const ml = data.length * 8; // message length in bits
  const paddingLength = (55 - (data.length % 64)) % 64;
  const paddedLength = data.length + 1 + paddingLength + 8;
  
  const padded = new Uint8Array(paddedLength);
  padded.set(data, 0);
  padded[data.length] = 0x80; // append '1' bit
  
  // Append length as 64-bit big-endian integer
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 8, 0, false); // high 32 bits (0 for lengths < 2^32)
  view.setUint32(paddedLength - 4, ml, false); // low 32 bits
  
  // Process 512-bit chunks
  for (let chunk = 0; chunk < paddedLength; chunk += 64) {
    const w = new Uint32Array(80);
    
    // Break chunk into sixteen 32-bit big-endian words
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(chunk + i * 4, false);
    }
    
    // Extend the sixteen 32-bit words into eighty 32-bit words
    for (let i = 16; i < 80; i++) {
      w[i] = rotateLeft(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
    }
    
    // Initialize hash value for this chunk
    let a = h[0];
    let b = h[1];
    let c = h[2];
    let d = h[3];
    let e = h[4];
    
    // Main loop
    for (let i = 0; i < 80; i++) {
      let f: number;
      let k: number;
      
      if (i < 20) {
        f = (b & c) | (~b & d);
        k = 0x5A827999;
      } else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ED9EBA1;
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8F1BBCDC;
      } else {
        f = b ^ c ^ d;
        k = 0xCA62C1D6;
      }
      
      const temp = (rotateLeft(a, 5) + f + e + k + w[i]) >>> 0;
      e = d;
      d = c;
      c = rotateLeft(b, 30);
      b = a;
      a = temp;
    }
    
    // Add this chunk's hash to result so far
    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
  }
  
  // Convert to hex string
  return h.map(val => val.toString(16).padStart(8, '0')).join('');
}

function rotateLeft(value: number, shift: number): number {
  return ((value << shift) | (value >>> (32 - shift))) >>> 0;
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
