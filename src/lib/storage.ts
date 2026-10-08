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
