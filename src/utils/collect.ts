/**
 * @fileoverview collect utility functions
 *
 * Utility functions for collect operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/collect.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// export

export async function collect(iterable: AsyncIterable<Uint8Array>): Promise<Uint8Array> {
  const buffers: Uint8Array[] = [];
  let totalSize = 0;

  for await (const chunk of iterable) {
    buffers.push(chunk);
    totalSize += chunk.byteLength;
  }

  const result = new Uint8Array(totalSize);
  let offset = 0;

  for (const buffer of buffers) {
    result.set(buffer, offset);
    offset += buffer.byteLength;
  }

  return result;
}
