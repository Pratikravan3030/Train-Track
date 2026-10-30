import crypto from 'crypto';
import { Readable } from 'stream';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetFileResult, StorageAdapter, StorageFileResult } from './types';

export class S3CompatibleStorageAdapter implements StorageAdapter {
  name = 's3';
  private s3Client: S3Client | null = null;
  private bucketName: string = '';

  private getClient(): { client: S3Client; bucket: string } {
    if (this.s3Client && this.bucketName) {
      return { client: this.s3Client, bucket: this.bucketName };
    }

    const bucket = process.env.S3_BUCKET_NAME;
    const region = process.env.S3_REGION;
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    const endpoint = process.env.S3_ENDPOINT;

    if (!bucket || !region || !accessKeyId || !secretAccessKey) {
      const missing: string[] = [];
      if (!bucket) missing.push('S3_BUCKET_NAME');
      if (!region) missing.push('S3_REGION');
      if (!accessKeyId) missing.push('S3_ACCESS_KEY_ID');
      if (!secretAccessKey) missing.push('S3_SECRET_ACCESS_KEY');

      throw new Error(
        `STORAGE CONFIGURATION ERROR: Missing required S3 storage environment variable(s): ${missing.join(
          ', '
        )}. Please configure these in your deployment settings.`
      );
    }

    this.bucketName = bucket;
    this.s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    });

    return { client: this.s3Client, bucket: this.bucketName };
  }

  async saveFile(params: {
    folder: 'resumes' | 'offers' | 'offer-letters' | 'photos';
    buffer: Buffer;
    contentType?: string;
  }): Promise<StorageFileResult> {
    const { client, bucket } = this.getClient();
    const fileId = crypto.randomUUID();
    let ext = '.pdf';
    if (params.contentType === 'image/jpeg') ext = '.jpg';
    else if (params.contentType === 'image/png') ext = '.png';
    else if (params.contentType === 'image/webp') ext = '.webp';
    const key = `${params.folder}/${fileId}${ext}`;

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: params.buffer,
        ContentType: params.contentType || 'application/pdf',
        // Never set public ACL; bucket stays private
      })
    );

    return {
      key,
      url: `/api/storage/${key}`,
    };
  }

  async getFile(key: string): Promise<GetFileResult | null> {
    const { client, bucket } = this.getClient();

    try {
      const response = await client.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: key,
        })
      );

      if (!response.Body) {
        return null;
      }

      return {
        stream: response.Body as unknown as Readable,
        contentType: response.ContentType || 'application/pdf',
        contentLength: response.ContentLength,
      };
    } catch {
      return null;
    }
  }

  async getSignedDownloadUrl(key: string, expiresInSeconds = 300): Promise<string | null> {
    const { client, bucket } = this.getClient();

    // Enforce maximum 5 minutes (300 seconds) expiration
    const safeExpires = Math.min(Math.max(expiresInSeconds, 1), 300);

    try {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        ResponseContentType: 'application/pdf',
        ResponseContentDisposition: 'inline; filename="document.pdf"',
      });

      return await getSignedUrl(client, command, { expiresIn: safeExpires });
    } catch {
      return null;
    }
  }

  async deleteFile(key: string): Promise<boolean> {
    const { client, bucket } = this.getClient();

    try {
      await client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: key,
        })
      );
      return true;
    } catch {
      return false;
    }
  }
}
