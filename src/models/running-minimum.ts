/**
 * @fileoverview running-minimum model definition
 *
 * Defines the running-minimum class and related types for representing
 * Git objects and data structures in the implementation.
 *
 * @module models/running-minimum.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// export

/*** This is convenient for computing unions/joins of sorted lists. ***/
export class RunningMinimum<T = string> {
  /*** Using a getter for "value" would just bloat the code.
  You know better than to set it directly right? ***/
  public value: T | null = null;

  consider(value: T | null | undefined): void {
    if (value === null || value === undefined)
      return;

    if (this.value === null)
      this.value = value;
    else if (value < this.value!)
      this.value = value;
  }

  reset(): void {
    this.value = null;
  }
}
