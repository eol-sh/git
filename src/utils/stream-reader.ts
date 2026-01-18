/**
 * @fileoverview stream-reader utility functions
 *
 * Utility functions for stream-reader operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/stream-reader.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { getIterator } from "./get-iterator.ts";



//// export

/*** inspired by "gartal" but lighter-weight and more battle-tested. ***/
export class StreamReader {
  private _discardedBytes: number = 0;
  private _ended: boolean = false;
  private buffer: Uint8Array | null = null;
  private cursor: number = 0;
  private started: boolean = false;
  private stream: AsyncIterator<Uint8Array> | Iterator<Uint8Array>;
  private undoCursor: number = 0;

  constructor(
    stream:
      | AsyncIterable<Uint8Array>
      | Iterable<Uint8Array>
      | AsyncIterator<Uint8Array>
      | Iterator<Uint8Array>
  ) {
    this.stream = getIterator(stream);
  }

  async byte(): Promise<number | undefined> {
    if (this.eof())
      return;

    if (!this.started)
      await this._init();

    if (this.buffer && this.cursor === this.buffer.length) {
      await this._loadnext();

      if (this._ended)
        return;
    }

    this._moveCursor(1);
    return this.buffer![this.undoCursor];
  }

  async chunk(): Promise<Uint8Array | undefined> {
    if (this.eof())
      return;

    if (!this.started)
      await this._init();

    if (this.buffer && this.cursor === this.buffer.length) {
      await this._loadnext();

      if (this._ended)
        return;
    }

    if (!this.buffer)
      return;

    this._moveCursor(this.buffer.length);
    return this.buffer.slice(this.undoCursor, this.cursor);
  }

  eof(): boolean {
    return this._ended &&
      this.buffer !== null &&
      this.cursor === this.buffer.length;
  }

  async read(n: number): Promise<Uint8Array | undefined> {
    if (this.eof())
      return;

    if (!this.started)
      await this._init();

    if (this.buffer && this.cursor + n > this.buffer.length) {
      this._trim();
      await this._accumulate(n);
    }

    this._moveCursor(n);
    return this.buffer?.slice(this.undoCursor, this.cursor);
  }

  async skip(n: number): Promise<void> {
    if (this.eof())
      return;

    if (!this.started)
      await this._init();

    if (this.buffer && this.cursor + n > this.buffer.length) {
      this._trim();
      await this._accumulate(n);
    }

    this._moveCursor(n);
  }

  tell(): number {
    return this._discardedBytes + this.cursor;
  }

  undo(): Promise<void> {
    this.cursor = this.undoCursor;
    return Promise.resolve();
  }



  private async _accumulate(n: number): Promise<void> {
    if (this._ended || !this.buffer)
      return;

    /*** Expand the buffer until we have N bytes of data
    or we’ve reached the end of the stream ***/
    const buffers = [this.buffer];

    while (this.cursor + n > lengthBuffers(buffers)) {
      const nextbuffer = await this._next();

      if (this._ended)
        break;

      buffers.push(nextbuffer);
    }

    this.buffer = concatUint8Arrays(buffers);
  }

  private async _init(): Promise<void> {
    this.buffer = await this._next();
  }

  private async _loadnext(): Promise<void> {
    if (this.buffer)
      this._discardedBytes += this.buffer.length;

    this.undoCursor = 0;
    this.cursor = 0;
    this.buffer = await this._next();
  }

  private _moveCursor(n: number): void {
    this.undoCursor = this.cursor;
    this.cursor += n;

    if (this.buffer && this.cursor > this.buffer.length)
      this.cursor = this.buffer.length;
  }

  private async _next(): Promise<Uint8Array> {
    this.started = true;
    const { done, value } = await (this.stream as AsyncIterator<Uint8Array>).next();

    if (done) {
      this._ended = true;

      if (!value)
        return new Uint8Array(0);
    }

    return value ?
      new Uint8Array(value) :
      new Uint8Array(0);
  }

  private _trim(): void {
    /*** Throw away parts of the buffer we don’t need anymore ***/
    if (this.buffer) {
      this.buffer = this.buffer.slice(this.undoCursor);
      this.cursor -= this.undoCursor;
      this._discardedBytes += this.undoCursor;
      this.undoCursor = 0;
    }
  }
}



//// helper

function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }

  return result;
}

function lengthBuffers(buffers: Uint8Array[]): number {
  return buffers.reduce((acc, buffer) => acc + buffer.length, 0);
}
