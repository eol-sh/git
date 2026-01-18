


//// export

export function outdent(str: string): string {
  return str
    .split("\n")
    .map((x) => x.replace(/^ /, ""))
    .join("\n");
}
