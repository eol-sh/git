


//// util

import type { RemoteRef } from "../types.ts";

interface Remote {
  refs: Map<string, string>;
  symrefs: Map<string, string>;
}



//// export

export function formatInfoRefs(remote: Remote, prefix: string, symrefs: boolean, peelTags: boolean): RemoteRef[] {
  const refs: RemoteRef[] = [];

  for (const [key, value] of remote.refs) {
    if (prefix && !key.startsWith(prefix))
      continue;

    if (key.endsWith("^{}")) {
      if (peelTags) {
        const _key = key.replace("^{}", "");
        /*** Peeled tags are almost always listed immediately after the original tag ***/
        const last = refs[refs.length - 1];

        const r = last?.ref === _key ?
          last :
          refs.find((x) => x.ref === _key);

        if (r === undefined)
          throw new Error("I did not expect this to happen");

        r.peeled = value;
      }

      continue;
    }

    const ref: RemoteRef = { oid: value, ref: key };

    if (symrefs) {
      if (remote.symrefs.has(key)) {
        const target = remote.symrefs.get(key);

        if (target)
          ref.target = target;
      }
    }

    refs.push(ref);
  }

  return refs;
}
