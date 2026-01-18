/**
 * @fileoverview git-stash manager
 *
 * Manages git-stash resources including creation, access, and lifecycle.
 * Provides centralized control and caching for git-stash operations.
 *
 * @module managers/git-stash.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { _readCommit } from "../commands/read-commit.ts";
import { _writeCommit } from "../commands/write-commit.ts";
import { acquireLock } from "../utils/walker-to-tree-entry-map.ts";
import { GitRefManager } from "./git-ref.ts";
import { GitRefStash } from "../models/git-ref-stash.ts";
import { InvalidRefNameError } from "../errors/invalid-ref-name.ts";
import { join } from "../utils/join.ts";
import { MissingNameError } from "../errors/missing-name.ts";
import { normalizeAuthorObject } from "../utils/normalize-author-object.ts";

import type { Author, CommitObject } from "../types.ts";

interface FileSystemLike {
  exists(filepath: string): Promise<boolean>;
  read(filepath: string, encoding?: string): Promise<string | Uint8Array>;
  write(filepath: string, contents: string, encoding?: string): Promise<void>;
}



//// export

export interface GitStashManagerOptions {
  fs: FileSystemLike;
  gitdir: string;
}

export interface ReadStashReflogsOptions {
  parsed?: boolean;
}

export interface StashEntry {
  commit: CommitObject;
  oid: string;
  payload?: string;
}

export interface WriteStashCommitOptions {
  message: string;
  parent: string[];
  tree: string;
}

export interface WriteStashReflogEntryOptions {
  message: string;
  stashCommit: string;
}



export class GitStashManager {
  private _author: Author | null = null;
  private fs!: FileSystemLike;
  private gitdir!: string;

  constructor({ fs, gitdir }: GitStashManagerOptions) {
    Object.assign(this, {
      _author: null,
      fs,
      gitdir
    });
  }



  static get refLogsStash(): string {
    return "logs/refs/stash";
  }

  static get refStash(): string {
    return "refs/stash";
  }



  async getAuthor(): Promise<Author> {
    if (!this._author) {
      this._author = await normalizeAuthorObject({
        author: {},
        fs: this.fs as any,
        gitdir: this.gitdir
      }) as Author;

      if (!this._author)
        throw new MissingNameError("author");
    }

    return this._author;
  }

  async getStashSHA(refIdx: number, stashEntries?: string[]): Promise<string | null> {
    if (!(await this.fs.exists(this.refStashPath)))
      return null;

    const entries = stashEntries || (await this.readStashReflogs({ parsed: false }));
    return entries[refIdx].split(" ")[1];
  }

  async readStashReflogs({ parsed = false }: ReadStashReflogsOptions = {}): Promise<string[] | any[]> {
    if (!(await this.fs.exists(this.refLogsStashPath)))
      return [];

    const reflogBuffer = await this.fs.read(this.refLogsStashPath) as Uint8Array;
    const reflogString = reflogBuffer.toString();

    return GitRefStash.getStashReflogEntry(reflogString, parsed);
  }

  get refLogsStashPath(): string {
    return join(this.gitdir, GitStashManager.refLogsStash);
  }

  get refStashPath(): string {
    return join(this.gitdir, GitStashManager.refStash);
  }

  async readStashCommit(refIdx: number) {
    const stashEntries = await this.readStashReflogs({ parsed: false });

    if (refIdx !== 0) {
      /*** non-default case, throw exceptions if not valid ***/
      if (refIdx < 0 || refIdx > stashEntries.length - 1) {
        throw new InvalidRefNameError(
          `stash@${refIdx}`,
          "number that is in range of [0, num of stash pushed]"
        );
      }
    }

    const stashSHA = await this.getStashSHA(refIdx, stashEntries);

    if (!stashSHA)
      return {}; /*** no stash found ***/

    /*** get the stash commit object ***/
    return _readCommit({
      cache: new Map(),
      fs: this.fs as any,
      gitdir: this.gitdir,
      oid: stashSHA
    });
  }

  async writeStashCommit({ message, parent, tree }: WriteStashCommitOptions): Promise<string> {
    return _writeCommit({
      commit: {
        author: await this.getAuthor(),
        committer: await this.getAuthor(),
        message,
        parent,
        tree
      },
      fs: this.fs as any,
      gitdir: this.gitdir
    });
  }

  writeStashRef(stashCommit: string): Promise<void> {
    return GitRefManager.writeRef({
      fs: this.fs as any,
      gitdir: this.gitdir,
      ref: GitStashManager.refStash,
      value: stashCommit
    });
  }

  async writeStashReflogEntry({ message, stashCommit }: WriteStashReflogEntryOptions): Promise<void> {
    const author = await this.getAuthor();
    const entry = GitRefStash.createStashReflogEntry(author, stashCommit, message);
    const filepath = this.refLogsStashPath;

    await acquireLock(filepath, async() => {
      const appendTo = (await this.fs.exists(filepath)) ?
        await this.fs.read(filepath, "utf8") as string :
        "";
      await this.fs.write(filepath, appendTo + entry, "utf8");
    });
  }
}
