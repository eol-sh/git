/**
 * @fileoverview git-ref-spec-set model definition
 *
 * Defines the git-ref-spec-set class and related types for representing
 * Git objects and data structures in the implementation.
 *
 * @module models/git-ref-spec-set.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { GitRefSpec } from "./git-ref-spec.ts";



//// export

export class GitRefSpecSet {
  rules: GitRefSpec[];

  constructor(rules: GitRefSpec[] = []) {
    this.rules = rules;
  }

  static from(refspecs: string[]): GitRefSpecSet {
    const rules: GitRefSpec[] = [];

    for (const refspec of refspecs) {
      rules.push(GitRefSpec.from(refspec)); /*** might throw ***/
    }

    return new GitRefSpecSet(rules);
  }



  add(refspec: string): void {
    const rule = GitRefSpec.from(refspec); /*** might throw ***/
    this.rules.push(rule);
  }

  localNamespaces(): string[] {
    return this.rules
      .filter((rule) => rule.matchPrefix)
      .map((rule) => rule.localPath.replace(/\/$/, ""));
  }

  translate(remoteRefs: string[]): [string, string][] {
    const result: [string, string][] = [];

    for (const rule of this.rules) {
      for (const remoteRef of remoteRefs) {
        const localRef = rule.translate(remoteRef);

        if (localRef)
          result.push([remoteRef, localRef]);
      }
    }

    return result;
  }

  translateOne(remoteRef: string): string | null {
    let result: string | null = null;

    for (const rule of this.rules) {
      const localRef = rule.translate(remoteRef);

      if (localRef)
        result = localRef;
    }

    return result;
  }
}
