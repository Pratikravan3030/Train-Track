import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import fs from 'fs';
import path from 'path';
import type { AuthContext } from '@/lib/auth-guards';

// 1. Session state control for NextAuth mock
let mockUserSession: { user: AuthContext } | null = null;

vi.mock('next-auth', () => ({
  default: vi.fn(),
  getServerSession: vi.fn(async () => mockUserSession),
}));

// Set test upload directory
const TEST_UPLOAD_DIR = path.join(process.cwd(), 'scratch', 'test-uploads');
process.env.UPLOAD_DIR = TEST_UPLOAD_DIR;

import {
  isValidPdf,
  saveResume,
  getResumeFilePath,
  deleteResumeFile,
  MAX_RESUME_SIZE_BYTES,
} from '@/lib/storage';
import { GET as getResume, POST as postResume, DELETE as deleteResume } from '@/app/api/students/[id]/resume/route';
import Student from '@/models/Student';
import User from '@/models/User';
import AuditLog from '@/models/AuditLog';

describe('Resume Storage Utility & API Route Integration Tests', () => {
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

  // Mock sessions
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
      studentId: '', // Set in beforeAll
    },
  };

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    process.env.MONGODB_URI = uri;
    process.env.NEXTAUTH_SECRET = 'secret_test_key_12345';
    await mongoose.connect(uri);

    // Clean test upload directory
    if (fs.existsSync(TEST_UPLOAD_DIR)) {
      fs.rmSync(TEST_UPLOAD_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(TEST_UPLOAD_DIR, { recursive: true });

    // Seed users
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

    // Seed students
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

  describe('1. Storage Utility Functions', () => {
    it('isValidPdf returns true for valid %PDF buffers and false for invalid files', () => {
      expect(isValidPdf(validPdfBuffer)).toBe(true);
      expect(isValidPdf(invalidTextBuffer)).toBe(false);
      expect(isValidPdf(Buffer.from([]))).toBe(false);
      expect(isValidPdf(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBe(false); // PNG header
    });

    it('saveResume throws if buffer exceeds 5MB size limit', async () => {
      const oversizedBuffer = Buffer.alloc(MAX_RESUME_SIZE_BYTES + 1024, 0x25); // Starts with % but too large
      oversizedBuffer[1] = 0x50;
      oversizedBuffer[2] = 0x44;
      oversizedBuffer[3] = 0x46;

      await expect(saveResume('test-id', oversizedBuffer)).rejects.toThrow(/exceeds 5MB limit/);
    });

    it('saveResume throws if buffer is not a valid PDF', async () => {
      await expect(saveResume('test-id', invalidTextBuffer)).rejects.toThrow(/Invalid file format/);
    });

    it('saveResume writes file to disk and cleans up previous file for the same student', async () => {
      const result1 = await saveResume('test-id-123', validPdfBuffer);
      expect(result1.filename).toMatch(/^resume_test-id-123_\d+\.pdf$/);

      const filePath1 = getResumeFilePath(result1.filename);
      expect(filePath1).not.toBeNull();
      expect(fs.existsSync(filePath1!)).toBe(true);

      // Save a second time for same student: first file should be cleaned up
      const result2 = await saveResume('test-id-123', validPdfBuffer);
      expect(fs.existsSync(filePath1!)).toBe(false);

      const filePath2 = getResumeFilePath(result2.filename);
      expect(filePath2).not.toBeNull();
      expect(fs.existsSync(filePath2!)).toBe(true);

      // Cleanup
      await deleteResumeFile(result2.filename);
      expect(fs.existsSync(filePath2!)).toBe(false);
    });

    it('getResumeFilePath defends against directory traversal attempts', () => {
      expect(getResumeFilePath('../../../etc/passwd')).toBeNull();
      expect(getResumeFilePath('/etc/hosts')).toBeNull();
    });
  });

  describe('2. Resume API Route Authorization & Scoping', () => {
    it('DENIES unauthenticated request to POST /api/students/[id]/resume with 401', async () => {
      mockUserSession = null;

      const formData = new FormData();
      formData.append('file', new Blob([validPdfBuffer], { type: 'application/pdf' }), 'test.pdf');

      const req = new Request(`http://localhost:3000/api/students/${cseStudentId}/resume`, {
        method: 'POST',
        body: formData,
      });

      const res = await postResume(req, { params: Promise.resolve({ id: cseStudentId }) });
      expect(res.status).toBe(401);
    });

    it('DENIES coordinator from uploading a resume for a student outside their department (403)', async () => {
      mockUserSession = coordinatorMeSession; // ME coordinator trying to upload for CSE student

      const formData = new FormData();
      formData.append('file', new Blob([validPdfBuffer], { type: 'application/pdf' }), 'test.pdf');

      const req = new Request(`http://localhost:3000/api/students/${cseStudentId}/resume`, {
        method: 'POST',
        body: formData,
      });

      const res = await postResume(req, { params: Promise.resolve({ id: cseStudentId }) });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toMatch(/You cannot upload resumes for students outside your department/i);
    });

    it('REJECTS upload of non-PDF file with 400', async () => {
      mockUserSession = coordinatorCseSession;

      const formData = new FormData();
      formData.append('file', new Blob([invalidTextBuffer], { type: 'text/plain' }), 'test.txt');

      const req = new Request(`http://localhost:3000/api/students/${cseStudentId}/resume`, {
        method: 'POST',
        body: formData,
      });

      const res = await postResume(req, { params: Promise.resolve({ id: cseStudentId }) });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/must be a valid PDF document/i);
    });

    it('ALLOWS coordinator to upload valid PDF for student in their department (200) and creates audit entry', async () => {
      mockUserSession = coordinatorCseSession;

      const formData = new FormData();
      formData.append('file', new Blob([validPdfBuffer], { type: 'application/pdf' }), 'aarav_resume.pdf');

      const req = new Request(`http://localhost:3000/api/students/${cseStudentId}/resume`, {
        method: 'POST',
        body: formData,
      });

      const res = await postResume(req, { params: Promise.resolve({ id: cseStudentId }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.resumeUrl).toBe(`/api/students/${cseStudentId}/resume`);

      // Verify student updated in DB
      const updated = await Student.findById(cseStudentId);
      expect(updated?.resumeUrl).toBe(`/api/students/${cseStudentId}/resume`);
      expect(updated?.resumeFilename).toBeDefined();

      // Verify audit log
      const log = await AuditLog.findOne({ action: 'UPLOAD_RESUME', resourceId: cseStudentId });
      expect(log).toBeDefined();
      expect(log?.details.rollNumber).toBe('PRN-RESUME-CSE');
    });

    it('DENIES coordinator from viewing/downloading resume of student in another department (403)', async () => {
      mockUserSession = coordinatorMeSession; // ME coordinator trying to view CSE student resume

      const req = new Request(`http://localhost:3000/api/students/${cseStudentId}/resume`, {
        method: 'GET',
      });

      const res = await getResume(req, { params: Promise.resolve({ id: cseStudentId }) });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toMatch(/You cannot view resumes of students in other departments/i);
    });

    it('ALLOWS coordinator to download resume of student in own department (200, Content-Type: application/pdf)', async () => {
      mockUserSession = coordinatorCseSession;

      const req = new Request(`http://localhost:3000/api/students/${cseStudentId}/resume`, {
        method: 'GET',
      });

      const res = await getResume(req, { params: Promise.resolve({ id: cseStudentId }) });
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('application/pdf');
      expect(res.headers.get('Content-Disposition')).toContain('PRN-RESUME-CSE-resume.pdf');
    });

    it('ALLOWS Super Admin to download any student resume, and ME coordinator to access ME student', async () => {
      mockUserSession = superAdminSession;

      const req = new Request(`http://localhost:3000/api/students/${cseStudentId}/resume`, {
        method: 'GET',
      });

      const res = await getResume(req, { params: Promise.resolve({ id: cseStudentId }) });
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('application/pdf');

      // Verify ME coordinator can access ME student
      mockUserSession = coordinatorMeSession;
      const meReq = new Request(`http://localhost:3000/api/students/${meStudentId}/resume`, {
        method: 'GET',
      });
      const meRes = await getResume(meReq, { params: Promise.resolve({ id: meStudentId }) });
      // ME student has no resume uploaded yet, should return 404 (not 403 Forbidden)
      expect(meRes.status).toBe(404);
    });

    it('ALLOWS deletion of resume by authorized coordinator (200) and cleans up storage', async () => {
      mockUserSession = coordinatorCseSession;

      const req = new Request(`http://localhost:3000/api/students/${cseStudentId}/resume`, {
        method: 'DELETE',
      });

      const res = await deleteResume(req, { params: Promise.resolve({ id: cseStudentId }) });
      expect(res.status).toBe(200);

      // Verify student doc cleared
      const updated = await Student.findById(cseStudentId);
      expect(updated?.resumeUrl).toBeUndefined();
      expect(updated?.resumeFilename).toBeUndefined();

      // Subsequent GET returns 404
      const getRes = await getResume(new Request(`http://localhost:3000/api/students/${cseStudentId}/resume`), {
        params: Promise.resolve({ id: cseStudentId }),
      });
      expect(getRes.status).toBe(404);
    });
  });
});
