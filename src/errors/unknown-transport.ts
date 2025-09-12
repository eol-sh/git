


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
