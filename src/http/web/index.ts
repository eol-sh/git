


//// util

import "../../typedefs.ts";

import { collect } from "../../utils/collect.ts";
import { fromStream } from "../../utils/from-stream.ts";



//// export

/**
 * HttpClient
 *
 * @param {GitHttpRequest} request
 * @returns {Promise<GitHttpResponse>}
 */
export async function request({
  body,
  headers = {},
  method = "GET",
  onProgress: _onProgress,
  url
}) {
  /*** streaming uploads aren’t possible yet in the browser ***/
  if (body)
    body = await collect(body);

  const res = await fetch(url, { body, headers, method });

  const iter = res.body && typeof res.body.getReader === 'function' ?
    fromStream(res.body) :
    [new Uint8Array(await res.arrayBuffer())];

  /*** convert Header object to ordinary JSON ***/
  headers = {};

  for (const [key, value] of res.headers.entries()) {
    headers[key] = value;
  }

  return {
    body: iter,
    headers: headers,
    method: method,
    statusCode: res.status,
    statusMessage: res.statusText,
    url: res.url
  };
}

export default { request };
