


//// export

// Convert a web ReadableStream (not Node stream!) to an Async Iterator
// adapted from https://jakearchibald.com/2017/async-iterators-and-generators/
export function fromStream<T>(stream: ReadableStream<T>): AsyncIterable<T> & AsyncIterator<T> {
  /*** Use native async iteration if it’s available. ***/
  if ((stream as any)[Symbol.asyncIterator])
    return stream as any;

  const reader = stream.getReader();

  return {
    next() {
      return reader.read();
    },
    return() {
      reader.releaseLock();
      return Promise.resolve({ done: true, value: undefined });
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };
}
