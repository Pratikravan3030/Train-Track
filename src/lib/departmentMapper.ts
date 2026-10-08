import { z } from 'zod';
import { DEPARTMENT_CODES, DepartmentCode, COLLEGE_CONFIG } from '@/config/collegeConfig';

export const departmentCodeSchema = z.enum(DEPARTMENT_CODES);

// Canonical lookup mapping free-text variants to stable department codes
const NORMALIZED_MAP: Record<string, DepartmentCode> = {
  // CSE
  cse: 'CSE',
  cs: 'CSE',
  'computer science': 'CSE',
  'computer science & engineering': 'CSE',
  'computer science and engineering': 'CSE',
  'computer engineering': 'CSE',

  // IT
  it: 'IT',
  'information technology': 'IT',
  'info tech': 'IT',

  // ECE / ETC
  ece: 'ECE',
  etc: 'ECE',
  entc: 'ECE',
  'electronics and telecommunication': 'ECE',
  'electronics and telecommunication engineering': 'ECE',
  'electronics & telecommunication engineering': 'ECE',
  'electronics and communication': 'ECE',
  'electronics & communication engineering': 'ECE',
  'electronics and communication engineering': 'ECE',

  // EE
  ee: 'EE',
  electrical: 'EE',
  'electrical engineering': 'EE',

  // ME
  me: 'ME',
  mechanical: 'ME',
  'mechanical engineering': 'ME',

  // CE
  ce: 'CE',
  civil: 'CE',
  'civil engineering': 'CE',

  // OTHER
  other: 'OTHER',
  'other department': 'OTHER',
  unassigned: 'OTHER',
};

/**
 * Normalizes a raw department or branch string into a validated DepartmentCode.
 * Returns null if the value cannot be mapped.
 */
export function mapToDepartmentCode(input?: string | null): DepartmentCode | null {
  if (!input) return null;
  const cleaned = input.trim();
  if (!cleaned) return null;

  // Direct code match (e.g., 'CSE', 'IT')
  const upper = cleaned.toUpperCase();
  if (DEPARTMENT_CODES.includes(upper as DepartmentCode)) {
    return upper as DepartmentCode;
  }

  // Normalized free-text lookup
  const lower = cleaned.toLowerCase().replace(/\s+/g, ' ');
  if (NORMALIZED_MAP[lower]) {
    return NORMALIZED_MAP[lower];
  }

  // Check exact department names from config
  const matchedFromConfig = COLLEGE_CONFIG.academic.departments.find(
    (d) => d.name.toLowerCase() === lower
  );
  if (matchedFromConfig) {
    return matchedFromConfig.code;
  }

  return null;
}

/**
 * Returns human-readable department name from code.
 */
export function getDepartmentName(code: string): string {
  const matched = COLLEGE_CONFIG.academic.departments.find(
    (d) => d.code === code.toUpperCase()
  );
  return matched ? matched.name : code;
}

/**
 * Shared helper to enforce Student.department as the single source of truth.
 * Validates and resolves any create/update/import input (whether passed as department or branch)
 * into a strictly validated DepartmentCode.
 * Throws a descriptive Error if input is missing or unmappable.
 */
export function resolveStudentDepartment(input: {
  department?: string | null;
  branch?: string | null;
}): DepartmentCode {
  const candidate = input.department || input.branch;
  if (!candidate || typeof candidate !== 'string' || !candidate.trim()) {
    throw new Error('Department is required and must be specified.');
  }
  const mapped = mapToDepartmentCode(candidate);
  if (!mapped) {
    throw new Error(
      `Invalid department value: "${candidate}". Must map to one of: ${DEPARTMENT_CODES.join(', ')}.`
    );
  }
  const parseResult = departmentCodeSchema.safeParse(mapped);
  if (!parseResult.success) {
    throw new Error(`Invalid department code: "${mapped}".`);
  }
  return parseResult.data;
}
