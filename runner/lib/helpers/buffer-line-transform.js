/* global Buffer */
/* eslint-disable no-underscore-dangle,no-nested-ternary,no-plusplus */

import { Transform } from 'stream';

export default class BufferLineTransform extends Transform {
  /**
   * The BufferLineTransform is reading String or Buffer content from a Readable stream
   * and writing each line as a Buffer in object mode
   *
   * @param {import('./buffer-line-transform.js').BufferLineTransformOptions} [options]
   */
  constructor(options) {
    const { break: breakValue, breakEncoding, ...transformOptions } =
      options || {};
    super({ ...transformOptions, readableObjectMode: true });
    this._breakValue = breakValue || 10;
    this._breakEncoding = breakEncoding;

    /** @type {number} */
    let breakLength;
    if (!breakValue || typeof breakValue === 'number') {
      breakLength = 1;
    } else if (Buffer.isBuffer(breakValue)) {
      breakLength = breakValue.length;
    } else {
      breakLength = Buffer.from(breakValue, breakEncoding).length;
    }
    this._breakLength = breakLength;

    /** @type {Array<Buffer>} */
    this._chunks = [];
  }

  /**
   * @override
   * @param {any} chunk
   * @param {BufferEncoding | 'buffer'} encoding
   * @param {import('stream').TransformCallback} cb
   * */
  _transform(chunk, encoding, cb) {
    try {
      /** @type {Buffer} */
      let buf =
        Buffer.isBuffer(chunk) || encoding === 'buffer'
          ? chunk
          : Buffer.from(chunk, encoding);

      // In case the break value is more than a single byte, it may span
      // multiple chunks. Since Node doesn't provide a way to get partial
      // search result, fallback to a less optimal early concatenation
      if (this._breakLength > 1 && this._chunks.length) {
        buf = Buffer.concat([/** @type {Buffer} */ (this._chunks.pop()), buf]);
      }

      while (buf.length) {
        const offset = buf.indexOf(this._breakValue, 0, this._breakEncoding);

        /** @type {number} */
        let endOffset;
        if (offset >= 0) {
          endOffset = offset + this._breakLength;
          if (this._chunks.length) {
            const concatLength = this._chunks.reduce(
              (acc, { length }) => acc + length,
              endOffset,
            );
            this._writeItem(
              Buffer.concat(
                [...this._chunks.splice(0, this._chunks.length), buf],
                concatLength,
              ),
            );
          } else {
            this._writeItem(buf.subarray(0, endOffset));
          }
        } else {
          endOffset = buf.length;
          this._chunks.push(buf);
        }
        buf = buf.subarray(endOffset);
      }
      cb();
    } catch (err) {
      cb(/** @type {any} */ (err)); // invalid data type;
    }
  }

  /**
   * @override
   * @param {import('stream').TransformCallback} cb
   * */
  _flush(cb) {
    if (this._chunks.length) {
      this._writeItem(
        Buffer.concat(this._chunks.splice(0, this._chunks.length)),
      );
    }
    cb();
  }

  /** @param {Buffer} line */
  _writeItem(line) {
    this.push(line);
  }
}
