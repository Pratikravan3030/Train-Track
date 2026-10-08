import { describe, it, expect } from 'vitest';
import {
  createStudentSchema,
  updateStudentSchema,
} from '@/lib/validations/student';
import {
  importStudentRowSchema,
  normalizeHeader,
} from '@/lib/validations/student-import';
import { nullableNumberPreprocessor } from '@/lib/validations/common';

describe('Validation Preprocessor & Nullable Numbers Tests', () => {
  describe('1. Raw nullableNumberPreprocessor unit checks', () => {
    it('converts empty string, whitespace, undefined, and null to null', () => {
      expect(nullableNumberPreprocessor('')).toBeNull();
      expect(nullableNumberPreprocessor('   ')).toBeNull();
      expect(nullableNumberPreprocessor(undefined)).toBeNull();
      expect(nullableNumberPreprocessor(null)).toBeNull();
    });

    it('strictly preserves "0" and 0 as 0 (does not convert to null)', () => {
      expect(nullableNumberPreprocessor('0')).toBe(0);
      expect(nullableNumberPreprocessor(0)).toBe(0);
      expect(nullableNumberPreprocessor('0.0')).toBe(0);
    });

    it('parses valid positive decimals and numbers', () => {
      expect(nullableNumberPreprocessor('8.75')).toBe(8.75);
      expect(nullableNumberPreprocessor(9.2)).toBe(9.2);
      expect(nullableNumberPreprocessor('85')).toBe(85);
    });

    it('returns NaN for invalid non-numeric strings', () => {
      expect(Number.isNaN(nullableNumberPreprocessor('not-a-number'))).toBe(true);
    });
  });

  describe('2. Student API JSON Path Validation', () => {
    it('treats missing/null backlogs and percentages as null (not 0)', () => {
      const parsed = createStudentSchema.parse({
        name: 'Pratik Patil',
        rollNumber: 'PRN-VAL-01',
        department: 'CSE',
        year: 'Final Year',
        passoutYear: 2026,
        email: 'pratik@dypcet.edu',
        cgpa: null,
        backlogs: null,
        tenthPercentage: null,
        twelfthOrDiplomaPercentage: null,
      });

      expect(parsed.cgpa).toBeNull();
      expect(parsed.backlogs).toBeNull();
      expect(parsed.tenthPercentage).toBeNull();
      expect(parsed.twelfthOrDiplomaPercentage).toBeNull();
    });

    it('preserves backlogs: 0 and cgpa: 0 when explicitly passed as 0 or "0"', () => {
      const parsed = createStudentSchema.parse({
        name: 'Pratik Patil',
        rollNumber: 'PRN-VAL-02',
        department: 'CSE',
        year: 'Final Year',
        passoutYear: 2026,
        email: 'pratik@dypcet.edu',
        cgpa: '0',
        backlogs: '0',
        tenthPercentage: '85.5',
      });

      expect(parsed.cgpa).toBe(0);
      expect(parsed.backlogs).toBe(0);
      expect(parsed.tenthPercentage).toBe(85.5);
    });

    it('treats empty string "" in JSON payload as null', () => {
      const parsed = updateStudentSchema.parse({
        cgpa: '',
        backlogs: '',
        tenthPercentage: '',
        twelfthOrDiplomaPercentage: '',
      });

      expect(parsed.cgpa).toBeNull();
      expect(parsed.backlogs).toBeNull();
      expect(parsed.tenthPercentage).toBeNull();
      expect(parsed.twelfthOrDiplomaPercentage).toBeNull();
    });
  });

  describe('3. Student Form Path Validation (simulating HTML form fields)', () => {
    it('converts blank form text inputs ("") to null and allows valid submission', () => {
      const formPayload = {
        name: 'Rohit Kulkarni',
        rollNumber: 'PRN-VAL-FORM',
        department: 'IT',
        year: 'Final Year',
        passoutYear: '2026',
        email: 'rohit@dypcet.edu',
        cgpa: '', // Blank HTML input
        backlogs: '', // Blank HTML input
        tenthPercentage: '', // Blank HTML input
        twelfthOrDiplomaPercentage: '', // Blank HTML input
      };

      const result = createStudentSchema.safeParse(formPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cgpa).toBeNull();
        expect(result.data.backlogs).toBeNull();
        expect(result.data.tenthPercentage).toBeNull();
        expect(result.data.twelfthOrDiplomaPercentage).toBeNull();
        expect(result.data.passoutYear).toBe(2026);
      }
    });

    it('distinguishes form input "0" for backlogs from blank input ""', () => {
      const resultWithZero = createStudentSchema.safeParse({
        name: 'Rohit Kulkarni',
        rollNumber: 'PRN-VAL-FORM2',
        department: 'IT',
        year: 'Final Year',
        passoutYear: '2026',
        email: 'rohit@dypcet.edu',
        backlogs: '0',
      });
      expect(resultWithZero.success).toBe(true);
      if (resultWithZero.success) {
        expect(resultWithZero.data.backlogs).toBe(0);
      }
    });
  });

  describe('4. CSV Import Path Validation', () => {
    it('normalizes 10th and 12th percentage headers correctly', () => {
      expect(normalizeHeader('10th %')).toBe('tenthPercentage');
      expect(normalizeHeader('Tenth Percentage')).toBe('tenthPercentage');
      expect(normalizeHeader('SSC %')).toBe('tenthPercentage');
      expect(normalizeHeader('12th %')).toBe('twelfthOrDiplomaPercentage');
      expect(normalizeHeader('Diploma %')).toBe('twelfthOrDiplomaPercentage');
      expect(normalizeHeader('HSC Percentage')).toBe('twelfthOrDiplomaPercentage');
    });

    it('parses CSV row with blank backlogs/percentages as null, and "0" as 0', () => {
      const csvRowWithBlanks = {
        name: 'Snehal More',
        rollNumber: 'PRN-CSV-01',
        department: 'ECE',
        year: 'Final Year',
        passoutYear: 2026,
        cgpa: '',
        backlogs: '',
        tenthPercentage: '',
        twelfthOrDiplomaPercentage: '',
      };

      const parsed = importStudentRowSchema.parse(csvRowWithBlanks);
      expect(parsed.cgpa).toBeNull();
      expect(parsed.backlogs).toBeNull();
      expect(parsed.tenthPercentage).toBeNull();
      expect(parsed.twelfthOrDiplomaPercentage).toBeNull();

      const csvRowWithZero = {
        name: 'Snehal More',
        rollNumber: 'PRN-CSV-02',
        department: 'ECE',
        year: 'Final Year',
        passoutYear: 2026,
        cgpa: '7.8',
        backlogs: '0',
        tenthPercentage: '88.4',
        twelfthOrDiplomaPercentage: '82.0',
      };

      const parsedWithZero = importStudentRowSchema.parse(csvRowWithZero);
      expect(parsedWithZero.cgpa).toBe(7.8);
      expect(parsedWithZero.backlogs).toBe(0);
      expect(parsedWithZero.tenthPercentage).toBe(88.4);
      expect(parsedWithZero.twelfthOrDiplomaPercentage).toBe(82.0);
    });
  });
});
