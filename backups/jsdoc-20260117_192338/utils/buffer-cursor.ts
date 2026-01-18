


//// export

export class BufferCursor {
  private _start: number = 0;
  buffer: Uint8Array;

  constructor(buffer: Uint8Array | ArrayBuffer) {
    this.buffer = buffer instanceof ArrayBuffer ?
      new Uint8Array(buffer) :
      buffer;
    this._start = 0;
  }

  copy(source: Uint8Array, start?: number, end?: number): number {
    const sourceSlice = source.slice(start, end);

    this.buffer.set(sourceSlice, this._start);
    this._start += sourceSlice.length;

    return sourceSlice.length;
  }

  eof(): boolean {
    return this._start >= this.buffer.length;
  }

  readUInt8(): number {
    const r = this.buffer[this._start];

    this._start += 1;
    return r;
  }

  readUInt16BE(): number {
    const r = (this.buffer[this._start] << 8) | this.buffer[this._start + 1];
    this._start += 2;

    return r;
  }

  readUInt32BE(): number {
    const r = (this.buffer[this._start] << 24) |
      (this.buffer[this._start + 1] << 16) |
      (this.buffer[this._start + 2] << 8) | this.buffer[this._start + 3];

    this._start += 4;
    return r >>> 0; /*** Convert to unsigned 32-bit ***/
  }

  seek(n: number): void {
    this._start = n;
  }

  slice(n: number): Uint8Array {
    const r = this.buffer.slice(this._start, this._start + n);

    this._start += n;
    return r;
  }

  tell(): number {
    return this._start;
  }

  toString(enc?: string, length?: number): string {
    const slice = this.buffer.slice(
      this._start,
      this._start + (length || this.buffer.length - this._start)
    );

    this._start += length || (this.buffer.length - this._start);
    return new TextDecoder(enc).decode(slice);
  }

  write(value: string, length: number, _enc?: string): number {
    const encoded = new TextEncoder().encode(value);
    const bytesToWrite = Math.min(length, encoded.length);

    this.buffer.set(encoded.slice(0, bytesToWrite), this._start);
    this._start += bytesToWrite;

    return bytesToWrite;
  }

  writeUInt8(value: number): number {
    this.buffer[this._start] = value & 0xFF;
    this._start += 1;

    return 1;
  }

  writeUInt16BE(value: number): number {
    this.buffer[this._start] = (value >> 8) & 0xFF;
    this.buffer[this._start + 1] = value & 0xFF;
    this._start += 2;

    return 2;
  }

  writeUInt32BE(value: number): number {
    this.buffer[this._start] = (value >>> 24) & 0xFF;
    this.buffer[this._start + 1] = (value >>> 16) & 0xFF;
    this.buffer[this._start + 2] = (value >>> 8) & 0xFF;
    this.buffer[this._start + 3] = value & 0xFF;
    this._start += 4;

    return 4;
  }
}



// Modeled after https://github.com/tjfontaine/node-buffercursor
// but with the goal of being much lighter weight.
