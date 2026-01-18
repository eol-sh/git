/**
 * @fileoverview fifo utility functions
 *
 * Utility functions for fifo operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/fifo.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// export

export class FIFO<T = any> {
  private _ended = false;
  private _queue: T[] = [];
  private _waiting: ((result: IteratorResult<T>) => void) | null = null;
  public error?: Error;

  destroy(err: Error): void {
    this.error = err;
    this.end();
  }

  end(): void {
    this._ended = true;

    if (this._waiting) {
      const resolve = this._waiting;

      this._waiting = null;
      resolve({ done: true, value: undefined });
    }
  }

  next(): Promise<IteratorResult<T>> {
    if (this._queue.length > 0)
      return Promise.resolve({ value: this._queue.shift()! });

    if (this._ended)
      return Promise.resolve({ done: true, value: undefined });

    if (this._waiting)
      throw Error("You cannot call read until the previous call to read has returned!");

    return new Promise((resolve) => {
      this._waiting = resolve;
    });
  }

  write(chunk: T): void {
    if (this._ended)
      throw Error("You cannot write to a FIFO that has already been ended!");

    if (this._waiting) {
      const resolve = this._waiting;

      this._waiting = null;
      resolve({ value: chunk });
    } else {
      this._queue.push(chunk);
    }
  }
}
