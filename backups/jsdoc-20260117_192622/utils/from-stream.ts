


//// export

// Convert a web ReadableStream (not Node stream!) to an Async Iterator
// adapted from https://jakearchibald.com/2017/async-iterators-and-generators/
export function fromStream<T>(stream: ReadableStream<T>): AsyncIterable<T> & AsyncIterator<T> {
  /*** Use native async iteration if it’s available. ***/
  if ((stream as any)[Symbol.asyncIterator])
    return stream as any;

  const reader = stream.getReader();

  return {
    async next() {
      const result = await reader.read();
      // Ensure value is always present for IteratorResult compatibility
      if (result.done) {
        return { done: true, value: undefined } as IteratorReturnResult<any>;
      }
      return result as IteratorYieldResult<T>;
    },
    return() {
      reader.releaseLock();
      return Promise.resolve({ done: true, value: undefined } as IteratorReturnResult<any>);
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };
}
