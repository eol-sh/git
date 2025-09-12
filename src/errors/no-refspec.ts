


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
