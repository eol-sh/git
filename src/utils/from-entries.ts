


//// export

export function fromEntries<K extends string | number | symbol, V>(map: Map<K, V> | [K, V][]): Record<K, V> {
  const o = {} as Record<K, V>;

  const entries = Array.isArray(map) ?
    map :
    map.entries();

  for (const [key, value] of entries) {
    o[key] = value;
  }

  return o;
}
