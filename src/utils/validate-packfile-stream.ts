/**
 * Streaming packfile validation utilities
 * Validates packfile integrity without loading entire file into memory
 */

import { InternalError } from "../errors/internal.ts";

interface StreamValidationResult {
  isValid: boolean;
  computedSha: string;
  expectedSha: string;
  error?: string;
}

/**
 * Validate a packfile stream by computing SHA-1 of all content except the trailing 20 bytes
 * and comparing with the trailing 20 bytes (which contain the expected SHA)
 */
export async function validatePackfileStream(
  stream: ReadableStream<Uint8Array>
): Promise<StreamValidationResult> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalSize = 0;

  try {
    // Read all chunks from stream
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      chunks.push(value);
      totalSize += value.length;
    }

    if (totalSize < 20) {
      return {
        isValid: false,
        computedSha: "",
        expectedSha: "",
        error: "Packfile too small to contain SHA checksum"
      };
    }

    // Concatenate all chunks
    const fullPackfile = new Uint8Array(totalSize);
    let offset = 0;
    for (const chunk of chunks) {
      fullPackfile.set(chunk, offset);
      offset += chunk.length;
    }

    // Extract expected SHA from last 20 bytes
    const expectedShaBytes = fullPackfile.slice(-20);
    const expectedSha = Array.from(expectedShaBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Compute SHA of everything except the last 20 bytes
    const contentToHash = fullPackfile.slice(0, -20);
    const hashBuffer = await crypto.subtle.digest("SHA-1", contentToHash);
    const computedShaBytes = new Uint8Array(hashBuffer);
    const computedSha = Array.from(computedShaBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const isValid = computedSha === expectedSha;

    return {
      isValid,
      computedSha,
      expectedSha,
      error: isValid ? undefined : "SHA checksum mismatch"
    };

  } catch (error) {
    return {
      isValid: false,
      computedSha: "",
      expectedSha: "",
      error: `Validation failed: ${(error as Error).message}`
    };
  } finally {
    reader.releaseLock();
  }
}

/**
 * Create a transform stream that validates packfile integrity while passing data through
 * This allows for validation without buffering the entire packfile in memory
 */
export function createPackfileValidationTransform(): {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
  getValidationResult: () => Promise<StreamValidationResult>;
} {
  const chunks: Uint8Array[] = [];
  let totalSize = 0;
  let validationPromise: Promise<StreamValidationResult>;
  let resolveValidation: (result: StreamValidationResult) => void;

  // Create the validation promise that will be resolved when stream ends
  validationPromise = new Promise((resolve) => {
    resolveValidation = resolve;
  });

  const writable = new WritableStream<Uint8Array>({
    write(chunk) {
      chunks.push(chunk.slice()); // Copy chunk to avoid mutation
      totalSize += chunk.length;
    },

    close() {
      // Validate when stream is closed
      validateChunks().then(resolveValidation);
    },

    abort(error) {
      resolveValidation({
        isValid: false,
        computedSha: "",
        expectedSha: "",
        error: `Stream aborted: ${error}`
      });
    }
  });

  const readable = new ReadableStream<Uint8Array>({
    start(controller) {
      // Set up transform logic
    },

    pull(controller) {
      // Pass through data as it comes
      if (chunks.length > 0) {
        const chunk = chunks.shift()!;
        controller.enqueue(chunk);
      }
    }
  });

  async function validateChunks(): Promise<StreamValidationResult> {
    try {
      if (totalSize < 20) {
        return {
          isValid: false,
          computedSha: "",
          expectedSha: "",
          error: "Packfile too small to contain SHA checksum"
        };
      }

      // Concatenate all chunks
      const fullPackfile = new Uint8Array(totalSize);
      let offset = 0;
      for (const chunk of chunks) {
        fullPackfile.set(chunk, offset);
        offset += chunk.length;
      }

      // Extract expected SHA from last 20 bytes
      const expectedShaBytes = fullPackfile.slice(-20);
      const expectedSha = Array.from(expectedShaBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      // Compute SHA of everything except the last 20 bytes
      const contentToHash = fullPackfile.slice(0, -20);
      const hashBuffer = await crypto.subtle.digest("SHA-1", contentToHash);
      const computedShaBytes = new Uint8Array(hashBuffer);
      const computedSha = Array.from(computedShaBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const isValid = computedSha === expectedSha;

      return {
        isValid,
        computedSha,
        expectedSha,
        error: isValid ? undefined : "SHA checksum mismatch"
      };

    } catch (error) {
      return {
        isValid: false,
        computedSha: "",
        expectedSha: "",
        error: `Validation failed: ${(error as Error).message}`
      };
    }
  }

  return {
    readable,
    writable,
    getValidationResult: () => validationPromise
  };
}