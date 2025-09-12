


//// export

export function indent(str: string): string {
  return (
    str
      .trim()
      .split("\n")
      .map((x) => " " + x)
      .join("\n") + "\n"
  );
}
