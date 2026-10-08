import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import fs from 'fs';
import path from 'path';
import type { AuthContext } from '@/lib/auth-guards';
import {
  isValidPdf,
  MAX_FILE_SIZE_BYTES,
  getStorageAdapter,
  setStorageAdapterForTesting,
  LocalDiskStorageAdapter,
  S3CompatibleStorageAdapter,
  StorageAdapter,
  StorageFileResult,
  GetFileResult,
} from '@/lib/storage';
import { GET as getResume, POST as postResume, DELETE as deleteResume } from '@/app/api/students/[id]/resume/route';
import Student from '@/models/Student';
import User from '@/models/User';

// 1. Session state control for NextAuth mock
let mockUserSession: { user: AuthContext } | null = null;

vi.mock('next-auth', () => ({
  default: vi.fn(),
  getServerSession: vi.fn(async () => mockUserSession),
}));

// Set test upload directory
const TEST_UPLOAD_DIR = path.join(process.cwd(), 'scratch', 'test-uploads');
process.env.UPLOAD_DIR = TEST_UPLOAD_DIR;

// In-Memory Fake Storage Adapter for unit test isolation
class InMemoryStorageAdapter implements StorageAdapter {
  name = 'in-memory-fake';
  public files = new Map<string, Buffer>();

  async saveFile(params: {
    folder: 'resumes' | 'offers';
    buffer: Buffer;
    contentType?: string;
  }): Promise<StorageFileResult> {
    const key = `${params.folder}/fake-uuid-${Date.now()}.pdf`;
    this.files.set(key, params.buffer);
    return { key, url: `/api/storage/${key}` };
  }

  async getFile(key: string): Promise<GetFileResult | null> {
    const buf = this.files.get(key);
    if (!buf) return null;
    return {
      buffer: buf,
      contentType: 'application/pdf',
      contentLength: buf.length,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getSignedDownloadUrl(key: string, _expiresInSeconds?: number): Promise<string | null> {
    if (!this.files.has(key)) return null;
    return `https://fake-s3.amazonaws.com/${key}?signed=true`;
  }

  async deleteFile(key: string): Promise<boolean> {
    return this.files.delete(key);
  }
}

describe('Storage Adapter Architecture & Resume Route Tests', () => {
  let mongoServer: MongoMemoryServer;

  let cseStudentId: string;
  let meStudentId: string;

  const validPdfBuffer = Buffer.concat([
    Buffer.from('%PDF-1.4\n%âãÏÓ\n'),
    Buffer.from('Test dummy PDF content for resume storage testing\n%%EOF'),
  ]);

  const invalidTextBuffer = Buffer.from('This is a plain text file, not a PDF.');

  const adminId = new mongoose.Types.ObjectId().toString();
  const coordCseId = new mongoose.Types.ObjectId().toString();
  const coordMeId = new mongoose.Types.ObjectId().toString();
  const studentUserId = new mongoose.Types.ObjectId().toString();

  const superAdminSession: { user: AuthContext } = {
    user: {
      id: adminId,
      name: 'Super Admin',
      email: 'admin@dypcet.edu',
      role: 'SUPER_ADMIN',
    },
  };

  const coordinatorCseSession: { user: AuthContext } = {
    user: {
      id: coordCseId,
      name: 'CSE Coordinator',
      email: 'coord.cse@dypcet.edu',
      role: 'DEPT_COORDINATOR',
      department: 'CSE',
    },
  };

  const coordinatorMeSession: { user: AuthContext } = {
    user: {
      id: coordMeId,
      name: 'ME Coordinator',
      email: 'coord.me@dypcet.edu',
      role: 'DEPT_COORDINATOR',
      department: 'ME',
    },
  };

  const studentSession: { user: AuthContext } = {
    user: {
      id: studentUserId,
      name: 'CSE Student User',
      email: 'student.cse@dypcet.edu',
      role: 'STUDENT',
      studentId: '',
    },
  };

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    process.env.MONGODB_URI = uri;
    process.env.NEXTAUTH_SECRET = 'secret_test_key_12345';
    await mongoose.connect(uri);

    if (fs.existsSync(TEST_UPLOAD_DIR)) {
      fs.rmSync(TEST_UPLOAD_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(TEST_UPLOAD_DIR, { recursive: true });

    await User.create([
      {
        _id: new mongoose.Types.ObjectId(superAdminSession.user.id),
        name: superAdminSession.user.name,
        email: superAdminSession.user.email,
        password: 'dummyhash',
        role: superAdminSession.user.role,
        isActive: true,
        tokenVersion: 1,
      },
      {
        _id: new mongoose.Types.ObjectId(coordinatorCseSession.user.id),
        name: coordinatorCseSession.user.name,
        email: coordinatorCseSession.user.email,
        password: 'dummyhash',
        role: coordinatorCseSession.user.role,
        department: coordinatorCseSession.user.department,
        isActive: true,
        tokenVersion: 1,
      },
      {
        _id: new mongoose.Types.ObjectId(coordinatorMeSession.user.id),
        name: coordinatorMeSession.user.name,
        email: coordinatorMeSession.user.email,
        password: 'dummyhash',
        role: coordinatorMeSession.user.role,
        department: coordinatorMeSession.user.department,
        isActive: true,
        tokenVersion: 1,
      },
    ]);

    const cseStudent = await Student.create({
      name: 'Aarav Patil',
      rollNumber: 'PRN-RESUME-CSE',
      department: 'CSE',
      year: 'Final Year',
      passoutYear: 2026,
      email: 'aarav.patil@dypcet.edu',
    });
    cseStudentId = cseStudent._id.toString();
    studentSession.user.studentId = cseStudentId;

    const meStudent = await Student.create({
      name: 'Rohan Deshmukh',
      rollNumber: 'PRN-RESUME-ME',
      department: 'ME',
      year: 'Final Year',
      passoutYear: 2026,
      email: 'rohan.deshmukh@dypcet.edu',
    });
    meStudentId = meStudent._id.toString();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
    if (fs.existsSync(TEST_UPLOAD_DIR)) {
      fs.rmSync(TEST_UPLOAD_DIR, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    setStorageAdapterForTesting(null);
  });

  describe('1. Storage Adapter Interface & Implementations', () => {
    it('isValidPdf correctly checks magic bytes', () => {
      expect(isValidPdf(validPdfBuffer)).toBe(true);
      expect(isValidPdf(invalidTextBuffer)).toBe(false);
      expect(isValidPdf(Buffer.from([]))).toBe(false);
    });

    it('LocalDiskStorageAdapter saves files with UUID keys and cleans up on delete', async () => {
      const localAdapter = new LocalDiskStorageAdapter(TEST_UPLOAD_DIR);
      const { key } = await localAdapter.saveFile({
        folder: 'resumes',
        buffer: validPdfBuffer,
      });

      expect(key).toMatch(/^resumes\/[0-9a-f-]+\.pdf$/);

      const fileResult = await localAdapter.getFile(key);
      expect(fileResult).not.toBeNull();
      expect(fileResult?.contentType).toBe('application/pdf');

      const deleted = await localAdapter.deleteFile(key);
      expect(deleted).toBe(true);

      const missingAfterDelete = await localAdapter.getFile(key);
      expect(missingAfterDelete).toBeNull();
    });

    it('LocalDiskStorageAdapter throws in production or Vercel environment to prevent data loss', async () => {
      const origVercel = process.env.VERCEL;
      process.env.VERCEL = '1';

      const localAdapter = new LocalDiskStorageAdapter(TEST_UPLOAD_DIR);
      await expect(
        localAdapter.saveFile({ folder: 'resumes', buffer: validPdfBuffer })
      ).rejects.toThrow(/Local filesystem storage is disabled in production/);

      if (origVercel === undefined) {
        delete process.env.VERCEL;
      } else {
        process.env.VERCEL = origVercel;
      }
    });

    it('S3CompatibleStorageAdapter throws clear error when credentials or bucket are missing', async () => {
      const s3Adapter = new S3CompatibleStorageAdapter();
      const origBucket = process.env.S3_BUCKET_NAME;
      delete process.env.S3_BUCKET_NAME;

      await expect(
        s3Adapter.saveFile({ folder: 'resumes', buffer: validPdfBuffer })
      ).rejects.toThrow(/Missing required S3 storage environment variable/);

      if (origBucket === undefined) {
        delete process.env.S3_BUCKET_NAME;
      } else {
        process.env.S3_BUCKET_NAME = origBucket;
      }
    });

    it('setStorageAdapterForTesting injects in-memory fake adapter', async () => {
      const fake = new InMemoryStorageAdapter();
      setStorageAdapterForTesting(fake);

      const active = getStorageAdapter();
      expect(active.name).toBe('in-memory-fake');

      const { key } = await active.saveFile({ folder: 'resumes', buffer: validPdfBuffer });
      expect(fake.files.has(key)).toBe(true);
    });
  });

  describe('2. Resume API Routes Integration with StorageAdapter', () => {
    it('rejects unauthenticated requests to GET /api/students/[id]/resume with 401', async () => {
      mockUserSession = null;
      const res = await getResume(new Request('http://localhost/api/students/123/resume'), {
        params: Promise.resolve({ id: cseStudentId }),
      });
      expect(res.status).toBe(401);
    });

    it('denies DEPT_COORDINATOR from ME from accessing CSE student resume with 403', async () => {
      mockUserSession = coordinatorMeSession;
      const res = await getResume(new Request(`http://localhost/api/students/${cseStudentId}/resume`), {
        params: Promise.resolve({ id: cseStudentId }),
      });
      expect(res.status).toBe(403);

      // But can access student in own ME department
      const ownRes = await getResume(new Request(`http://localhost/api/students/${meStudentId}/resume`), {
        params: Promise.resolve({ id: meStudentId }),
      });
      expect(ownRes.status).toBe(404); // No resume uploaded yet, but allowed to reach record
    });

    it('allows SUPER_ADMIN to upload a valid resume PDF under 2MB', async () => {
      mockUserSession = superAdminSession;

      const formData = new FormData();
      const blob = new Blob([validPdfBuffer], { type: 'application/pdf' });
      formData.append('file', blob, 'sample.pdf');

      const req = new Request(`http://localhost/api/students/${cseStudentId}/resume`, {
        method: 'POST',
        body: formData,
      });

      const res = await postResume(req, { params: Promise.resolve({ id: cseStudentId }) });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.message).toBe('Resume uploaded successfully');
      expect(body.resumeUrl).toBe(`/api/students/${cseStudentId}/resume`);

      const updated = await Student.findById(cseStudentId);
      expect(updated.resumeStorageKey).toBeDefined();
      expect(updated.resumeStorageKey).toMatch(/^resumes\/[0-9a-f-]+\.pdf$/);
    });

    it('enforces 2MB limit: rejects uploads exceeding MAX_FILE_SIZE_BYTES (2MB) with 400', async () => {
      mockUserSession = superAdminSession;

      const oversized = Buffer.alloc(MAX_FILE_SIZE_BYTES + 512, 0x25);
      oversized[1] = 0x50;
      oversized[2] = 0x44;
      oversized[3] = 0x46;

      const formData = new FormData();
      const blob = new Blob([oversized], { type: 'application/pdf' });
      formData.append('file', blob, 'large.pdf');

      const req = new Request(`http://localhost/api/students/${cseStudentId}/resume`, {
        method: 'POST',
        body: formData,
      });

      const res = await postResume(req, { params: Promise.resolve({ id: cseStudentId }) });
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error).toMatch(/exceeds 2MB limit/);
    });

    it('GET /api/students/[id]/resume streams PDF with nosniff and Content-Disposition headers', async () => {
      mockUserSession = superAdminSession;

      const req = new Request(`http://localhost/api/students/${cseStudentId}/resume`);
      const res = await getResume(req, { params: Promise.resolve({ id: cseStudentId }) });

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('application/pdf');
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(res.headers.get('Content-Disposition')).toBe('inline; filename="PRN-RESUME-CSE-resume.pdf"');
    });

    it('replaces existing resume on upload and removes old storage object', async () => {
      mockUserSession = superAdminSession;

      const before = await Student.findById(cseStudentId);
      const oldStorageKey = before.resumeStorageKey;
      expect(oldStorageKey).toBeDefined();

      const adapter = getStorageAdapter();
      const fileBefore = await adapter.getFile(oldStorageKey!);
      expect(fileBefore).not.toBeNull();

      // Upload replacement resume
      const formData = new FormData();
      const blob = new Blob([validPdfBuffer], { type: 'application/pdf' });
      formData.append('file', blob, 'new_resume.pdf');

      const req = new Request(`http://localhost/api/students/${cseStudentId}/resume`, {
        method: 'POST',
        body: formData,
      });
      const res = await postResume(req, { params: Promise.resolve({ id: cseStudentId }) });
      expect(res.status).toBe(200);

      const after = await Student.findById(cseStudentId);
      expect(after.resumeStorageKey).not.toBe(oldStorageKey);

      // Old file is deleted from storage
      const fileAfterOld = await adapter.getFile(oldStorageKey!);
      expect(fileAfterOld).toBeNull();
    });

    it('DELETE /api/students/[id]/resume removes the storage object and clears student fields', async () => {
      mockUserSession = superAdminSession;

      const studentBefore = await Student.findById(cseStudentId);
      const keyToDelete = studentBefore.resumeStorageKey;
      expect(keyToDelete).toBeDefined();

      const req = new Request(`http://localhost/api/students/${cseStudentId}/resume`, {
        method: 'DELETE',
      });
      const res = await deleteResume(req, { params: Promise.resolve({ id: cseStudentId }) });
      expect(res.status).toBe(200);

      const studentAfter = await Student.findById(cseStudentId);
      expect(studentAfter.resumeStorageKey).toBeUndefined();
      expect(studentAfter.resumeUrl).toBeUndefined();

      const adapter = getStorageAdapter();
      const fileCheck = await adapter.getFile(keyToDelete!);
      expect(fileCheck).toBeNull();
    });

    it('supports in-memory fake adapter redirection when signed URL is requested', async () => {
      const fakeAdapter = new InMemoryStorageAdapter();
      setStorageAdapterForTesting(fakeAdapter);

      mockUserSession = superAdminSession;

      // Re-upload with fake adapter
      const formData = new FormData();
      const blob = new Blob([validPdfBuffer], { type: 'application/pdf' });
      formData.append('file', blob, 'fake_resume.pdf');

      const postReq = new Request(`http://localhost/api/students/${cseStudentId}/resume`, {
        method: 'POST',
        body: formData,
      });
      await postResume(postReq, { params: Promise.resolve({ id: cseStudentId }) });

      // Request with ?signed=true
      const getReq = new Request(`http://localhost/api/students/${cseStudentId}/resume?signed=true`);
      const getRes = await getResume(getReq, { params: Promise.resolve({ id: cseStudentId }) });

      expect(getRes.status).toBe(307);
      expect(getRes.headers.get('Location')).toContain('https://fake-s3.amazonaws.com/');
    });
  });
});
