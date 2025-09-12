


//// export

export function arrayRange(start: number, end: number): number[] {
  const length = end - start;
  return Array.from({ length }, (_, i) => start + i);
}



/*** via https://dev.to/namirsab/comment/2050 ***/
