


//// export

export async function parseCapabilitiesV2(read: () => Promise<Uint8Array | boolean | null>): Promise<{
  capabilities2: Record<string, string | true>;
  protocolVersion: number;
}> {
  const capabilities2: Record<string, string | true> = {};
  let line: Uint8Array | boolean | null;

  while (true) {
    line = await read();

    if (line === true)
      break;

    if (line === null)
      continue;

    const lineStr = new TextDecoder("utf8")
      .decode(line as Uint8Array)
      .replace(/\n$/, "");

    const i = lineStr.indexOf("=");

    if (i > -1) {
      const key = lineStr.slice(0, i);
      const value = lineStr.slice(i + 1);
      capabilities2[key] = value;
    } else {
      capabilities2[lineStr] = true;
    }
  }

  return { capabilities2, protocolVersion: 2 };
}
