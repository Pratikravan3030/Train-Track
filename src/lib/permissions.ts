/**
 * Central Authorization & Role-Based Access Control (RBAC) Policy
 * 
 * Principle: Default-Deny.
 * A role may perform an action on a resource ONLY if explicitly granted in this policy.
 * Any missing mapping resolves to scope: 'none' (403 Forbidden).
 */

import { UserRole } from '@/config/collegeConfig';

export type Resource =
  | 'students'
  | 'sessions'
  | 'attendance'
  | 'feedback'
  | 'dashboard'
  | 'search'
  | 'health'
  | 'users'
  | 'audit'
  | 'companies'
  | 'drives'
  | 'applications'
  | 'offers'
  | 'reports'
  | 'assessments';

export type Action =
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'restore'
  | 'update_placement'
  | 'export'
  | 'import'
  | 'manage_shortlist'
  | 'register'
  | 'withdraw'
  | 'override';

export type PermissionScope = 'all' | 'own-department' | 'own-record' | 'none';

export interface PermissionRule {
  scope: PermissionScope;
  notes?: string;
}

// Type mapping: Role -> Resource -> Action -> PermissionRule
export type PermissionPolicy = Record<
  UserRole,
  Partial<Record<Resource, Partial<Record<Action, PermissionRule>>>>
>;

export const PERMISSION_MATRIX: PermissionPolicy = {
  SUPER_ADMIN: {
    students: {
      read: { scope: 'all' },
      create: { scope: 'all' },
      update: { scope: 'all' },
      delete: { scope: 'all' },
      restore: { scope: 'all' },
      update_placement: { scope: 'all' },
      export: { scope: 'all' },
      import: { scope: 'all' },
    },
    sessions: {
      read: { scope: 'all' },
      create: { scope: 'all' },
      update: { scope: 'all' },
      delete: { scope: 'all' },
      restore: { scope: 'all' },
    },
    attendance: {
      read: { scope: 'all' },
      create: { scope: 'all' },
      update: { scope: 'all' },
      delete: { scope: 'all' },
    },
    feedback: {
      read: { scope: 'all' },
      create: { scope: 'all', notes: 'Observer evaluation with null studentId' },
      delete: { scope: 'all' },
    },
    dashboard: {
      read: { scope: 'all' },
    },
    search: {
      read: { scope: 'all' },
    },
    health: {
      read: { scope: 'all' },
    },
    users: {
      read: { scope: 'all' },
      create: { scope: 'all' },
      update: { scope: 'all' },
      delete: { scope: 'all' },
    },
    audit: {
      read: { scope: 'all' },
    },
    companies: {
      read: { scope: 'all' },
      create: { scope: 'all' },
      update: { scope: 'all' },
      delete: { scope: 'all' },
      restore: { scope: 'all' },
    },
    drives: {
      read: { scope: 'all' },
      create: { scope: 'all' },
      update: { scope: 'all' },
      delete: { scope: 'all' },
      restore: { scope: 'all' },
      manage_shortlist: { scope: 'all' },
      export: { scope: 'all' },
    },
    applications: {
      read: { scope: 'all' },
      register: { scope: 'all' },
      withdraw: { scope: 'all' },
      override: { scope: 'all' },
      export: { scope: 'all' },
    },
    offers: {
      read: { scope: 'all' },
      create: { scope: 'all' },
      update: { scope: 'all' },
      delete: { scope: 'all' },
      override: { scope: 'all' },
    },
    reports: {
      read: { scope: 'all' },
      export: { scope: 'all' },
    },
    assessments: {
      read: { scope: 'all' },
      create: { scope: 'all' },
      update: { scope: 'all' },
      delete: { scope: 'all' },
      import: { scope: 'all' },
    },
  },

  TPO: {
    students: {
      read: { scope: 'all' },
      create: { scope: 'all' },
      update: { scope: 'all' },
      delete: { scope: 'all' },
      update_placement: { scope: 'all' },
      export: { scope: 'all' },
      import: { scope: 'all' },
    },
    sessions: {
      read: { scope: 'all' },
      create: { scope: 'all' },
      update: { scope: 'all' },
      delete: { scope: 'all' },
    },
    attendance: {
      read: { scope: 'all' },
      create: { scope: 'all' },
      update: { scope: 'all' },
    },
    feedback: {
      read: { scope: 'all' },
      create: { scope: 'all', notes: 'Observer note with null studentId' },
    },
    dashboard: {
      read: { scope: 'all' },
    },
    search: {
      read: { scope: 'all' },
    },
    companies: {
      read: { scope: 'all' },
      create: { scope: 'all' },
      update: { scope: 'all' },
      delete: { scope: 'all' },
    },
    drives: {
      read: { scope: 'all' },
      create: { scope: 'all' },
      update: { scope: 'all' },
      delete: { scope: 'all' },
      manage_shortlist: { scope: 'all' },
      export: { scope: 'all' },
    },
    applications: {
      read: { scope: 'all' },
      register: { scope: 'all' },
      withdraw: { scope: 'all' },
      override: { scope: 'all' },
      export: { scope: 'all' },
    },
    offers: {
      read: { scope: 'all' },
      create: { scope: 'all' },
      update: { scope: 'all' },
      delete: { scope: 'all' },
      override: { scope: 'all' },
    },
    reports: {
      read: { scope: 'all' },
      export: { scope: 'all' },
    },
    assessments: {
      read: { scope: 'all' },
      create: { scope: 'all' },
      update: { scope: 'all' },
      delete: { scope: 'all' },
      import: { scope: 'all' },
    },
    // health: none (SUPER_ADMIN only)
    // users: none
    // audit: none
  },

  DEPT_COORDINATOR: {
    students: {
      read: { scope: 'own-department' },
      create: { scope: 'own-department' },
      update: { scope: 'own-department' },
      delete: { scope: 'none', notes: 'Coordinators cannot delete students' },
      update_placement: { scope: 'none', notes: 'Placement status changes only by TPO/SUPER_ADMIN' },
      export: { scope: 'own-department' },
      import: { scope: 'own-department' },
    },
    sessions: {
      read: { scope: 'all', notes: 'Sessions visible, roster scoped to own department' },
      create: { scope: 'none' },
      update: { scope: 'none' },
      delete: { scope: 'none' },
    },
    attendance: {
      read: { scope: 'own-department' },
      create: { scope: 'own-department' },
      update: { scope: 'own-department' },
      delete: { scope: 'none' },
    },
    feedback: {
      read: { scope: 'own-department', notes: 'Feedback from own department students only' },
      create: { scope: 'none' },
      delete: { scope: 'none' },
    },
    dashboard: {
      read: { scope: 'own-department', notes: 'All metrics strictly aggregated on own department' },
    },
    search: {
      read: { scope: 'own-department', notes: 'Students scoped to dept, sessions campus-wide' },
    },
    companies: {
      read: { scope: 'all', notes: 'Visible, but HR contacts hidden' },
      create: { scope: 'none' },
      update: { scope: 'none' },
      delete: { scope: 'none' },
    },
    drives: {
      read: { scope: 'all', notes: 'Drive details visible, applicants scoped to own dept' },
      create: { scope: 'none' },
      update: { scope: 'none' },
      delete: { scope: 'none' },
      manage_shortlist: { scope: 'none' },
      export: { scope: 'own-department' },
    },
    applications: {
      read: { scope: 'own-department', notes: 'Applications from own department students only' },
      register: { scope: 'none' },
      withdraw: { scope: 'none' },
      override: { scope: 'none' },
      export: { scope: 'own-department' },
    },
    offers: {
      read: { scope: 'own-department', notes: 'Offers for own department students only' },
      create: { scope: 'none' },
      update: { scope: 'none' },
      delete: { scope: 'none' },
    },
    reports: {
      read: { scope: 'own-department' },
      export: { scope: 'own-department' },
    },
    assessments: {
      read: { scope: 'own-department' },
      create: { scope: 'none' },
      update: { scope: 'none' },
      delete: { scope: 'none' },
      import: { scope: 'none' },
    },
    // health: none
    // users: none
    // audit: none
  },

  STUDENT: {
    // Until Student Portal Phase 6: Default-deny on all student directory, attendance, health, dashboard, drives
    students: {
      read: { scope: 'none', notes: 'Deny until Phase 6 student portal' },
      create: { scope: 'none' },
      update: { scope: 'none' },
      delete: { scope: 'none' },
      update_placement: { scope: 'none' },
      export: { scope: 'none' },
      import: { scope: 'none' },
    },
    sessions: {
      read: { scope: 'all', notes: 'Read session details without attendee roster' },
      create: { scope: 'none' },
      update: { scope: 'none' },
      delete: { scope: 'none' },
    },
    attendance: {
      read: { scope: 'none', notes: 'Deny until Phase 6 student portal' },
      create: { scope: 'none' },
      update: { scope: 'none' },
      delete: { scope: 'none' },
    },
    feedback: {
      read: { scope: 'none', notes: 'Cannot view others feedback' },
      create: { scope: 'own-record', notes: 'Forced to own studentId, max 1 per session' },
      update: { scope: 'none' },
      delete: { scope: 'none' },
    },
    dashboard: {
      read: { scope: 'none' },
    },
    search: {
      read: { scope: 'all', notes: 'Search training sessions only, no student records' },
    },
    companies: {
      read: { scope: 'none', notes: 'Deny until Phase 6 student portal' },
      create: { scope: 'none' },
      update: { scope: 'none' },
      delete: { scope: 'none' },
    },
    drives: {
      read: { scope: 'none', notes: 'Deny until Phase 6 student portal' },
      create: { scope: 'none' },
      update: { scope: 'none' },
      delete: { scope: 'none' },
      manage_shortlist: { scope: 'none' },
      export: { scope: 'none' },
    },
    applications: {
      read: { scope: 'none', notes: 'Deny until Phase 6 student portal' },
      register: { scope: 'none', notes: 'Deny until Phase 6 student portal' },
      withdraw: { scope: 'none', notes: 'Deny until Phase 6 student portal' },
      override: { scope: 'none' },
      export: { scope: 'none' },
    },
    offers: {
      read: { scope: 'none', notes: 'Deny until Phase 6 student portal' },
      create: { scope: 'none' },
      update: { scope: 'none' },
      delete: { scope: 'none' },
    },
    // health: none
    // users: none
    // audit: none
  },
};

/**
 * Check permission using default-deny principle.
 */
export function getPermission(
  role: UserRole | undefined,
  resource: Resource,
  action: Action
): PermissionRule {
  if (!role || !PERMISSION_MATRIX[role]) {
    return { scope: 'none' };
  }

  const resourceRules = PERMISSION_MATRIX[role]?.[resource];
  if (!resourceRules) {
    return { scope: 'none' };
  }

  const actionRule = resourceRules[action];
  if (!actionRule) {
    return { scope: 'none' };
  }

  return actionRule;
}

/**
 * Returns true if the role has any non-'none' permission for the given resource and action.
 */
export function isAllowed(
  role: UserRole | undefined,
  resource: Resource,
  action: Action
): boolean {
  return getPermission(role, resource, action).scope !== 'none';
}
