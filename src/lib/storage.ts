import fs from 'fs';
import path from 'path';
import {
  getStorageAdapter,
  isValidPdf,
  MAX_FILE_SIZE_BYTES,
} from './storage/index';

export * from './storage/index';

// Backwards compatibility alias
export const MAX_RESUME_SIZE_BYTES = MAX_FILE_SIZE_BYTES; // 2 MB strict limit

/**
 * Legacy helper for test compatibility or direct path lookup.
 */
export function getUploadDir(): string {
  const dir =
    process.env.UPLOAD_DIR ||
    path.join(/*turbopackIgnore: true*/ process.cwd(), 'uploads', 'resumes');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Legacy helper bridging to the storage adapter.
 */
export async function saveResume(
  studentId: string,
  buffer: Buffer
): Promise<{ filename: string; relativeUrl: string; key: string }> {
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `File size exceeds 2MB limit (${(buffer.length / (1024 * 1024)).toFixed(2)} MB).`
    );
  }

  if (!isValidPdf(buffer)) {
    throw new Error('Invalid file format. Only valid PDF files are permitted.');
  }

  const adapter = getStorageAdapter();
  const { key } = await adapter.saveFile({
    folder: 'resumes',
    buffer,
    contentType: 'application/pdf',
  });

  return {
    filename: key.split('/').pop() || key,
    relativeUrl: `/api/students/${studentId}/resume`,
    key,
  };
}

export function isValidImage(buffer: Buffer): { valid: boolean; contentType?: string } {
  if (buffer.length < 8) return { valid: false };
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, contentType: 'image/jpeg' };
  }
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return { valid: true, contentType: 'image/png' };
  }
  // WebP: RIFF ... WEBP
  if (
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return { valid: true, contentType: 'image/webp' };
  }
  return { valid: false };
}

export async function savePhoto(
  studentId: string,
  buffer: Buffer
): Promise<{ key: string; relativeUrl: string; contentType: string }> {
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `Photo size exceeds 2MB limit (${(buffer.length / (1024 * 1024)).toFixed(2)} MB).`
    );
  }

  const { valid, contentType } = isValidImage(buffer);
  if (!valid || !contentType) {
    throw new Error('Invalid image format. Allowed formats: JPEG, PNG, WebP.');
  }

  const adapter = getStorageAdapter();
  const { key } = await adapter.saveFile({
    folder: 'photos',
    buffer,
    contentType,
  });

  return {
    key,
    relativeUrl: `/api/students/${studentId}/photo`,
    contentType,
  };
}

/**
 * Resolves safe absolute path for a resume filename, preventing directory traversal.
 * Kept for legacy fallback when reading local disk files.
 */
export function getResumeFilePath(filename: string): string | null {
  const uploadDir = getUploadDir();
  const safeFilename = path.basename(filename);
  const resolvedPath = path.resolve(uploadDir, safeFilename);

  if (!resolvedPath.startsWith(uploadDir)) {
    return null;
  }

  if (!fs.existsSync(resolvedPath)) {
    return null;
  }

  return resolvedPath;
}

/**
 * Deletes a resume file from disk safely.
 */
export async function deleteResumeFile(filenameOrKey: string): Promise<boolean> {
  const adapter = getStorageAdapter();
  const key = filenameOrKey.includes('/') ? filenameOrKey : `resumes/${filenameOrKey}`;
  const deleted = await adapter.deleteFile(key);
  if (deleted) return true;

  // Fallback to legacy local path
  const legacyPath = getResumeFilePath(filenameOrKey);
  if (legacyPath) {
    try {
      await fs.promises.unlink(legacyPath);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}
