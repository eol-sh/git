/**
 * @fileoverview flat-file-list-to-directory-structure utility functions
 *
 * Utility functions for flat-file-list-to-directory-structure operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/flat-file-list-to-directory-structure.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { basename } from "../utils/basename.ts";
import { dirname } from "../utils/dirname.ts";

interface Node {
  basename: string;
  children: Node[];
  fullpath: string;
  metadata: Record<string, any>;
  parent?: Node;
  type: string;
}

interface FileEntry {
  path: string;
  [key: string]: any;
}



//// export

export function flatFileListToDirectoryStructure(files: FileEntry[]): Map<string, Node> {
  const inodes = new Map<string, Node>();

  const mkdir = function (name: string): Node {
    if (!inodes.has(name)) {
      const dir: Node = {
        basename: basename(name),
        children: [],
        fullpath: name,
        metadata: {},
        type: "tree"
      };

      inodes.set(name, dir);

      /*** This recursively generates any missing parent folders.
      We do it after we’ve added the inode to the set so that
      we don’t recurse infinitely trying to create the root "." dirname. ***/
      dir.parent = mkdir(dirname(name));

      if (dir.parent && dir.parent !== dir)
        dir.parent.children.push(dir);
    }

    return inodes.get(name)!;
  };

  const mkfile = function (name: string, metadata: FileEntry): Node {
    if (!inodes.has(name)) {
      const file: Node = {
        basename: basename(name),
        children: [],
        fullpath: name,
        metadata: metadata,
        /*** This recursively generates any missing parent folders. ***/
        parent: mkdir(dirname(name)),
        type: "blob"
      };

      if (file.parent)
        file.parent.children.push(file);

      inodes.set(name, file);
    }

    return inodes.get(name)!;
  };

  mkdir(".");

  for (const file of files) {
    mkfile(file.path, file);
  }

  return inodes;
}
