/**
 * @fileoverview from-node-stream utility functions
 *
 * Utility functions for from-node-stream operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/from-node-stream.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// export

// Convert a Node stream to an Async Iterator
// Note: This module is for Node.js compatibility and may not be needed in Deno
export function fromNodeStream<T>(stream: any): AsyncIterable<T> & AsyncIterator<T> {
  /*** Use native async iteration if it’s available. ***/
  const asyncIterator = Object.getOwnPropertyDescriptor(stream, Symbol.asyncIterator);

  if (asyncIterator && asyncIterator.enumerable)
    return stream;

  // Author’s Note
  // I tried many MANY ways to do this.
  // I tried two npm modules (stream-to-async-iterator and streams-to-async-iterator) with no luck.
  // I tried using "readable" and .read(), and .pause() and .resume()
  // It took me two loooong evenings to get to this point.
  // So if you are horrified that this solution just builds up a queue with no backpressure,
  // and turns Promises inside out, too bad. This is the first code that worked reliably.

  const queue: T[] = [];
  let ended = false;
  let defer: {
    resolve?: (value: IteratorResult<T>) => void;
    reject?: (err: Error) => void;
  } = {};

  stream.on("data", (chunk: T) => {
    queue.push(chunk);

    if (defer.resolve) {
      defer.resolve({ done: false, value: queue.shift()! });
      defer = {};
    }
  });

  stream.on("error", (err: Error) => {
    if (defer.reject) {
      defer.reject(err);
      defer = {};
    }
  });

  stream.on("end", () => {
    ended = true;

    if (defer.resolve) {
      defer.resolve({ done: true, value: undefined });
      defer = {};
    }
  });

  return {
    next(): Promise<IteratorResult<T>> {
      return new Promise((resolve, reject) => {
        if (queue.length === 0 && ended)
          return resolve({ done: true, value: undefined });
        else if (queue.length > 0)
          return resolve({ done: false, value: queue.shift()! });
        else if (queue.length === 0 && !ended)
          defer = { reject, resolve };
      });
    },
    return() {
      stream.removeAllListeners();

      if (stream.destroy)
        stream.destroy();

      return Promise.resolve({ done: true, value: undefined });
    },
    [Symbol.asyncIterator]() {
      return this;
    }
  };
}
