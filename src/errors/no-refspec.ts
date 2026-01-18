


/**
 * @fileoverview No refspec error implementation
 * 
 * This error is thrown when attempting to fetch from a remote that has
 * no configured fetch refspec. A refspec defines how references are
 * mapped between the remote and local repository during fetch operations.
 * 
 * @module errors/no-refspec
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { BaseError } from "./base.ts";



//// export

export class NoRefspecError extends BaseError {
  static readonly code = "NoRefspecError" as const;

  constructor(remote: string) {
    super(
      `Could not find a fetch refspec for remote "${remote}". Make sure the config file has an entry like the following:
[remote "${remote}"]
\tfetch = +refs/heads/*:refs/remotes/origin/*
`
    );

    this.code = this.name = NoRefspecError.code;
    this.data = { remote };
  }
}
