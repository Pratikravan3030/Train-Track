import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { AuthContext } from '@/lib/auth-guards';

// 1. Session state control for NextAuth mock
let mockUserSession: { user: AuthContext } | null = null;

vi.mock('next-auth', () => ({
  default: vi.fn(),
  getServerSession: vi.fn(async () => mockUserSession),
}));

// 2. Import Real API Route Handlers
import { GET as getStudents, POST as postStudents } from '@/app/api/students/route';
import {
  GET as getStudentById,
  PUT as putStudentById,
  DELETE as deleteStudentById,
} from '@/app/api/students/[id]/route';
import { GET as getSessions, POST as postSessions } from '@/app/api/sessions/route';
import {
  GET as getSessionById,
  PUT as putSessionById,
  DELETE as deleteSessionById,
} from '@/app/api/sessions/[id]/route';
import { GET as getAttendance, POST as postAttendance } from '@/app/api/attendance/route';
import { GET as getFeedback, POST as postFeedback } from '@/app/api/feedback/route';
import { GET as getDashboardStats } from '@/app/api/dashboard-stats/route';
import { GET as getHealth } from '@/app/api/health/route';
import { GET as getSearch } from '@/app/api/search/route';
import { GET as getUsers, POST as postUsers } from '@/app/api/admin/users/route';
import { PUT as putUserById, DELETE as deleteUserById } from '@/app/api/admin/users/[id]/route';
import { POST as resetUserPassword } from '@/app/api/admin/users/[id]/reset-password/route';
import { POST as changePassword } from '@/app/api/auth/change-password/route';
import { resolveStudentDepartment } from '@/lib/departmentMapper';
import bcrypt from 'bcryptjs';

// 3. Import Mongoose Models
import Student from '@/models/Student';
import TrainingSession from '@/models/TrainingSession';
import Attendance from '@/models/Attendance';
import Feedback from '@/models/Feedback';
import User from '@/models/User';
import AuditLog from '@/models/AuditLog';

describe('Route-Level Authorization & Real Handler Scope Tests (In-Memory MongoDB)', () => {
  let mongoServer: MongoMemoryServer;

  // Track seeded document IDs
  let studentAId: string; // CSE Student
  let studentBId: string; // ME Student
  let sessionId: string;
  let testUserId: string;

  // Mock sessions for all 5 roles
  let superAdminSession: { user: AuthContext };
  let tpoSession: { user: AuthContext };
  let coordinatorDeptASession: { user: AuthContext };
  let studentSession: { user: AuthContext };

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    process.env.MONGODB_URI = uri;
    process.env.NEXTAUTH_SECRET = 'secret_test_key_12345';
    await mongoose.connect(uri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Reset DB
    await Student.deleteMany({});
    await TrainingSession.deleteMany({});
    await Attendance.deleteMany({});
    await Feedback.deleteMany({});
    await User.deleteMany({});
    await AuditLog.deleteMany({});

    // Seed Dept A (CSE) student
    const studentA = await Student.create({
      name: 'Aarav Patil',
      rollNumber: 'PRN-CSE-001',
      branch: 'CSE',
      department: 'CSE',
      year: 'Third Year',
      passoutYear: 2026,
      email: 'aarav.cse@dypcet.edu',
    });
    studentAId = studentA._id.toString();

    // Seed Dept B (ME) student
    const studentB = await Student.create({
      name: 'Rohan Shinde',
      rollNumber: 'PRN-ME-002',
      branch: 'ME',
      department: 'ME',
      year: 'Final Year',
      passoutYear: 2026,
      email: 'rohan.me@dypcet.edu',
    });
    studentBId = studentB._id.toString();

    // Student user session linked to Student A
    const defaultPasswordHash = await bcrypt.hash('SecurePassword123!', 10);

    const adminUser = await User.create({
      name: 'Super Administrator',
      email: 'superadmin@dypcet.edu',
      role: 'SUPER_ADMIN',
      password: defaultPasswordHash,
      isActive: true,
      tokenVersion: 1,
      mustChangePassword: false,
    });
    superAdminSession = {
      user: {
        id: adminUser._id.toString(),
        email: adminUser.email,
        role: 'SUPER_ADMIN',
        tokenVersion: 1,
        mustChangePassword: false,
      },
    };

    const tpoUser = await User.create({
      name: 'TPO Officer',
      email: 'tpo@dypcet.edu',
      role: 'TPO',
      password: defaultPasswordHash,
      isActive: true,
      tokenVersion: 1,
      mustChangePassword: false,
    });
    tpoSession = {
      user: {
        id: tpoUser._id.toString(),
        email: tpoUser.email,
        role: 'TPO',
        tokenVersion: 1,
        mustChangePassword: false,
      },
    };

    const coordUser = await User.create({
      name: 'CSE Coordinator',
      email: 'coord.cse@dypcet.edu',
      role: 'DEPT_COORDINATOR',
      department: 'CSE',
      password: defaultPasswordHash,
      isActive: true,
      tokenVersion: 1,
      mustChangePassword: false,
    });
    coordinatorDeptASession = {
      user: {
        id: coordUser._id.toString(),
        email: coordUser.email,
        role: 'DEPT_COORDINATOR',
        department: 'CSE',
        tokenVersion: 1,
        mustChangePassword: false,
      },
    };

    const stuUser = await User.create({
      name: 'Aarav Patil',
      email: 'aarav.cse@dypcet.edu',
      role: 'STUDENT',
      department: 'CSE',
      studentId: studentA._id,
      password: defaultPasswordHash,
      isActive: true,
      tokenVersion: 1,
      mustChangePassword: false,
    });
    studentSession = {
      user: {
        id: stuUser._id.toString(),
        email: stuUser.email,
        role: 'STUDENT',
        department: 'CSE',
        studentId: studentAId,
        tokenVersion: 1,
        mustChangePassword: false,
      },
    };

    // Seed Training Session
    const sessionDoc = await TrainingSession.create({
      title: 'Full Stack Development Bootcamp',
      date: '2026-11-10T10:00:00.000Z',
      trainer: 'Dr. S. K. Patil',
      description: 'Hands-on web engineering',
    });
    sessionId = sessionDoc._id.toString();

    // Seed Attendance for both students
    await Attendance.create([
      { sessionId, studentId: studentAId, present: true },
      { sessionId, studentId: studentBId, present: true },
    ]);

    // Seed initial feedback
    await Feedback.create({
      sessionId,
      studentId: studentBId,
      source: 'student',
      rating: 5,
      comment: 'Excellent session by Dr. Patil',
    });

    // Seed a dummy staff user for admin route testing
    const dummyUser = await User.create({
      name: 'Test Staff Member',
      email: 'staff.test@dypcet.edu',
      role: 'TPO',
      password: defaultPasswordHash,
      isActive: true,
      tokenVersion: 1,
      mustChangePassword: false,
    });
    testUserId = dummyUser._id.toString();
  });

  // =========================================================================
  // 1. UNAUTHENTICATED CALLS (Must return 401 Unauthorized for all endpoints)
  // =========================================================================
  describe('Unauthenticated Caller (Default Deny - 401)', () => {
    beforeEach(() => {
      mockUserSession = null;
    });

    it('denies GET /api/students with 401', async () => {
      const res = await getStudents(new Request('http://localhost:3000/api/students'));
      expect(res.status).toBe(401);
    });

    it('denies POST /api/students with 401', async () => {
      const res = await postStudents(
        new Request('http://localhost:3000/api/students', {
          method: 'POST',
          body: JSON.stringify({ name: 'Test', rollNumber: 'T01', branch: 'CSE', year: 'First' }),
        })
      );
      expect(res.status).toBe(401);
    });

    it('denies GET /api/students/[id] with 401', async () => {
      const res = await getStudentById(
        new Request(`http://localhost:3000/api/students/${studentAId}`),
        { params: Promise.resolve({ id: studentAId }) }
      );
      expect(res.status).toBe(401);
    });

    it('denies PUT /api/students/[id] with 401', async () => {
      const res = await putStudentById(
        new Request(`http://localhost:3000/api/students/${studentAId}`, {
          method: 'PUT',
          body: JSON.stringify({ name: 'Updated' }),
        }),
        { params: Promise.resolve({ id: studentAId }) }
      );
      expect(res.status).toBe(401);
    });

    it('denies DELETE /api/students/[id] with 401', async () => {
      const res = await deleteStudentById(
        new Request(`http://localhost:3000/api/students/${studentAId}`, { method: 'DELETE' }),
        { params: Promise.resolve({ id: studentAId }) }
      );
      expect(res.status).toBe(401);
    });

    it('denies GET /api/sessions with 401', async () => {
      const res = await getSessions(new Request('http://localhost:3000/api/sessions'));
      expect(res.status).toBe(401);
    });

    it('denies POST /api/sessions with 401', async () => {
      const res = await postSessions(
        new Request('http://localhost:3000/api/sessions', {
          method: 'POST',
          body: JSON.stringify({ title: 'New', date: '2026-12-01', trainer: 'Test' }),
        })
      );
      expect(res.status).toBe(401);
    });

    it('denies GET /api/sessions/[id] with 401', async () => {
      const res = await getSessionById(
        new Request(`http://localhost:3000/api/sessions/${sessionId}`),
        { params: Promise.resolve({ id: sessionId }) }
      );
      expect(res.status).toBe(401);
    });

    it('denies GET /api/attendance with 401', async () => {
      const res = await getAttendance(
        new Request(`http://localhost:3000/api/attendance?sessionId=${sessionId}`)
      );
      expect(res.status).toBe(401);
    });

    it('denies POST /api/attendance with 401', async () => {
      const res = await postAttendance(
        new Request('http://localhost:3000/api/attendance', {
          method: 'POST',
          body: JSON.stringify({ sessionId, records: [{ studentId: studentAId, present: true }] }),
        })
      );
      expect(res.status).toBe(401);
    });

    it('denies GET /api/feedback with 401', async () => {
      const res = await getFeedback(new Request('http://localhost:3000/api/feedback'));
      expect(res.status).toBe(401);
    });

    it('denies POST /api/feedback with 401', async () => {
      const res = await postFeedback(
        new Request('http://localhost:3000/api/feedback', {
          method: 'POST',
          body: JSON.stringify({ sessionId, rating: 5 }),
        })
      );
      expect(res.status).toBe(401);
    });

    it('denies GET /api/dashboard-stats with 401', async () => {
      const res = await getDashboardStats();
      expect(res.status).toBe(401);
    });

    it('denies GET /api/health with 401', async () => {
      const res = await getHealth();
      expect(res.status).toBe(401);
    });

    it('denies GET /api/search with 401', async () => {
      const res = await getSearch(new Request('http://localhost:3000/api/search?q=test'));
      expect(res.status).toBe(401);
    });

    it('denies GET /api/admin/users with 401', async () => {
      const res = await getUsers(new Request('http://localhost:3000/api/admin/users'));
      expect(res.status).toBe(401);
    });

    it('denies POST /api/admin/users with 401', async () => {
      const res = await postUsers(
        new Request('http://localhost:3000/api/admin/users', {
          method: 'POST',
          body: JSON.stringify({ name: 'Admin', email: 'admin@dypcet.edu', role: 'TPO' }),
        })
      );
      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // 2. STUDENT ROLE (Pre-Phase 6 Default-Deny & Scope Restrictions)
  // =========================================================================
  describe('STUDENT Role Boundary & Impersonation Prevention', () => {
    beforeEach(() => {
      mockUserSession = studentSession;
      process.env.STUDENT_PORTAL_ENABLED = 'true';
    });

    it('DENIES student from reading student directory (403)', async () => {
      const res = await getStudents(new Request('http://localhost:3000/api/students'));
      expect(res.status).toBe(403);
    });

    it('DENIES student from enrolling new students (403)', async () => {
      const res = await postStudents(
        new Request('http://localhost:3000/api/students', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Imposter',
            rollNumber: 'PRN-999',
            branch: 'CSE',
            year: 'First',
          }),
        })
      );
      expect(res.status).toBe(403);
    });

    it('DENIES student from reading specific student detail (403)', async () => {
      const res = await getStudentById(
        new Request(`http://localhost:3000/api/students/${studentAId}`),
        { params: Promise.resolve({ id: studentAId }) }
      );
      expect(res.status).toBe(403);
    });

    it('DENIES student from modifying or deleting student records (403)', async () => {
      const putRes = await putStudentById(
        new Request(`http://localhost:3000/api/students/${studentAId}`, {
          method: 'PUT',
          body: JSON.stringify({ name: 'Altered Name' }),
        }),
        { params: Promise.resolve({ id: studentAId }) }
      );
      expect(putRes.status).toBe(403);

      const delRes = await deleteStudentById(
        new Request(`http://localhost:3000/api/students/${studentAId}`, { method: 'DELETE' }),
        { params: Promise.resolve({ id: studentAId }) }
      );
      expect(delRes.status).toBe(403);
    });

    it('DENIES student from reading or writing attendance (403)', async () => {
      const getAtt = await getAttendance(
        new Request(`http://localhost:3000/api/attendance?sessionId=${sessionId}`)
      );
      expect(getAtt.status).toBe(403);

      const postAtt = await postAttendance(
        new Request('http://localhost:3000/api/attendance', {
          method: 'POST',
          body: JSON.stringify({ sessionId, records: [{ studentId: studentAId, present: true }] }),
        })
      );
      expect(postAtt.status).toBe(403);
    });

    it('DENIES student from reading feedback list (403)', async () => {
      const res = await getFeedback(new Request('http://localhost:3000/api/feedback'));
      expect(res.status).toBe(403);
    });

    it('DENIES student from dashboard stats, health, and user management (403)', async () => {
      const dash = await getDashboardStats();
      expect(dash.status).toBe(403);

      const health = await getHealth();
      expect(health.status).toBe(403);

      const users = await getUsers(new Request('http://localhost:3000/api/admin/users'));
      expect(users.status).toBe(403);
    });

    it('ALLOWS student to read session catalog (200)', async () => {
      const res = await getSessions(new Request('http://localhost:3000/api/sessions'));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.length).toBeGreaterThan(0);
    });

    it('DENIES student from updating or deleting sessions (403)', async () => {
      const putRes = await putSessionById(
        new Request(`http://localhost:3000/api/sessions/${sessionId}`, {
          method: 'PUT',
          body: JSON.stringify({ title: 'Tampered Title' }),
        }),
        { params: Promise.resolve({ id: sessionId }) }
      );
      expect(putRes.status).toBe(403);

      const delRes = await deleteSessionById(
        new Request(`http://localhost:3000/api/sessions/${sessionId}`, { method: 'DELETE' }),
        { params: Promise.resolve({ id: sessionId }) }
      );
      expect(delRes.status).toBe(403);
    });

    it('STRIPS attendee roster and attendee details when student views session detail', async () => {
      const res = await getSessionById(
        new Request(`http://localhost:3000/api/sessions/${sessionId}`),
        { params: Promise.resolve({ id: sessionId }) }
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.session._id).toBe(sessionId);
      // Essential security assertion: roster and others' attendance/feedback are stripped to empty arrays
      expect(data.students).toEqual([]);
      expect(data.attendance).toEqual([]);
      expect(data.feedback).toEqual([]);
    });

    it('ALLOWS student to submit feedback, derives studentId from session (ignoring foreign ID in body)', async () => {
      // Attempting to submit feedback with malicious foreign studentId in body
      const res = await postFeedback(
        new Request('http://localhost:3000/api/feedback', {
          method: 'POST',
          body: JSON.stringify({
            sessionId,
            studentId: studentBId, // Attempted impersonation of student B!
            rating: 4,
            comment: 'Great presentation',
          }),
        })
      );
      expect(res.status).toBe(201);
      const created = await res.json();
      // Crucial assertion: studentId is derived from session, NOT from request body!
      expect(created.studentId).toBe(studentAId);
      expect(created.source).toBe('student');
    });

    it('REJECTS duplicate feedback from the same student for the same session with 409 Conflict', async () => {
      // First submission
      const first = await postFeedback(
        new Request('http://localhost:3000/api/feedback', {
          method: 'POST',
          body: JSON.stringify({ sessionId, rating: 5, comment: 'First review' }),
        })
      );
      expect(first.status).toBe(201);

      // Second submission for the same session by same student
      const second = await postFeedback(
        new Request('http://localhost:3000/api/feedback', {
          method: 'POST',
          body: JSON.stringify({ sessionId, rating: 3, comment: 'Second review' }),
        })
      );
      expect(second.status).toBe(409);
      const err = await second.json();
      expect(err.error).toMatch(/already submitted feedback/i);
    });
  });

  // =========================================================================
  // 3. DEPT_COORDINATOR ROLE (Coordinator A from Dept CSE)
  // =========================================================================
  describe('DEPT_COORDINATOR Cross-Department Isolation (Dept A: CSE)', () => {
    beforeEach(() => {
      mockUserSession = coordinatorDeptASession;
    });

    it('scopes GET /api/students strictly to own department (excludes Dept B students)', async () => {
      const res = await getStudents(new Request('http://localhost:3000/api/students'));
      expect(res.status).toBe(200);
      const json = await res.json();
      const students = json.data;

      // Only studentA (CSE) should be visible
      const cseStudents = students.filter((s: { branch: string }) => s.branch === 'CSE');
      const meStudents = students.filter((s: { branch: string }) => s.branch === 'ME');

      expect(cseStudents.length).toBe(1);
      expect(meStudents.length).toBe(0);
    });

    it('ALLOWS coordinator to view students in their own department (200)', async () => {
      const res = await getStudentById(
        new Request(`http://localhost:3000/api/students/${studentAId}`),
        { params: Promise.resolve({ id: studentAId }) }
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.student._id).toBe(studentAId);
    });

    it('DENIES coordinator from reading a student in another department (403)', async () => {
      const res = await getStudentById(
        new Request(`http://localhost:3000/api/students/${studentBId}`),
        { params: Promise.resolve({ id: studentBId }) }
      );
      expect(res.status).toBe(403);
      const err = await res.json();
      expect(err.error).toMatch(/other departments/i);
    });

    it('DENIES coordinator from updating a student in another department (403)', async () => {
      const res = await putStudentById(
        new Request(`http://localhost:3000/api/students/${studentBId}`, {
          method: 'PUT',
          body: JSON.stringify({ name: 'Tampered Name' }),
        }),
        { params: Promise.resolve({ id: studentBId }) }
      );
      expect(res.status).toBe(403);
    });

    it('DENIES coordinator from deleting any student, even in their own department (403)', async () => {
      const res = await deleteStudentById(
        new Request(`http://localhost:3000/api/students/${studentAId}`, { method: 'DELETE' }),
        { params: Promise.resolve({ id: studentAId }) }
      );
      expect(res.status).toBe(403);
    });

    it('DENIES coordinator from enrolling students outside their own department (403)', async () => {
      const res = await postStudents(
        new Request('http://localhost:3000/api/students', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Wrong Dept Student',
            rollNumber: 'PRN-FOREIGN-01',
            branch: 'ME',
            year: 'Second Year',
            email: 'wrong.dept@dypcet.edu',
          }),
        })
      );
      expect(res.status).toBe(403);
    });

    it('scopes GET /api/sessions/[id] roster strictly to own department', async () => {
      const res = await getSessionById(
        new Request(`http://localhost:3000/api/sessions/${sessionId}`),
        { params: Promise.resolve({ id: sessionId }) }
      );
      expect(res.status).toBe(200);
      const data = await res.json();

      // Roster must ONLY contain CSE student
      expect(data.students.length).toBe(1);
      expect(data.students[0]._id.toString()).toBe(studentAId);
      // Attendance must only contain CSE student record
      expect(data.attendance.length).toBe(1);
      expect(data.attendance[0].studentId.toString()).toBe(studentAId);
    });

    it('scopes GET /api/attendance strictly to own department', async () => {
      const res = await getAttendance(
        new Request(`http://localhost:3000/api/attendance?sessionId=${sessionId}`)
      );
      expect(res.status).toBe(200);
      const records = await res.json();
      expect(records.length).toBe(1);
      expect(records[0].studentId._id.toString()).toBe(studentAId);
    });

    it('ALLOWS coordinator to submit bulk attendance when all students belong to own department (200)', async () => {
      const res = await postAttendance(
        new Request('http://localhost:3000/api/attendance', {
          method: 'POST',
          body: JSON.stringify({
            sessionId,
            records: [{ studentId: studentAId, present: true }],
          }),
        })
      );
      expect(res.status).toBe(200);
    });

    it('REJECTS entire bulk attendance payload with 403 if even ONE student belongs to another department', async () => {
      const res = await postAttendance(
        new Request('http://localhost:3000/api/attendance', {
          method: 'POST',
          body: JSON.stringify({
            sessionId,
            records: [
              { studentId: studentAId, present: true }, // Own department
              { studentId: studentBId, present: true }, // Foreign department (ME)!
            ],
          }),
        })
      );
      expect(res.status).toBe(403);
      const err = await res.json();
      expect(err.error).toMatch(/cross-department attendance manipulation rejected/i);
    });

    it('scopes GET /api/feedback strictly to own department (excludes Dept B student feedback)', async () => {
      // Create feedback from Dept A student
      await Feedback.create({
        sessionId,
        studentId: studentAId,
        source: 'student',
        rating: 4,
        comment: 'CSE student feedback',
      });

      const res = await getFeedback(new Request('http://localhost:3000/api/feedback'));
      expect(res.status).toBe(200);
      const json = await res.json();
      // Should only contain the 1 feedback from Student A (CSE)
      expect(json.data.length).toBe(1);
      expect(json.data[0].studentId._id.toString()).toBe(studentAId);
    });

    it('DENIES coordinator from system health, user administration routes (403)', async () => {
      const health = await getHealth();
      expect(health.status).toBe(403);

      const users = await getUsers(new Request('http://localhost:3000/api/admin/users'));
      expect(users.status).toBe(403);

      const postUser = await postUsers(
        new Request('http://localhost:3000/api/admin/users', {
          method: 'POST',
          body: JSON.stringify({ name: 'Admin', email: 'test@dypcet.edu', role: 'TPO' }),
        })
      );
      expect(postUser.status).toBe(403);
    });
  });

  // =========================================================================
  // 4. TPO ROLE (Cross-Department Staff Oversight, No Super Admin Rights)
  // =========================================================================
  describe('TPO Role (Universal College Scope, Restricted from Super Admin Actions)', () => {
    beforeEach(() => {
      mockUserSession = tpoSession;
    });

    it('ALLOWS TPO to read students across all departments (200)', async () => {
      const res = await getStudents(new Request('http://localhost:3000/api/students'));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.length).toBe(2); // Both CSE and ME
    });

    it('ALLOWS TPO to view full campus-wide roster in sessions (200)', async () => {
      const res = await getSessionById(
        new Request(`http://localhost:3000/api/sessions/${sessionId}`),
        { params: Promise.resolve({ id: sessionId }) }
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.students.length).toBe(2);
      expect(data.attendance.length).toBe(2);
    });

    it('ALLOWS TPO to record attendance for students of any department (200)', async () => {
      const res = await postAttendance(
        new Request('http://localhost:3000/api/attendance', {
          method: 'POST',
          body: JSON.stringify({
            sessionId,
            records: [
              { studentId: studentAId, present: true },
              { studentId: studentBId, present: false },
            ],
          }),
        })
      );
      expect(res.status).toBe(200);
    });

    it('DENIES TPO from health diagnostic route (403 - SUPER_ADMIN only)', async () => {
      const res = await getHealth();
      expect(res.status).toBe(403);
    });

    it('DENIES TPO from user management routes (403 - SUPER_ADMIN only)', async () => {
      const getUsr = await getUsers(new Request('http://localhost:3000/api/admin/users'));
      expect(getUsr.status).toBe(403);

      const postUsr = await postUsers(
        new Request('http://localhost:3000/api/admin/users', {
          method: 'POST',
          body: JSON.stringify({ name: 'User', email: 'u@dypcet.edu', role: 'TPO' }),
        })
      );
      expect(postUsr.status).toBe(403);
    });
  });

  // =========================================================================
  // 5. SUPER_ADMIN ROLE (Unrestricted System Governance)
  // =========================================================================
  describe('SUPER_ADMIN Role (Full Privileges)', () => {
    beforeEach(() => {
      mockUserSession = superAdminSession;
    });

    it('ALLOWS SUPER_ADMIN to access health diagnostic endpoint (200)', async () => {
      const res = await getHealth();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe('healthy');
      expect(json.database.connected).toBe(true);
      expect(json.database.counts.students).toBe(2);
    });

    it('ALLOWS SUPER_ADMIN to list all system users (200)', async () => {
      const res = await getUsers(new Request('http://localhost:3000/api/admin/users'));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.length).toBeGreaterThan(0);
    });

    it('ALLOWS SUPER_ADMIN to provision a new coordinator with temporary password (201)', async () => {
      const res = await postUsers(
        new Request('http://localhost:3000/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Prof. Joshi',
            email: 'joshi.it@dypcet.edu',
            role: 'DEPT_COORDINATOR',
            department: 'IT',
          }),
        })
      );
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.user.email).toBe('joshi.it@dypcet.edu');
      expect(json.user.mustChangePassword).toBe(true);
      expect(json.temporaryPassword).toBeDefined();
      expect(json.temporaryPassword.length).toBeGreaterThan(8);
    });

    it('ALLOWS SUPER_ADMIN to deactivate and reactivate a user (200)', async () => {
      // Deactivate
      const deactRes = await putUserById(
        new Request(`http://localhost:3000/api/admin/users/${testUserId}`, {
          method: 'PUT',
          body: JSON.stringify({ isActive: false }),
        }),
        { params: Promise.resolve({ id: testUserId }) }
      );
      expect(deactRes.status).toBe(200);
      let updatedUser = await User.findById(testUserId);
      expect(updatedUser?.isActive).toBe(false);

      // Reactivate
      const reactRes = await putUserById(
        new Request(`http://localhost:3000/api/admin/users/${testUserId}`, {
          method: 'PUT',
          body: JSON.stringify({ isActive: true }),
        }),
        { params: Promise.resolve({ id: testUserId }) }
      );
      expect(reactRes.status).toBe(200);
      updatedUser = await User.findById(testUserId);
      expect(updatedUser?.isActive).toBe(true);
    });

    it('ALLOWS SUPER_ADMIN to reset a user password generating temporary password (200)', async () => {
      const res = await resetUserPassword(
        new Request(`http://localhost:3000/api/admin/users/${testUserId}/reset-password`, {
          method: 'POST',
        }),
        { params: Promise.resolve({ id: testUserId }) }
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.temporaryPassword).toBeDefined();

      const user = await User.findById(testUserId);
      expect(user?.mustChangePassword).toBe(true);
      expect(user?.temporaryPasswordHash).toBeDefined();
    });

    it('ALLOWS SUPER_ADMIN to delete a staff user account (200)', async () => {
      const res = await deleteUserById(
        new Request(`http://localhost:3000/api/admin/users/${testUserId}`, { method: 'DELETE' }),
        { params: Promise.resolve({ id: testUserId }) }
      );
      expect(res.status).toBe(200);
      const found = await User.findById(testUserId);
      expect(found).toBeNull();
    });

    it('ALLOWS SUPER_ADMIN to delete a student with cascading cleanup (200)', async () => {
      const res = await deleteStudentById(
        new Request(`http://localhost:3000/api/students/${studentBId}`, { method: 'DELETE' }),
        { params: Promise.resolve({ id: studentBId }) }
      );
      expect(res.status).toBe(200);

      // Verify cascading deletion of student, attendance, and feedback
      const studentDoc = await Student.findById(studentBId);
      expect(studentDoc).toBeNull();

      const attendanceRecords = await Attendance.find({ studentId: studentBId });
      expect(attendanceRecords.length).toBe(0);

      const feedbackRecords = await Feedback.find({ studentId: studentBId });
      expect(feedbackRecords.length).toBe(0);
    });
  });

  // =========================================================================
  // 6. GAP 1: SERVER-SIDE FORCED PASSWORD CHANGE (mustChangePassword=true)
  // =========================================================================
  describe('Gap 1: Server-Side Forced Password Change (mustChangePassword=true)', () => {
    let pendingPasswordUser: InstanceType<typeof User>;
    let pendingPasswordSession: { user: AuthContext };

    beforeEach(async () => {
      const initialHashed = await bcrypt.hash('TempPassword123!', 10);
      pendingPasswordUser = await User.create({
        name: 'Forced Password User',
        email: 'forced.pwd@dypcet.edu',
        role: 'TPO',
        password: initialHashed,
        temporaryPasswordHash: initialHashed,
        isActive: true,
        mustChangePassword: true,
        tokenVersion: 1,
      });

      pendingPasswordSession = {
        user: {
          id: pendingPasswordUser._id.toString(),
          email: pendingPasswordUser.email,
          role: 'TPO',
          tokenVersion: 1,
          mustChangePassword: true,
        },
      };
      mockUserSession = pendingPasswordSession;
    });

    it('DENIES GET /api/students with 403 and code PASSWORD_CHANGE_REQUIRED', async () => {
      const res = await getStudents(new Request('http://localhost:3000/api/students'));
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.code).toBe('PASSWORD_CHANGE_REQUIRED');
    });

    it('DENIES GET /api/sessions with 403 and code PASSWORD_CHANGE_REQUIRED', async () => {
      const res = await getSessions(new Request('http://localhost:3000/api/sessions'));
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.code).toBe('PASSWORD_CHANGE_REQUIRED');
    });

    it('DENIES POST /api/attendance with 403 and code PASSWORD_CHANGE_REQUIRED', async () => {
      const res = await postAttendance(
        new Request('http://localhost:3000/api/attendance', {
          method: 'POST',
          body: JSON.stringify({ sessionId, studentId: studentAId, present: true }),
        })
      );
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.code).toBe('PASSWORD_CHANGE_REQUIRED');
    });

    it('DENIES GET /api/dashboard-stats with 403 and code PASSWORD_CHANGE_REQUIRED', async () => {
      const res = await getDashboardStats(new Request('http://localhost:3000/api/dashboard-stats'));
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.code).toBe('PASSWORD_CHANGE_REQUIRED');
    });

    it('ALLOWS POST /api/auth/change-password, resets mustChangePassword, increments tokenVersion, and unblocks API routes after refresh', async () => {
      // 1. Password change route is allowed even when mustChangePassword=true
      const res = await changePassword(
        new Request('http://localhost:3000/api/auth/change-password', {
          method: 'POST',
          body: JSON.stringify({
            currentPassword: 'TempPassword123!',
            newPassword: 'MyNewPermanentPassword123!',
            confirmPassword: 'MyNewPermanentPassword123!',
          }),
        })
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.message).toBe('Password updated successfully');
      expect(json.tokenVersion).toBe(2);

      // Verify DB flags updated
      const updatedUser = await User.findById(pendingPasswordUser._id);
      expect(updatedUser?.mustChangePassword).toBe(false);
      expect(updatedUser?.tokenVersion).toBe(2);

      // 2. NextAuth session refresh: tokenVersion updated to 2 and mustChangePassword cleared
      mockUserSession = {
        user: {
          id: pendingPasswordUser._id.toString(),
          email: pendingPasswordUser.email,
          role: 'TPO',
          tokenVersion: 2,
          mustChangePassword: false,
        },
      };

      // 3. User is now unblocked from accessing protected API routes
      const unblockedRes = await getStudents(new Request('http://localhost:3000/api/students'));
      expect(unblockedRes.status).toBe(200);
    });
  });

  // =========================================================================
  // 7. GAP 2: SESSION INVALIDATION & TOKEN VERSION VERIFICATION
  // =========================================================================
  describe('Gap 2: Session Invalidation & Token Version Verification', () => {
    it('DENIES access (403) for an active JWT session when the user is deactivated (isActive=false)', async () => {
      // Deactivate user in DB
      await User.updateOne({ email: 'coord.cse@dypcet.edu' }, { isActive: false });

      mockUserSession = coordinatorDeptASession;
      const res = await getStudents(new Request('http://localhost:3000/api/students'));
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toMatch(/deactivated/i);
    });

    it('DENIES access (401) for an old token when tokenVersion does not match DB (e.g. after password reset)', async () => {
      // Simulate password reset which bumped DB tokenVersion to 2
      await User.updateOne(
        { email: 'tpo@dypcet.edu' },
        { tokenVersion: 2, mustChangePassword: true }
      );

      // Mock session holds old tokenVersion: 1
      mockUserSession = {
        ...tpoSession,
        user: {
          ...tpoSession.user,
          tokenVersion: 1,
        },
      };

      const res = await getStudents(new Request('http://localhost:3000/api/students'));
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toMatch(/session has been invalidated/i);
    });

    it('DENIES access (401) when user has been deleted from MongoDB', async () => {
      // Delete user
      await User.deleteOne({ email: 'coord.cse@dypcet.edu' });

      mockUserSession = coordinatorDeptASession;
      const res = await getStudents(new Request('http://localhost:3000/api/students'));
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toMatch(/no longer exists/i);
    });
  });

  // =========================================================================
  // 8. GAP 3: STUDENT.DEPARTMENT SINGLE SOURCE OF TRUTH & VALIDATION
  // =========================================================================
  describe('Gap 3: Student.department Single Source of Truth & Validation', () => {
    beforeEach(() => {
      mockUserSession = superAdminSession;
    });

    it('REJECTS Student.create when department is missing (Mongoose ValidationError)', async () => {
      await expect(
        Student.create({
          name: 'No Dept Student',
          rollNumber: 'PRN-NODEPT-001',
          year: 'First Year',
          email: 'nodept@dypcet.edu',
        })
      ).rejects.toThrow(/Department code is required/);
    });

    it('REJECTS Student.create when department code is invalid (Mongoose Enum Validation)', async () => {
      await expect(
        Student.create({
          name: 'Invalid Dept Student',
          rollNumber: 'PRN-INV-001',
          department: 'INVALID_DEPT' as never,
          year: 'First Year',
          passoutYear: 2026,
          email: 'invdept@dypcet.edu',
        })
      ).rejects.toThrow(/is not a valid department code/);
    });

    it('REJECTS POST /api/students when department is missing or unmappable (400)', async () => {
      const res = await postStudents(
        new Request('http://localhost:3000/api/students', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Invalid Input Student',
            rollNumber: 'PRN-BAD-001',
            department: 'Unknown Martian Studies',
            year: 'First Year',
            email: 'baddept@dypcet.edu',
          }),
        })
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/invalid department/i);
    });

    it('ACCEPTS legacy branch in POST /api/students, writes validated department code, and leaves branch unset', async () => {
      const res = await postStudents(
        new Request('http://localhost:3000/api/students', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Legacy FreeText Student',
            rollNumber: 'PRN-LEGACY-001',
            branch: 'Computer Science & Engineering',
            year: 'Second Year',
            email: 'legacy.student@dypcet.edu',
          }),
        })
      );
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.department).toBe('CSE');
      expect(json.branch).toBeUndefined();

      // Verify in MongoDB
      const savedDoc = await Student.findOne({ rollNumber: 'PRN-LEGACY-001' });
      expect(savedDoc?.department).toBe('CSE');
      expect(savedDoc?.branch).toBeUndefined();
    });

    it('resolveStudentDepartment helper validates all department inputs and throws on missing or invalid', () => {
      expect(resolveStudentDepartment({ department: 'CSE' })).toBe('CSE');
      expect(resolveStudentDepartment({ branch: 'Mechanical Engineering' })).toBe('ME');
      expect(resolveStudentDepartment({ department: 'it' })).toBe('IT');
      expect(() => resolveStudentDepartment({ department: '' })).toThrow(/Department is required/);
      expect(() => resolveStudentDepartment({ department: 'invalid-xyz' })).toThrow(/Invalid department/);
    });
  });

  // =========================================================================
  // 9. PHASE 3: BATCH ISOLATION & PLACEMENT STATUS GOVERNANCE
  // =========================================================================
  describe('Phase 3: Batch Isolation & Placement Status Governance', () => {
    let placedStudentId: string;
    let cohort2025StudentId: string;

    beforeEach(async () => {
      mockUserSession = tpoSession;

      // Seed a Placed student in 2026 batch
      const placedStudent = await Student.create({
        name: 'Placed CSE Student',
        rollNumber: 'PRN-PLACED-001',
        department: 'CSE',
        year: 'Final Year',
        passoutYear: 2026,
        email: 'placed.cse@dypcet.edu',
        placementStatus: 'Placed',
        placementDetails: {
          companyName: 'TCS Digital',
          packageLPA: 7.5,
          placedDate: new Date('2025-09-15'),
        },
      });
      placedStudentId = placedStudent._id.toString();

      // Seed a student in 2025 batch
      const cohort2025Student = await Student.create({
        name: 'Cohort 2025 CSE Student',
        rollNumber: 'PRN-2025-001',
        department: 'CSE',
        year: 'Final Year',
        passoutYear: 2025,
        email: 'alumni2025@dypcet.edu',
        placementStatus: 'Placed',
      });
      cohort2025StudentId = cohort2025Student._id.toString();
    });

    it('DENIES coordinator from modifying placementStatus on a student (403)', async () => {
      mockUserSession = coordinatorDeptASession;

      const res = await putStudentById(
        new Request(`http://localhost:3000/api/students/${placedStudentId}`, {
          method: 'PUT',
          body: JSON.stringify({
            placementStatus: 'Not Placed',
          }),
        }),
        { params: Promise.resolve({ id: placedStudentId }) }
      );

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toMatch(/Placement status changes can only be performed by TPO and Super Administrators/i);
    });

    it('REJECTS TPO moving student out of Placed status without a mandatory statusChangeReason (400)', async () => {
      mockUserSession = tpoSession;

      const res = await putStudentById(
        new Request(`http://localhost:3000/api/students/${placedStudentId}`, {
          method: 'PUT',
          body: JSON.stringify({
            placementStatus: 'Not Placed',
          }),
        }),
        { params: Promise.resolve({ id: placedStudentId }) }
      );

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/A mandatory reason .* is required when moving a student out of 'Placed' status/i);
    });

    it('ALLOWS TPO to move student out of Placed with reason, updating details and writing an audit log (200)', async () => {
      mockUserSession = tpoSession;

      const res = await putStudentById(
        new Request(`http://localhost:3000/api/students/${placedStudentId}`, {
          method: 'PUT',
          body: JSON.stringify({
            placementStatus: 'Not Placed',
            statusChangeReason: 'Offer revoked due to project cancellation by client',
          }),
        }),
        { params: Promise.resolve({ id: placedStudentId }) }
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.placementStatus).toBe('Not Placed');
      expect(json.placementDetails?.reasonForStatusChange).toBe('Offer revoked due to project cancellation by client');

      // Verify audit log entry
      const auditLog = await AuditLog.findOne({
        action: 'UPDATE_PLACEMENT_STATUS',
        resourceId: placedStudentId,
      });
      expect(auditLog).toBeDefined();
      expect(auditLog?.details.previousStatus).toBe('Placed');
      expect(auditLog?.details.newStatus).toBe('Not Placed');
      expect(auditLog?.details.reason).toBe('Offer revoked due to project cancellation by client');
    });

    it('ISOLATES cohorts by batch: default GET /api/students returns only current batch (2026)', async () => {
      mockUserSession = tpoSession;

      const res = await getStudents(new Request('http://localhost:3000/api/students'));
      expect(res.status).toBe(200);
      const json = await res.json();

      const studentIds = json.data.map((s: { _id: string }) => s._id.toString());
      expect(studentIds).toContain(placedStudentId);
      expect(studentIds).not.toContain(cohort2025StudentId);
    });

    it('allows explicit filtering by batch in GET /api/students?batch=2025', async () => {
      mockUserSession = tpoSession;

      const res = await getStudents(new Request('http://localhost:3000/api/students?batch=2025'));
      expect(res.status).toBe(200);
      const json = await res.json();

      const studentIds = json.data.map((s: { _id: string }) => s._id.toString());
      expect(studentIds).toContain(cohort2025StudentId);
      expect(studentIds).not.toContain(placedStudentId);
    });

    it('aggregates placement stats filtered by batch in GET /api/dashboard-stats', async () => {
      mockUserSession = tpoSession;

      const res = await getDashboardStats(new Request('http://localhost:3000/api/dashboard-stats?batch=2026'));
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.selectedBatch).toBe(2026);
      expect(typeof json.placedStudents).toBe('number');
      expect(typeof json.placementRate).toBe('number');
      expect(Array.isArray(json.placementDistribution)).toBe(true);
    });
  });
});
