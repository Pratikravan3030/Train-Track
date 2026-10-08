import { Readable } from 'stream';

export interface StorageFileResult {
  key: string;
  url: string;
}

export interface GetFileResult {
  stream?: Readable;
  buffer?: Buffer;
  contentType: string;
  contentLength?: number;
}

export interface StorageAdapter {
  name: string;

  /**
   * Saves a file to the storage provider under a random UUID key.
   */
  saveFile(params: {
    folder: 'resumes' | 'offers';
    buffer: Buffer;
    contentType?: string;
  }): Promise<StorageFileResult>;

  /**
   * Retrieves a file as a stream or buffer for proxy delivery.
   */
  getFile(key: string): Promise<GetFileResult | null>;

  /**
   * Generates a temporary pre-signed URL for direct download (valid <= 5 mins).
   */
  getSignedDownloadUrl(key: string, expiresInSeconds?: number): Promise<string | null>;

  /**
   * Deletes a file from storage.
   */
  deleteFile(key: string): Promise<boolean>;
}
