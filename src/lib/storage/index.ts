import { StorageAdapter } from './types';
import { LocalDiskStorageAdapter } from './localStorage';
import { S3CompatibleStorageAdapter } from './s3Storage';

export * from './types';
export * from './localStorage';
export * from './s3Storage';

export const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB strict limit

/**
 * Validates that the buffer is a valid PDF by checking magic bytes `%PDF` (0x25, 0x50, 0x44, 0x46)
 */
export function isValidPdf(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  return (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  );
}

let activeAdapter: StorageAdapter | null = null;

/**
 * Resolves the configured storage adapter.
 * Selects based on `process.env.STORAGE_PROVIDER`.
 */
export function getStorageAdapter(): StorageAdapter {
  if (activeAdapter) {
    return activeAdapter;
  }

  const provider = (process.env.STORAGE_PROVIDER || 'local').toLowerCase();

  if (provider === 's3') {
    return new S3CompatibleStorageAdapter();
  }

  return new LocalDiskStorageAdapter();
}

/**
 * For testing purposes: override the active storage adapter.
 */
export function setStorageAdapterForTesting(adapter: StorageAdapter | null): void {
  activeAdapter = adapter;
}
