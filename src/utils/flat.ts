


//// export

export const flat = <T>(entries: T[][]): T[] => {
  return typeof Array.prototype.flat === "undefined" ?
    entries.reduce((acc, x) => acc.concat(x), []) :
    entries.flat();
};
