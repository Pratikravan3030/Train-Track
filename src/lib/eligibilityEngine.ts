import {
  DepartmentCode,
  DriveStatus,
} from '@/config/collegeConfig';

export interface StudentEligibilityProfile {
  _id?: string;
  name: string;
  rollNumber: string;
  department: DepartmentCode | string;
  passoutYear?: number | null;
  cgpa?: number | null;
  backlogs?: number | null;
  tenthPercentage?: number | null;
  twelfthOrDiplomaPercentage?: number | null;
  placementStatus?: string;
}

export interface DriveEligibilityRulesInput {
  minCgpa?: number | null;
  maxBacklogs?: number | null;
  allowedDepartments?: DepartmentCode[] | string[];
  allowedBatches?: number[];
  minTenthPercentage?: number | null;
  minTwelfthOrDiplomaPercentage?: number | null;
}

export interface EligibilityResult {
  isEligible: boolean;
  reasons: string[];
  isDataIncomplete: boolean;
  missingFields: string[];
  criteriaChecks: {
    placementStatus: boolean;
    cgpa: boolean;
    backlogs: boolean;
    tenthPercentage: boolean;
    twelfthOrDiplomaPercentage: boolean;
    department: boolean;
    batch: boolean;
  };
}

/**
 * Evaluates whether a student meets a drive's academic and policy criteria.
 * Missing data (null/undefined) produces explicit "not recorded" reasons and ineligible status.
 * Empty allowedDepartments or allowedBatches means "no restriction".
 */
export function evaluateStudentEligibility(
  student: StudentEligibilityProfile,
  rules?: DriveEligibilityRulesInput | null
): EligibilityResult {
  const reasons: string[] = [];
  const missingFields: string[] = [];

  const checks = {
    placementStatus: true,
    cgpa: true,
    backlogs: true,
    tenthPercentage: true,
    twelfthOrDiplomaPercentage: true,
    department: true,
    batch: true,
  };

  // 1. Placement status exclusions
  if (student.placementStatus === 'Opted Out') {
    checks.placementStatus = false;
    reasons.push('Student has opted out of campus placements.');
  } else if (student.placementStatus === 'Higher Studies') {
    checks.placementStatus = false;
    reasons.push('Student has opted for higher studies.');
  }

  // 2. Department check (Empty means no restriction)
  const allowedDepts = rules?.allowedDepartments || [];
  if (allowedDepts.length > 0) {
    if (!student.department || !allowedDepts.includes(student.department as DepartmentCode)) {
      checks.department = false;
      reasons.push(`Department "${student.department || 'Unknown'}" is not eligible for this drive.`);
    }
  }

  // 3. Batch check (Empty means no restriction)
  const allowedBatches = rules?.allowedBatches || [];
  if (allowedBatches.length > 0) {
    if (student.passoutYear == null) {
      checks.batch = false;
      missingFields.push('passoutYear');
      reasons.push('Graduation batch (passout year) not recorded.');
    } else if (!allowedBatches.includes(student.passoutYear)) {
      checks.batch = false;
      reasons.push(`Graduation batch "${student.passoutYear}" is not eligible for this drive.`);
    }
  }

  // 4. CGPA check
  if (rules?.minCgpa != null) {
    if (student.cgpa == null) {
      checks.cgpa = false;
      missingFields.push('cgpa');
      reasons.push('CGPA not recorded.');
    } else if (student.cgpa < rules.minCgpa) {
      checks.cgpa = false;
      reasons.push(`CGPA ${student.cgpa.toFixed(2)} is below minimum required ${rules.minCgpa.toFixed(2)}.`);
    }
  }

  // 5. Active Backlogs check
  if (rules?.maxBacklogs != null) {
    if (student.backlogs == null) {
      checks.backlogs = false;
      missingFields.push('backlogs');
      reasons.push('Active backlogs count not recorded.');
    } else if (student.backlogs > rules.maxBacklogs) {
      checks.backlogs = false;
      reasons.push(
        `${student.backlogs} active backlog(s) exceeds maximum permitted limit of ${rules.maxBacklogs}.`
      );
    }
  }

  // 6. 10th Percentage check
  if (rules?.minTenthPercentage != null) {
    if (student.tenthPercentage == null) {
      checks.tenthPercentage = false;
      missingFields.push('tenthPercentage');
      reasons.push('10th standard percentage not recorded.');
    } else if (student.tenthPercentage < rules.minTenthPercentage) {
      checks.tenthPercentage = false;
      reasons.push(
        `10th percentage ${student.tenthPercentage.toFixed(1)}% is below minimum required ${rules.minTenthPercentage.toFixed(1)}%.`
      );
    }
  }

  // 7. 12th / Diploma Percentage check
  if (rules?.minTwelfthOrDiplomaPercentage != null) {
    if (student.twelfthOrDiplomaPercentage == null) {
      checks.twelfthOrDiplomaPercentage = false;
      missingFields.push('twelfthOrDiplomaPercentage');
      reasons.push('12th / Diploma percentage not recorded.');
    } else if (student.twelfthOrDiplomaPercentage < rules.minTwelfthOrDiplomaPercentage) {
      checks.twelfthOrDiplomaPercentage = false;
      reasons.push(
        `12th/Diploma percentage ${student.twelfthOrDiplomaPercentage.toFixed(1)}% is below minimum required ${rules.minTwelfthOrDiplomaPercentage.toFixed(1)}%.`
      );
    }
  }

  const isEligible = reasons.length === 0;
  const isDataIncomplete = missingFields.length > 0;

  return {
    isEligible,
    reasons,
    isDataIncomplete,
    missingFields,
    criteriaChecks: checks,
  };
}

/**
 * Format date in Asia/Kolkata (IST)
 */
export function formatInIST(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }) + ' IST';
}

/**
 * Evaluates whether registration is currently open on the server in IST.
 * Registration Closed is computed dynamically from registrationDeadline.
 */
export function isDriveRegistrationOpen(drive: {
  status: DriveStatus | string;
  registrationDeadline: Date | string;
  isArchived?: boolean;
}): { isOpen: boolean; reason?: string } {
  if (drive.isArchived) {
    return { isOpen: false, reason: 'This placement drive has been archived.' };
  }

  if (drive.status === 'Draft') {
    return { isOpen: false, reason: 'Drive is in Draft status; registration has not opened.' };
  }

  if (drive.status === 'Completed') {
    return { isOpen: false, reason: 'This placement drive has completed.' };
  }

  const deadline = new Date(drive.registrationDeadline);
  const now = new Date();

  if (now.getTime() > deadline.getTime()) {
    return {
      isOpen: false,
      reason: `Registration closed on ${formatInIST(deadline)}. Late registrations require TPO override.`,
    };
  }

  if (drive.status !== 'Open') {
    return {
      isOpen: false,
      reason: `Drive status is "${drive.status}". Registration is not currently open.`,
    };
  }

  return { isOpen: true };
}
