


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
