import { describe, it, expect } from 'vitest';
import {
  mapToDepartmentCode,
  getDepartmentName,
  departmentCodeSchema,
} from '@/lib/departmentMapper';
import { DEPARTMENT_CODES } from '@/config/collegeConfig';

describe('Department Mapper Unit Tests', () => {
  it('validates department codes against Zod enum schema', () => {
    for (const code of DEPARTMENT_CODES) {
      expect(departmentCodeSchema.safeParse(code).success).toBe(true);
    }
    expect(departmentCodeSchema.safeParse('INVALID_CODE').success).toBe(false);
  });

  it('maps direct uppercase code inputs', () => {
    expect(mapToDepartmentCode('CSE')).toBe('CSE');
    expect(mapToDepartmentCode('IT')).toBe('IT');
    expect(mapToDepartmentCode('ECE')).toBe('ECE');
    expect(mapToDepartmentCode('ME')).toBe('ME');
    expect(mapToDepartmentCode('CE')).toBe('CE');
    expect(mapToDepartmentCode('EE')).toBe('EE');
    expect(mapToDepartmentCode('OTHER')).toBe('OTHER');
  });

  it('maps lowercase and whitespace padded codes', () => {
    expect(mapToDepartmentCode('  cse  ')).toBe('CSE');
    expect(mapToDepartmentCode('it')).toBe('IT');
    expect(mapToDepartmentCode('me')).toBe('ME');
  });

  it('maps common free-text variations to canonical codes', () => {
    expect(mapToDepartmentCode('Computer Science & Engineering')).toBe('CSE');
    expect(mapToDepartmentCode('computer science and engineering')).toBe('CSE');
    expect(mapToDepartmentCode('Computer Engineering')).toBe('CSE');
    expect(mapToDepartmentCode('Information Technology')).toBe('IT');
    expect(mapToDepartmentCode('Electronics & Communication Engineering')).toBe('ECE');
    expect(mapToDepartmentCode('Electronics and Telecommunication')).toBe('ECE');
    expect(mapToDepartmentCode('Mechanical Engineering')).toBe('ME');
    expect(mapToDepartmentCode('Civil Engineering')).toBe('CE');
    expect(mapToDepartmentCode('Electrical Engineering')).toBe('EE');
    expect(mapToDepartmentCode('Other Department')).toBe('OTHER');
  });

  it('returns null for unmappable or empty values', () => {
    expect(mapToDepartmentCode('')).toBeNull();
    expect(mapToDepartmentCode('   ')).toBeNull();
    expect(mapToDepartmentCode(null)).toBeNull();
    expect(mapToDepartmentCode(undefined)).toBeNull();
    expect(mapToDepartmentCode('Department of Astronomy')).toBeNull();
  });

  it('retrieves full human-readable department name from code', () => {
    expect(getDepartmentName('CSE')).toBe('Computer Science & Engineering');
    expect(getDepartmentName('IT')).toBe('Information Technology');
    expect(getDepartmentName('UNKNOWN')).toBe('UNKNOWN');
  });
});
