


//// export

/**
 * Fallback compression interface for when native isn’t available
 */
export interface CompressionFallback {
  deflate: (data: Uint8Array) => Promise<Uint8Array>;
  gunzip: (data: Uint8Array) => Promise<Uint8Array>;
  gzip: (data: Uint8Array) => Promise<Uint8Array>;
  inflate: (data: Uint8Array) => Promise<Uint8Array>;
}



/**
 * Compress data using native Compression Streams API
 */
export async function deflate(data: Uint8Array, format: "deflate" | "gzip" = "deflate"): Promise<Uint8Array> {
  try {
    const stream = new CompressionStream(format);
    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();

    /*** Start reading immediately to avoid deadlock ***/
    const readPromise = (async() => {
      const chunks: Uint8Array[] = [];

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done)
            break;

          chunks.push(value);
        }

        return chunks;
      } finally {
        reader.releaseLock();
      }
    })();

    /*** Write data and close ***/
    try {
      await writer.write(new Uint8Array(data));
      await writer.close();
    } finally {
      /*** Ensure writer is released ***/
      try {
        writer.releaseLock();
      } catch {
        /***/
      }
    }

    const chunks = await readPromise;
    return concatenateUint8Arrays(chunks);
  } catch(error) {
    /*** Fallback: if native compression isn’t available, we’d need to use npm pako ***/
    throw new Error(`Native compression not available: ${String(error)}`);
  }
}

/**
 * Get compression implementation - native if available, otherwise falls back to provided implementation
 */
export function getCompression(fallback?: CompressionFallback): {
  deflate: (data: Uint8Array) => Promise<Uint8Array>;
  gunzip: (data: Uint8Array) => Promise<Uint8Array>;
  gzip: (data: Uint8Array) => Promise<Uint8Array>;
  inflate: (data: Uint8Array) => Promise<Uint8Array>;
  isNative: boolean;
} {
  if (isNativeCompressionAvailable()) {
    return {
      deflate: (data: Uint8Array) => deflate(data, "deflate"),
      gunzip,
      gzip,
      inflate: (data: Uint8Array) => inflate(data, "deflate"),
      isNative: true
    };
  } else if (fallback) {
    return {
      ...fallback,
      isNative: false
    };
  } else {
    throw new Error("No compression implementation available.");
  }
}

/**
 * Decompress gzipped data
 */
export function gunzip(data: Uint8Array): Promise<Uint8Array> {
  return inflate(data, "gzip");
}

/**
 * Compress data with gzip
 */
export function gzip(data: Uint8Array): Promise<Uint8Array> {
  return deflate(data, "gzip");
}

/**
 * Decompress data using native Decompression Streams API
 */
export async function inflate(data: Uint8Array, format: "deflate" | "gzip" = "deflate"): Promise<Uint8Array> {
  try {
    const stream = new DecompressionStream(format);
    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();

    /*** Start reading immediately to avoid deadlock ***/
    const readPromise = (async() => {
      const chunks: Uint8Array[] = [];

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done)
            break;

          chunks.push(value);
        }

        return chunks;
      } finally {
        reader.releaseLock();
      }
    })();

    /*** Write data and close ***/
    try {
      await writer.write(new Uint8Array(data));
      await writer.close();
    } finally {
      /*** Ensure writer is released ***/
      try {
        writer.releaseLock();
      } catch {
        /***/
      }
    }

    const chunks = await readPromise;
    return concatenateUint8Arrays(chunks);
  } catch(error) {
    throw new Error(`Native decompression not available: ${String(error)}`);
  }
}

/**
 * Check if native compression is available
 */
export function isNativeCompressionAvailable(): boolean {
  try {
    /*** Test if CompressionStream constructor exists ***/
    return typeof CompressionStream !== "undefined" && typeof DecompressionStream !== "undefined";
  } catch {
    return false;
  }
}



//// helper

/**
 * Helper function to concatenate multiple Uint8Arrays
 */
function concatenateUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }

  return result;
}
