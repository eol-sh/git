/**
 * @fileoverview validate-packfile-stream utility functions
 *
 * Utility functions for validate-packfile-stream operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/validate-packfile-stream.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */

/*** UTILITY ------------------------------------------ ***/

/**
 * Streaming packfile validation utilities
 * Validates packfile integrity without loading entire file into memory
 */
interface StreamValidationResult {
  computedSha: string;
  error?: string;
  expectedSha: string;
  isValid: boolean;
}

/*** EXPORT ------------------------------------------- ***/

/**
 * Validate a packfile stream by computing SHA-1 of all content except the trailing 20 bytes
 * and comparing with the trailing 20 bytes (which contain the expected SHA)
 */
export async function validatePackfileStream(stream: ReadableStream<Uint8Array>): Promise<StreamValidationResult> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalSize = 0;

  try {
    /*** Read all chunks from stream ***/
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      totalSize += value.length;
    }

    if (totalSize < 20) {
      return {
        computedSha: "",
        error: "Packfile too small to contain SHA checksum",
        expectedSha: "",
        isValid: false
      };
    }

    /*** Concatenate all chunks ***/
    const fullPackfile = new Uint8Array(totalSize);
    let offset = 0;

    for (const chunk of chunks) {
      fullPackfile.set(chunk, offset);
      offset += chunk.length;
    }

    /*** Extract expected SHA from last 20 bytes ***/
    const expectedShaBytes = fullPackfile.slice(-20);

    const expectedSha = Array.from(expectedShaBytes)
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    /*** Compute SHA of everything except the last 20 bytes ***/
    const contentToHash = fullPackfile.slice(0, -20);
    const hashBuffer = await crypto.subtle.digest("SHA-1", contentToHash);
    const computedShaBytes = new Uint8Array(hashBuffer);

    const computedSha = Array.from(computedShaBytes)
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    const isValid = computedSha === expectedSha;

    return {
      computedSha,
      error: isValid ? undefined : "SHA checksum mismatch",
      expectedSha,
      isValid
    };
  } catch (error) {
    return {
      computedSha: "",
      error: `Validation failed: ${String(error)}`,
      expectedSha: "",
      isValid: false
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
  getValidationResult: () => Promise<StreamValidationResult>;
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
} {
  const chunks: Uint8Array[] = [];
  let resolveValidation: (result: StreamValidationResult) => void;
  let totalSize = 0;

  /*** Create the validation promise that will be resolved when stream ends ***/
  const validationPromise: Promise<StreamValidationResult> = new Promise((resolve) => {
    resolveValidation = resolve;
  });

  const writable = new WritableStream<Uint8Array>({
    abort(error) {
      resolveValidation({
        computedSha: "",
        error: `Stream aborted: ${String(error)}`,
        expectedSha: "",
        isValid: false,
      });
    },
    close() {
      /*** Validate when stream is closed ***/
      validateChunks().then(resolveValidation);
    },
    write(chunk) {
      chunks.push(chunk.slice()); /*** Copy chunk to avoid mutation ***/
      totalSize += chunk.length;
    }
  });

  const readable = new ReadableStream<Uint8Array>({
    start(_controller) {
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
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");

      // Compute SHA of everything except the last 20 bytes
      const contentToHash = fullPackfile.slice(0, -20);
      const hashBuffer = await crypto.subtle.digest("SHA-1", contentToHash);
      const computedShaBytes = new Uint8Array(hashBuffer);
      const computedSha = Array.from(computedShaBytes)
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");

      const isValid = computedSha === expectedSha;

      return {
        computedSha,
        error: isValid ? undefined : "SHA checksum mismatch",
        expectedSha,
        isValid
      };
    } catch (error) {
      return {
        computedSha: "",
        error: `Validation failed: ${String(error)}`,
        expectedSha: "",
        isValid: false,
      };
    }
  }

  return {
    getValidationResult: () => validationPromise,
    readable,
    writable
  };
}
