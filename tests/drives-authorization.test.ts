import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { AuthContext } from '@/lib/auth-guards';

// Mock NextAuth session
let mockUserSession: { user: AuthContext } | null = null;

vi.mock('next-auth', () => ({
  default: vi.fn(),
  getServerSession: vi.fn(async () => mockUserSession),
}));

// Import Real Handlers
import { GET as getCompanies, POST as postCompanies } from '@/app/api/companies/route';
import { DELETE as deleteCompanyById } from '@/app/api/companies/[id]/route';
import { POST as postDrives } from '@/app/api/drives/route';
import { GET as getDriveById, DELETE as deleteDriveById } from '@/app/api/drives/[id]/route';
import { GET as getEligibleStudents } from '@/app/api/drives/[id]/eligible/route';
import {
  GET as getApplications,
  POST as postApplications,
} from '@/app/api/drives/[id]/applications/route';

// Import Models
import Company from '@/models/Company';
import Drive from '@/models/Drive';
import Application from '@/models/Application';
import Student from '@/models/Student';
import User from '@/models/User';
import AuditLog from '@/models/AuditLog';

describe('Phase 4: Companies, Drives & Applications RBAC & Functional Test Suite', () => {
  let mongoServer: MongoMemoryServer;

  // Track created entities
  let superAdminSession: { user: AuthContext };
  let tpoSession: { user: AuthContext };
  let coordinatorCseSession: { user: AuthContext };
  let studentSession: { user: AuthContext };

  let cseStudentId: string;
  let meStudentId: string;
  let companyId: string;
  let driveId: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    process.env.MONGODB_URI = uri;
    await mongoose.connect(uri);

    // Create session user models in DB for token version checks
    const superAdminUser = await User.create({
      name: 'Super Admin',
      email: 'superadmin@dypcet.ac.in',
      role: 'SUPER_ADMIN',
      password: 'hashedpassword123',
      isActive: true,
      tokenVersion: 1,
    });
    const tpoUser = await User.create({
      name: 'TPO Officer',
      email: 'tpo@dypcet.ac.in',
      role: 'TPO',
      password: 'hashedpassword123',
      isActive: true,
      tokenVersion: 1,
    });
    const coordUser = await User.create({
      name: 'CSE Coordinator',
      email: 'coord.cse@dypcet.ac.in',
      role: 'DEPT_COORDINATOR',
      department: 'CSE',
      password: 'hashedpassword123',
      isActive: true,
      tokenVersion: 1,
    });
    const studentUser = await User.create({
      name: 'Student User',
      email: 'student@dypcet.ac.in',
      role: 'STUDENT',
      password: 'hashedpassword123',
      isActive: true,
      tokenVersion: 1,
    });

    superAdminSession = {
      user: {
        id: superAdminUser._id.toString(),
        email: superAdminUser.email,
        name: superAdminUser.name,
        role: 'SUPER_ADMIN',
        tokenVersion: 1,
      },
    };

    tpoSession = {
      user: {
        id: tpoUser._id.toString(),
        email: tpoUser.email,
        name: tpoUser.name,
        role: 'TPO',
        tokenVersion: 1,
      },
    };

    coordinatorCseSession = {
      user: {
        id: coordUser._id.toString(),
        email: coordUser.email,
        name: coordUser.name,
        role: 'DEPT_COORDINATOR',
        department: 'CSE',
        tokenVersion: 1,
      },
    };

    studentSession = {
      user: {
        id: studentUser._id.toString(),
        email: studentUser.email,
        name: studentUser.name,
        role: 'STUDENT',
        tokenVersion: 1,
      },
    };
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Company.deleteMany({});
    await Drive.deleteMany({});
    await Application.deleteMany({});
    await Student.deleteMany({});
    await AuditLog.deleteMany({});

    // Seed students
    const studentCSE = await Student.create({
      name: 'Aarav Patel',
      rollNumber: 'CSE-2025-01',
      prn: 'PRN20250001',
      department: 'CSE',
      year: 'BE',
      batch: 2025,
      passoutYear: 2025,
      cgpa: 8.5,
      backlogs: 0,
      tenthPercentage: 88,
      twelfthOrDiplomaPercentage: 85,
      placementStatus: 'Not Placed',
    });
    cseStudentId = studentCSE._id.toString();

    const studentME = await Student.create({
      name: 'Rohan Sharma',
      rollNumber: 'ME-2025-01',
      prn: 'PRN20250002',
      department: 'ME',
      year: 'BE',
      batch: 2025,
      passoutYear: 2025,
      cgpa: 6.2,
      backlogs: 1,
      tenthPercentage: 75,
      twelfthOrDiplomaPercentage: 70,
      placementStatus: 'Not Placed',
    });
    meStudentId = studentME._id.toString();

    // Seed Company
    const comp = await Company.create({
      name: 'Tata Consultancy Services',
      normalizedName: 'tata consultancy services',
      sector: 'IT Services',
      website: 'https://tcs.com',
      hrContacts: [
        {
          name: 'Priya Sharma',
          email: 'priya.s@tcs.com',
          phone: '+91 9876543210',
          designation: 'Campus Lead',
        },
      ],
    });
    companyId = comp._id.toString();

    // Seed Drive (Drive in 7 days, registration deadline in 3 days)
    const futureDriveDate = new Date(Date.now() + 7 * 86400000);
    const futureDeadline = new Date(Date.now() + 3 * 86400000);

    const drv = await Drive.create({
      company: comp._id,
      role: 'Systems Engineer',
      type: 'Full-time',
      jd: 'Full stack development role',
      ctcLpa: 7.0,
      tier: 'Dream',
      location: 'Pune',
      mode: 'On-Campus',
      driveDate: futureDriveDate,
      registrationDeadline: futureDeadline,
      selectionRounds: ['Online Test', 'Technical Interview', 'HR Interview'],
      eligibilityRules: {
        minCgpa: 7.0,
        maxBacklogs: 0,
        allowedDepartments: ['CSE'],
        allowedBatches: [2025],
        minTenthPercentage: 60,
        minTwelfthOrDiplomaPercentage: 60,
      },
      status: 'Open',
    });
    driveId = drv._id.toString();
  });

  describe('Company Management & RBAC', () => {
    it('allows TPO to create a new company', async () => {
      mockUserSession = tpoSession;
      const req = new Request('http://localhost/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Infosys Limited',
          sector: 'IT Services',
          website: 'https://infosys.com',
          hrContacts: [{ name: 'Anil Kumar', email: 'anil@infosys.com' }],
        }),
      });

      const res = await postCompanies(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.name).toBe('Infosys Limited');
      expect(data.normalizedName).toBe('infosys limited');
    });

    it('rejects duplicate company creation (case-insensitive)', async () => {
      mockUserSession = tpoSession;
      const req = new Request('http://localhost/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'TATA CONSULTANCY SERVICES',
          sector: 'IT Services',
        }),
      });

      const res = await postCompanies(req);
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toContain('already exists');
    });

    it('redacts HR contacts when DEPT_COORDINATOR fetches companies', async () => {
      mockUserSession = coordinatorCseSession;
      const req = new Request('http://localhost/api/companies');
      const res = await getCompanies(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.length).toBeGreaterThan(0);
      const comp = data.data.find((c: { _id: string }) => c._id === companyId);
      expect(comp.hrContacts).toEqual([]);
      expect(comp.hrContactsCount).toBe(1);
    });

    it('reveals HR contacts to TPO and SUPER_ADMIN', async () => {
      mockUserSession = tpoSession;
      const req = new Request('http://localhost/api/companies');
      const res = await getCompanies(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      const comp = data.data.find((c: { _id: string }) => c._id === companyId);
      expect(comp.hrContacts.length).toBe(1);
      expect(comp.hrContacts[0].name).toBe('Priya Sharma');
    });

    it('denies DEPT_COORDINATOR from creating companies (HTTP 403)', async () => {
      mockUserSession = coordinatorCseSession;
      const req = new Request('http://localhost/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Wipro', sector: 'IT Services' }),
      });

      const res = await postCompanies(req);
      expect(res.status).toBe(403);
    });

    it('denies STUDENT from viewing companies (HTTP 403)', async () => {
      mockUserSession = studentSession;
      const req = new Request('http://localhost/api/companies');
      const res = await getCompanies(req);
      expect(res.status).toBe(403);
    });

    it('blocks deleting a company that has associated placement drives (HTTP 409)', async () => {
      mockUserSession = superAdminSession;
      const req = new Request(`http://localhost/api/companies/${companyId}`, {
        method: 'DELETE',
      });

      const res = await deleteCompanyById(req, { params: Promise.resolve({ id: companyId }) });
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toContain('Cannot delete company with active or historical placement drives');
    });
  });

  describe('Drive Management & Deadlines', () => {
    it('rejects drive creation when registration deadline is after drive date', async () => {
      mockUserSession = tpoSession;
      const driveDate = new Date(Date.now() + 5 * 86400000);
      const invalidDeadline = new Date(Date.now() + 6 * 86400000); // After drive date

      const req = new Request('http://localhost/api/drives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: companyId,
          role: 'Analyst',
          type: 'Full-time',
          jd: 'JD content',
          location: 'Mumbai',
          driveDate: driveDate.toISOString(),
          registrationDeadline: invalidDeadline.toISOString(),
        }),
      });

      const res = await postDrives(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Registration deadline must be strictly before the drive date');
    });

    it('computes dynamic "Registration Closed" status on read when deadline has passed', async () => {
      // Create drive with past deadline
      const pastDeadline = new Date(Date.now() - 3600000); // 1 hour ago
      const futureDriveDate = new Date(Date.now() + 86400000);

      const pastDrive = await Drive.create({
        company: companyId,
        role: 'Past Deadline Role',
        type: 'Full-time',
        jd: 'Job description',
        location: 'Pune',
        driveDate: futureDriveDate,
        registrationDeadline: pastDeadline,
        status: 'Open',
      });

      mockUserSession = tpoSession;
      const req = new Request(`http://localhost/api/drives/${pastDrive._id}`);
      const res = await getDriveById(req, {
        params: Promise.resolve({ id: pastDrive._id.toString() }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.displayStatus).toBe('Registration Closed');
      expect(data.isRegistrationClosed).toBe(true);
    });

    it('blocks deleting a drive when applications exist (HTTP 409)', async () => {
      // Register an application
      await Application.create({
        drive: driveId,
        student: cseStudentId,
        status: 'Applied',
        currentRoundIndex: 0,
        registeredBy: tpoSession.user.id,
        eligibilitySnapshot: {
          isEligible: true,
          ineligibilityReasons: [],
          cgpa: 8.5,
          backlogs: 0,
          department: 'CSE',
          passoutYear: 2025,
          evaluatedAt: new Date(),
          policyCheck: { passesPolicy: true },
        },
      });

      mockUserSession = superAdminSession;
      const req = new Request(`http://localhost/api/drives/${driveId}`, {
        method: 'DELETE',
      });

      const res = await deleteDriveById(req, {
        params: Promise.resolve({ id: driveId }),
      });
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toContain('Cannot delete drive with registered applications');
    });
  });

  describe('Eligibility Evaluation Endpoint (/api/drives/[id]/eligible)', () => {
    it('evaluates student eligibility correctly with specific ineligibility reasons', async () => {
      mockUserSession = tpoSession;
      const req = new Request(`http://localhost/api/drives/${driveId}/eligible?batch=2025`);
      const res = await getEligibleStudents(req, {
        params: Promise.resolve({ id: driveId }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.length).toBe(2);

      const cseStudent = body.data.find((s: { rollNumber: string }) => s.rollNumber === 'CSE-2025-01');
      expect(cseStudent.isEligible).toBe(true);
      expect(cseStudent.reasons).toEqual([]);

      const meStudent = body.data.find((s: { rollNumber: string }) => s.rollNumber === 'ME-2025-01');
      expect(meStudent.isEligible).toBe(false);
      // ME student violates: department CSE required, CGPA >= 7.0 required, backlogs <= 0 required
      expect(meStudent.reasons.length).toBeGreaterThan(0);
      expect(meStudent.reasons.some((r: string) => r.includes('Department'))).toBe(true);
    });

    it('scopes eligible students strictly to coordinator own department', async () => {
      mockUserSession = coordinatorCseSession; // CSE coordinator
      const req = new Request(`http://localhost/api/drives/${driveId}/eligible?batch=2025`);
      const res = await getEligibleStudents(req, {
        params: Promise.resolve({ id: driveId }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.length).toBe(1);
      expect(body.data[0].department).toBe('CSE');
      expect(body.data[0].rollNumber).toBe('CSE-2025-01');
    });
  });

  describe('Drive Applications (/api/drives/[id]/applications)', () => {
    it('allows TPO to register an eligible student', async () => {
      mockUserSession = tpoSession;
      const req = new Request(`http://localhost/api/drives/${driveId}/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: cseStudentId }),
      });

      const res = await postApplications(req, {
        params: Promise.resolve({ id: driveId }),
      });
      expect(res.status).toBe(201);
      const app = await res.json();
      expect(app.student).toBe(cseStudentId);
      expect(app.status).toBe('Applied');
      expect(app.eligibilitySnapshot.isEligible).toBe(true);
    });

    it('prevents registering an ineligible student without override reason', async () => {
      mockUserSession = tpoSession;
      const req = new Request(`http://localhost/api/drives/${driveId}/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: meStudentId }), // Ineligible student
      });

      const res = await postApplications(req, {
        params: Promise.resolve({ id: driveId }),
      });
      expect(res.status).toBe(400);
      const err = await res.json();
      expect(err.error).toContain('is ineligible');
      expect(err.error).toContain('Staff override reason is required');
    });

    it('allows registering an ineligible student when staff provides override reason', async () => {
      mockUserSession = tpoSession;
      const req = new Request(`http://localhost/api/drives/${driveId}/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: meStudentId,
          overrideReason: 'Special approval from HOD and TPO Chair for interview waiver',
        }),
      });

      const res = await postApplications(req, {
        params: Promise.resolve({ id: driveId }),
      });
      expect(res.status).toBe(201);
      const app = await res.json();
      expect(app.student).toBe(meStudentId);
      expect(app.eligibilitySnapshot.policyCheck.overrideReason).toContain('Special approval');
    });

    it('prevents double-registration of the same student for the same drive', async () => {
      mockUserSession = tpoSession;
      // Register first time
      await postApplications(
        new Request(`http://localhost/api/drives/${driveId}/applications`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId: cseStudentId }),
        }),
        { params: Promise.resolve({ id: driveId }) }
      );

      // Register second time
      const res2 = await postApplications(
        new Request(`http://localhost/api/drives/${driveId}/applications`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId: cseStudentId }),
        }),
        { params: Promise.resolve({ id: driveId }) }
      );

      const data2 = await res2.json();
      expect(data2.summary?.skipped).toBe(1);
    });

    it('scopes GET applications to coordinator own department', async () => {
      // Register both students (one with override)
      mockUserSession = tpoSession;
      await postApplications(
        new Request(`http://localhost/api/drives/${driveId}/applications`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId: cseStudentId }),
        }),
        { params: Promise.resolve({ id: driveId }) }
      );
      await postApplications(
        new Request(`http://localhost/api/drives/${driveId}/applications`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId: meStudentId,
            overrideReason: 'Approved override',
          }),
        }),
        { params: Promise.resolve({ id: driveId }) }
      );

      // CSE coordinator fetches applications
      mockUserSession = coordinatorCseSession;
      const req = new Request(`http://localhost/api/drives/${driveId}/applications`);
      const res = await getApplications(req, {
        params: Promise.resolve({ id: driveId }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.length).toBe(1);
      expect(data.data[0].student.department).toBe('CSE');
    });

    it('denies STUDENT role from registering or viewing applications (HTTP 403)', async () => {
      mockUserSession = studentSession;
      const getReq = new Request(`http://localhost/api/drives/${driveId}/applications`);
      const getRes = await getApplications(getReq, {
        params: Promise.resolve({ id: driveId }),
      });
      expect(getRes.status).toBe(403);

      const postReq = new Request(`http://localhost/api/drives/${driveId}/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: cseStudentId }),
      });
      const postRes = await postApplications(postReq, {
        params: Promise.resolve({ id: driveId }),
      });
      expect(postRes.status).toBe(403);
    });
  });
});
