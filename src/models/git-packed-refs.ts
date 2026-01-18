/**
 * @fileoverview git-packed-refs model definition
 *
 * Defines the git-packed-refs class and related types for representing
 * Git objects and data structures in the implementation.
 *
 * @module models/git-packed-refs.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

interface PackedRefEntry {
  comment?: boolean;
  line: string;
  oid?: string;
  peeled?: string;
  ref?: string;
}



//// export

export class GitPackedRefs {
  parsedConfig: PackedRefEntry[];
  refs: Map<string, string>;

  constructor(text?: string) {
    this.parsedConfig = [];
    this.refs = new Map();

    if (text) {
      let key: string | null = null;

      this.parsedConfig = text
        .trim()
        .split("\n")
        .map((line) => {
          if (/^\s*#/.test(line))
            return { comment: true, line };

          const i = line.indexOf(" ");

          if (line.startsWith("^")) {
            /*** This is a oid for the commit associated with the annotated tag immediately preceding this line.
            Trim off the "^" ***/
            const value = line.slice(1);

            /*** The tagname^{} syntax is based on the output of `git show-ref --tags -d` ***/
            if (key) {
              this.refs.set(key + "^{}", value);
              return { line, peeled: value, ref: key };
            }

            return { line };
          } else {
            /*** This is an oid followed by the ref name ***/
            const value = line.slice(0, i);
            key = line.slice(i + 1);
            this.refs.set(key, value);

            return { line, oid: value, ref: key };
          }
        });
    }

    return this;
  }

  static from(text?: string): GitPackedRefs {
    return new GitPackedRefs(text);
  }



  delete(ref: string): void {
    this.parsedConfig = this.parsedConfig.filter((entry) => entry.ref !== ref);
    this.refs.delete(ref);
  }

  toString(): string {
    return this.parsedConfig.map(({ line }) => line).join("\n") + "\n";
  }
}
