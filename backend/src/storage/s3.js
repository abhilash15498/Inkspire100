import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

/**
 * Works with any S3-compatible service: Cloudflare R2, Backblaze B2, AWS S3, MinIO...
 * The bucket must be PRIVATE. Files are only ever served through this server,
 * after it has checked who is asking.
 */
export class S3Storage {
  constructor({ bucket, endpoint, region, accessKeyId, secretAccessKey, forcePathStyle }, client) {
    this.bucket = bucket;
    this.client =
      client ||
      new S3Client({
        region: region || 'auto',
        endpoint: endpoint || undefined,
        forcePathStyle: !!forcePathStyle,
        credentials: { accessKeyId, secretAccessKey },
      });
  }

  async put(key, buffer, contentType = 'application/octet-stream') {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: buffer, ContentType: contentType }),
    );
  }

  async get(key) {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return Buffer.from(await res.Body.transformToByteArray());
  }

  async delete(key) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
