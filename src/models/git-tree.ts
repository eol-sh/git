


//// util

import { comparePath } from "../utils/compare-path.ts";
import { compareTreeEntryPath } from "../utils/compare-tree-entry-path.ts";
import { InternalError } from "../errors/internal.ts";
import { UnsafeFilepathError } from "../errors/unsafe-filepath.ts";

interface RawTreeEntry {
  mode: string | number;
  oid?: string;
  path: string;
  sha?: string; /*** Github compatibility ***/
  type?: "blob" | "commit" | "tree";
}



//// export

export interface TreeEntry {
  mode: string; /*** the 6 digit hexadecimal mode ***/
  oid: string;  /*** the SHA-1 object id of the blob or tree ***/
  path: string; /*** the name of the file or directory ***/
  type: "blob" | "commit" | "tree"; /*** the type of object ***/
}

export class GitTree {
  private _entries: TreeEntry[];

  constructor(entries: Uint8Array | RawTreeEntry[]) {
    if (entries instanceof Uint8Array)
      this._entries = parseBuffer(entries);
    else if (Array.isArray(entries))
      this._entries = entries.map(nudgeIntoShape);
    else
      throw new InternalError("invalid type passed to GitTree constructor");

    /*** Tree entries are not sorted alphabetically in the usual sense (see `compareTreeEntryPath`)
    but it is important later on that these be sorted in the same order as they would be returned from readdir. ***/
    this._entries.sort(comparePath);
  }

  static from(tree: Uint8Array | RawTreeEntry[]): GitTree {
    return new GitTree(tree);
  }

  entries(): TreeEntry[] {
    return this._entries;
  }

  render(): string {
    return this._entries
      .map((entry) => `${entry.mode} ${entry.type} ${entry.oid}    ${entry.path}`)
      .join("\n");
  }

  toObject(): Uint8Array {
    /*** Adjust the sort order to match git’s ***/
    const entries = [...this._entries];
    entries.sort(compareTreeEntryPath);
    const buffers: Uint8Array[] = [];

    for (const entry of entries) {
      const mode = new TextEncoder().encode(entry.mode.replace(/^0/, ""));
      const space = new TextEncoder().encode(" ");
      const path = new TextEncoder().encode(entry.path);
      const nullchar = new Uint8Array([0]);
      const oid = new Uint8Array(entry.oid.match(/.{2}/g)!.map((byte) => parseInt(byte, 16)));

      /*** Calculate total length ***/
      const totalLength = mode.length +
        space.length +
        path.length +
        nullchar.length +
        oid.length;

      const combined = new Uint8Array(totalLength);
      let offset = 0;

      combined.set(mode, offset);
      offset += mode.length;
      combined.set(space, offset);
      offset += space.length;
      combined.set(path, offset);
      offset += path.length;
      combined.set(nullchar, offset);
      offset += nullchar.length;
      combined.set(oid, offset);

      buffers.push(combined);
    }

    /*** Concatenate all buffers ***/
    const totalLength = buffers.reduce((sum, buf) => sum + buf.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;

    for (const buf of buffers) {
      result.set(buf, offset);
      offset += buf.length;
    }

    return result;
  }

  *[Symbol.iterator](): Iterator<TreeEntry> {
    for (const entry of this._entries) {
      yield entry;
    }
  }
}



//// helper

function limitModeToAllowed(mode: string | number): string {
  if (typeof mode === "number")
    mode = mode.toString(8);

  /*** tree ***/
  if (mode.match(/^0?4.*/))
    return "040000"; /*** Directory ***/

  if (mode.match(/^1006.*/))
    return "100644"; /*** Regular non-executable file ***/

  if (mode.match(/^1007.*/))
    return "100755"; /*** Regular executable file ***/

  if (mode.match(/^120.*/))
    return "120000"; /*** Symbolic link ***/

  if (mode.match(/^160.*/))
    return "160000"; /*** Commit (git submodule reference) ***/

  throw new InternalError(`Could not understand file mode: ${mode}`);
}

function mode2type(mode: string): "blob" | "commit" | "tree" {
  switch(mode) {
    case "040000": {
      return "tree";
    }

    case "100644": {
      return "blob";
    }

    case "100755": {
      return "blob";
    }

    case "120000": {
      return "blob";
    }

    case "160000": {
      return "commit";
    }
  }

  throw new InternalError(`Unexpected GitTree entry mode: ${mode}`);
}

function nudgeIntoShape(entry: RawTreeEntry): TreeEntry {
  const result: any = { ...entry };

  if (!result.oid && result.sha)
    result.oid = result.sha; /*** Github ***/

  result.mode = limitModeToAllowed(result.mode); /*** index ***/

  if (!result.type)
    result.type = mode2type(result.mode); /*** index ***/

  return result as TreeEntry;
}

function parseBuffer(buffer: Uint8Array): TreeEntry[] {
  const _entries: TreeEntry[] = [];
  let cursor = 0;

  while (cursor < buffer.length) {
    const space = buffer.indexOf(32, cursor);

    if (space === -1)
      throw new InternalError(`GitTree: Error parsing buffer at byte location ${cursor}: Could not find the next space character.`);

    const nullchar = buffer.indexOf(0, cursor);

    if (nullchar === -1)
      throw new InternalError(`GitTree: Error parsing buffer at byte location ${cursor}: Could not find the next null character.`);

    let mode = new TextDecoder().decode(buffer.slice(cursor, space));

    if (mode === "40000")
      mode = "040000"; /*** makes it line up neater in printed output ***/

    const type = mode2type(mode);
    const path = new TextDecoder().decode(buffer.slice(space + 1, nullchar));

    /*** Prevent malicious git repos from writing to "..\foo" on clone etc ***/
    if (path.includes("\\") || path.includes("/"))
      throw new UnsafeFilepathError(path);

    const oid = Array.from(buffer.slice(nullchar + 1, nullchar + 21))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    cursor = nullchar + 21;
    _entries.push({ mode, oid, path, type });
  }

  return _entries;
}
