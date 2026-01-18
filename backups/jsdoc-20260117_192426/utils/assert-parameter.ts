


//// util

import { MissingParameterError } from "../errors/missing-parameter.ts";



//// export

export function assertParameter(name: string, value: any): void {
  if (value === undefined)
    throw new MissingParameterError(name);
}
