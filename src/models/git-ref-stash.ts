/**
 * @fileoverview git-ref-stash model definition
 *
 * Defines the git-ref-stash class and related types for representing
 * Git objects and data structures in the implementation.
 *
 * @module models/git-ref-stash.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import type { Author } from "../types.ts";



//// export

export class GitRefStash {
  static get timezoneOffsetForRefLogEntry(): string {
    const offsetMinutes = new Date().getTimezoneOffset();
    const offsetHours = Math.abs(Math.floor(offsetMinutes / 60));

    const offsetMinutesFormatted = Math.abs(offsetMinutes % 60)
      .toString()
      .padStart(2, "0");

    const sign = offsetMinutes > 0 ? "-" : "+";

    return `${sign}${
      offsetHours
        .toString()
        .padStart(2, "0")
    }${offsetMinutesFormatted}`;
  }



  static createStashReflogEntry(author: Author, stashCommit: string, message: string): string {
    const nameNoSpace = author.name.replace(/\s/g, "");
    const z40 = "0000000000000000000000000000000000000000"; /*** hard code for now, works with `git stash list` ***/
    const timestamp = Math.floor(Date.now() / 1000);
    const timezoneOffset = GitRefStash.timezoneOffsetForRefLogEntry;

    return `${z40} ${stashCommit} ${nameNoSpace} ${author.email} ${timestamp} ${timezoneOffset}\t${message}\n`;
  }

  static getStashReflogEntry(reflogString: string, parsed: boolean = false): string[] {
    const reflogLines = reflogString.split("\n");

    const entries = reflogLines
      .filter((l) => l)
      .reverse()
      .map((line, idx) => parsed ? `stash@{${idx}}: ${line.split("\t")[1]}` : line);

    return entries;
  }
}
