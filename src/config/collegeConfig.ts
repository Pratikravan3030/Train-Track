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

export const TRAINING_CATEGORIES = [
  'Technical',
  'Aptitude',
  'Soft Skills',
  'Domain-Specific',
  'Mock Interview',
  'Other',
] as const;
export type TrainingCategory = (typeof TRAINING_CATEGORIES)[number];
export const SESSION_CATEGORIES = TRAINING_CATEGORIES;

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

export const DRIVE_TYPES = ['Full-time', 'Internship', 'Internship+PPO'] as const;
export type DriveType = (typeof DRIVE_TYPES)[number];

export const DRIVE_MODES = ['On-Campus', 'Off-Campus', 'Virtual', 'Hybrid'] as const;
export type DriveMode = (typeof DRIVE_MODES)[number];

export const DRIVE_STATUSES = [
  'Draft',
  'Open',
  'Registration Closed',
  'In Progress',
  'Completed',
  'Archived',
] as const;
export type DriveStatus = (typeof DRIVE_STATUSES)[number];

export const OFFER_TYPES = ['Full-time', 'Internship', 'PPO'] as const;
export type OfferType = (typeof OFFER_TYPES)[number];

export const OFFER_SOURCES = ['Campus Drive', 'Off-Campus / Manual'] as const;
export type OfferSource = (typeof OFFER_SOURCES)[number];

export const OFFER_STATUSES = ['Pending', 'Accepted', 'Declined', 'Revoked'] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export const APPLICATION_STATUSES = [
  'Applied',
  'Shortlisted',
  'In Round',
  'Selected',
  'Rejected',
  'Withdrawn',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const OFFER_TIER_NAMES = ['Regular', 'Dream', 'Super Dream'] as const;
export type OfferTierName = (typeof OFFER_TIER_NAMES)[number];

export interface PlacementTierConfig {
  name: OfferTierName;
  minCtcLpa: number;
  maxCtcLpa: number | null; // null represents no upper bound
  label: string;
}

export const PLACEMENT_POLICY_CONFIG = {
  /* UNVERIFIED: CTC tiers to be confirmed by DYPCET T&P Cell */
  tiers: [
    { name: 'Regular', minCtcLpa: 0, maxCtcLpa: 5.0, label: 'Regular (< 5 LPA)' },
    { name: 'Dream', minCtcLpa: 5.0, maxCtcLpa: 10.0, label: 'Dream (5.0 - 10.0 LPA)' },
    { name: 'Super Dream', minCtcLpa: 10.0, maxCtcLpa: null, label: 'Super Dream (10.0+ LPA)' },
  ] as const satisfies readonly PlacementTierConfig[],

  /* UNVERIFIED: Placement eligibility and re-application rules */
  rules: {
    oneOfferPolicy: true, // Placed students can only apply for strictly higher tiers
    tierUpgradeOnly: true,
    maxOffersPerStudent: 2,
    /* Open question for college: Do Pending offers count as active offers that restrict reapplying? */
    pendingOffersCountAsActive: false,
    /* Types of offers counted toward institutional placement percentage and package stats */
    placementStatOfferTypes: ['Full-time', 'PPO'] as const,
  },

  /* Denominator configuration for placement rate calculations */
  placementPercentageCalculation: {
    /* Configurable basis: 'eligibleOptedIn' | 'registered' | 'totalCohort' */
    denominatorBasis: 'eligibleOptedIn' as 'eligibleOptedIn' | 'registered' | 'totalCohort',
    formulaDisplay:
      'Placement Rate (%) = (Placed Students with Full-time/PPO / Placement-Eligible & Opted-In Students) × 100',
  },
} as const;

/**
 * Computes placement tier from CTC LPA using half-open ranges [min, max).
 * Boundary 5.0 => Dream; Boundary 10.0 => Super Dream.
 */
export function resolveOfferTier(ctcLpa?: number | null): OfferTierName {
  if (ctcLpa == null || ctcLpa < 0) return 'Regular';

  for (const tier of PLACEMENT_POLICY_CONFIG.tiers) {
    const aboveMin = ctcLpa >= tier.minCtcLpa;
    const belowMax = tier.maxCtcLpa === null ? true : ctcLpa < tier.maxCtcLpa;
    if (aboveMin && belowMax) {
      return tier.name;
    }
  }

  return 'Regular';
}
