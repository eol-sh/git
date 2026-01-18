/**
 * @fileoverview resolve-file-id-in-tree utility functions
 *
 * Utility functions for resolve-file-id-in-tree operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/resolve-file-id-in-tree.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { GitTree } from "../models/git-tree.ts";
import { join } from "./join.ts";
import { _readObject as readObject } from "../storage/read-object.ts";
import { resolveTree } from "./resolve-tree.ts";

import type { FsInterface } from "../types.ts";

interface _ResolveFileIdOptions {
  cache: Map<string, any>;
  fileId: string;
  filepaths?: string[];
  fs: FsInterface;
  gitdir: string;
  oid: string;
  parentPath?: string;
  tree: GitTree;
}

interface ResolveFileIdInTreeOptions {
  cache: Map<string, any>;
  fileId: string;
  fs: FsInterface;
  gitdir: string;
  oid: string;
}

/*** the empty file content object id ***/
const EMPTY_OID = "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391";



//// export

export async function resolveFileIdInTree({
  cache,
  fileId,
  fs,
  gitdir,
  oid
}: ResolveFileIdInTreeOptions): Promise<string | string[] | undefined> {
  if (fileId === EMPTY_OID)
    return;

  const _oid = oid;
  const result = await resolveTree({ cache, fs, gitdir, oid });
  const tree = result.tree;
  let filepath: string | string[] | undefined;

  if (fileId === result.oid) {
    filepath = ""; /*** Root path ***/
  } else {
    filepath = await _resolveFileId({
      cache,
      fileId,
      fs,
      gitdir,
      oid: _oid,
      tree
    });

    if (Array.isArray(filepath)) {
      if (filepath.length === 0)
        filepath = undefined;
      else if (filepath.length === 1)
        filepath = filepath[0];
    }
  }

  return filepath;
}



//// helper

async function _resolveFileId({
  cache,
  fileId,
  filepaths = [],
  fs,
  gitdir,
  oid,
  parentPath = "",
  tree
}: _ResolveFileIdOptions): Promise<string[]> {
  const walks = tree.entries().map(function (entry) {
    let result: Promise<string[]> | undefined;

    if (entry.oid === fileId) {
      const resultPath = join(parentPath, entry.path);
      filepaths.push(resultPath);
    } else if (entry.type === "tree") {
      result = readObject({
        cache,
        fs,
        gitdir,
        oid: entry.oid
      }).then(({ object }) => {
        return _resolveFileId({
          cache,
          fileId,
          filepaths,
          fs,
          gitdir,
          oid,
          parentPath: join(parentPath, entry.path),
          tree: GitTree.from(object)
        });
      });
    }

    return result;
  });

  await Promise.all(walks);
  return filepaths;
}
