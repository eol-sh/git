


//// util

import { BaseError } from "./base.ts";



//// export

export class PullError extends BaseError {
  static code = "PullError" as const;
  public override code = PullError.code;
  public override data: { reason: string; ref?: string; remote?: string };
  public override name = PullError.code;

  constructor(reason: string, options?: { ref?: string; remote?: string }) {
    let message: string;

    switch(reason) {
      case "no_current_branch": {
        message = "Cannot pull when not on any branch. Please checkout a branch first or specify a ref explicitly.";
        break;
      }

      case "detached_head": {
        message = "Cannot pull in detached HEAD state. Please checkout a branch first or specify both ref and remote.";
        break;
      }

      case "no_upstream": {
        message = options?.ref ?
          `Branch "${options.ref}" has no upstream branch configured. Please specify a remote and ref, or configure an upstream branch.` :
          "Current branch has no upstream branch configured. Please specify a remote and ref, or configure an upstream branch.";
        break;
      }

      case "no_remote": {
        message = "No remote specified and no default remote configured. Please specify a remote URL or remote name.";
        break;
      }

      default: {
        message = `Pull failed: ${reason}`;
      }
    }

    super(message);
    this.data = { reason, ...options };
  }
}
