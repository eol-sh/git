


//// util

import { BaseError } from "./base.ts";

type GitObjectType = "blob" | "commit" | "tag" | "tree";



//// export

export class ObjectTypeError extends BaseError {
  static code = "ObjectTypeError" as const;
  public override code = ObjectTypeError.code;
  public override data: {
    actual: GitObjectType;
    expected: GitObjectType;
    filepath?: string;
    oid: string;
  };
  public override name = ObjectTypeError.code;

  constructor(oid: string, actual: GitObjectType, expected: GitObjectType, filepath?: string) {
    super(`Object ${oid} ${filepath ? `at ${filepath} ` : ""}was anticipated to be a ${expected} but it is a ${actual}.`);
    this.data = {
      actual,
      expected,
      ...(filepath !== undefined ? { filepath } : {}),
      oid
    };
  }
}
