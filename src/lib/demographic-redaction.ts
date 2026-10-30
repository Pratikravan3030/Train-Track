import { UserRole } from '@/config/collegeConfig';

export function canViewDemographics(role?: UserRole | string, isOwnRecord = false): boolean {
  if (isOwnRecord) return true;
  if (!role) return false;
  return role === 'SUPER_ADMIN' || role === 'TPO';
}

export function redactStudentDemographics<T extends Record<string, unknown>>(
  student: T,
  role?: UserRole | string,
  isOwnRecord = false
): T & { isDemographicsRedacted?: boolean } {
  if (canViewDemographics(role, isOwnRecord)) {
    return { ...student, isDemographicsRedacted: false };
  }

  // Redact sensitive demographic fields for DEPT_COORDINATOR and other unauthorized callers
  const copy: Record<string, unknown> = { ...student };
  delete copy.dateOfBirth;
  delete copy.gender;
  delete copy.phone;

  return {
    ...copy,
    isDemographicsRedacted: true,
  } as T & { isDemographicsRedacted: boolean };
}

export function redactStudentListDemographics<T extends Record<string, unknown>>(
  students: T[],
  role?: UserRole | string,
  currentStudentId?: string
): Array<T & { isDemographicsRedacted?: boolean }> {
  const allowAll = role === 'SUPER_ADMIN' || role === 'TPO';
  if (allowAll) {
    return students.map((s) => ({ ...s, isDemographicsRedacted: false }));
  }

  return students.map((s) => {
    const isOwn = currentStudentId && (s._id?.toString() === currentStudentId || s.id?.toString() === currentStudentId);
    return redactStudentDemographics(s, role, Boolean(isOwn));
  });
}
