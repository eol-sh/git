/**
 * @fileoverview async-iterator-to-stream utility functions
 *
 * Utility functions for async-iterator-to-stream operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/async-iterator-to-stream.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// export

export function asyncIteratorToStream<T>(iter: AsyncIterable<T>): ReadableStream<T> {
  return new ReadableStream<T>({
    async start(controller) {
      try {
        for await (const chunk of iter) {
          controller.enqueue(chunk);
        }

        controller.close();
      } catch(error) {
        controller.error(error);
      }
    }
  });
}
