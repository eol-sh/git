


//// export

export function posixifyPathBuffer(buffer: Uint8Array): Uint8Array {
  let idx: number;

  while (~(idx = buffer.indexOf(92)))
    buffer[idx] = 47;

  return buffer;
}
