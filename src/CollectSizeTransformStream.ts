import { Transform, TransformCallback } from "stream";

type ChunkType = string | NodeJS.ArrayBufferView | ArrayBuffer | SharedArrayBuffer;

export class CollectSizeTransformStream extends Transform {
	private sizeInBytes: number = 0;

	_transform(chunk: ChunkType, encoding: BufferEncoding, callback: TransformCallback): void {
		this.sizeInBytes += Buffer.byteLength(chunk, encoding);
		callback(null, chunk);
	}

	public get bytesRead(): number { return this.sizeInBytes; }

}
