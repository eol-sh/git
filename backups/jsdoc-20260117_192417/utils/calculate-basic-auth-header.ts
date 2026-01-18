


//// util

import type { AuthOptions } from "../types.ts";



//// export

export function calculateBasicAuthHeader({ password = "", username = "" }: AuthOptions): string {
  return `Basic ${btoa(`${username}:${password}`)}`;
}
