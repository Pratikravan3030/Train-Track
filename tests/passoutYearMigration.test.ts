import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Student from '@/models/Student';
import { derivePassoutYearFromAcademicYear } from '../scripts/migrate-passout-year';
import { createStudentSchema } from '@/lib/validations/student';
import { DEFAULT_PASSOUT_YEAR, PLACEMENT_STATUSES } from '@/config/collegeConfig';

describe('Student Schema, Batch Helpers & Migration Tests', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    process.env.MONGODB_URI = uri;
    await mongoose.connect(uri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Student.deleteMany({});
  });

  describe('derivePassoutYearFromAcademicYear helper', () => {
    it('maps Final Year / 4th Year to current graduating batch (2026)', () => {
      expect(derivePassoutYearFromAcademicYear('Final Year')).toBe(DEFAULT_PASSOUT_YEAR);
      expect(derivePassoutYearFromAcademicYear('4th Year')).toBe(DEFAULT_PASSOUT_YEAR);
      expect(derivePassoutYearFromAcademicYear('Fourth Year')).toBe(DEFAULT_PASSOUT_YEAR);
    });

    it('maps Third Year / 3rd Year to graduating batch + 1 (2027)', () => {
      expect(derivePassoutYearFromAcademicYear('Third Year')).toBe(DEFAULT_PASSOUT_YEAR + 1);
      expect(derivePassoutYearFromAcademicYear('3rd Year')).toBe(DEFAULT_PASSOUT_YEAR + 1);
    });

    it('maps Second Year / 2nd Year to graduating batch + 2 (2028)', () => {
      expect(derivePassoutYearFromAcademicYear('Second Year')).toBe(DEFAULT_PASSOUT_YEAR + 2);
      expect(derivePassoutYearFromAcademicYear('2nd Year')).toBe(DEFAULT_PASSOUT_YEAR + 2);
    });

    it('maps First Year / 1st Year to graduating batch + 3 (2029)', () => {
      expect(derivePassoutYearFromAcademicYear('First Year')).toBe(DEFAULT_PASSOUT_YEAR + 3);
      expect(derivePassoutYearFromAcademicYear('1st Year')).toBe(DEFAULT_PASSOUT_YEAR + 3);
    });

    it('falls back to default passout year for empty or unparseable input', () => {
      expect(derivePassoutYearFromAcademicYear(null)).toBe(DEFAULT_PASSOUT_YEAR);
      expect(derivePassoutYearFromAcademicYear('')).toBe(DEFAULT_PASSOUT_YEAR);
      expect(derivePassoutYearFromAcademicYear('Unknown')).toBe(DEFAULT_PASSOUT_YEAR);
    });
  });

  describe('Student Model Schema with passoutYear & placementStatus', () => {
    it('creates a student successfully with valid passoutYear and default placementStatus', async () => {
      const student = await Student.create({
        name: 'Gaurav Kulkarni',
        rollNumber: 'PRN-CSE-101',
        department: 'CSE',
        year: 'Final Year',
        passoutYear: 2026,
        email: 'gaurav.k@dypcet.edu',
      });

      expect(student.passoutYear).toBe(2026);
      expect(student.placementStatus).toBe('Not Placed');
      expect(student.department).toBe('CSE');
    });

    it('fails validation when passoutYear is missing', async () => {
      await expect(
        Student.create({
          name: 'Missing Batch Student',
          rollNumber: 'PRN-CSE-102',
          department: 'CSE',
          year: 'Final Year',
          email: 'missing.batch@dypcet.edu',
        })
      ).rejects.toThrow(/Passout year \(batch\) is required/);
    });

    it('fails validation when placementStatus is not in enum', async () => {
      await expect(
        Student.create({
          name: 'Invalid Status Student',
          rollNumber: 'PRN-CSE-103',
          department: 'CSE',
          year: 'Final Year',
          passoutYear: 2026,
          placementStatus: 'Random Status' as never,
          email: 'invalid.status@dypcet.edu',
        })
      ).rejects.toThrow(/is not a valid placement status/);
    });

    it('allows all supported PLACEMENT_STATUSES', async () => {
      for (const status of PLACEMENT_STATUSES) {
        const s = await Student.create({
          name: `Student for ${status}`,
          rollNumber: `PRN-STAT-${status.replace(/\s+/g, '')}`,
          department: 'IT',
          year: 'Final Year',
          passoutYear: 2026,
          placementStatus: status,
          email: `stat.${status.replace(/\s+/g, '').toLowerCase()}@dypcet.edu`,
        });
        expect(s.placementStatus).toBe(status);
      }
    });
  });

  describe('createStudentSchema Zod validation', () => {
    it('automatically defaults passoutYear to DEFAULT_PASSOUT_YEAR if omitted in payload', () => {
      const parsed = createStudentSchema.parse({
        name: 'Aarohi Mane',
        rollNumber: 'PRN-IT-201',
        department: 'IT',
        year: 'Final Year',
        email: 'aarohi.m@dypcet.edu',
      });
      expect(parsed.passoutYear).toBe(DEFAULT_PASSOUT_YEAR);
      expect(parsed.placementStatus).toBe('Not Placed');
    });

    it('accepts explicit passoutYear in payload', () => {
      const parsed = createStudentSchema.parse({
        name: 'Sanket Patil',
        rollNumber: 'PRN-ME-301',
        department: 'ME',
        year: 'Third Year',
        passoutYear: 2027,
        email: 'sanket.p@dypcet.edu',
      });
      expect(parsed.passoutYear).toBe(2027);
    });
  });
});
