import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { AuthContext } from '@/lib/auth-guards';
import { parseCsv, serializeCsv } from '@/lib/csv';

// Session state control for NextAuth mock
let mockUserSession: { user: AuthContext } | null = null;

vi.mock('next-auth', () => ({
  default: vi.fn(),
  getServerSession: vi.fn(async () => mockUserSession),
}));

import { POST as previewImport } from '@/app/api/students/import/preview/route';
import { POST as executeImport } from '@/app/api/students/import/route';
import { GET as exportStudents } from '@/app/api/students/export/route';
import Student from '@/models/Student';
import User from '@/models/User';
import AuditLog from '@/models/AuditLog';

describe('Student CSV Import/Export & Duplicate Detection Tests', () => {
  let mongoServer: MongoMemoryServer;

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

  const tpoSession: { user: AuthContext } = {
    user: {
      id: adminId,
      name: 'TPO Officer',
      email: 'tpo@dypcet.edu',
      role: 'TPO',
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
      name: 'Student User',
      email: 'student@dypcet.edu',
      role: 'STUDENT',
    },
  };

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    process.env.MONGODB_URI = uri;
    process.env.NEXTAUTH_SECRET = 'secret_test_key_12345';
    await mongoose.connect(uri);

    // Seed users
    await User.create([
      {
        _id: new mongoose.Types.ObjectId(adminId),
        name: superAdminSession.user.name,
        email: superAdminSession.user.email,
        password: 'dummyhash',
        role: superAdminSession.user.role,
        isActive: true,
        tokenVersion: 1,
      },
      {
        _id: new mongoose.Types.ObjectId(coordCseId),
        name: coordinatorCseSession.user.name,
        email: coordinatorCseSession.user.email,
        password: 'dummyhash',
        role: coordinatorCseSession.user.role,
        department: coordinatorCseSession.user.department,
        isActive: true,
        tokenVersion: 1,
      },
      {
        _id: new mongoose.Types.ObjectId(coordMeId),
        name: coordinatorMeSession.user.name,
        email: coordinatorMeSession.user.email,
        password: 'dummyhash',
        role: coordinatorMeSession.user.role,
        department: coordinatorMeSession.user.department,
        isActive: true,
        tokenVersion: 1,
      },
      {
        _id: new mongoose.Types.ObjectId(studentUserId),
        name: studentSession.user.name,
        email: studentSession.user.email,
        password: 'dummyhash',
        role: studentSession.user.role,
        isActive: true,
        tokenVersion: 1,
      },
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Student.deleteMany({});
    await AuditLog.deleteMany({});
  });

  describe('1. CSV Parser & Serializer Unit Tests', () => {
    it('parses standard CSV text with headers into key-value records', () => {
      const csv = `Roll Number,Student Name,Department,Batch\nPRN001,Amit Patil,CSE,2026\nPRN002,Sneha Kulkarni,IT,2026`;
      const records = parseCsv(csv);
      expect(records).toHaveLength(2);
      expect(records[0]['Roll Number']).toBe('PRN001');
      expect(records[0]['Student Name']).toBe('Amit Patil');
      expect(records[1]['Department']).toBe('IT');
    });

    it('correctly handles quoted fields containing commas and quotes', () => {
      const csv = `"PRN,001","Patil, Amit ""Junior""",CSE\nPRN002,Sneha,IT`;
      const records = parseCsv(csv);
      expect(records[0]['"PRN,001"']).toBeUndefined(); // First row is header
      const rows = parseCsv(`Col1,Col2\n"A, B","He said ""Hello"""`);
      expect(rows[0]['Col1']).toBe('A, B');
      expect(rows[0]['Col2']).toBe('He said "Hello"');
    });

    it('serializes data records to RFC 4180 CSV escaping quotes and commas', () => {
      const headers = [
        { key: 'prn', label: 'PRN' },
        { key: 'name', label: 'Full Name' },
      ];
      const data = [
        { prn: 'PRN001', name: 'Patil, Amit' },
        { prn: 'PRN002', name: 'Sneha "S" Kulkarni' },
      ];
      const csv = serializeCsv(headers, data);
      expect(csv).toContain('"Patil, Amit"');
      expect(csv).toContain('"Sneha ""S"" Kulkarni"');
    });
  });

  describe('2. Import Preview & Duplicate PRN Detection', () => {
    it('flags in-file duplicate PRNs and reports row conflict clearly', async () => {
      mockUserSession = tpoSession;

      const csvContent = [
        'Roll Number,Student Name,Department,Batch,Email',
        'PRN-DUP-01,Student One,CSE,2026,s1@dypcet.edu',
        'PRN-DUP-02,Student Two,CSE,2026,s2@dypcet.edu',
        'PRN-DUP-01,Student One Duplicate,CSE,2026,s1dup@dypcet.edu', // Duplicate of row 2
      ].join('\n');

      const req = new Request('http://localhost:3000/api/students/import/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvContent, batch: 2026 }),
      });

      const res = await previewImport(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.totalRows).toBe(3);
      expect(json.validRows).toBe(2);
      expect(json.errorRows).toBe(1);
      expect(json.duplicateCount).toBe(1);

      const duplicateRow = json.rows[2];
      expect(duplicateRow.isDuplicate).toBe(true);
      expect(duplicateRow.duplicateType).toBe('file');
      expect(duplicateRow.duplicateDetails).toMatch(/Duplicate in file: PRN "PRN-DUP-01" appears multiple times/);
    });

    it('flags database duplicate PRNs clearly without silent merging', async () => {
      // Seed student into DB first
      await Student.create({
        name: 'Existing CSE Student',
        rollNumber: 'PRN-EXISTING-01',
        department: 'CSE',
        year: 'Final Year',
        passoutYear: 2026,
        email: 'existing@dypcet.edu',
      });

      mockUserSession = tpoSession;

      const csvContent = [
        'Roll Number,Student Name,Department,Batch,Email',
        'PRN-EXISTING-01,Import Attempt Student,CSE,2026,newattempt@dypcet.edu',
        'PRN-NEW-01,Brand New Student,CSE,2026,new@dypcet.edu',
      ].join('\n');

      const req = new Request('http://localhost:3000/api/students/import/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvContent, batch: 2026 }),
      });

      const res = await previewImport(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.totalRows).toBe(2);
      expect(json.validRows).toBe(1);
      expect(json.errorRows).toBe(1);
      expect(json.duplicateCount).toBe(1);

      const dbConflictRow = json.rows[0];
      expect(dbConflictRow.isDuplicate).toBe(true);
      expect(dbConflictRow.duplicateType).toBe('database');
      expect(dbConflictRow.duplicateDetails).toMatch(/Duplicate in database: Student with PRN "PRN-EXISTING-01" already exists/);
    });

    it('flags department violations when coordinator uploads rows for other departments', async () => {
      mockUserSession = coordinatorCseSession; // CSE Coordinator

      const csvContent = [
        'Roll Number,Student Name,Department,Batch,Email',
        'PRN-CSE-01,CSE Student,Computer Science & Engineering,2026,cse@dypcet.edu',
        'PRN-ME-01,ME Student,Mechanical Engineering,2026,me@dypcet.edu',
      ].join('\n');

      const req = new Request('http://localhost:3000/api/students/import/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvContent, batch: 2026 }),
      });

      const res = await previewImport(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.rows[0].isValid).toBe(true);
      expect(json.rows[1].isValid).toBe(false);
      expect(json.rows[1].errors[0]).toMatch(/As CSE Coordinator, you cannot import students for department "ME"/);
    });
  });

  describe('3. Import Execution & Insertion Safeguards', () => {
    it('REJECTS import execution (409 Conflict) if duplicate PRNs exist in the payload', async () => {
      mockUserSession = tpoSession;

      const req = new Request('http://localhost:3000/api/students/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch: 2026,
          students: [
            {
              name: 'Student A',
              rollNumber: 'PRN-DUP-EXEC',
              department: 'CSE',
              year: 'Final Year',
              passoutYear: 2026,
              email: 'a@dypcet.edu',
            },
            {
              name: 'Student B',
              rollNumber: 'PRN-DUP-EXEC',
              department: 'CSE',
              year: 'Final Year',
              passoutYear: 2026,
              email: 'b@dypcet.edu',
            },
          ],
        }),
      });

      const res = await executeImport(req);
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error).toMatch(/duplicate PRN\/Roll Number conflicts/);
    });

    it('REJECTS import execution (409 Conflict) if a PRN already exists in database', async () => {
      await Student.create({
        name: 'In Database',
        rollNumber: 'PRN-IN-DB',
        department: 'CSE',
        year: 'Final Year',
        passoutYear: 2026,
        email: 'indb@dypcet.edu',
      });

      mockUserSession = tpoSession;

      const req = new Request('http://localhost:3000/api/students/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch: 2026,
          students: [
            {
              name: 'Trying To Overwrite',
              rollNumber: 'PRN-IN-DB',
              department: 'CSE',
              year: 'Final Year',
              passoutYear: 2026,
              email: 'overwrite@dypcet.edu',
            },
          ],
        }),
      });

      const res = await executeImport(req);
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error).toMatch(/duplicate PRN\/Roll Number conflicts/);
    });

    it('DENIES coordinator from importing students into a foreign department (403)', async () => {
      mockUserSession = coordinatorCseSession; // CSE Coordinator

      const req = new Request('http://localhost:3000/api/students/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch: 2026,
          students: [
            {
              name: 'Mechanical Student',
              rollNumber: 'PRN-FORBIDDEN-01',
              department: 'ME',
              year: 'Final Year',
              passoutYear: 2026,
              email: 'me.student@dypcet.edu',
            },
          ],
        }),
      });

      const res = await executeImport(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toMatch(/cannot import students into department "ME"/);
    });

    it('ALLOWS coordinator to import valid students for own department and logs audit trail', async () => {
      mockUserSession = coordinatorCseSession;

      const req = new Request('http://localhost:3000/api/students/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch: 2026,
          students: [
            {
              name: 'Aarav Patil',
              rollNumber: 'PRN-VALID-01',
              department: 'Computer Science & Engineering', // free-text mapped to CSE
              year: 'Final Year',
              passoutYear: 2026,
              cgpa: 8.85,
              backlogs: 0,
              email: 'aarav.patil@dypcet.edu',
            },
            {
              name: 'Snehal Deshmukh',
              rollNumber: 'PRN-VALID-02',
              department: 'CSE',
              year: 'Final Year',
              passoutYear: 2026,
              cgpa: 9.1,
              backlogs: 0,
              email: 'snehal.deshmukh@dypcet.edu',
            },
          ],
        }),
      });

      const res = await executeImport(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.count).toBe(2);

      // Verify in DB
      const s1 = await Student.findOne({ rollNumber: 'PRN-VALID-01' });
      expect(s1).toBeDefined();
      expect(s1?.department).toBe('CSE');
      expect(s1?.passoutYear).toBe(2026);
      expect(s1?.placementStatus).toBe('Not Placed');

      // Verify audit log entry
      const audit = await AuditLog.findOne({ action: 'IMPORT_STUDENTS' });
      expect(audit).toBeDefined();
      expect(audit?.details.count).toBe(2);
      expect(audit?.details.batch).toBe(2026);
      expect(audit?.details.department).toBe('CSE');
    });
  });

  describe('4. Student CSV Export & Scoping', () => {
    beforeEach(async () => {
      await Student.create([
        {
          name: 'CSE Grad 2026',
          rollNumber: 'PRN-EXP-01',
          department: 'CSE',
          year: 'Final Year',
          passoutYear: 2026,
          placementStatus: 'Placed',
          placementDetails: { companyName: 'TCS', packageLPA: 7.2 },
          email: 'cse2026@dypcet.edu',
        },
        {
          name: 'ME Grad 2026',
          rollNumber: 'PRN-EXP-02',
          department: 'ME',
          year: 'Final Year',
          passoutYear: 2026,
          placementStatus: 'Not Placed',
          email: 'me2026@dypcet.edu',
        },
        {
          name: 'CSE Alumni 2025',
          rollNumber: 'PRN-EXP-03',
          department: 'CSE',
          year: 'Final Year',
          passoutYear: 2025,
          placementStatus: 'Placed',
          email: 'cse2025@dypcet.edu',
        },
      ]);
    });

    it('DENIES STUDENT from exporting student data (403)', async () => {
      mockUserSession = studentSession;

      const req = new Request('http://localhost:3000/api/students/export');
      const res = await exportStudents(req);
      expect(res.status).toBe(403);
    });

    it('DENIES coordinator from requesting export for other departments (403)', async () => {
      mockUserSession = coordinatorCseSession; // CSE Coordinator

      const req = new Request('http://localhost:3000/api/students/export?department=ME');
      const res = await exportStudents(req);
      expect(res.status).toBe(403);
    });

    it('SCOPES coordinator export strictly to own department (CSE) and requested batch', async () => {
      mockUserSession = coordinatorCseSession;

      const req = new Request('http://localhost:3000/api/students/export?batch=2026');
      const res = await exportStudents(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('text/csv');

      const csvText = await res.text();
      expect(csvText).toContain('PRN-EXP-01'); // CSE 2026
      expect(csvText).not.toContain('PRN-EXP-02'); // ME 2026 (Different department)
      expect(csvText).not.toContain('PRN-EXP-03'); // CSE 2025 (Different batch)

      // Verify audit log
      const log = await AuditLog.findOne({ action: 'EXPORT_STUDENTS' });
      expect(log).toBeDefined();
      expect(log?.details.department).toBe('CSE');
      expect(log?.details.batch).toBe(2026);
    });

    it('ALLOWS TPO to export all departments with batch filtering', async () => {
      mockUserSession = tpoSession;

      const req = new Request('http://localhost:3000/api/students/export?batch=2026');
      const res = await exportStudents(req);
      expect(res.status).toBe(200);

      const csvText = await res.text();
      expect(csvText).toContain('PRN-EXP-01'); // CSE 2026
      expect(csvText).toContain('PRN-EXP-02'); // ME 2026
      expect(csvText).not.toContain('PRN-EXP-03'); // 2025 excluded by batch filter
    });
  });
});
