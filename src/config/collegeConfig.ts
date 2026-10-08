/**
 * College Configuration for D.Y. Patil College of Engineering & Technology (DYPCET)
 * Kasaba Bawada, Kolhapur, Maharashtra.
 *
 * NOTE: As per project requirements, any value that has not been officially confirmed
 * by the institution is marked with an /* UNVERIFIED *\/ comment and wrapped in
 * [UNVERIFIED: ...].
 * 
 * Helper function `isConfigured(val)` allows UI components to suppress (hide)
 * unverified placeholder fields instead of rendering guessed values.
 */

export const COLLEGE_ROLES = ['SUPER_ADMIN', 'TPO', 'DEPT_COORDINATOR', 'STUDENT'] as const;
export type UserRole = (typeof COLLEGE_ROLES)[number];

export const DEPARTMENT_CODES = ['CSE', 'IT', 'ECE', 'EE', 'ME', 'CE', 'OTHER'] as const;
export type DepartmentCode = (typeof DEPARTMENT_CODES)[number];

export function isConfigured(value?: string | null): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  return (
    !trimmed.startsWith('[PLACEHOLDER') &&
    !trimmed.startsWith('[UNVERIFIED') &&
    !trimmed.includes('PLACEHOLDER') &&
    !trimmed.includes('UNVERIFIED')
  );
}

export const COLLEGE_CONFIG = {
  institution: {
    name: 'D.Y. Patil College of Engineering & Technology',
    shortName: 'DYPCET',
    campus: 'Kasaba Bawada, Kolhapur, Maharashtra 416006',
    /* UNVERIFIED: Official central email not verified against college registrar */
    contactEmail: '[UNVERIFIED: info@dypcet.ac.in]',
    /* UNVERIFIED: Main PBX telephone not verified */
    contactPhone: '[UNVERIFIED: +91 231 2601431]',
    /* UNVERIFIED: Official portal domain to be verified */
    website: '[UNVERIFIED: https://coek.dypgroup.edu.in]',
    /* UNVERIFIED: Filepath to verified SVG/PNG crest asset */
    logoUrl: '[UNVERIFIED: /images/dypcet-logo.png]',
  },
  tpCell: {
    name: 'Training & Placement Cell',
    shortName: 'T&P Cell',
    headerTitle: 'Training & Placement Cell – DYPCET Kolhapur',
    /* UNVERIFIED: TPO direct inbox to be verified */
    email: '[UNVERIFIED: tpo@dypcet.ac.in]',
    /* UNVERIFIED: TPO officer designation name to be provided */
    contactPerson: '[UNVERIFIED: Training & Placement Officer]',
  },
  academic: {
    currentAcademicYear: '2025-2026',
    defaultPassoutYear: 2026,
    passoutYears: [2023, 2024, 2025, 2026, 2027, 2028, 2029] as const,
    /* UNVERIFIED: Standard DYPCET engineering departments to be confirmed against college handbook */
    departments: [
      { code: 'CSE', name: 'Computer Science & Engineering' },
      { code: 'IT', name: 'Information Technology' },
      { code: 'ECE', name: 'Electronics & Communication Engineering' },
      { code: 'EE', name: 'Electrical Engineering' },
      { code: 'ME', name: 'Mechanical Engineering' },
      { code: 'CE', name: 'Civil Engineering' },
      { code: 'OTHER', name: 'Other Department' },
    ],
    years: ['1st Year', '2nd Year', '3rd Year', '4th Year'] as const,
    divisions: ['A', 'B', 'C', 'D'] as const,
  },
  roles: {
    SUPER_ADMIN: {
      key: 'SUPER_ADMIN' as UserRole,
      label: 'Super Administrator',
      description: 'Full system management and configuration control',
    },
    TPO: {
      key: 'TPO' as UserRole,
      label: 'Training & Placement Officer',
      description: 'Placement drives, coordination, company and session management',
    },
    DEPT_COORDINATOR: {
      key: 'DEPT_COORDINATOR' as UserRole,
      label: 'Department Coordinator',
      description: 'Department-specific student and attendance management',
    },
    STUDENT: {
      key: 'STUDENT' as UserRole,
      label: 'Student',
      description: 'Student profile, drive applications, and attendance viewing',
    },
  },
} as const;

export const DEFAULT_DEPARTMENT_NAMES = COLLEGE_CONFIG.academic.departments.map((d) => d.name);
export const DEFAULT_ACADEMIC_YEARS = [...COLLEGE_CONFIG.academic.years];

export const CURRENT_ACADEMIC_YEAR = COLLEGE_CONFIG.academic.currentAcademicYear;
export const DEFAULT_PASSOUT_YEAR = COLLEGE_CONFIG.academic.defaultPassoutYear;
export const VALID_PASSOUT_YEARS = COLLEGE_CONFIG.academic.passoutYears;
export type PassoutYear = (typeof VALID_PASSOUT_YEARS)[number];

export const PLACEMENT_STATUSES = [
  'Not Placed',
  'Placed',
  'Opted Out',
  'Higher Studies',
  'Entrepreneurship',
] as const;
export type PlacementStatus = (typeof PLACEMENT_STATUSES)[number];
