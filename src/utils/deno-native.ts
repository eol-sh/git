/**
 * Deno-native implementations replacing npm packages
 * This file provides native Deno alternatives to Node.js npm packages
 */



//// import

import * as denoPath from "jsr:@std/path@1.1.2";



//// export

export const compression = {
  deflate: async(data: Uint8Array): Promise<Uint8Array> => {
    try {
      const stream = new CompressionStream("deflate");
      const reader = stream.readable.getReader();
      const writer = stream.writable.getWriter();

      /*** Start reading before writing to avoid deadlock ***/
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
      await writer.write(data);
      await writer.close();

      const chunks = await readPromise;

      /*** Concatenate chunks ***/
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;

      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }

      return result;
    } catch {
      /*** Fallback: return the original data (no compression) ***/
      return data;
    }
  },
  inflate: async(data: Uint8Array): Promise<Uint8Array> => {
    try {
      const stream = new DecompressionStream("deflate");
      const reader = stream.readable.getReader();
      const writer = stream.writable.getWriter();

      // Start reading before writing to avoid deadlock
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

      // Write data and close
      await writer.write(data);
      await writer.close();

      const chunks = await readPromise;

      // Concatenate chunks
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;

      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }

      return result;
    } catch {
      // Fallback: return the original data (assume it"s uncompressed)
      return data;
    }
  }
};

export const crypto = {
  /*** Convert ArrayBuffer to hex string ***/
  arrayBufferToHex: (buffer: ArrayBuffer): string => {
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  },
  /*** SHA-1 implementation ***/
  sha1: async(data: Uint8Array | string): Promise<ArrayBuffer> => {
    const encoder = new TextEncoder();

    const dataBuffer = typeof data === "string" ?
      encoder.encode(data) :
      data;

    return await globalThis.crypto.subtle.digest("SHA-1", dataBuffer as ArrayBuffer | DataView | Uint8Array);
  },
  /*** SHA-256 implementation ***/
  sha256: async(data: Uint8Array | string): Promise<ArrayBuffer> => {
    const encoder = new TextEncoder();

    const dataBuffer = typeof data === "string" ?
      encoder.encode(data) :
      data;

    return await globalThis.crypto.subtle.digest("SHA-256", dataBuffer as ArrayBuffer | DataView | Uint8Array);
  }
};

export const http = {
  get: async(url: string, options: RequestInit = {}): Promise<Response> => {
    return await fetch(url, { ...options, method: "GET" });
  },
  post: async(url: string, options: RequestInit = {}): Promise<Response> => {
    return await fetch(url, { ...options, method: "POST" });
  }
};

export const path = {
  basename: denoPath.basename,
  dirname: denoPath.dirname,
  extname: denoPath.extname,
  format: denoPath.format,
  isAbsolute: denoPath.isAbsolute,
  join: denoPath.join,
  normalize: denoPath.normalize,
  parse: denoPath.parse,
  relative: denoPath.relative,
  resolve: denoPath.resolve,
  sep: denoPath.SEPARATOR
};

export const ReadableStreamPolyfill = ReadableStream;
export const TransformStreamPolyfill = TransformStream;
export const WritableStreamPolyfill = WritableStream;

/*** Minimist replacement for command line argument parsing ***/
export function parseArgs(args: string[]): Record<string, any> {
  const result: Record<string, any> = { _: [] };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];

      if (nextArg && !nextArg.startsWith("-")) {
        result[key] = nextArg;
        i++;
      } else {
        result[key] = true;
      }
    } else if (arg.startsWith("-")) {
      const key = arg.slice(1);
      const nextArg = args[i + 1];

      if (nextArg && !nextArg.startsWith("-")) {
        result[key] = nextArg;
        i++;
      } else {
        result[key] = true;
      }
    } else {
      result._.push(arg);
    }
  }

  return result;
}

/*** Replace "pify" - promisify utility (not needed in Deno/modern JS) ***/
export function promisify<T extends any[], R>(fn: (...args: [...T, (err: any, result?: R) => void]) => void): (...args: T) => Promise<R> {
  return (...args: T) => {
    return new Promise<R>((resolve, reject) => {
      fn(...args, (err: any, result?: R) => {
        if (err)
          reject(err);
        else
          resolve(result!);
      });
    });
  };
}



/*** Simple async lock implementation to replace "async-lock" ***/
export class AsyncLock {
  private locks = new Map<string, Promise<void>>();

  async acquire<T>(key: string, fn: () => Promise<T> | T): Promise<T> {
    /*** Wait for any existing lock ***/
    while (this.locks.has(key)) {
      await this.locks.get(key);
    }

    /*** Create new lock ***/
    let resolve: () => void;

    const lockPromise = new Promise<void>((res) => {
      resolve = res;
    });

    this.locks.set(key, lockPromise);

    try {
      const result = await fn();
      return result;
    } finally {
      /*** Release lock ***/
      this.locks.delete(key);
      resolve!();
    }
  }
}

/*** CRC32 implementation to replace "crc-32" ***/
export class CRC32 {
  private static table: number[] | undefined;

  private static generateTable(): number[] {
    const table = new Array(256);

    for (let i = 0; i < 256; i++) {
      let c = i;

      for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }

      table[i] = c;
    }

    return table;
  }

  static calculate(data: Uint8Array): number {
    if (!this.table)
      this.table = this.generateTable();

    let crc = 0xFFFFFFFF;

    for (let i = 0; i < data.length; i++) {
      crc = (crc >>> 8) ^ this.table[(crc ^ data[i]) & 0xFF];
    }

    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
}



/*** Default exports to match original npm package APIs ***/
export default AsyncLock; /*** For async-lock package ***/
