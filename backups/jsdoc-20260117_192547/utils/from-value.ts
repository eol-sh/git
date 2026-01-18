


//// export

// Convert a value to an Async Iterator
// This will be easier with async generator functions.
export function fromValue<T>(value: T): AsyncIterable<T> & AsyncIterator<T> {
  let queue: T[] = [value];

  return {
    next(): Promise<IteratorResult<T>> {
      const isEmpty = queue.length === 0;

      if (isEmpty)
        return Promise.resolve({ done: true, value: undefined });
      else
        return Promise.resolve({ done: false, value: queue.pop()! });
    },
    return(): Promise<IteratorResult<T>> {
      queue = [];
      return Promise.resolve({ done: true, value: undefined });
    },
    [Symbol.asyncIterator]() {
      return this;
    }
  };
}
