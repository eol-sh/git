/**
 * @fileoverview save-stream-to-file utility functions
 *
 * Utility functions for save-stream-to-file operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/save-stream-to-file.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 *//**
 * Save a ReadableStream directly to a file without loading into memory
 */

import { FileSystem } from "../models/file-system.ts";

export interface StreamSaveResult {
  bytesWritten: number;
  sha1?: string;
}

/**
 * Save a ReadableStream to a file, optionally computing SHA-1 hash
 */
export async function saveStreamToFile(
  fs: FileSystem,
  stream: ReadableStream<Uint8Array>,
  filePath: string,
  options: {
    computeSha1?: boolean;
    validateTrailingSha?: boolean; // For packfiles: validate last 20 bytes are SHA-1
  } = {}
): Promise<StreamSaveResult> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  let sha1Hash: string | undefined;

  try {
    // Read stream in chunks
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      chunks.push(value);
      totalBytes += value.length;
    }

    // Concatenate all chunks
    const fullData = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      fullData.set(chunk, offset);
      offset += chunk.length;
    }

    // Compute SHA-1 if requested
    if (options.computeSha1 || options.validateTrailingSha) {
      let dataToHash = fullData;
      
      if (options.validateTrailingSha && fullData.length >= 20) {
        // For packfiles, hash everything except trailing 20 bytes
        dataToHash = fullData.slice(0, -20);
        const trailingBytes = fullData.slice(-20);
        const expectedSha = Array.from(trailingBytes)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        
        // Compute actual SHA
        const hashBuffer = await crypto.subtle.digest("SHA-1", dataToHash);
        const computedSha = Array.from(new Uint8Array(hashBuffer))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
          
        if (computedSha !== expectedSha) {
          throw new Error(`SHA-1 validation failed. Expected: ${expectedSha}, got: ${computedSha}`);
        }
        
        sha1Hash = expectedSha;
      } else {
        // Regular SHA-1 computation
        const hashBuffer = await crypto.subtle.digest("SHA-1", dataToHash);
        sha1Hash = Array.from(new Uint8Array(hashBuffer))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      }
    }

    // Write to file
    await fs.write(filePath, fullData);

    return {
      bytesWritten: totalBytes,
      sha1: sha1Hash
    };

  } finally {
    reader.releaseLock();
  }
}

/**
 * Create a writable stream that saves data to a file
 */
export function createFileWriterStream(
  fs: FileSystem,
  filePath: string
): WritableStream<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let totalSize = 0;

  return new WritableStream<Uint8Array>({
    write(chunk) {
      chunks.push(chunk.slice()); // Copy to avoid mutation
      totalSize += chunk.length;
    },

    async close() {
      // Concatenate and write when stream closes
      const fullData = new Uint8Array(totalSize);
      let offset = 0;
      for (const chunk of chunks) {
        fullData.set(chunk, offset);
        offset += chunk.length;
      }
      await fs.write(filePath, fullData);
    },

    abort(error) {
      throw new Error(`Stream write aborted: ${error}`);
    }
  });
}