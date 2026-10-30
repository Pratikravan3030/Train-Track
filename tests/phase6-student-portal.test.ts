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
import { GET as getStudentProfile, PUT as updateStudentProfile } from '@/app/api/student/profile/route';
import { POST as uploadResume } from '@/app/api/student/resume/route';
import { POST as uploadPhoto } from '@/app/api/student/photo/route';
import { GET as getStudentDrives } from '@/app/api/student/drives/route';
import { POST as applyToDrive } from '@/app/api/student/drives/[id]/apply/route';
import { POST as withdrawFromDrive } from '@/app/api/student/drives/[id]/withdraw/route';
import { GET as getStudentSessions } from '@/app/api/student/sessions/route';
import { POST as checkInSession } from '@/app/api/student/sessions/[id]/check-in/route';
import { POST as submitFeedback } from '@/app/api/student/sessions/[id]/feedback/route';
import { GET as getStudentNotices } from '@/app/api/student/notices/route';
import {
  GET as getNotifications,
  PATCH as markAllNotificationsRead,
} from '@/app/api/student/notifications/route';
import { POST as markNotificationRead } from '@/app/api/student/notifications/[id]/read/route';

// Staff routes to verify student denial
import { GET as getStaffStudents } from '@/app/api/students/route';

// Models
import User, { IUser } from '@/models/User';
import Student, { IStudent } from '@/models/Student';
import Drive, { IDrive } from '@/models/Drive';
import Company, { ICompany } from '@/models/Company';
import Application from '@/models/Application';
import TrainingSession, { ITrainingSession } from '@/models/TrainingSession';
import Attendance from '@/models/Attendance';
import Notice from '@/models/Notice';
import Notification, { INotification } from '@/models/Notification';

describe('Phase 6: Student Self-Service Portal & Feature Flag Isolation', () => {
  let mongoServer: MongoMemoryServer;

  let studentAUser: IUser;
  let studentBUser: IUser;
  let studentASession: { user: AuthContext };
  let studentBSession: { user: AuthContext };

  let studentARecord: IStudent;
  let studentBRecord: IStudent;

  let testCompany: ICompany;
  let activeDrive: IDrive;
  let expiredDrive: IDrive;
  let testSession: ITrainingSession;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    process.env.MONGODB_URI = uri;
    await mongoose.connect(uri);

    // Create Students
    studentARecord = await Student.create({
      name: 'Rohan Patil',
      email: 'rohan.patil@dypcet.ac.in',
      rollNumber: 'DYP2026CSE001',
      department: 'CSE',
      year: '4th Year',
      passoutYear: 2026,
      cgpa: 8.5,
      backlogs: 0,
      placementStatus: 'Not Placed',
    });

    studentBRecord = await Student.create({
      name: 'Snehal Shinde',
      email: 'snehal.shinde@dypcet.ac.in',
      rollNumber: 'DYP2026ME001',
      department: 'ME',
      year: '4th Year',
      passoutYear: 2026,
      cgpa: 6.2,
      backlogs: 2,
      placementStatus: 'Not Placed',
    });

    // Create User Accounts for Students
    studentAUser = await User.create({
      name: 'Rohan Patil',
      email: 'rohan.patil@dypcet.ac.in',
      role: 'STUDENT',
      studentId: studentARecord._id,
      password: 'password123',
      isActive: true,
      tokenVersion: 1,
    });

    studentBUser = await User.create({
      name: 'Snehal Shinde',
      email: 'snehal.shinde@dypcet.ac.in',
      role: 'STUDENT',
      studentId: studentBRecord._id,
      password: 'password123',
      isActive: true,
      tokenVersion: 1,
    });

    studentASession = {
      user: {
        id: studentAUser._id.toString(),
        name: studentAUser.name,
        email: studentAUser.email,
        role: 'STUDENT',
        studentId: studentARecord._id.toString(),
        tokenVersion: 1,
      },
    };

    studentBSession = {
      user: {
        id: studentBUser._id.toString(),
        name: studentBUser.name,
        email: studentBUser.email,
        role: 'STUDENT',
        studentId: studentBRecord._id.toString(),
        tokenVersion: 1,
      },
    };

    // Create Company
    testCompany = await Company.create({
      name: 'TCS Digital',
      normalizedName: 'tcs digital',
      sector: 'IT Services',
      website: 'https://tcs.com',
    });

    // Create Drives: one active, one expired deadline
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 2);

    activeDrive = await Drive.create({
      company: testCompany._id,
      role: 'Software Engineer',
      type: 'Full-time',
      jd: 'Full stack development role',
      location: 'Pune / Kolhapur',
      mode: 'On-Campus',
      ctcLpa: 7.0,
      registrationDeadline: futureDate,
      driveDate: futureDate,
      selectionRounds: ['Aptitude', 'Technical', 'HR'],
      eligibilityRules: {
        minCgpa: 7.0,
        maxBacklogs: 0,
        allowedDepartments: ['CSE', 'IT'],
        allowedBatches: [2026],
      },
      status: 'Open',
    });

    expiredDrive = await Drive.create({
      company: testCompany._id,
      role: 'Developer Intern',
      type: 'Internship',
      jd: 'Summer internship',
      location: 'Kolhapur',
      mode: 'On-Campus',
      ctcLpa: 4.5,
      registrationDeadline: pastDate,
      driveDate: pastDate,
      selectionRounds: ['Interview'],
      eligibilityRules: {
        minCgpa: 6.0,
        maxBacklogs: 1,
        allowedDepartments: ['CSE', 'IT', 'ME'],
        allowedBatches: [2026],
      },
      status: 'Open',
    });

    // Create Training Session with active check-in code
    const expiryTime = new Date();
    expiryTime.setMinutes(expiryTime.getMinutes() + 15);

    testSession = await TrainingSession.create({
      title: 'Full Stack Web Development Workshop',
      trainer: 'Er. Rajesh Kumar',
      category: 'Technical',
      date: new Date(),
      targetDepartments: ['CSE', 'IT'],
      targetBatches: [2026],
      checkInCode: 'TRN2026',
      checkInCodeExpiresAt: expiryTime,
    });
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  }, 60000);

  beforeEach(() => {
    mockUserSession = null;
    process.env.STUDENT_PORTAL_ENABLED = 'false';
  });

  describe('1. Feature Flag Isolation (STUDENT_PORTAL_ENABLED)', () => {
    it('returns 403 Forbidden for all student endpoints when STUDENT_PORTAL_ENABLED is false', async () => {
      process.env.STUDENT_PORTAL_ENABLED = 'false';
      mockUserSession = studentASession;

      const profileRes = await getStudentProfile();
      expect(profileRes.status).toBe(403);
      const profileData = await profileRes.json();
      expect(profileData.error).toContain('Student portal is currently disabled');

      const drivesRes = await getStudentDrives();
      expect(drivesRes.status).toBe(403);

      const sessionsRes = await getStudentSessions();
      expect(sessionsRes.status).toBe(403);

      const noticesRes = await getStudentNotices();
      expect(noticesRes.status).toBe(403);

      const notificationsRes = await getNotifications();
      expect(notificationsRes.status).toBe(403);
    });

    it('denies student access to staff directory endpoints (RBAC Default-Deny)', async () => {
      process.env.STUDENT_PORTAL_ENABLED = 'true';
      mockUserSession = studentASession;

      const req = new Request('http://localhost:3000/api/students');
      const res = await getStaffStudents(req);
      expect(res.status).toBe(403);
    });
  });

  describe('2. Student Profile & Tamper Protection', () => {
    beforeEach(() => {
      process.env.STUDENT_PORTAL_ENABLED = 'true';
      mockUserSession = studentASession;
    });

    it('returns own student profile with completeness metrics', async () => {
      const res = await getStudentProfile();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.student.name).toBe('Rohan Patil');
      expect(data.student.rollNumber).toBe('DYP2026CSE001');
      expect(data.completeness).toBeDefined();
      expect(data.completeness.percentage).toBeGreaterThanOrEqual(0);
    });

    it('permits self-update of non-authoritative fields (skills, division, projects)', async () => {
      const updateReq = new Request('http://localhost:3000/api/student/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          division: 'A',
          skills: ['TypeScript', 'Next.js', 'MongoDB'],
          socialLinks: {
            github: 'https://github.com/rohanpatil',
          },
        }),
      });

      const res = await updateStudentProfile(updateReq);
      expect(res.status).toBe(200);

      const updatedStudent = await Student.findById(studentARecord._id);
      expect(updatedStudent?.division).toBe('A');
      expect(updatedStudent?.skills).toEqual(['TypeScript', 'Next.js', 'MongoDB']);
      expect(updatedStudent?.socialLinks?.github).toBe('https://github.com/rohanpatil');
    });

    it('rejects student tampering with academic authority fields (CGPA, backlogs, department, placementStatus)', async () => {
      const tamperReq = new Request('http://localhost:3000/api/student/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cgpa: 10.0,
          placementStatus: 'Placed',
        }),
      });

      const res = await updateStudentProfile(tamperReq);
      expect(res.status).toBe(400);

      const currentStudent = await Student.findById(studentARecord._id);
      expect(currentStudent?.cgpa).toBe(8.5);
      expect(currentStudent?.placementStatus).toBe('Not Placed');
    });

    it('validates and accepts resume PDF upload within 2MB limit', async () => {
      const pdfHeader = Buffer.from('%PDF-1.4 sample valid pdf content');
      const req = new Request('http://localhost:3000/api/student/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/pdf' },
        body: pdfHeader,
      });

      const res = await uploadResume(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.resumeUrl).toBeDefined();

      const studentInDb = await Student.findById(studentARecord._id);
      expect(studentInDb?.resumeUrl).toBe(data.resumeUrl);
    });

    it('rejects invalid non-PDF resume uploads', async () => {
      const fakeHeader = Buffer.from('NOT A PDF FILE');
      const req = new Request('http://localhost:3000/api/student/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/pdf' },
        body: fakeHeader,
      });

      const res = await uploadResume(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Only valid PDF files are permitted');
    });

    it('validates and accepts photo upload (JPEG magic bytes)', async () => {
      // JPEG magic bytes: FF D8 FF
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
      const req = new Request('http://localhost:3000/api/student/photo', {
        method: 'POST',
        headers: { 'Content-Type': 'image/jpeg' },
        body: jpegBuffer,
      });

      const res = await uploadPhoto(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.photoUrl).toBeDefined();
    });
  });

  describe('3. Placement Drives Application & Withdrawal (IST Deadlines)', () => {
    beforeEach(() => {
      process.env.STUDENT_PORTAL_ENABLED = 'true';
    });

    it('lists drives with accurate eligibility assessment for the calling student', async () => {
      mockUserSession = studentASession;
      const res = await getStudentDrives();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.drives).toBeDefined();

      const tcsDrive = data.drives.find(
        (d: { _id: string }) => d._id.toString() === activeDrive._id.toString()
      );
      expect(tcsDrive).toBeDefined();
      expect(tcsDrive.isEligible).toBe(true);
      expect(tcsDrive.canApply).toBe(true);
    });

    it('marks student ineligible when department or academic cutoffs are not met', async () => {
      mockUserSession = studentBSession; // ME department, 6.2 CGPA, 2 backlogs
      const res = await getStudentDrives();
      const data = await res.json();

      const tcsDrive = data.drives.find(
        (d: { _id: string }) => d._id.toString() === activeDrive._id.toString()
      );
      expect(tcsDrive.isEligible).toBe(false);
      expect(tcsDrive.canApply).toBe(false);
      expect(tcsDrive.reasonsIneligible.length).toBeGreaterThan(0);
    });

    it('allows eligible student to apply before deadline and creates notification', async () => {
      mockUserSession = studentASession;
      const req = new Request(`http://localhost:3000/api/student/drives/${activeDrive._id}/apply`, {
        method: 'POST',
      });
      const res = await applyToDrive(req, {
        params: Promise.resolve({ id: activeDrive._id.toString() }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.application.status).toBe('Applied');

      // Verify notification created for student
      const notification = await Notification.findOne({
        userId: studentAUser._id,
        type: 'drive',
      });
      expect(notification).toBeDefined();
      expect(notification?.title).toBe('Application Submitted');
    });

    it('prevents duplicate application submission', async () => {
      mockUserSession = studentASession;
      const req = new Request(`http://localhost:3000/api/student/drives/${activeDrive._id}/apply`, {
        method: 'POST',
      });
      const res = await applyToDrive(req, {
        params: Promise.resolve({ id: activeDrive._id.toString() }),
      });

      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toContain('already applied');
    });

    it('rejects application if IST deadline has passed', async () => {
      mockUserSession = studentASession;
      const req = new Request(`http://localhost:3000/api/student/drives/${expiredDrive._id}/apply`, {
        method: 'POST',
      });
      const res = await applyToDrive(req, {
        params: Promise.resolve({ id: expiredDrive._id.toString() }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Application deadline has passed');
    });

    it('allows student to withdraw application before deadline', async () => {
      mockUserSession = studentASession;
      const req = new Request(`http://localhost:3000/api/student/drives/${activeDrive._id}/withdraw`, {
        method: 'POST',
      });
      const res = await withdrawFromDrive(req, {
        params: Promise.resolve({ id: activeDrive._id.toString() }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.application.status).toBe('Withdrawn');

      const appInDb = await Application.findOne({
        drive: activeDrive._id,
        student: studentARecord._id,
      });
      expect(appInDb?.status).toBe('Withdrawn');
    });
  });

  describe('4. Training Check-In (Zero Geolocation) & One Feedback Rule', () => {
    beforeEach(() => {
      process.env.STUDENT_PORTAL_ENABLED = 'true';
      mockUserSession = studentASession;
    });

    it('allows student to check in with valid time-limited code (zero geolocation collected)', async () => {
      const req = new Request(`http://localhost:3000/api/student/sessions/${testSession._id}/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'TRN2026' }),
      });

      const res = await checkInSession(req, {
        params: Promise.resolve({ id: testSession._id.toString() }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      const attendance = await Attendance.findOne({
        sessionId: testSession._id,
        studentId: studentARecord._id,
      });
      expect(attendance).toBeDefined();
      expect(attendance?.present).toBe(true);
      expect(attendance?.status).toBe('Present');
    });

    it('rejects check-in with invalid code', async () => {
      const req = new Request(`http://localhost:3000/api/student/sessions/${testSession._id}/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'WRONG_CODE' }),
      });

      const res = await checkInSession(req, {
        params: Promise.resolve({ id: testSession._id.toString() }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Invalid check-in code');
    });

    it('allows attended student to submit rating and comment feedback', async () => {
      const req = new Request(`http://localhost:3000/api/student/sessions/${testSession._id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: 5,
          comment: 'Outstanding workshop with practical hands-on examples.',
        }),
      });

      const res = await submitFeedback(req, {
        params: Promise.resolve({ id: testSession._id.toString() }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.feedback.rating).toBe(5);
    });

    it('strictly enforces ONE feedback per student per attended session (rejects duplicate)', async () => {
      const duplicateReq = new Request(`http://localhost:3000/api/student/sessions/${testSession._id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: 4,
          comment: 'Second feedback attempt.',
        }),
      });

      const res = await submitFeedback(duplicateReq, {
        params: Promise.resolve({ id: testSession._id.toString() }),
      });

      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toContain('already submitted feedback');
    });

    it('rejects feedback from students who did not attend the session', async () => {
      mockUserSession = studentBSession; // Student B has NOT attended

      const req = new Request(`http://localhost:3000/api/student/sessions/${testSession._id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: 5,
          comment: 'Feedback without attendance',
        }),
      });

      const res = await submitFeedback(req, {
        params: Promise.resolve({ id: testSession._id.toString() }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Feedback can only be submitted for sessions you have attended');
    });
  });

  describe('5. Notices and In-App Notifications', () => {
    let studentNotification: INotification;

    beforeAll(async () => {
      await Notice.create({
        title: 'Campus Recruitment Schedule 2026',
        content: 'Please find the upcoming drive timetable attached.',
        targetDepartments: ['CSE', 'IT'],
        targetBatches: [2026],
        isPinned: true,
      });

      studentNotification = await Notification.create({
        userId: studentAUser._id,
        studentId: studentARecord._id,
        title: 'System Alert',
        message: 'Your profile has been created successfully.',
        type: 'system',
        read: false,
      });
    });

    beforeEach(() => {
      process.env.STUDENT_PORTAL_ENABLED = 'true';
      mockUserSession = studentASession;
    });

    it('delivers notices targeted to student department and batch', async () => {
      const res = await getStudentNotices();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.notices).toBeDefined();
      expect(data.notices.length).toBeGreaterThan(0);
      expect(data.notices[0].title).toBe('Campus Recruitment Schedule 2026');
    });

    it('fetches unread in-app notifications', async () => {
      const res = await getNotifications();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.unreadCount).toBeGreaterThan(0);
      expect(
        data.notifications.some(
          (n: { _id: string }) => n._id.toString() === studentNotification._id.toString()
        )
      ).toBe(true);
    });

    it('marks a single notification as read', async () => {
      const req = new Request(`http://localhost:3000/api/student/notifications/${studentNotification._id}/read`, {
        method: 'POST',
      });
      const res = await markNotificationRead(req, {
        params: Promise.resolve({ id: studentNotification._id.toString() }),
      });

      expect(res.status).toBe(200);
      const notifInDb = await Notification.findById(studentNotification._id);
      expect(notifInDb?.read).toBe(true);
    });

    it('marks all notifications as read for current user', async () => {
      const res = await markAllNotificationsRead();
      expect(res.status).toBe(200);

      const checkRes = await getNotifications();
      const data = await checkRes.json();
      expect(data.unreadCount).toBe(0);
    });
  });
});
