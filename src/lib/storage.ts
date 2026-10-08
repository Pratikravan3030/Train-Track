import fs from 'fs';
import path from 'path';

export const MAX_RESUME_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const DEFAULT_UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'resumes');

export function getUploadDir(): string {
  const dir = process.env.UPLOAD_DIR || DEFAULT_UPLOAD_DIR;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.resolve(dir);
}

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

/**
 * Saves a student's resume PDF buffer to disk with sanitized filename,
 * deleting any previous resume files for this student.
 */
export async function saveResume(
  studentId: string,
  buffer: Buffer
): Promise<{ filename: string; relativeUrl: string }> {
  if (buffer.length > MAX_RESUME_SIZE_BYTES) {
    throw new Error(`File size exceeds 5MB limit (${(buffer.length / (1024 * 1024)).toFixed(2)} MB).`);
  }

  if (!isValidPdf(buffer)) {
    throw new Error('Invalid file format. Only valid PDF files are permitted.');
  }

  const uploadDir = getUploadDir();
  const sanitizedId = studentId.replace(/[^a-zA-Z0-9_-]/g, '');

  // Clean up any prior resumes for this student to prevent orphaned files
  try {
    const existingFiles = await fs.promises.readdir(uploadDir);
    for (const file of existingFiles) {
      if (file.startsWith(`resume_${sanitizedId}_`) && file.endsWith('.pdf')) {
        await fs.promises.unlink(path.join(uploadDir, file)).catch(() => {});
      }
    }
  } catch {
    // Ignore cleanup error if directory empty
  }

  const filename = `resume_${sanitizedId}_${Date.now()}.pdf`;
  const targetPath = path.join(uploadDir, filename);

  await fs.promises.writeFile(targetPath, buffer);

  return {
    filename,
    relativeUrl: `/api/students/${studentId}/resume`,
  };
}

/**
 * Resolves safe absolute path for a resume filename, preventing directory traversal.
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
export async function deleteResumeFile(filename: string): Promise<boolean> {
  const filePath = getResumeFilePath(filename);
  if (!filePath) return false;

  try {
    await fs.promises.unlink(filePath);
    return true;
  } catch {
    return false;
  }
}
