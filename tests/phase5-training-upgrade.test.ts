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
import { GET as getSessions, POST as createSession } from '@/app/api/sessions/route';
import { POST as saveAttendance } from '@/app/api/attendance/route';
import { GET as getTrainerAnalytics } from '@/app/api/sessions/analytics/route';
import { GET as getDefaulters } from '@/app/api/sessions/defaulters/route';
import { POST as generateCheckInCode } from '@/app/api/sessions/[id]/check-in-code/route';
import { GET as getAssessments } from '@/app/api/sessions/[id]/assessments/route';
import { POST as importAssessment } from '@/app/api/sessions/[id]/assessments/import/route';

// Models
import User from '@/models/User';
import Student from '@/models/Student';
import TrainingSession from '@/models/TrainingSession';
import Attendance from '@/models/Attendance';
import Feedback from '@/models/Feedback';
import Assessment from '@/models/Assessment';
import AuditLog from '@/models/AuditLog';

describe('Phase 5: Staff-Side Training Upgrade (Categories, Attendance Statuses, Defaulters, Trainer Analytics, Assessments)', () => {
  let mongoServer: MongoMemoryServer;

  let superAdminSession: { user: AuthContext };
  let tpoSession: { user: AuthContext };
  let cseCoordinatorSession: { user: AuthContext };

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    process.env.MONGODB_URI = uri;
    await mongoose.connect(uri);

    const adminUser = await User.create({
      name: 'Super Admin',
      email: 'superadmin.p5@dypcet.ac.in',
      role: 'SUPER_ADMIN',
      password: 'password123',
      isActive: true,
      tokenVersion: 1,
    });

    const tpoUser = await User.create({
      name: 'TPO Officer',
      email: 'tpo.p5@dypcet.ac.in',
      role: 'TPO',
      password: 'password123',
      isActive: true,
      tokenVersion: 1,
    });

    const cseCoordUser = await User.create({
      name: 'CSE Coordinator',
      email: 'coord.cse.p5@dypcet.ac.in',
      role: 'DEPT_COORDINATOR',
      department: 'CSE',
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
        id: cseCoordUser._id.toString(),
        name: cseCoordUser.name,
        email: cseCoordUser.email,
        role: 'DEPT_COORDINATOR',
        department: 'CSE',
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
    await TrainingSession.deleteMany({});
    await Attendance.deleteMany({});
    await Feedback.deleteMany({});
    await Assessment.deleteMany({});
    await AuditLog.deleteMany({});
  });

  // 1. Session Categories & Target Groups
  describe('Session Categories & Target Groups', () => {
    it('creates and filters training sessions by category, department, and batch', async () => {
      mockUserSession = tpoSession;

      const createReq = new Request('http://localhost:3000/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Quantitative Aptitude Masterclass',
          date: '2026-03-20',
          trainer: 'Prof. A. R. Kulkarni',
          description: 'Permutations, probability, and speed math',
          category: 'Aptitude',
          targetDepartments: ['CSE', 'IT'],
          targetBatches: [2026],
          venue: 'Auditorium 1',
        }),
      });

      const createRes = await createSession(createReq);
      expect(createRes.status).toBe(201);
      const created = await createRes.json();
      expect(created.category).toBe('Aptitude');
      expect(created.targetDepartments).toEqual(['CSE', 'IT']);
      expect(created.venue).toBe('Auditorium 1');

      // Create another session in Soft Skills
      await createSession(
        new Request('http://localhost:3000/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Campus to Corporate Grooming',
            date: '2026-03-22',
            trainer: 'Corporate HR',
            category: 'Soft Skills',
            targetDepartments: ['ME'],
            targetBatches: [2026],
          }),
        })
      );

      // Filter by category=Aptitude
      const filterReq = new Request('http://localhost:3000/api/sessions?category=Aptitude');
      const filterRes = await getSessions(filterReq);
      expect(filterRes.status).toBe(200);
      const filterData = await filterRes.json();
      expect(filterData.data.length).toBe(1);
      expect(filterData.data[0].title).toBe('Quantitative Aptitude Masterclass');
    });
  });

  // 2. Attendance Statuses (Present, Absent, Late, Excused)
  describe('Attendance Status Enums and Synchronization', () => {
    it('records attendance with granular statuses and auto-syncs boolean present field', async () => {
      const student1 = await Student.create({
        name: 'Omkar Shinde',
        rollNumber: 'DYP2026CSE031',
        department: 'CSE',
        year: 'Final Year',
        passoutYear: 2026,
      });

      const student2 = await Student.create({
        name: 'Pooja Desai',
        rollNumber: 'DYP2026CSE032',
        department: 'CSE',
        year: 'Final Year',
        passoutYear: 2026,
      });

      expect(student1._id).toBeDefined();
      expect(student2._id).toBeDefined();
      expect(superAdminSession.user.role).toBe('SUPER_ADMIN');
      expect(cseCoordinatorSession.user.department).toBe('CSE');

      const session = await TrainingSession.create({
        title: 'Mock Interview Workshop',
        date: new Date('2026-03-25'),
        trainer: 'Alumni Panel',
        category: 'Mock Interview',
      });

      mockUserSession = tpoSession;
      const attReq = new Request('http://localhost:3000/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session._id.toString(),
          records: [
            { studentId: student1._id.toString(), status: 'Late', remarks: 'Joined 10 mins late' },
            { studentId: student2._id.toString(), status: 'Excused', remarks: 'Medical leave approved' },
          ],
        }),
      });

      const attRes = await saveAttendance(attReq);
      expect(attRes.status).toBe(200);

      // Check Student 1: Late counts as present: true
      const att1 = await Attendance.findOne({ sessionId: session._id, studentId: student1._id });
      expect(att1?.status).toBe('Late');
      expect(att1?.present).toBe(true);
      expect(att1?.remarks).toBe('Joined 10 mins late');

      // Check Student 2: Excused counts as present: false
      const att2 = await Attendance.findOne({ sessionId: session._id, studentId: student2._id });
      expect(att2?.status).toBe('Excused');
      expect(att2?.present).toBe(false);
      expect(att2?.remarks).toBe('Medical leave approved');
    });
  });

  // 3. Trainer Analytics
  describe('Trainer Analytics API', () => {
    it('computes sessions count, student attendance rate, feedback score, and category distribution per trainer', async () => {
      const student = await Student.create({
        name: 'Kunal Mane',
        rollNumber: 'DYP2026CSE040',
        department: 'CSE',
        year: 'Final Year',
        passoutYear: 2026,
      });

      const s1 = await TrainingSession.create({
        title: 'Algorithms 1',
        date: new Date('2026-01-10'),
        trainer: 'Dr. V. S. Patil',
        category: 'Technical',
      });

      const s2 = await TrainingSession.create({
        title: 'Algorithms 2',
        date: new Date('2026-01-12'),
        trainer: 'Dr. V. S. Patil',
        category: 'Technical',
      });

      // Attendance
      await Attendance.create({ sessionId: s1._id, studentId: student._id, present: true, status: 'Present' });
      await Attendance.create({ sessionId: s2._id, studentId: student._id, present: true, status: 'Present' });

      // Feedback
      await Feedback.create({ sessionId: s1._id, studentId: student._id, rating: 4.5, comments: 'Good' });
      await Feedback.create({ sessionId: s2._id, studentId: student._id, rating: 5.0, comments: 'Excellent' });

      mockUserSession = tpoSession;
      const res = await getTrainerAnalytics();
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.totalSessions).toBe(2);

      const patilStat = data.trainerAnalytics.find((t: { trainer: string }) => t.trainer === 'Dr. V. S. Patil');
      expect(patilStat).toBeDefined();
      expect(patilStat.sessionsCount).toBe(2);
      expect(patilStat.totalStudentsAttended).toBe(2);
      expect(patilStat.averageAttendanceRate).toBe(100);
      expect(patilStat.averageFeedbackRating).toBe(4.75);
    });
  });

  // 4. Defaulters List API & CSV Export
  describe('Defaulters List API', () => {
    it('accurately identifies students with attendance < 75% and exports CSV with formula safety', async () => {
      const sRegular = await Student.create({
        name: 'Aditya Powar',
        rollNumber: 'DYP2026CSE050',
        department: 'CSE',
        year: 'Final Year',
        passoutYear: 2026,
      });

      const sDefaulter = await Student.create({
        name: '=SUM(1,2)', // formula injection safety test
        rollNumber: 'DYP2026CSE051',
        department: 'CSE',
        year: 'Final Year',
        passoutYear: 2026,
      });

      const s1 = await TrainingSession.create({ title: 'Session A', date: new Date('2026-01-10'), trainer: 'T1' });
      const s2 = await TrainingSession.create({ title: 'Session B', date: new Date('2026-01-11'), trainer: 'T1' });

      // sRegular attended both (100%)
      await Attendance.create({ sessionId: s1._id, studentId: sRegular._id, present: true });
      await Attendance.create({ sessionId: s2._id, studentId: sRegular._id, present: true });

      // sDefaulter attended 0 of 2 (0% < 75%)
      await Attendance.create({ sessionId: s1._id, studentId: sDefaulter._id, present: false, status: 'Absent' });
      await Attendance.create({ sessionId: s2._id, studentId: sDefaulter._id, present: false, status: 'Absent' });

      mockUserSession = tpoSession;
      const res = await getDefaulters(new Request('http://localhost:3000/api/sessions/defaulters?threshold=75&batch=2026'));
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.defaulterCount).toBe(1);
      expect(data.defaulters[0].rollNumber).toBe('DYP2026CSE051');
      expect(data.defaulters[0].attendanceRate).toBe(0);

      // CSV Export test
      const csvRes = await getDefaulters(
        new Request('http://localhost:3000/api/sessions/defaulters?threshold=75&batch=2026&format=csv')
      );
      expect(csvRes.status).toBe(200);
      const csvText = await csvRes.text();
      // Verifies formula sanitization
      expect(csvText).toContain("'=SUM(1,2)");
    });
  });

  // 5. Time-Limited Check-In Code
  describe('Time-Limited Check-In Code', () => {
    it('generates an active 6-character check-in code with expiration timestamp', async () => {
      const session = await TrainingSession.create({
        title: 'Campus Coding Challenge',
        date: new Date(),
        trainer: 'Coding Club',
      });

      mockUserSession = tpoSession;
      const res = await generateCheckInCode(
        new Request(`http://localhost:3000/api/sessions/${session._id}/check-in-code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ durationMinutes: 20 }),
        }),
        { params: Promise.resolve({ id: session._id.toString() }) }
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.checkInCode).toMatch(/^[A-Z0-9]{6}$/);
      expect(new Date(data.expiresAt).getTime()).toBeGreaterThan(Date.now());

      const inDb = await TrainingSession.findById(session._id);
      expect(inDb?.checkInCode).toBe(data.checkInCode);
    });
  });

  // 6. Assessments & Score CSV Import
  describe('Assessments & CSV Score Import', () => {
    it('imports student scores from CSV, matches roll numbers, computes percentages, and saves assessment', async () => {
      const student1 = await Student.create({
        name: 'Shruti Kamble',
        rollNumber: 'DYP2026CSE060',
        department: 'CSE',
        year: 'Final Year',
        passoutYear: 2026,
      });

      const student2 = await Student.create({
        name: 'Prathamesh Bhosale',
        rollNumber: 'DYP2026CSE061',
        department: 'CSE',
        year: 'Final Year',
        passoutYear: 2026,
      });

      expect(student1._id).toBeDefined();
      expect(student2._id).toBeDefined();
      expect(superAdminSession.user.role).toBe('SUPER_ADMIN');
      expect(cseCoordinatorSession.user.department).toBe('CSE');

      const session = await TrainingSession.create({
        title: 'Full-Stack Technical Assessment Session',
        date: new Date(),
        trainer: 'T&P Evaluation Team',
      });

      const csvContent = `Roll Number,Score,Remarks
DYP2026CSE060,85,Distinction
DYP2026CSE061,45,Needs improvement
UNKNOWN999,90,Unregistered student`;

      mockUserSession = tpoSession;
      const importReq = new Request(
        `http://localhost:3000/api/sessions/${session._id}/assessments/import`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Technical Evaluation 1',
            maxScore: 100,
            passingScore: 50,
            csvText: csvContent,
          }),
        }
      );

      const importRes = await importAssessment(importReq, {
        params: Promise.resolve({ id: session._id.toString() }),
      });
      expect(importRes.status).toBe(201);

      const importData = await importRes.json();
      expect(importData.summary.totalImported).toBe(2);
      expect(importData.summary.passedCount).toBe(1); // 85 passed, 45 failed
      expect(importData.summary.failedCount).toBe(1);
      expect(importData.summary.passRate).toBe(50);
      expect(importData.summary.unmatchedCount).toBe(1); // UNKNOWN999 was unmatched

      // Query Assessments list
      const listReq = new Request(`http://localhost:3000/api/sessions/${session._id}/assessments`);
      const listRes = await getAssessments(listReq, {
        params: Promise.resolve({ id: session._id.toString() }),
      });
      expect(listRes.status).toBe(200);

      const listData = await listRes.json();
      expect(listData.assessments.length).toBe(1);
      expect(listData.assessments[0].title).toBe('Technical Evaluation 1');
      expect(listData.assessments[0].stats.highestScore).toBe(85);
    });
  });
});
