


/**
 * @fileoverview Unknown transport error implementation
 * 
 * This error is thrown when attempting to use a Git transport protocol
 * that is not recognized or supported by the implementation. Git supports
 * various transport protocols like HTTP(S), SSH, and local file paths,
 * and this error occurs when an unsupported protocol is specified.
 * 
 * @module errors/unknown-transport
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { BaseError } from "./base.ts";



//// export

export class UnknownTransportError extends BaseError {
  static readonly code = "UnknownTransportError" as const;

  constructor(url: string, transport: string, suggestion?: string) {
    super(`Git remote "${url}" uses an unrecognized transport protocol: "${transport}"`);

    this.code = this.name = UnknownTransportError.code;
    this.data = { suggestion, transport, url };
  }
}
