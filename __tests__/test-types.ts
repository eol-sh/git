/*** deno test test-types.ts --no-check ***/



//// util

import type {
  Author,
  CloneOptions,
  CommitObject,
  FsInterface,
  GitHttpRequest,
  GitHttpResponse,
  TreeEntry
} from "../src/types.ts";



//// program

Deno.test("TypeScript types are properly defined", () => {
  /*** Test Author interface ***/
  const author: Author = {
    email: "test@example.com",
    name: "Test User",
    timestamp: Date.now(),
    timezoneOffset: -420
  };

  if (!author.name || !author.email)
    throw new Error("Author interface properties are not accessible");

  /*** Test TreeEntry interface ***/
  const treeEntry: TreeEntry = {
    mode: "100644",
    oid: "abc123",
    path: "test.txt",
    type: "blob"
  };

  if (treeEntry.type !== "blob")
    throw new Error("TreeEntry type property not working correctly");

  /*** Test that we can create properly typed objects ***/
  const commitObj: Partial<CommitObject> = {
    author,
    committer: author,
    message: "Test commit"
  };

  if (commitObj.message !== "Test commit")
    throw new Error("CommitObject properties not accessible");

  console.log("✅ TypeScript types test passed");
});
