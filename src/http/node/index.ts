/**
 * @fileoverview index implementation
 *
 * Implementation of index functionality for the Git system.
 *
 * @module http/node/index.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import "../../typedefs.ts";
import { collect } from "../../utils/collect.ts";

import type { GitHttpRequest, GitHttpResponse } from "../../types.ts";



//// export

/**
 * HttpClient
 */
export async function request({
  agent: _agent,
  body,
  headers = {},
  method = "GET",
  onProgress: _onProgress,
  url
}: GitHttpRequest): Promise<GitHttpResponse> {
  /*** Convert body if it’s an array ***/
  let requestBody: BodyInit | null = null;

  if (body && Array.isArray(body)) {
    /*** Convert array to AsyncIterable for collect function ***/
    const arrayIterable = {
      async *[Symbol.asyncIterator]() {
        for (const item of body) {
          yield item;
        }
      }
    };

    const collected = await collect(arrayIterable);
    requestBody = collected;
  } else if (body && typeof body[Symbol.asyncIterator] === "function") {
    const collected = await collect(body);
    requestBody = collected;
  } else if (body) {
    requestBody = body;
  }

  try {
    const response = await fetch(url, {
      body: requestBody,
      headers,
      method
    });

    /*** Create async iterator from response body ***/
    const bodyIter = response.body ?
      (async function* (): AsyncGenerator<Uint8Array, void, unknown> {
        const reader = response.body!.getReader();

        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done)
              break;

            yield value;
          }
        } finally {
          reader.releaseLock();
        }
      })() :
      (async function* (): AsyncGenerator<Uint8Array, void, unknown> {})();

    return {
      body: bodyIter,
      headers: Object.fromEntries(response.headers.entries()),
      method,
      statusCode: response.status,
      statusMessage: response.statusText,
      url: response.url
    };
  } catch(err) {
    throw err;
  }
}

export default { request };
