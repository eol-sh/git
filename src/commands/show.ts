/**
 * Core show command implementation
 * Displays git objects (commits, trees, blobs, tags)
 */

import { _readObject } from "../storage/read-object.ts";
import { _resolveRef } from "../commands/resolve-ref.ts";
import { FileSystem } from "../models/file-system.ts";
// import { GitCommit } from "../models/git-commit.ts";
import { GitTree } from "../models/git-tree.ts";
import { NotFoundError } from "../errors/not-found.ts";
// Inline abbreviate-oid utility
function abbreviateOid(oid: string, length = 7): string {
  return oid.substring(0, length);
}

import type { Cache } from "../types.ts";

export type ShowFormat = "raw" | "pretty" | "oneline" | "short" | "medium" | "full" | "fuller";

interface ShowCommandOptions {
  cache: Cache;
  fs: FileSystem;
  gitdir: string;
  ref?: string;
  oid?: string;
  format?: ShowFormat;
}

/**
 * Internal show command - display git objects
 */
export async function _show({
  cache,
  fs,
  gitdir,
  ref,
  oid,
  format = "medium"
}: ShowCommandOptions): Promise<string> {
  // Resolve ref to oid if provided
  let objectOid = oid;
  if (!objectOid && ref) {
    const resolved = await _resolveRef({ cache, fs, gitdir, ref });
    if (!resolved) {
      throw new NotFoundError(ref);
    }
    objectOid = resolved;
  }

  if (!objectOid) {
    const resolved = await _resolveRef({ cache, fs, gitdir, ref: "HEAD" });
    objectOid = resolved ?? undefined;
    if (!objectOid) {
      throw new NotFoundError("HEAD");
    }
  }

  // Read the object
  const { type, object } = await _readObject({ fs: fs as any, gitdir, oid: objectOid });

  // Format based on object type
  switch (type) {
    case "commit":
      return formatCommit(objectOid, object, format);
    case "tree":
      return formatTree(objectOid, object, format);
    case "blob":
      return formatBlob(objectOid, object, format);
    case "tag":
      return formatTag(objectOid, object, format);
    default:
      return formatRaw(objectOid, object, type || "unknown");
  }
}

/**
 * Format a commit object
 */
function formatCommit(oid: string, object: Uint8Array, format: ShowFormat): string {
  const text = new TextDecoder().decode(object);

  if (format === "raw") {
    return text;
  }

  // Parse commit
  const lines = text.split("\n");
  const commit = parseCommitText(lines);

  switch (format) {
    case "oneline":
      return `${abbreviateOid(oid)} ${commit.message.split("\n")[0]}`;

    case "short":
      return [
        `commit ${abbreviateOid(oid)}`,
        `Author: ${commit.author}`,
        "",
        `    ${commit.message}`
      ].join("\n");

    case "medium":
    case "pretty":
      return [
        `commit ${oid}`,
        `Author: ${commit.author}`,
        `Date:   ${commit.authorDate}`,
        "",
        `    ${commit.message.split("\n").join("\n    ")}`
      ].join("\n");

    case "full":
      return [
        `commit ${oid}`,
        `Author: ${commit.author}`,
        `Commit: ${commit.committer}`,
        "",
        `    ${commit.message.split("\n").join("\n    ")}`
      ].join("\n");

    case "fuller":
      return [
        `commit ${oid}`,
        `Author:     ${commit.author}`,
        `AuthorDate: ${commit.authorDate}`,
        `Commit:     ${commit.committer}`,
        `CommitDate: ${commit.committerDate}`,
        "",
        `    ${commit.message.split("\n").join("\n    ")}`
      ].join("\n");

    default:
      return text;
  }
}

/**
 * Parse commit text into structured data
 */
function parseCommitText(lines: string[]): {
  tree: string;
  parent: string[];
  author: string;
  authorDate: string;
  committer: string;
  committerDate: string;
  message: string;
} {
  const result = {
    tree: "",
    parent: [] as string[],
    author: "",
    authorDate: "",
    committer: "",
    committerDate: "",
    message: ""
  };

  let messageStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line === "") {
      messageStart = i + 1;
      break;
    }

    if (line.startsWith("tree ")) {
      result.tree = line.slice(5);
    } else if (line.startsWith("parent ")) {
      result.parent.push(line.slice(7));
    } else if (line.startsWith("author ")) {
      const authorMatch = line.match(/^author (.+) (\d+) ([-+]\d{4})$/);
      if (authorMatch) {
        result.author = authorMatch[1];
        result.authorDate = new Date(parseInt(authorMatch[2]) * 1000).toISOString();
      }
    } else if (line.startsWith("committer ")) {
      const committerMatch = line.match(/^committer (.+) (\d+) ([-+]\d{4})$/);
      if (committerMatch) {
        result.committer = committerMatch[1];
        result.committerDate = new Date(parseInt(committerMatch[2]) * 1000).toISOString();
      }
    }
  }

  if (messageStart > 0) {
    result.message = lines.slice(messageStart).join("\n").trim();
  }

  return result;
}

/**
 * Format a tree object
 */
function formatTree(oid: string, object: Uint8Array, format: ShowFormat): string {
  if (format === "raw") {
    return new TextDecoder().decode(object);
  }

  // Parse tree
  const tree = GitTree.from(object);
  const lines = [`tree ${oid}`, ""];

  for (const entry of tree.entries()) {
    lines.push(`${entry.mode.padStart(6, "0")} ${entry.type} ${entry.oid}    ${entry.path}`);
  }

  return lines.join("\n");
}

/**
 * Format a blob object
 */
function formatBlob(oid: string, object: Uint8Array, format: ShowFormat): string {
  const text = new TextDecoder().decode(object);

  if (format === "raw") {
    return text;
  }

  // For blobs, show the content with object info header
  return `blob ${oid}\n${text}`;
}

/**
 * Format a tag object
 */
function formatTag(oid: string, object: Uint8Array, format: ShowFormat): string {
  const text = new TextDecoder().decode(object);

  if (format === "raw") {
    return text;
  }

  // Parse tag
  const lines = text.split("\n");
  const tag = parseTagText(lines);

  return [
    `tag ${oid}`,
    `Object: ${tag.object}`,
    `Type:   ${tag.type}`,
    `Tag:    ${tag.tag}`,
    `Tagger: ${tag.tagger}`,
    "",
    tag.message
  ].join("\n");
}

/**
 * Parse tag text
 */
function parseTagText(lines: string[]): {
  object: string;
  type: string;
  tag: string;
  tagger: string;
  message: string;
} {
  const result = {
    object: "",
    type: "",
    tag: "",
    tagger: "",
    message: ""
  };

  let messageStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line === "") {
      messageStart = i + 1;
      break;
    }

    if (line.startsWith("object ")) {
      result.object = line.slice(7);
    } else if (line.startsWith("type ")) {
      result.type = line.slice(5);
    } else if (line.startsWith("tag ")) {
      result.tag = line.slice(4);
    } else if (line.startsWith("tagger ")) {
      result.tagger = line.slice(7);
    }
  }

  if (messageStart > 0) {
    result.message = lines.slice(messageStart).join("\n").trim();
  }

  return result;
}

/**
 * Format raw object
 */
function formatRaw(oid: string, object: Uint8Array, type: string): string {
  return `${type} ${oid}\n${new TextDecoder().decode(object)}`;
}
