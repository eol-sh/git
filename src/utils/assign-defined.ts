


//// export

export function assignDefined<T extends Record<string, any>>(target: T, ...sources: Partial<T>[]): T {
  for (const source of sources) {
    if (source) {
      for (const key of Object.keys(source)) {
        const val = source[key];

        if (val !== undefined)
          (target as any)[key] = val;
      }
    }
  }

  return target;
}



// Like Object.assign but ignore properties with undefined values
// ref: https://stackoverflow.com/q/39513815
