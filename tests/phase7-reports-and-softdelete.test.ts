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
import { DELETE as deleteStudent } from '@/app/api/students/[id]/route';
import { POST as restoreStudent } from '@/app/api/students/[id]/restore/route';
import { GET as getStudents } from '@/app/api/students/route';

import { DELETE as deleteSession } from '@/app/api/sessions/[id]/route';
import { POST as restoreSession } from '@/app/api/sessions/[id]/restore/route';

import { DELETE as deleteCompany } from '@/app/api/companies/[id]/route';
import { POST as restoreCompany } from '@/app/api/companies/[id]/restore/route';

import { DELETE as deleteDrive } from '@/app/api/drives/[id]/route';
import { POST as restoreDrive } from '@/app/api/drives/[id]/restore/route';

import { GET as getAuditLogs } from '@/app/api/admin/audit-logs/route';
import { GET as getPlacementReport } from '@/app/api/reports/placement/route';
import { GET as getTrainingReport } from '@/app/api/reports/training/route';

// Models
import User from '@/models/User';
import Student from '@/models/Student';
import TrainingSession from '@/models/TrainingSession';
import Company from '@/models/Company';
import Drive from '@/models/Drive';
import Offer from '@/models/Offer';
import Attendance from '@/models/Attendance';
import Feedback from '@/models/Feedback';
import AuditLog from '@/models/AuditLog';

describe('Phase 7: Soft Delete, Restore, Audit Log Viewer, and Reports & Exports', () => {
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
      email: 'superadmin@dypcet.ac.in',
      role: 'SUPER_ADMIN',
      password: 'password123',
      isActive: true,
      tokenVersion: 1,
    });

    const tpoUser = await User.create({
      name: 'TPO Officer',
      email: 'tpo@dypcet.ac.in',
      role: 'TPO',
      password: 'password123',
      isActive: true,
      tokenVersion: 1,
    });

    const cseCoordUser = await User.create({
      name: 'CSE Coordinator',
      email: 'cse.coord@dypcet.ac.in',
      role: 'DEPT_COORDINATOR',
      department: 'CSE',
      password: 'password123',
      isActive: true,
      tokenVersion: 1,
    });

    const meCoordUser = await User.create({
      name: 'ME Coordinator',
      email: 'me.coord@dypcet.ac.in',
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
        id: cseCoordUser._id.toString(),
        name: cseCoordUser.name,
        email: cseCoordUser.email,
        role: 'DEPT_COORDINATOR',
        department: 'CSE',
        tokenVersion: 1,
      },
    };

    meCoordinatorSession = {
      user: {
        id: meCoordUser._id.toString(),
        name: meCoordUser.name,
        email: meCoordUser.email,
        role: 'DEPT_COORDINATOR',
        department: 'ME',
        tokenVersion: 1,
      },
    };
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Student.deleteMany({});
    await TrainingSession.deleteMany({});
    await Company.deleteMany({});
    await Drive.deleteMany({});
    await Offer.deleteMany({});
    await Attendance.deleteMany({});
    await Feedback.deleteMany({});
    await AuditLog.deleteMany({});
  });

  // 1. Soft Delete & Restore Tests
  describe('Soft Delete & Restore Implementation', () => {
    it('soft deletes a student, excludes from queries, and allows SUPER_ADMIN restore only', async () => {
      const student = await Student.create({
        name: 'Rohan Sharma',
        rollNumber: 'DYP2026CSE001',
        department: 'CSE',
        year: 'Final Year',
        passoutYear: 2026,
        placementStatus: 'Not Placed',
      });

      // TPO deletes student
      mockUserSession = tpoSession;
      const delReq = new Request(`http://localhost:3000/api/students/${student._id}`, {
        method: 'DELETE',
      });
      const delRes = await deleteStudent(delReq, { params: Promise.resolve({ id: student._id.toString() }) });
      expect(delRes.status).toBe(200);

      // Verify student is marked as isDeleted, not removed from DB
      const rawInDb = await Student.findOne({ _id: student._id, isDeleted: true });
      expect(rawInDb).not.toBeNull();
      expect(rawInDb?.isDeleted).toBe(true);
      expect(rawInDb?.deletedBy?.toString()).toBe(tpoSession.user.id);

      // Verify default Student.find excludes soft-deleted
      const foundDefault = await Student.findById(student._id);
      expect(foundDefault).toBeNull();

      // Verify GET /api/students does not return the deleted student
      const listReq = new Request('http://localhost:3000/api/students?batch=2026');
      const listRes = await getStudents(listReq);
      const listData = await listRes.json();
      expect(listData.data.length).toBe(0);

      // TPO attempts to restore -> 403 Forbidden
      const tpoRestoreReq = new Request(`http://localhost:3000/api/students/${student._id}/restore`, {
        method: 'POST',
      });
      const tpoRestoreRes = await restoreStudent(tpoRestoreReq, {
        params: Promise.resolve({ id: student._id.toString() }),
      });
      expect(tpoRestoreRes.status).toBe(403);

      // SUPER_ADMIN restores student -> 200 OK
      mockUserSession = superAdminSession;
      const adminRestoreReq = new Request(`http://localhost:3000/api/students/${student._id}/restore`, {
        method: 'POST',
      });
      const adminRestoreRes = await restoreStudent(adminRestoreReq, {
        params: Promise.resolve({ id: student._id.toString() }),
      });
      expect(adminRestoreRes.status).toBe(200);

      const restoredStudent = await Student.findById(student._id);
      expect(restoredStudent).not.toBeNull();
      expect(restoredStudent?.isDeleted).toBe(false);
      expect(restoredStudent?.deletedAt).toBeNull();
    });

    it('soft deletes a training session and restores successfully', async () => {
      const session = await TrainingSession.create({
        title: 'Full Stack Web Architecture',
        date: new Date('2026-03-15'),
        trainer: 'Industry Expert',
        description: 'Next.js and Node.js masterclass',
      });

      mockUserSession = tpoSession;
      const delReq = new Request(`http://localhost:3000/api/sessions/${session._id}`, {
        method: 'DELETE',
      });
      const delRes = await deleteSession(delReq, { params: Promise.resolve({ id: session._id.toString() }) });
      expect(delRes.status).toBe(200);

      // Verify session is soft-deleted
      const foundDefault = await TrainingSession.findById(session._id);
      expect(foundDefault).toBeNull();

      // SUPER_ADMIN restores
      mockUserSession = superAdminSession;
      const restoreReq = new Request(`http://localhost:3000/api/sessions/${session._id}/restore`, {
        method: 'POST',
      });
      const restoreRes = await restoreSession(restoreReq, {
        params: Promise.resolve({ id: session._id.toString() }),
      });
      expect(restoreRes.status).toBe(200);

      const restoredSession = await TrainingSession.findById(session._id);
      expect(restoredSession).not.toBeNull();
      expect(restoredSession?.isDeleted).toBe(false);
    });

    it('soft deletes a company and restores successfully', async () => {
      const company = await Company.create({
        name: 'Persistent Systems',
        sector: 'Information Technology',
      });

      mockUserSession = tpoSession;
      const delReq = new Request(`http://localhost:3000/api/companies/${company._id}`, {
        method: 'DELETE',
      });
      const delRes = await deleteCompany(delReq, { params: Promise.resolve({ id: company._id.toString() }) });
      expect(delRes.status).toBe(200);

      const foundDefault = await Company.findById(company._id);
      expect(foundDefault).toBeNull();

      mockUserSession = superAdminSession;
      const restoreReq = new Request(`http://localhost:3000/api/companies/${company._id}/restore`, {
        method: 'POST',
      });
      const restoreRes = await restoreCompany(restoreReq, {
        params: Promise.resolve({ id: company._id.toString() }),
      });
      expect(restoreRes.status).toBe(200);

      const restoredCompany = await Company.findById(company._id);
      expect(restoredCompany).not.toBeNull();
      expect(restoredCompany?.isDeleted).toBe(false);
    });

    it('soft deletes a drive without applications and restores successfully', async () => {
      const company = await Company.create({
        name: 'TCS Digital',
        sector: 'IT',
      });

      const drive = await Drive.create({
        company: company._id,
        role: 'Digital Specialist Engineer',
        type: 'Full-time',
        jd: 'Full-stack engineering role',
        location: 'Pune',
        driveDate: new Date('2026-04-20'),
        registrationDeadline: new Date('2026-04-15'),
      });

      mockUserSession = tpoSession;
      const delReq = new Request(`http://localhost:3000/api/drives/${drive._id}`, {
        method: 'DELETE',
      });
      const delRes = await deleteDrive(delReq, { params: Promise.resolve({ id: drive._id.toString() }) });
      expect(delRes.status).toBe(200);

      const foundDefault = await Drive.findById(drive._id);
      expect(foundDefault).toBeNull();

      mockUserSession = superAdminSession;
      const restoreReq = new Request(`http://localhost:3000/api/drives/${drive._id}/restore`, {
        method: 'POST',
      });
      const restoreRes = await restoreDrive(restoreReq, {
        params: Promise.resolve({ id: drive._id.toString() }),
      });
      expect(restoreRes.status).toBe(200);

      const restoredDrive = await Drive.findById(drive._id);
      expect(restoredDrive).not.toBeNull();
      expect(restoredDrive?.isDeleted).toBe(false);
    });
  });

  // 2. Audit Log Viewer Tests
  describe('Audit Log Viewer Route', () => {
    it('guards audit log endpoint against non-SUPER_ADMIN and returns paginated logs for SUPER_ADMIN', async () => {
      await AuditLog.create([
        { action: 'CREATE_STUDENT', resource: 'Student', userEmail: 'tpo@dypcet.ac.in', userRole: 'TPO' },
        { action: 'ACCEPT_OFFER', resource: 'Offer', userEmail: 'tpo@dypcet.ac.in', userRole: 'TPO' },
        { action: 'LOGIN', resource: 'Auth', userEmail: 'superadmin@dypcet.ac.in', userRole: 'SUPER_ADMIN' },
      ]);

      // TPO attempts to access -> 403 Forbidden
      mockUserSession = tpoSession;
      const tpoReq = new Request('http://localhost:3000/api/admin/audit-logs');
      const tpoRes = await getAuditLogs(tpoReq);
      expect(tpoRes.status).toBe(403);

      // Coordinator attempts to access -> 403 Forbidden
      mockUserSession = cseCoordinatorSession;
      const coordReq = new Request('http://localhost:3000/api/admin/audit-logs');
      const coordRes = await getAuditLogs(coordReq);
      expect(coordRes.status).toBe(403);

      // SUPER_ADMIN accesses -> 200 OK with pagination
      mockUserSession = superAdminSession;
      const adminReq = new Request('http://localhost:3000/api/admin/audit-logs?limit=2&page=1');
      const adminRes = await getAuditLogs(adminReq);
      expect(adminRes.status).toBe(200);

      const data = await adminRes.json();
      expect(data.logs.length).toBe(2);
      expect(data.pagination.total).toBe(3);
      expect(data.pagination.totalPages).toBe(2);

      // Filter by action
      const filterReq = new Request('http://localhost:3000/api/admin/audit-logs?action=ACCEPT_OFFER');
      const filterRes = await getAuditLogs(filterReq);
      const filterData = await filterRes.json();
      expect(filterData.logs.length).toBe(1);
      expect(filterData.logs[0].action).toBe('ACCEPT_OFFER');
    });
  });

  // 3. Placement Reports & Export Tests
  describe('Placement Reports & Exports', () => {
    it('calculates placement statistics, enforces department isolation, and escapes formulas in CSV/Excel', async () => {
      const company = await Company.create({ name: 'Infosys Ltd', sector: 'IT' });

      // Create students
      const s1 = await Student.create({
        name: 'Aarav Patil',
        rollNumber: 'DYP2026CSE010',
        department: 'CSE',
        year: 'Final Year',
        passoutYear: 2026,
        placementStatus: 'Placed',
      });

      const s2 = await Student.create({
        name: '=HYPERLINK("http://attacker.com")', // formula injection test case
        rollNumber: 'DYP2026CSE011',
        department: 'CSE',
        year: 'Final Year',
        passoutYear: 2026,
        placementStatus: 'Placed',
      });

      await Student.create({
        name: 'Neha Kulkarni',
        rollNumber: 'DYP2026ME005',
        department: 'ME',
        year: 'Final Year',
        passoutYear: 2026,
        placementStatus: 'Not Placed',
      });

      // Offers
      await Offer.create({
        student: s1._id,
        company: company._id,
        companyName: company.name,
        role: 'Software Engineer',
        type: 'Full-time',
        status: 'Accepted',
        ctcLpa: 9.5,
        source: 'Campus Drive',
        tier: 'Dream',
      });

      await Offer.create({
        student: s2._id,
        company: company._id,
        companyName: company.name,
        role: 'System Analyst',
        type: 'Full-time',
        status: 'Accepted',
        ctcLpa: 6.5,
        source: 'Campus Drive',
        tier: 'Regular',
      });

      // TPO queries placement report JSON
      mockUserSession = tpoSession;
      const tpoReq = new Request('http://localhost:3000/api/reports/placement?batch=2026');
      const tpoRes = await getPlacementReport(tpoReq);
      expect(tpoRes.status).toBe(200);

      const report = await tpoRes.json();
      expect(report.summary.totalStudents).toBe(3);
      expect(report.summary.placedStudentsCount).toBe(2);
      expect(report.summary.highestPackageLPA).toBe(9.5);
      expect(report.summary.avgPackageLPA).toBe(8); // (9.5 + 6.5) / 2 = 8.0
      expect(report.summary.medianPackageLPA).toBe(8);

      // CSE Coordinator queries placement report -> scoped to CSE (2 students)
      mockUserSession = cseCoordinatorSession;
      const cseReq = new Request('http://localhost:3000/api/reports/placement?batch=2026');
      const cseRes = await getPlacementReport(cseReq);
      expect(cseRes.status).toBe(200);

      const cseReport = await cseRes.json();
      expect(cseReport.summary.totalStudents).toBe(2);
      expect(cseReport.summary.placedStudentsCount).toBe(2);
      expect(cseReport.summary.placementRate).toBe(100);

      // ME Coordinator queries placement report -> scoped to ME (1 student, 0 placed)
      mockUserSession = meCoordinatorSession;
      const meReq = new Request('http://localhost:3000/api/reports/placement?batch=2026');
      const meRes = await getPlacementReport(meReq);
      expect(meRes.status).toBe(200);
      const meReport = await meRes.json();
      expect(meReport.summary.totalStudents).toBe(1);
      expect(meReport.summary.placedStudentsCount).toBe(0);

      // CSE Coordinator attempts to query ME department -> 403 Forbidden
      const forbiddenReq = new Request('http://localhost:3000/api/reports/placement?batch=2026&department=ME');
      const forbiddenRes = await getPlacementReport(forbiddenReq);
      expect(forbiddenRes.status).toBe(403);

      // Formula injection test in CSV export
      mockUserSession = tpoSession;
      const csvReq = new Request('http://localhost:3000/api/reports/placement?batch=2026&format=csv');
      const csvRes = await getPlacementReport(csvReq);
      expect(csvRes.status).toBe(200);
      expect(csvRes.headers.get('Content-Type')).toContain('text/csv');

      const csvText = await csvRes.text();
      // Ensure the cell starting with = was sanitized to '=
      expect(csvText).toContain("'=HYPERLINK");

      // Excel export test
      const excelReq = new Request('http://localhost:3000/api/reports/placement?batch=2026&format=excel');
      const excelRes = await getPlacementReport(excelReq);
      expect(excelRes.status).toBe(200);
      expect(excelRes.headers.get('Content-Type')).toContain('openxmlformats');

      const buffer = await excelRes.arrayBuffer();
      expect(buffer.byteLength).toBeGreaterThan(1000); // Valid Excel file generated
    });
  });

  // 4. Training & Attendance Reports Tests
  describe('Training & Attendance Reports', () => {
    it('computes training metrics, detects defaulters (<75%), and exports CSV/Excel', async () => {
      const student1 = await Student.create({
        name: 'Aniket Jadhav',
        rollNumber: 'DYP2026CSE020',
        department: 'CSE',
        year: 'Final Year',
        passoutYear: 2026,
        placementStatus: 'Not Placed',
      });

      const student2 = await Student.create({
        name: 'Snehal More',
        rollNumber: 'DYP2026CSE021',
        department: 'CSE',
        year: 'Final Year',
        passoutYear: 2026,
        placementStatus: 'Not Placed',
      });

      const session1 = await TrainingSession.create({
        title: 'Aptitude Bootcamp Day 1',
        date: new Date('2026-02-10'),
        trainer: 'Trainer A',
      });

      const session2 = await TrainingSession.create({
        title: 'Aptitude Bootcamp Day 2',
        date: new Date('2026-02-11'),
        trainer: 'Trainer A',
      });

      // Student 1 attended both (100%)
      await Attendance.create({ sessionId: session1._id, studentId: student1._id, present: true });
      await Attendance.create({ sessionId: session2._id, studentId: student1._id, present: true });

      // Student 2 attended 1 of 2 (50% -> Defaulter)
      await Attendance.create({ sessionId: session1._id, studentId: student2._id, present: true });
      await Attendance.create({ sessionId: session2._id, studentId: student2._id, present: false });

      // Feedback from student 1
      await Feedback.create({
        sessionId: session1._id,
        studentId: student1._id,
        rating: 5,
        comments: 'Excellent training session',
      });

      mockUserSession = tpoSession;
      const reportReq = new Request('http://localhost:3000/api/reports/training?batch=2026');
      const reportRes = await getTrainingReport(reportReq);
      expect(reportRes.status).toBe(200);

      const report = await reportRes.json();
      expect(report.summary.totalSessions).toBe(2);
      expect(report.summary.totalStudentsEnrolled).toBe(2);
      expect(report.summary.defaultersCount).toBe(1); // Snehal More has 50%
      expect(report.summary.averageFeedbackRating).toBe(5);

      expect(report.defaultersList.length).toBe(1);
      expect(report.defaultersList[0].rollNumber).toBe('DYP2026CSE021');
      expect(report.defaultersList[0].attendanceRate).toBe(50);

      // CSV Export test
      const csvReq = new Request('http://localhost:3000/api/reports/training?batch=2026&format=csv');
      const csvRes = await getTrainingReport(csvReq);
      expect(csvRes.status).toBe(200);
      const csvText = await csvRes.text();
      expect(csvText).toContain('DYP2026CSE021');

      // Excel Export test
      const excelReq = new Request('http://localhost:3000/api/reports/training?batch=2026&format=excel');
      const excelRes = await getTrainingReport(excelReq);
      expect(excelRes.status).toBe(200);
      const excelBuf = await excelRes.arrayBuffer();
      expect(excelBuf.byteLength).toBeGreaterThan(1000);
    });
  });
});
