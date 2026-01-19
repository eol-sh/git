/*** deno test --allow-net test-http-simple.ts --no-check ***/

/*** UTILITY ------------------------------------------ ***/

import { request } from "../src/http/node/index.ts";
import type { GitHttpRequest, GitHttpResponse } from "../src/types.ts";

/*** PROGRAM ------------------------------------------ ***/

Deno.test("HTTP client basic functionality", { sanitizeResources: false }, async() => {
  /*** Test with a simple GET request to a public API ***/
  const httpRequest: GitHttpRequest = {
    headers: {
      "User-Agent": "@eol/git-test"
    },
    method: "GET",
    url: "https://httpbin.org/get"
  };

  try {
    const response: GitHttpResponse = await request(httpRequest);

    /*** Handle service unavailable gracefully ***/
    if (response.statusCode === 503) {
      console.log("⚠️  HTTP test skipped (httpbin.org service unavailable - 503)");
      return;
    }

    if (response.statusCode !== 200)
      throw new Error(`Expected status 200, got ${response.statusCode}`);

    if (!response.url)
      throw new Error("Response URL is missing");

    if (!response.headers)
      throw new Error("Response headers are missing");

    /*** Test that body is async iterable ***/
    if (!response.body || typeof response.body[Symbol.asyncIterator] !== "function")
      throw new Error("Response body is not async iterable");

    console.log("✅ HTTP client test passed");
  } catch(error) {
    /*** If httpbin.org is not accessible, that’s okay for this test ***/
    if (error instanceof TypeError && error.message.includes("fetch")) {
      console.log("⚠️  HTTP test skipped (network not available)");
      return;
    }

    throw error;
  }
});

Deno.test("HTTP client function signature test", () => {
  /*** Test that we can create the request object with proper typing ***/
  const httpRequest: GitHttpRequest = {
    headers: { "User-Agent": "test" },
    method: "GET",
    url: "https://example.com"
  };

  if (typeof request !== "function")
    throw new Error("request is not a function");

  if (httpRequest.url !== "https://example.com")
    throw new Error("Request object not properly typed");

  console.log("✅ HTTP client function signature test passed");
});
