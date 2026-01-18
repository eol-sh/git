/**
 * @fileoverview Base error class for all Git operation errors
 * 
 * Provides a common base class with serialization support for all Git errors.
 * All custom error types in the library extend from this base class.
 * 
 * @module errors/base
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */

//// export

export class BaseError extends Error {
  public caller = "";
  public code!: string;
  public data?: any;

  constructor(message: string) {
    super(message);
    /*** Setting this here allows TS to infer that all git errors have a `caller` property and
    that its type is string. ***/
    this.caller = "";
  }

  toJSON() {
    /*** Error objects aren’t normally serializable. So we do something about that. ***/
    return {
      caller: this.caller,
      code: this.code,
      data: this.data,
      message: this.message,
      stack: this.stack
    };
  }

  static fromJSON(json: any): BaseError {
    const e = new BaseError(json.message);

    e.caller = json.caller;
    e.code = json.code;
    e.data = json.data;
    e.stack = json.stack;

    return e;
  }
}
