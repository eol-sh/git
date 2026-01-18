/**
 * @fileoverview file-system model definition
 *
 * Defines the file-system class and related types for representing
 * Git objects and data structures in the implementation.
 *
 * @module models/file-system.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// import

import { Buffer } from "node:buffer";

//// util

import { compareStrings } from "../utils/compare-strings.ts";
import { dirname } from "../utils/dirname.ts";
import { isPromiseLike } from "../utils/types.ts";
import { rmRecursive } from "../utils/rm-recursive.ts";

import type { FsInterface as _FsInterface } from "../types.ts";

interface FileStats {
  atime: Date;
  ctime: Date;
  dev?: number;
  gid?: number;
  ino?: number;
  isDirectory(): boolean;
  isFile(): boolean;
  isSymbolicLink(): boolean;
  mode: number;
  mtime: Date;
  nlink?: number;
  size: number;
  uid?: number;
}

interface FileSystemOptions {
  autocrlf?: string;
  encoding?: string;
}

interface RawFs {
  [key: string]: unknown;
  lstat?: (...args: unknown[]) => unknown;
  mkdir?: (...args: unknown[]) => unknown;
  promises?: unknown;
  readdir?: (...args: unknown[]) => unknown;
  readFile?: (...args: unknown[]) => unknown;
  readlink?: (...args: unknown[]) => unknown;
  rm?: (...args: unknown[]) => unknown;
  rmdir?: (...args: unknown[]) => unknown;
  stat?: (...args: unknown[]) => unknown;
  symlink?: (...args: unknown[]) => unknown;
  unlink?: (...args: unknown[]) => unknown;
  writeFile?: (...args: unknown[]) => unknown;
}

type FsLike = RawFs | any;

interface RmOptions {
  force?: boolean;
  recursive?: boolean;
}

/*** List of commands all filesystems are expected to provide. `rm` is not
included since it may not exist and must be handled as a special case ***/
const commands = [
  "lstat",
  "mkdir",
  "readdir",
  "readFile",
  "readlink",
  "rmdir",
  "stat",
  "symlink",
  "unlink",
  "writeFile"
] as const;



//// export

/**
 * This is just a collection of helper functions really. At least that’s how it started.
 */
export class FileSystem {
  private _lstat!: (filepath: string) => Promise<FileStats>;
  private _mkdir!: (filepath: string) => Promise<void>;
  private _readdir!: (filepath: string) => Promise<string[]>;
  private _readFile!: (filepath: string, options?: unknown) => Promise<Uint8Array>;
  private _readlink!: (filename: string, opts?: unknown) => Promise<string | Uint8Array>;
  private _rm!: (filepath: string, opts?: RmOptions) => Promise<void>;
  private _rmdir!: (filepath: string) => Promise<void>;
  private _stat!: (filepath: string) => Promise<FileStats>;
  private _symlink!: (target: string, filepath: string) => Promise<void>;
  private _unlink!: (filepath: string) => Promise<void>;
  private _writeFile!: (filepath: string, contents: Uint8Array | string, options?: unknown) => Promise<void>;

  constructor(fs: FsLike) {
    if (typeof (fs as any)._original_unwrapped_fs !== "undefined")
      return fs as any;

    const promises = Object.getOwnPropertyDescriptor(fs, "promises");

    if (promises && promises.enumerable)
      bindFs(this, fs.promises);
    else
      bindFs(this, fs);
  }

  /**
   * Return true if a file exists, false if it doesn’t exist.
   * Rethrows errors that aren’t related to file existence.
   */
  async exists(filepath: string, _options: FileSystemOptions = {}): Promise<boolean> {
    try {
      await this._stat(filepath);
      return true;
    } catch(err: unknown) {
      const error = err as any;

      if (error.code === "ENOENT" || error.code === "ENOTDIR" || (error.code || "").includes("ENS")) {
        return false;
      } else {
        console.log(`Unhandled error in "FileSystem.exists()" function: ${String(err)}`);
        throw err;
      }
    }
  }

  /**
   * Return the Stats of a file/symlink if it exists, otherwise returns null.
   * Rethrows errors that aren’t related to file existence.
   */
  async lstat(filename: string): Promise<FileStats | null> {
    try {
      const stats = await this._lstat(filename);
      return stats;
    } catch(err: unknown) {
      const error = err as any;

      if (error.code === "ENOENT" || (error.code || "").includes("ENS"))
        return null;

      throw err;
    }
  }

  /**
   * Make a directory (or series of nested directories) without throwing an error if it already exists.
   */
  async mkdir(filepath: string, _selfCall: boolean = false): Promise<void> {
    try {
      await this._mkdir(filepath);
      return;
    } catch(err: unknown) {
      /*** If err is null then operation succeeded! ***/
      if (err === null)
        return;

      const error = err as any;

      /*** If the directory already exists, that’s OK! ***/
      if (error.code === "EEXIST")
        return;

      /*** Avoid infinite loops of failure ***/
      if (_selfCall)
        throw err;

      /*** If we got a "no such file or directory error" backup and try again. ***/
      if (error.code === "ENOENT") {
        const parent = dirname(filepath);

        /*** Check to see if we’ve gone too far ***/
        if (parent === "." || parent === "/" || parent === filepath)
          throw err;

        /*** Create parent directory recursively ***/
        await this.mkdir(parent, true);
        await this.mkdir(filepath, true);
      }
    }
  }

  /**
   * Return the contents of a file if it exists, otherwise returns null.
   */
  async read(filepath: string, options: FileSystemOptions = {}): Promise<Uint8Array | string | null> {
    try {
      let buffer = await this._readFile(filepath, options);

      if (options.autocrlf === "true") {
        try {
          const text = new TextDecoder("utf8", { fatal: true }).decode(buffer);
          const normalizedText = text.replace(/\r\n/g, "\n");

          buffer = new TextEncoder().encode(normalizedText);
        } catch {
          /*** non utf8 file ***/
        }
      }

      /*** Convert plain ArrayBuffers to Uint8Array ***/
      if (typeof buffer !== "string")
        buffer = new Uint8Array(buffer);

      return buffer;
    } catch {
      return null;
    }
  }

  /**
   * Read a directory without throwing an error is the directory doesn’t exist
   */
  async readdir(filepath: string): Promise<string[] | null> {
    try {
      const names = await this._readdir(filepath);
      /*** Ordering is not guaranteed, and system specific (Windows vs Unix)
      so we must sort them ourselves. ***/
      names.sort(compareStrings);
      return names;
    } catch(err: unknown) {
      const error = err as any;

      if (error.code === "ENOTDIR")
        return null;

      return [];
    }
  }

  /**
   * Return a flat list of all the files nested inside a directory
   *
   * Based on an elegant concurrent recursive solution from SO
   * https://stackoverflow.com/a/45130990
   */
  async readdirDeep(dir: string): Promise<string[]> {
    const subdirs = await this._readdir(dir);

    const files = await Promise.all(
      subdirs.map(async(subdir: string) => {
        const res = dir + "/" + subdir;

        return (await this._stat(res)).isDirectory() ?
          this.readdirDeep(res) :
          res;
      })
    );

    return files.reduce((a: string[], f: string | string[]) => a.concat(f), []);
  }

  /**
   * Reads the contents of a symlink if it exists, otherwise returns null.
   * Rethrows errors that aren’t related to file existence.
   */
  async readlink(filename: string, opts: { encoding?: string } = { encoding: "buffer" }): Promise<Uint8Array | null> {
    /*** Note: FileSystem.readlink returns a buffer by default
    so we can dump it into GitObject.write just like any other file. ***/
    try {
      const link = await this._readlink(filename, opts);

      return link instanceof Uint8Array ?
        link :
        new Uint8Array(Buffer.from(link as string));
    } catch(err: unknown) {
      const error = err as any;

      if (error.code === "ENOENT" || (error.code || "").includes("ENS"))
        return null;

      throw err;
    }
  }

  /**
   * Delete a file without throwing an error if it is already deleted.
   */
  async rm(filepath: string): Promise<void> {
    try {
      await this._unlink(filepath);
    } catch(err: unknown) {
      const error = err as any;

      if (error.code !== "ENOENT")
        throw err;
    }
  }

  /**
   * Delete a directory without throwing an error if it is already deleted.
   */
  async rmdir(filepath: string, opts?: RmOptions): Promise<void> {
    try {
      if (opts && opts.recursive)
        await this._rm(filepath, opts);
      else
        await this._rmdir(filepath);
    } catch(err: unknown) {
      const error = err as any;

      if (error.code !== "ENOENT")
        throw err;
    }
  }

  /**
   * Write a file (creating missing directories if need be) without throwing errors.
   */
  async write(filepath: string, contents: Uint8Array | string, options: FileSystemOptions = {}): Promise<void> {
    try {
      await this._writeFile(filepath, contents, options);
      return;
    } catch {
      /*** Hmm. Let’s try mkdirp and try again. ***/
      await this.mkdir(dirname(filepath));
      await this._writeFile(filepath, contents, options);
    }
  }

  /**
   * Write the contents of buffer to a symlink.
   */
  writelink(filename: string, buffer: Uint8Array): Promise<void> {
    return this._symlink(new TextDecoder("utf8").decode(buffer), filename);
  }

  /**
   * Compatibility methods for FsInterface
   */
  async readFile(path: string, options?: { encoding?: string } | string): Promise<Uint8Array | string> {
    const result = await this.read(path, typeof options === 'string' ? { encoding: options } : options as FileSystemOptions);
    if (result === null) {
      throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    }
    return result;
  }

  async stat(path: string): Promise<FileStats> {
    const result = await this.lstat(path);
    if (result === null) {
      throw new Error(`ENOENT: no such file or directory, stat '${path}'`);
    }
    return result;
  }

  async unlink(path: string): Promise<void> {
    return await this.rm(path);
  }

  async writeFile(path: string, data: Uint8Array | string, options?: FileSystemOptions): Promise<void> {
    return await this.write(path, data, options);
  }
}



//// helper

function bindFs(target: any, fs: FsLike): void {
  if (isPromiseFs(fs)) {
    for (const command of commands) {
      target[`_${command}`] = fs[command]?.bind(fs);
    }
  } else {
    for (const command of commands) {
      target[`_${command}`] = pify(fs[command]?.bind(fs));
    }
  }

  /*** Handle the special case of `rm` ***/
  if (isPromiseFs(fs)) {
    if (fs.rm)
      target._rm = fs.rm.bind(fs);
    else if (fs.rmdir && fs.rmdir.length > 1)
      target._rm = fs.rmdir.bind(fs);
    else
      target._rm = rmRecursive.bind(null, target);
  } else {
    if (fs.rm) {
      target._rm = pify(fs.rm.bind(fs));
    } else if (fs.rmdir && fs.rmdir.length > 2) {
      target._rm = pify(fs.rmdir.bind(fs));
    } else {
      target._rm = rmRecursive.bind(null, target);
    }
  }
}

function isPromiseFs(fs: FsLike): boolean {
  const test = (targetFs: FsLike) => {
    try {
      /*** If readFile returns a promise then we can probably assume the other
      commands do as well ***/
      return targetFs.readFile?.().catch((e: unknown) => e);
    } catch(e) {
      return e;
    }
  };

  return isPromiseLike(test(fs));
}

/*** Deno-compatible pify replacement - Deno uses promises by default ***/
function pify(fn: (...args: unknown[]) => unknown): (...args: unknown[]) => Promise<unknown> {
  return function (...args: unknown[]) {
    return new Promise((resolve, reject) => {
      fn(...args, (err: Error, result: unknown) => {
        if (err)
          reject(err);
        else
          resolve(result);
      });
    });
  };
}
