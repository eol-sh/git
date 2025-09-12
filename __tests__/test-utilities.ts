/*** deno test test-utilities.ts --no-check ***/



//// util

import { asyncIteratorToStream } from "../src/utils/async-iterator-to-stream.ts";
import { calculateBasicAuthHeader } from "../src/utils/calculate-basic-auth-header.ts";
import type { AuthOptions } from "../src/types.ts";



//// program

Deno.test("calculateBasicAuthHeader creates correct auth header", () => {
  const authOptions: AuthOptions = {
    password: "testpass",
    username: "testuser"
  };

  const header = calculateBasicAuthHeader(authOptions);

  /*** Verify the header format ***/
  if (!header.startsWith("Basic "))
    throw new Error(`Auth header does not start with "Basic "`);

  /*** Decode and verify the base64 encoded credentials ***/
  const encodedCredentials = header.slice(6); /*** Remove "Basic " ***/
  const decodedCredentials = atob(encodedCredentials);

  if (decodedCredentials !== "testuser:testpass")
    throw new Error(`Expected "testuser:testpass", got "${decodedCredentials}"`);

  console.log("✅ Basic auth header test passed");
});

Deno.test("calculateBasicAuthHeader handles empty credentials", () => {
  const authOptions: AuthOptions = {};
  const header = calculateBasicAuthHeader(authOptions);
  const encodedCredentials = header.slice(6);
  const decodedCredentials = atob(encodedCredentials);

  if (decodedCredentials !== ":")
    throw new Error(`Expected ":", got "${decodedCredentials}"`);

  console.log("✅ Empty credentials auth header test passed");
});

Deno.test("asyncIteratorToStream converts async iterator to ReadableStream", async() => {
  /*** Create a simple async iterator ***/
  async function* simpleIterator() {
    yield new Uint8Array([1, 2, 3]);
    yield new Uint8Array([4, 5, 6]);
    yield new Uint8Array([7, 8, 9]);
  }

  const stream = asyncIteratorToStream(simpleIterator());

  /*** Verify it’s a ReadableStream ***/
  if (!(stream instanceof ReadableStream))
    throw new Error("Expected ReadableStream");

  /*** Read from the stream ***/
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done)
        break;

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  /*** Verify we got all chunks ***/
  if (chunks.length !== 3)
    throw new Error(`Expected 3 chunks, got ${chunks.length}`);

  /*** Verify chunk contents ***/
  if (chunks[0][0] !== 1 || chunks[1][0] !== 4 || chunks[2][0] !== 7)
    throw new Error("Chunk contents are incorrect");

  console.log("✅ Async iterator to stream test passed");
});
