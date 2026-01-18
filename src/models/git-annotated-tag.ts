/**
 * @fileoverview git-annotated-tag model definition
 *
 * Defines the git-annotated-tag class and related types for representing
 * Git objects and data structures in the implementation.
 *
 * @module models/git-annotated-tag.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { formatAuthor } from "../utils/format-author.ts";
import { InternalError } from "../errors/internal.ts";
import { normalizeNewlines } from "../utils/normalize-newlines.ts";
import { parseAuthor } from "../utils/parse-author.ts";

import type { TagObject } from "../types.ts";

interface ParsedTag extends TagObject {
  [key: string]: any;
}

interface SignOptions {
  payload: string;
  secretKey: string;
}

interface SignResult {
  signature: string;
}



//// export

export class GitAnnotatedTag {
  private _tag: string;

  constructor(tag: string | Uint8Array | TagObject) {
    if (typeof tag === "string")
      this._tag = tag;
    else if (tag instanceof Uint8Array)
      this._tag = new TextDecoder().decode(tag);
    else if (typeof tag === "object")
      this._tag = GitAnnotatedTag.render(tag);
    else
      throw new InternalError("invalid type passed to GitAnnotatedTag constructor");
  }

  static from(tag: string | Uint8Array | TagObject): GitAnnotatedTag {
    return new GitAnnotatedTag(tag);
  }

  static render(obj: TagObject): string {
    return `object ${obj.object}
type ${obj.type}
tag ${obj.tag}
tagger ${formatAuthor(obj.tagger)}

${obj.message}${obj.gpgsig ? obj.gpgsig : ""}`;
  }

  static async sign(tag: GitAnnotatedTag, sign: (options: SignOptions) => Promise<SignResult>, secretKey: string): Promise<GitAnnotatedTag> {
    const payload = tag.payload();
    let { signature } = await sign({ payload, secretKey });

    /*** renormalize the line endings to the one true line-ending ***/
    signature = normalizeNewlines(signature);
    const signedTag = payload + signature;

    /*** return a new tag object ***/
    return GitAnnotatedTag.from(signedTag);
  }



  gpgsig(): string | undefined {
    if (this._tag.indexOf("\n-----BEGIN PGP SIGNATURE-----") === -1)
      return;

    const signature = this._tag.slice(
      this._tag.indexOf("-----BEGIN PGP SIGNATURE-----"),
      this._tag.indexOf("-----END PGP SIGNATURE-----") +
      "-----END PGP SIGNATURE-----".length
    );

    return normalizeNewlines(signature);
  }

  headers(): ParsedTag {
    const headers = this.justHeaders().split("\n");
    const hs: string[] = [];

    for (const h of headers) {
      if (h[0] === " ") /*** combine with previous header (without space indent) ***/
        hs[hs.length - 1] += "\n" + h.slice(1);
      else
        hs.push(h);
    }

    const obj: any = {};

    for (const h of hs) {
      const key = h.slice(0, h.indexOf(" "));
      const value = h.slice(h.indexOf(" ") + 1);

      if (Array.isArray(obj[key]))
        obj[key].push(value);
      else
        obj[key] = value;
    }

    if (obj.tagger)
      obj.tagger = parseAuthor(obj.tagger);

    if (obj.committer)
      obj.committer = parseAuthor(obj.committer);

    return obj as ParsedTag;
  }

  justHeaders(): string {
    return this._tag.slice(0, this._tag.indexOf("\n\n"));
  }

  message(): string {
    const tag = this.withoutSignature();
    return tag.slice(tag.indexOf("\n\n") + 2);
  }

  parse(): ParsedTag {
    return Object.assign(this.headers(), {
      gpgsig: this.gpgsig(),
      message: this.message()
    });
  }

  payload(): string {
    return this.withoutSignature() + "\n";
  }

  render(): string {
    return this._tag;
  }

  toObject(): Uint8Array {
    return new TextEncoder().encode(this._tag);
  }

  withoutSignature(): string {
    const tag = normalizeNewlines(this._tag);

    if (tag.indexOf("\n-----BEGIN PGP SIGNATURE-----") === -1)
      return tag;

    return tag.slice(0, tag.lastIndexOf("\n-----BEGIN PGP SIGNATURE-----"));
  }
}
