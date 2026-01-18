


//// export

export function compareStrings(a: string, b: string): number {
  /*** https://stackoverflow.com/a/40355107 ***/
  return -(a < b) || +(a > b);
}
