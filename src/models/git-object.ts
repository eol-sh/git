/**
 * @fileoverview git-object model definition
 *
 * Defines the git-object class and related types for representing
 * Git objects and data structures in the implementation.
 *
 * @module models/git-object.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { InternalError } from "../errors/internal.ts";

interface UnwrapResult {
  object: Uint8Array;
  type: string;
}

interface WrapParams {
  object: Uint8Array;
  type: string;
}



//// export

/**
 * Represents a Git object and provides methods to wrap and unwrap Git objects
 * according to the Git object format.
 */
export class GitObject {
  /**
   * Wraps a raw object with a Git header.
   */
  static wrap({ type, object }: WrapParams): Uint8Array {
    const header = `${type} ${object.length}\x00`;
    const headerLen = header.length;
    const totalLength = headerLen + object.length;

    /*** Allocate a single buffer for the header and object, rather than create multiple buffers ***/
    const wrappedObject = new Uint8Array(totalLength);

    for (let i = 0; i < headerLen; i++) {
      wrappedObject[i] = header.charCodeAt(i);
    }

    wrappedObject.set(object, headerLen);
    return wrappedObject;
  }

  /**
   * Unwraps a Git object buffer into its type and raw object data.
   *
   * @throws {InternalError} If the length specified in the header does not match the actual object length.
   */
  static unwrap(buffer: Uint8Array): UnwrapResult {
    const s = buffer.indexOf(32); /*** first space ***/
    const i = buffer.indexOf(0);  /*** first null value ***/
    const type = new TextDecoder().decode(buffer.slice(0, s));       /*** get type of object ***/
    const length = new TextDecoder().decode(buffer.slice(s + 1, i)); /*** get length ***/
    const actualLength = buffer.length - (i + 1);

    /*** verify length ***/
    if (parseInt(length) !== actualLength)
      throw new InternalError(`Length mismatch: expected ${length} bytes but got ${actualLength} instead.`);

    return {
      object: buffer.slice(i + 1),
      type
    };
  }
}
