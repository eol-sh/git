/**
 * @fileoverview git-ref-spec model definition
 *
 * Defines the git-ref-spec class and related types for representing
 * Git objects and data structures in the implementation.
 *
 * @module models/git-ref-spec.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { InternalError } from "../errors/internal.ts";

interface GitRefSpecOptions {
  force: boolean;
  localPath: string;
  matchPrefix: boolean;
  remotePath: string;
}



//// export

export class GitRefSpec {
  force: boolean;
  localPath: string;
  matchPrefix: boolean;
  remotePath: string;

  constructor({ force, localPath, matchPrefix, remotePath }: GitRefSpecOptions) {
    this.force = force;
    this.localPath = localPath;
    this.matchPrefix = matchPrefix;
    this.remotePath = remotePath;
  }

  static from(refspec: string, options?: { isFetch?: boolean }): GitRefSpec {
    const match = refspec.match(/^(\+?)(.*?)(\*?):(.*?)(\*?)$/);

    if (!match)
      throw new InternalError("Invalid refspec format");

    const [
      ,
      forceMatch,
      remotePathOrig,
      remoteGlobMatch,
      localPathOrig,
      localGlobMatch,
    ] = match;

    const force = forceMatch === "+";
    const remoteIsGlob = remoteGlobMatch === "*";
    const localIsGlob = localGlobMatch === "*";
    let localPath = localPathOrig;
    let remotePath = remotePathOrig;

    /*** Enhanced validation based on fetch vs push context ***/
    const isFetch = options?.isFetch !== false; // Default to fetch behavior

    if (remoteIsGlob !== localIsGlob)
      throw new InternalError("Invalid refspec: glob patterns must match on both sides");

    /*** For fetch operations, validate that local path makes sense ***/
    if (isFetch && localPath && !localPath.startsWith("refs/"))
      throw new InternalError("Invalid fetch refspec: local path must be a full ref name");

    /*** For push operations, allow more flexibility in remote refs ***/
    if (!isFetch && remotePath && !remotePath.startsWith("refs/") && !remotePath.includes("*")) {
      /*** Auto-expand short branch names for push ***/
      remotePath = remotePath.startsWith("refs/") ?
        remotePath :
        `refs/heads/${remotePath}`;
    }

    /*** Expand abbreviated ref names to full paths where possible
    Note: Full ref resolution would require access to the repository,
    so we do basic expansions here ***/
    if (remotePath && !remotePath.startsWith("refs/") && !remoteIsGlob)
      remotePath = `refs/heads/${remotePath}`;

    if (localPath && !localPath.startsWith("refs/") && !localIsGlob && isFetch)
      localPath = `refs/remotes/origin/${localPath}`;

    return new GitRefSpec({
      force,
      localPath,
      matchPrefix: remoteIsGlob,
      remotePath
    });
  }

  reverseTranslate(localBranch: string): string | null {
    if (this.matchPrefix) {
      if (localBranch.startsWith(this.localPath))
        return this.remotePath + localBranch.replace(this.localPath, "");
    } else {
      if (localBranch === this.localPath)
        return this.remotePath;
    }

    return null;
  }

  translate(remoteBranch: string): string | null {
    if (this.matchPrefix) {
      if (remoteBranch.startsWith(this.remotePath))
        return this.localPath + remoteBranch.replace(this.remotePath, "");
    } else {
      if (remoteBranch === this.remotePath)
        return this.localPath;
    }

    return null;
  }
}
