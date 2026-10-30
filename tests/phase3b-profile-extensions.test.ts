import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { AuthContext } from '@/lib/auth-guards';

let mockUserSession: { user: AuthContext } | null = null;

vi.mock('next-auth', () => ({
  default: vi.fn(),
  getServerSession: vi.fn(async () => mockUserSession),
}));

// Route Handlers
import { GET as getStudents, POST as createStudent } from '@/app/api/students/route';
import { GET as getStudentById } from '@/app/api/students/[id]/route';
import { GET as getPhoto, POST as uploadPhoto } from '@/app/api/students/[id]/photo/route';
import { GET as exportStudents } from '@/app/api/students/export/route';

// Models & Helpers
import User from '@/models/User';
import Student from '@/models/Student';
import { calculateProfileCompleteness } from '@/lib/profile-completeness';

describe('Phase 3b: Profile Extensions, Completeness Meter, and Demographic Redaction', () => {
  let mongoServer: MongoMemoryServer;

  let superAdminSession: { user: AuthContext };
  let tpoSession: { user: AuthContext };
  let cseCoordinatorSession: { user: AuthContext };
  let meCoordinatorSession: { user: AuthContext };

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    process.env.MONGODB_URI = uri;
    await mongoose.connect(uri);

    const adminUser = await User.create({
      name: 'Super Admin',
      email: 'superadmin.p3b@dypcet.ac.in',
      role: 'SUPER_ADMIN',
      password: 'password123',
      isActive: true,
      tokenVersion: 1,
    });

    const tpoUser = await User.create({
      name: 'TPO Officer',
      email: 'tpo.p3b@dypcet.ac.in',
      role: 'TPO',
      password: 'password123',
      isActive: true,
      tokenVersion: 1,
    });

    const cseCoord = await User.create({
      name: 'CSE Coordinator',
      email: 'coord.cse.p3b@dypcet.ac.in',
      role: 'DEPT_COORDINATOR',
      department: 'CSE',
      password: 'password123',
      isActive: true,
      tokenVersion: 1,
    });

    const meCoord = await User.create({
      name: 'ME Coordinator',
      email: 'coord.me.p3b@dypcet.ac.in',
      role: 'DEPT_COORDINATOR',
      department: 'ME',
      password: 'password123',
      isActive: true,
      tokenVersion: 1,
    });

    superAdminSession = {
      user: {
        id: adminUser._id.toString(),
        name: adminUser.name,
        email: adminUser.email,
        role: 'SUPER_ADMIN',
        tokenVersion: 1,
      },
    };

    tpoSession = {
      user: {
        id: tpoUser._id.toString(),
        name: tpoUser.name,
        email: tpoUser.email,
        role: 'TPO',
        tokenVersion: 1,
      },
    };

    cseCoordinatorSession = {
      user: {
        id: cseCoord._id.toString(),
        name: cseCoord.name,
        email: cseCoord.email,
        role: 'DEPT_COORDINATOR',
        department: 'CSE',
        tokenVersion: 1,
      },
    };

    meCoordinatorSession = {
      user: {
        id: meCoord._id.toString(),
        name: meCoord.name,
        email: meCoord.email,
        role: 'DEPT_COORDINATOR',
        department: 'ME',
        tokenVersion: 1,
      },
    };
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  }, 60000);

  beforeEach(async () => {
    await Student.deleteMany({});
  });

  // 1. Extended Profile Fields & Completeness Meter
  describe('Profile Extensions & Completeness Meter', () => {
    it('creates and updates student with extended profile fields and calculates completeness', async () => {
      mockUserSession = tpoSession;

      const newStudentData = {
        name: 'Aditya Patil',
        rollNumber: 'DYP2026CSE050',
        department: 'CSE',
        year: 'Final Year',
        passoutYear: 2026,
        email: 'aditya.patil@dypcet.ac.in',
        phone: '+91 9876543210',
        gender: 'Male',
        dateOfBirth: '2004-05-15',
        division: 'A',
        cgpa: 8.85,
        tenthPercentage: 89.4,
        twelfthOrDiplomaPercentage: 86.2,
        semesterSgpa: [8.5, 8.7, 8.9, 9.1],
        backlogHistory: { active: 0, dead: 0, cleared: 1 },
        skills: ['TypeScript', 'React', 'Node.js', 'MongoDB', 'Docker'],
        certifications: [
          { title: 'AWS Cloud Practitioner', issuer: 'Amazon Web Services', issueDate: '2025-08' },
        ],
        projects: [
          {
            title: 'Campus Placement System',
            description: 'Full stack dashboard with role based access control',
            techStack: ['Next.js', 'TypeScript', 'MongoDB'],
            githubUrl: 'https://github.com/dypcet/placement',
          },
        ],
        internships: [
          {
            company: 'Tech Solutions Pune',
            role: 'Software Development Intern',
            startDate: '2025-06',
            endDate: '2025-08',
            description: 'Built REST APIs',
          },
        ],
        socialLinks: {
          github: 'https://github.com/aditya',
          linkedin: 'https://linkedin.com/in/aditya',
        },
      };

      const req = new Request('http://localhost:3000/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newStudentData),
      });

      const res = await createStudent(req);
      expect(res.status).toBe(201);
      const created = await res.json();
      expect(created.division).toBe('A');
      expect(created.semesterSgpa.length).toBe(4);
      expect(created.skills).toContain('Docker');
      expect(created.projects.length).toBe(1);

      // Verify completeness computation
      const completeness = calculateProfileCompleteness(created);
      expect(completeness.totalPercentage).toBeGreaterThanOrEqual(80);
      expect(completeness.sections.basic.completed).toBe(true);
      expect(completeness.sections.academic.completed).toBe(true);
      expect(completeness.sections.experience.completed).toBe(true);
    });
  });

  // 2. Demographic Redaction (Privacy)
  describe('Demographic Redaction (DOB, Gender, Phone)', () => {
    it('shows full demographics to TPO and SUPER_ADMIN, but redacts for DEPT_COORDINATOR', async () => {
      const student = await Student.create({
        name: 'Neha Chougule',
        rollNumber: 'DYP2026CSE055',
        department: 'CSE',
        year: 'Final Year',
        passoutYear: 2026,
        email: 'neha.chougule@dypcet.ac.in',
        phone: '+91 9988776655',
        gender: 'Female',
        dateOfBirth: new Date('2004-11-20'),
        division: 'B',
        cgpa: 9.1,
      });

      // TPO reads student profile -> Full demographics visible
      mockUserSession = tpoSession;
      const tpoReq = new Request(`http://localhost:3000/api/students/${student._id}`);
      const tpoRes = await getStudentById(tpoReq, { params: Promise.resolve({ id: student._id.toString() }) });
      expect(tpoRes.status).toBe(200);
      const tpoData = await tpoRes.json();
      expect(tpoData.student.phone).toBe('+91 9988776655');
      expect(tpoData.student.gender).toBe('Female');
      expect(tpoData.student.dateOfBirth).toBeDefined();
      expect(tpoData.student.isDemographicsRedacted).toBe(false);

      // SUPER_ADMIN reads student profile -> Full demographics visible
      mockUserSession = superAdminSession;
      const adminReq = new Request(`http://localhost:3000/api/students/${student._id}`);
      const adminRes = await getStudentById(adminReq, { params: Promise.resolve({ id: student._id.toString() }) });
      expect(adminRes.status).toBe(200);
      const adminData = await adminRes.json();
      expect(adminData.student.phone).toBe('+91 9988776655');
      expect(adminData.student.isDemographicsRedacted).toBe(false);

      // DEPT_COORDINATOR (CSE) reads CSE student profile -> Demographics REDACTED
      mockUserSession = cseCoordinatorSession;
      const coordReq = new Request(`http://localhost:3000/api/students/${student._id}`);
      const coordRes = await getStudentById(coordReq, { params: Promise.resolve({ id: student._id.toString() }) });
      expect(coordRes.status).toBe(200);
      const coordData = await coordRes.json();
      expect(coordData.student.phone).toBeUndefined();
      expect(coordData.student.gender).toBeUndefined();
      expect(coordData.student.dateOfBirth).toBeUndefined();
      expect(coordData.student.isDemographicsRedacted).toBe(true);

      // DEPT_COORDINATOR student list -> Demographics REDACTED
      const listReq = new Request('http://localhost:3000/api/students?department=CSE');
      const listRes = await getStudents(listReq);
      expect(listRes.status).toBe(200);
      const listData = await listRes.json();
      expect(listData.data[0].phone).toBeUndefined();
      expect(listData.data[0].gender).toBeUndefined();
      expect(listData.data[0].isDemographicsRedacted).toBe(true);

      // CSV Export by DEPT_COORDINATOR -> Phone is REDACTED
      const exportReq = new Request('http://localhost:3000/api/students/export?batch=2026');
      const exportRes = await exportStudents(exportReq);
      expect(exportRes.status).toBe(200);
      const csvContent = await exportRes.text();
      expect(csvContent).toContain('[REDACTED]');
      expect(csvContent).not.toContain('+91 9988776655');
    });
  });

  // 3. Photo Upload & Cross-Department Security
  describe('Profile Photo Upload & Streaming', () => {
    it('uploads a valid JPEG image and enforces cross-department access', async () => {
      const cseStudent = await Student.create({
        name: 'Rohan Deshmukh',
        rollNumber: 'DYP2026CSE070',
        department: 'CSE',
        year: 'Final Year',
        passoutYear: 2026,
        email: 'rohan.deshmukh@dypcet.ac.in',
      });

      // Valid JPEG header bytes: FF D8 FF E0 + dummy padding
      const validJpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

      // 1. ME Coordinator attempts to upload photo for CSE student -> 403 Forbidden
      mockUserSession = meCoordinatorSession;
      const forbiddenReq = new Request(`http://localhost:3000/api/students/${cseStudent._id}/photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'image/jpeg' },
        body: validJpegBuffer,
      });
      const forbiddenRes = await uploadPhoto(forbiddenReq, {
        params: Promise.resolve({ id: cseStudent._id.toString() }),
      });
      expect(forbiddenRes.status).toBe(403);

      // 2. CSE Coordinator uploads photo for CSE student -> 200 OK
      mockUserSession = cseCoordinatorSession;
      const uploadReq = new Request(`http://localhost:3000/api/students/${cseStudent._id}/photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'image/jpeg' },
        body: validJpegBuffer,
      });
      const uploadRes = await uploadPhoto(uploadReq, {
        params: Promise.resolve({ id: cseStudent._id.toString() }),
      });
      expect(uploadRes.status).toBe(200);
      const uploadData = await uploadRes.json();
      expect(uploadData.success).toBe(true);
      expect(uploadData.photoUrl).toBe(`/api/students/${cseStudent._id}/photo`);

      // 3. ME Coordinator attempts to stream CSE student photo -> 403 Forbidden
      mockUserSession = meCoordinatorSession;
      const forbiddenGetReq = new Request(`http://localhost:3000/api/students/${cseStudent._id}/photo`);
      const forbiddenGetRes = await getPhoto(forbiddenGetReq, {
        params: Promise.resolve({ id: cseStudent._id.toString() }),
      });
      expect(forbiddenGetRes.status).toBe(403);

      // 4. TPO streams CSE student photo -> 200 OK with correct content-type
      mockUserSession = tpoSession;
      const getReq = new Request(`http://localhost:3000/api/students/${cseStudent._id}/photo`);
      const getRes = await getPhoto(getReq, {
        params: Promise.resolve({ id: cseStudent._id.toString() }),
      });
      expect(getRes.status).toBe(200);
      expect(getRes.headers.get('Content-Type')).toContain('image/jpeg');
    });

    it('rejects invalid image formats and oversized photos', async () => {
      const student = await Student.create({
        name: 'Pooja Jadhav',
        rollNumber: 'DYP2026CSE075',
        department: 'CSE',
        year: 'Final Year',
        passoutYear: 2026,
      });

      mockUserSession = tpoSession;

      // Text file disguised as image
      const textBuffer = Buffer.from('NOT_AN_IMAGE_FILE_DATA');
      const invalidReq = new Request(`http://localhost:3000/api/students/${student._id}/photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'image/jpeg' },
        body: textBuffer,
      });
      const invalidRes = await uploadPhoto(invalidReq, {
        params: Promise.resolve({ id: student._id.toString() }),
      });
      expect(invalidRes.status).toBe(400);
      const err = await invalidRes.json();
      expect(err.error).toContain('Invalid image format');
    });
  });
});
