/**
 * @fileoverview fs-adapter utility functions
 *
 * Utility functions for fs-adapter operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/fs-adapter.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */

 /*** UTILITY ------------------------------------------ ***/

import { FileSystem } from "../models/file-system.ts";
import type { FsInterface } from "../types.ts";

/*** EXPORT ------------------------------------------- ***/

export interface UnifiedFileSystemLike {
  /*** Core file operations ***/
  exists(filepath: string): Promise<boolean>;
  lstat(filepath: string): Promise<any>;
  read(filepath: string, options?: { encoding?: string } | string): Promise<string | Uint8Array | null>;
  write(filepath: string, contents: string | Uint8Array, options?: { encoding?: string } | string): Promise<void>;
  /*** Directory operations ***/
  readdirDeep?(dirpath: string): Promise<string[]>;
  /*** Cleanup operations ***/
  rm?(filepath: string): Promise<void>;
}

export const adaptFsInterfaceForGitIndex = (fs: FsInterface) => ({
  lstat: (filepath: string) => fs.lstat(filepath),
  read: async(filepath: string) => {
    try {
      return await fs.readFile(filepath);
    } catch {
      return null;
    }
  },
  write: (filepath: string, buffer: Uint8Array) => fs.writeFile(filepath, buffer)
});

export function adaptFileSystem(fileSystem: FileSystem): FsInterface {
  return {
    lstat: (path: string) => fileSystem.lstat(path).then(stat => {
      if (stat === null)
        throw new Error(`No such file or directory: ${path}`);

      return stat as any;
    }),
    mkdir: (path: string, _options?: { recursive?: boolean }) => fileSystem.mkdir(path),
    read: async (path: string) => {
      const result = await fileSystem.read(path);

      if (result === null)
        throw new Error(`File not found: ${path}`);

      if (typeof result === "string")
        return new TextEncoder().encode(result);

      return result;
    },
    readdir: (path: string) => fileSystem.readdir(path).then(result => result || []),
    readFile: (path: string) => fileSystem.read(path).then(result => {
      if (!result)
        throw new Error(`File not found: ${path}`);

      if (typeof result === "string")
        return new TextEncoder().encode(result);

      return result;
    }),
    rm: (path: string, options?: { recursive?: boolean; force?: boolean }) => {
      if (options?.recursive)
        return fileSystem.rmdir(path);

      return fileSystem.rm(path);
    },
    rmdir: (path: string) => fileSystem.rmdir(path),
    stat: (path: string) => fileSystem.lstat(path).then(stat => {
      if (stat === null)
        throw new Error(`No such file or directory: ${path}`);

      return stat as any;
    }),
    unlink: (path: string) => fileSystem.rm(path),
    writeFile: (path: string, data: Uint8Array) => fileSystem.write(path, data)
  };
}

export function adaptFsInterface(fs: FsInterface): any {
  return {
    exists: async(filepath: string) => {
      try {
        await fs.stat(filepath);
        return true;
      } catch {
        return false;
      }
    },
    lstat: (filepath: string) => fs.lstat(filepath),
    read: async(filepath: string, options?: { encoding?: string } | string) => {
      try {
        const result = await fs.readFile(filepath);

        /*** If encoding was requested, decode to string ***/
        if (options)
          return new TextDecoder().decode(result);

        return result;
      } catch {
        return null;
      }
    },
    readdirDeep: async(dirpath: string): Promise<string[]> => {
      const allFiles: string[] = [];

      async function readRecursive(currentPath: string, basePath: string = ""): Promise<void> {
        try {
          const entries = await fs.readdir(currentPath);
          const entriesArray = Array.isArray(entries) ? entries : [];

          for (const entry of entriesArray) {
            const entryName = typeof entry === "string" ? entry : (entry as any).name;
            const fullPath = currentPath === dirpath ? entryName : `${basePath}/${entryName}`;
            const absolutePath = `${currentPath}/${entryName}`;

            try {
              const stat = await fs.lstat(absolutePath);

              if (stat && typeof (stat as any).isDirectory === "function" && (stat as any).isDirectory())
                await readRecursive(absolutePath, fullPath);
              else
                allFiles.push(fullPath);
            } catch {
              /*** Skip entries that can’t be stat’d (broken symlinks, permission issues) ***/
              continue;
            }
          }
        } catch {
          /*** Skip directories that can't be read ***/
          return;
        }
      }

      await readRecursive(dirpath);
      return allFiles;
    },
    rm: (filepath: string) => fs.unlink(filepath),
    write: async(filepath: string, contents: string | Uint8Array, _options?: { encoding?: string } | string) => {
      const data = typeof contents === "string" ?
        new TextEncoder().encode(contents) :
        contents;

      await fs.writeFile(filepath, data);
    }
  };
}

export function adaptFsForGitConfig(fileSystem: FileSystem) {
  return {
    exists: (filepath: string) => fileSystem.exists(filepath),
    lstat: (filepath: string) => fileSystem.lstat(filepath),
    read: async(filepath: string, _optionsR?: { encoding?: string }) => {
      const result = await fileSystem.read(filepath, { encoding: _optionsR?.encoding || "utf8" } as any);
      return result as string;
    },
    write: (filepath: string, contents: string, _optionsW?: { encoding?: string }) => fileSystem.write(filepath, contents, { encoding: _optionsW?.encoding || "utf8" } as any)
  };
}

export function adaptFsForGitIgnore(fileSystem: FileSystem) {
  return {
    exists: (filepath: string) => fileSystem.exists(filepath),
    read: async(filepath: string, encoding: string) => {
      const result = await fileSystem.read(filepath, { encoding } as any);
      return result as string;
    }
  };
}

export function adaptFsForGitIndex(fileSystem: FileSystem) {
  return {
    exists: (filepath: string) => fileSystem.exists(filepath),
    lstat: (filepath: string) => fileSystem.lstat(filepath),
    read: async(filepath: string) => {
      try {
        return await fileSystem.read(filepath);
      } catch {
        return null;
      }
    },
    rm: (filepath: string) => fileSystem.rm(filepath),
    write: (filepath: string, contents: string | Uint8Array, _options2?: { mode?: number }) => fileSystem.write(filepath, contents)
  };
}

export function adaptFsForGitRef(fileSystem: FileSystem) {
  return {
    exists: (filepath: string) => fileSystem.exists(filepath),
    lstat: (filepath: string) => fileSystem.lstat(filepath),
    read: async(filepath: string, _optionsR?: { encoding?: string }) => {
      const result = await fileSystem.read(filepath, { encoding: _optionsR?.encoding || "utf8" } as any);
      return result as string;
    },
    readdirDeep: (dirpath: string) => fileSystem.readdirDeep(dirpath),
    rm: (filepath: string) => fileSystem.rm(filepath),
    write: (filepath: string, contents: string, encoding?: string) => fileSystem.write(filepath, contents, { encoding: encoding || "utf8" } as any)
  };
}

export function createUnifiedAdapter(fileSystem: FileSystem): UnifiedFileSystemLike {
  return {
    exists: (filepath: string) => fileSystem.exists(filepath),
    lstat: (filepath: string) => fileSystem.lstat(filepath),
    read: async(filepath: string, options?: { encoding?: string } | string) => {
      /*** Handle both object and string options for compatibility ***/
      const opts = typeof options === "string" ?
        { encoding: options } :
        options;
      const result = await fileSystem.read(filepath, opts);

      /*** GitIgnoreManager expects string, GitIndexManager expects Uint8Array | string | null ***/
      if (result === null)
        return null;

      if (typeof result === "string")
        return result;

      /*** If encoding was requested, decode to string ***/
      if (opts?.encoding)
        return new TextDecoder().decode(result);

      return result;
    },
    readdirDeep: (dirpath: string) => fileSystem.readdirDeep(dirpath),
    rm: (filepath: string) => fileSystem.rm(filepath),
    write: async(filepath: string, contents: string | Uint8Array, _options?: { encoding?: string } | string) => {
      /*** Handle both string and Uint8Array content ***/
      if (typeof contents === "string") {
        const opts = typeof _options === "string" ?
          { encoding: _options } :
          _options;

        await fileSystem.write(filepath, contents, opts);
      } else {
        /*** For Uint8Array, write directly ***/
        await fileSystem.write(filepath, contents);
      }
    }
  };
}
