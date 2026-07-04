import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";

import { canvasS3Config } from "./env.js";

export type StoredObject = {
  bucket: string;
  key: string;
  sizeBytes: number;
};

function s3Client() {
  const config = canvasS3Config();

  const clientConfig: S3ClientConfig = {
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: config.forcePathStyle,
    region: config.region,
  };

  if (config.endpoint) {
    clientConfig.endpoint = config.endpoint;
  }

  return new S3Client(clientConfig);
}

export async function ensureCanvasBucket() {
  const config = canvasS3Config();
  const client = s3Client();

  try {
    await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
    return;
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: config.bucket }));
  }
}

export async function putCanvasObject({
  body,
  contentType,
  key,
}: {
  body: Buffer;
  contentType: string;
  key: string;
}): Promise<StoredObject> {
  const config = canvasS3Config();

  await s3Client().send(
    new PutObjectCommand({
      Body: body,
      Bucket: config.bucket,
      ContentLength: body.byteLength,
      ContentType: contentType,
      Key: key,
    }),
  );

  return {
    bucket: config.bucket,
    key,
    sizeBytes: body.byteLength,
  };
}

export async function getCanvasObject({
  bucket,
  key,
}: {
  bucket: string;
  key: string;
}) {
  const response = await s3Client().send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );

  if (!response.Body) {
    return Buffer.alloc(0);
  }

  return Buffer.from(await response.Body.transformToByteArray());
}
