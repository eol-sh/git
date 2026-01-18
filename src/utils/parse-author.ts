/**
 * @fileoverview parse-author utility functions
 *
 * Utility functions for parse-author operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/parse-author.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import type { Author } from "../types.ts";



//// export

export function parseAuthor(author: string): Author {
  const [, name, email, timestamp, offset] = author.match(/^(.*) <(.*)> (.*) (.*)$/)!;

  return {
    email,
    name,
    timestamp: Number(timestamp),
    timezoneOffset: parseTimezoneOffset(offset)
  };
}



//// helper

/*** The amount of effort that went into crafting these cases to handle
-0 (just so we don’t lose that information when parsing and reconstructing)
but can also default to +0 was extraordinary. ***/

function negateExceptForZero(n: number): number {
  return n === 0 ? n : -n;
}

function parseTimezoneOffset(offset: string): number {
  const [, sign, hours, minutes] = offset.match(/(\+|-)(\d\d)(\d\d)/)!;
  const minutesNum = (sign === "+" ? 1 : -1) * (Number(hours) * 60 + Number(minutes));

  return negateExceptForZero(minutesNum);
}
