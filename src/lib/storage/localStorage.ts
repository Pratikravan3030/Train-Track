import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { GetFileResult, StorageAdapter, StorageFileResult } from './types';

export class LocalDiskStorageAdapter implements StorageAdapter {
  name = 'local';
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir =
      baseDir ||
      process.env.UPLOAD_DIR ||
      path.join(/*turbopackIgnore: true*/ process.cwd(), 'uploads');
  }

  private ensureProductionSafety(): void {
    const isProduction =
      process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
    if (isProduction) {
      throw new Error(
        'CRITICAL CONFIGURATION ERROR: Local filesystem storage is disabled in production environments (including Vercel). ' +
          'Please configure an S3-compatible bucket via STORAGE_PROVIDER=s3 and provide S3_BUCKET_NAME, S3_REGION, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY.'
      );
    }
  }

  private getFolderDir(folder: 'resumes' | 'offers' | 'offer-letters' | 'photos'): string {
    const dir = path.join(this.baseDir, folder);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  private resolveSafePath(key: string): string | null {
    // Keys are expected to be e.g. "resumes/<uuid>.pdf" or "offers/<uuid>.pdf"
    const safeKey = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, '');
    const resolved = path.resolve(this.baseDir, safeKey);
    if (!resolved.startsWith(path.resolve(this.baseDir))) {
      return null;
    }
    return resolved;
  }

  async saveFile(params: {
    folder: 'resumes' | 'offers' | 'offer-letters' | 'photos';
    buffer: Buffer;
    contentType?: string;
  }): Promise<StorageFileResult> {
    this.ensureProductionSafety();

    const folderDir = this.getFolderDir(params.folder);
    const fileId = crypto.randomUUID();
    let ext = '.pdf';
    if (params.contentType === 'image/jpeg') ext = '.jpg';
    else if (params.contentType === 'image/png') ext = '.png';
    else if (params.contentType === 'image/webp') ext = '.webp';

    const filename = `${fileId}${ext}`;
    const targetPath = path.join(folderDir, filename);

    await fs.promises.writeFile(targetPath, params.buffer);
    const key = `${params.folder}/${filename}`;

    return {
      key,
      url: `/api/storage/${key}`,
    };
  }

  async getFile(key: string): Promise<GetFileResult | null> {
    const resolvedPath = this.resolveSafePath(key);
    if (!resolvedPath || !fs.existsSync(resolvedPath)) {
      return null;
    }

    const buffer = await fs.promises.readFile(resolvedPath);
    let contentType = 'application/pdf';
    if (key.endsWith('.jpg') || key.endsWith('.jpeg')) {
      contentType = 'image/jpeg';
    } else if (key.endsWith('.png')) {
      contentType = 'image/png';
    } else if (key.endsWith('.webp')) {
      contentType = 'image/webp';
    }

    return {
      buffer,
      contentType,
      contentLength: buffer.length,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getSignedDownloadUrl(_key: string, _expiresInSeconds?: number): Promise<string | null> {
    // Local storage does not issue S3 presigned URLs; returns null to fall back to route streaming
    return null;
  }

  async deleteFile(key: string): Promise<boolean> {
    const resolvedPath = this.resolveSafePath(key);
    if (!resolvedPath || !fs.existsSync(resolvedPath)) {
      return false;
    }
    try {
      await fs.promises.unlink(resolvedPath);
      return true;
    } catch {
      return false;
    }
  }
}
