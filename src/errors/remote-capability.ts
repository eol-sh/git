


/**
 * @fileoverview Remote capability error implementation
 * 
 * This error is thrown when attempting to use a Git capability that
 * is not supported by the remote server. This typically occurs when
 * trying to use advanced features like shallow cloning or specific
 * depth parameters with servers that don't support them.
 * 
 * @module errors/remote-capability
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { BaseError } from "./base.ts";

type Capability = "deepen-not" | "deepen-relative" | "deepen-since" | "shallow";
type Parameter = "depth" | "exclude" | "relative" | "since";



//// export

export class RemoteCapabilityError extends BaseError {
  static readonly code = "RemoteCapabilityError" as const;

  constructor(capability: Capability, parameter: Parameter) {
    super(`Remote does not support the "${capability}" so the "${parameter}" parameter cannot be used.`);

    this.code = this.name = RemoteCapabilityError.code;
    this.data = { capability, parameter };
  }
}
