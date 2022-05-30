import { createReadStream, createWriteStream, WriteStream } from 'fs';
import { PassThrough } from 'stream';
import { randomUUID } from 'crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Upload } from '@aws-sdk/lib-storage';
import { CollectSizeTransformStream } from './CollectSizeTransformStream';

const BUCKET_NAME = 'YOUR BUCKET NAME';

function createS3Client() {
	return new S3Client({
		credentials: {
			accessKeyId: 'YOUR ACCESS KEY',
			secretAccessKey: 'YOUR SECRET ACCESS KEY',
		},
		region: 'us-east-2',
		apiVersion: '2006-03-01',
	});
}

function readPackageJson() {
	const readStream = createReadStream('tsconfig.json');
	return readStream.pipe(new PassThrough);
}

function openObjectsLog() {
	return createWriteStream('logs/objects.log', { flags: 'a' });
}

function appendPutObjectLog(log: WriteStream, objectId: string, size: number) {
	const now = (new Date).toISOString();
	const logLine = `${now} | [put_object] ${objectId} ${size}\n`;
	console.log(logLine);
	log.write(logLine);
}

function appendMultpartUploadLog(log: WriteStream, objectId: string, size: number) {
	const now = (new Date).toISOString();
	const logLine = `${now} | [multpart_upload] ${objectId} ${size}\n`
	console.log(logLine);
	log.write(logLine);
}


interface S3OperationConfig {
	client: S3Client;
	readStream: PassThrough;
	persistentLog: WriteStream;
}


async function uploadUnkownStreamSizeError({ client, persistentLog, readStream }: S3OperationConfig) {
	const objectId = randomUUID();
	const collectSize = new CollectSizeTransformStream();
	const cmd = new PutObjectCommand({
		Bucket: BUCKET_NAME,
		Key: objectId,
		Body: readStream.pipe(collectSize),
		CacheControl: 'private, max-age=63072000',
	});

	await client.send(cmd);
	appendPutObjectLog(persistentLog, objectId, collectSize.bytesRead);
}

async function uploadWithUploadMethod({ client, persistentLog, readStream }: S3OperationConfig) {
	const objectId = randomUUID();
	const collectSize = new CollectSizeTransformStream();
	const multipartUpload = new Upload({
		client,
		params: {
			Bucket: BUCKET_NAME,
			Key: objectId,
			Body: readStream.pipe(collectSize),
			ContentType: 'application/json',
			CacheControl: 'private, max-age=63072000',
		},
	});

	await multipartUpload.done();
	appendMultpartUploadLog(persistentLog, objectId, collectSize.bytesRead);
}


async function main() {
	const config: S3OperationConfig = {
		client: createS3Client(),
		persistentLog: openObjectsLog(),
		readStream: readPackageJson(),
	}

	await uploadWithUploadMethod(config);
}

main().finally(() => console.log('finish'));
