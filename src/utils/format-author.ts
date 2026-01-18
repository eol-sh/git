/**
 * @fileoverview format-author utility functions
 *
 * Utility functions for format-author operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/format-author.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import type { Author } from "../types.ts";



//// export

export function formatAuthor({ email, name, timestamp, timezoneOffset }: Author): string {
  const formattedOffset = formatTimezoneOffset(timezoneOffset);
  return `${name} <${email}> ${timestamp} ${formattedOffset}`;
}



//// helper

// The amount of effort that went into crafting these cases to handle
// -0 (just so we don’t lose that information when parsing and reconstructing)
// but can also default to +0 was extraordinary.

function formatTimezoneOffset(minutes: number): string {
  const sign = simpleSign(negateExceptForZero(minutes));
  let absMinutes = Math.abs(minutes);

  const hours = Math.floor(absMinutes / 60);
  absMinutes -= hours * 60;

  let strHours = String(hours);
  let strMinutes = String(absMinutes);

  if (strHours.length < 2)
    strHours = "0" + strHours;

  if (strMinutes.length < 2)
    strMinutes = "0" + strMinutes;

  return (sign === -1 ? "-" : "+") + strHours + strMinutes;
}

function negateExceptForZero(n: number): number {
  return n === 0 ? n : -n;
}

function simpleSign(n: number): number {
  return Math.sign(n) || (Object.is(n, -0) ? -1 : 1);
}
