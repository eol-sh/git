/**
 * @fileoverview git-commit model definition
 *
 * Defines the git-commit class and related types for representing
 * Git objects and data structures in the implementation.
 *
 * @module models/git-commit.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { formatAuthor } from "../utils/format-author.ts";
import { indent } from "../utils/indent.ts";
import { InternalError } from "../errors/internal.ts";
import { normalizeNewlines } from "../utils/normalize-newlines.ts";
import { outdent } from "../utils/outdent.ts";
import { parseAuthor } from "../utils/parse-author.ts";

import type { CommitObject } from "../types.ts";

interface ParsedCommit extends CommitObject {
  [key: string]: any;
}

interface PayloadSignature {
  payload: string;
  signature: string;
}

interface SignOptions {
  payload: string;
  secretKey: string;
}

interface SignResult {
  signature: string;
}



//// export

export class GitCommit {
  private _commit: string;

  constructor(commit: string | Uint8Array | CommitObject) {
    if (typeof commit === "string")
      this._commit = commit;
    else if (commit instanceof Uint8Array)
      this._commit = new TextDecoder().decode(commit);
    else if (typeof commit === "object")
      this._commit = GitCommit.render(commit);
    else
      throw new InternalError("invalid type passed to GitCommit constructor");
  }

  static fromPayloadSignature({ payload, signature }: PayloadSignature): GitCommit {
    const headers = GitCommit.justHeaders(payload);
    const message = GitCommit.justMessage(payload);
    const commit = normalizeNewlines(headers + "\ngpgsig" + indent(signature) + "\n" + message);

    return new GitCommit(commit);
  }

  static from(commit: string | Uint8Array | CommitObject): GitCommit {
    return new GitCommit(commit);
  }

  static justHeaders(commit: string): string {
    return commit.slice(0, commit.indexOf("\n\n"));
  }

  static justMessage(commit: string): string {
    return normalizeNewlines(commit.slice(commit.indexOf("\n\n") + 2));
  }

  static render(obj: CommitObject): string {
    return GitCommit.renderHeaders(obj) + "\n" + normalizeNewlines(obj.message);
  }

  static renderHeaders(obj: CommitObject): string {
    let headers = "";

    if (obj.tree)
      headers += `tree ${obj.tree}\n`;
    else
      headers += `tree 4b825dc642cb6eb9a060e54bf8d69288fbee4904\n`; /*** the null tree ***/

    if (obj.parent) {
      if (obj.parent.length === undefined)
        throw new InternalError(`commit "parent" property should be an array`);

      for (const p of obj.parent) {
        headers += `parent ${p}\n`;
      }
    }

    const author = obj.author;
    headers += `author ${formatAuthor(author)}\n`;

    const committer = obj.committer || obj.author;
    headers += `committer ${formatAuthor(committer)}\n`;

    if (obj.gpgsig)
      headers += "gpgsig" + indent(obj.gpgsig);

    return headers;
  }

  static async sign(commit: GitCommit, sign: (options: SignOptions) => Promise<SignResult>, secretKey: string): Promise<GitCommit> {
    const payload = commit.withoutSignature();
    const message = GitCommit.justMessage(commit._commit);
    let { signature } = await sign({ payload, secretKey });

    /*** renormalize the line endings to the one true line-ending ***/
    signature = normalizeNewlines(signature);
    const headers = GitCommit.justHeaders(commit._commit);

    const signedCommit = headers +
      "\n" +
      "gpgsig" +
      indent(signature) +
      "\n" +
      message;

    /*** return a new commit object ***/
    return GitCommit.from(signedCommit);
  }



  headers(): ParsedCommit {
    // Todo: allow setting the headers
    return this.parseHeaders();
  }

  isolateSignature(): string {
    const signature = this._commit.slice(
      this._commit.indexOf("-----BEGIN PGP SIGNATURE-----"),
      this._commit.indexOf("-----END PGP SIGNATURE-----") + "-----END PGP SIGNATURE-----".length,
    );

    return outdent(signature);
  }

  message(): string {
    // Todo: allow setting the message
    return GitCommit.justMessage(this._commit);
  }

  parse(): ParsedCommit {
    return Object.assign({ message: this.message() }, this.headers());
  }

  parseHeaders(): ParsedCommit {
    const headers = GitCommit.justHeaders(this._commit).split("\n");
    const hs: string[] = [];

    for (const h of headers) {
      if (h[0] === " ") {
        /*** combine with previous header (without space indent) ***/
        hs[hs.length - 1] += "\n" + h.slice(1);
      } else {
        hs.push(h);
      }
    }

    const obj: any = { parent: [] };

    for (const h of hs) {
      const key = h.slice(0, h.indexOf(" "));
      const value = h.slice(h.indexOf(" ") + 1);

      if (Array.isArray(obj[key]))
        obj[key].push(value);
      else
        obj[key] = value;
    }

    if (obj.author)
      obj.author = parseAuthor(obj.author);

    if (obj.committer)
      obj.committer = parseAuthor(obj.committer);

    return obj as ParsedCommit;
  }

  render(): string {
    return this._commit;
  }

  toObject(): Uint8Array {
    return new TextEncoder().encode(this._commit);
  }

  withoutSignature(): string {
    const commit = normalizeNewlines(this._commit);

    if (commit.indexOf("\ngpgsig") === -1)
      return commit;

    const headers = commit.slice(0, commit.indexOf("\ngpgsig"));
    const message = commit.slice(commit.indexOf("-----END PGP SIGNATURE-----\n") + "-----END PGP SIGNATURE-----\n".length);

    return normalizeNewlines(headers + "\n" + message);
  }
}
