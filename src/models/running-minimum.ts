


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
