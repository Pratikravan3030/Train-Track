import { describe, it, expect } from 'vitest';
import {
  getPermission,
  isAllowed,
  Resource,
  Action,
} from '@/lib/permissions';
import { canAccessDepartment, AuthContext } from '@/lib/auth-guards';
import { COLLEGE_ROLES, UserRole } from '@/config/collegeConfig';

describe('Central RBAC Permission Policy & Authorization Enforcement', () => {
  describe('Default-Deny Principle', () => {
    it('denies access when role is undefined', () => {
      expect(isAllowed(undefined, 'students', 'read')).toBe(false);
      expect(getPermission(undefined, 'students', 'read').scope).toBe('none');
    });

    it('denies undefined actions on defined resources', () => {
      // @ts-expect-error Testing invalid action input
      expect(isAllowed('TPO', 'students', 'invalidAction')).toBe(false);
    });

    it('denies undefined resources on defined roles', () => {
      // @ts-expect-error Testing invalid resource input
      expect(isAllowed('DEPT_COORDINATOR', 'unknownResource', 'read')).toBe(false);
    });
  });

  describe('STUDENT Role Boundary Tests (Pre-Phase 6 Default-Deny)', () => {
    const studentRole: UserRole = 'STUDENT';

    it('DENIES student from reading the student directory', () => {
      expect(isAllowed(studentRole, 'students', 'read')).toBe(false);
      expect(getPermission(studentRole, 'students', 'read').scope).toBe('none');
    });

    it('DENIES student from modifying or creating student records', () => {
      expect(isAllowed(studentRole, 'students', 'create')).toBe(false);
      expect(isAllowed(studentRole, 'students', 'update')).toBe(false);
      expect(isAllowed(studentRole, 'students', 'delete')).toBe(false);
    });

    it('DENIES student from reading attendance records', () => {
      expect(isAllowed(studentRole, 'attendance', 'read')).toBe(false);
      expect(isAllowed(studentRole, 'attendance', 'create')).toBe(false);
    });

    it('DENIES student from accessing system health diagnostics', () => {
      expect(isAllowed(studentRole, 'health', 'read')).toBe(false);
    });

    it('DENIES student from accessing staff dashboard statistics', () => {
      expect(isAllowed(studentRole, 'dashboard', 'read')).toBe(false);
    });

    it('DENIES student from reading others feedback logs', () => {
      expect(isAllowed(studentRole, 'feedback', 'read')).toBe(false);
    });

    it('ALLOWS student to view training sessions list and detail', () => {
      expect(isAllowed(studentRole, 'sessions', 'read')).toBe(true);
      expect(getPermission(studentRole, 'sessions', 'read').scope).toBe('all');
    });

    it('DENIES student from scheduling or deleting training sessions', () => {
      expect(isAllowed(studentRole, 'sessions', 'create')).toBe(false);
      expect(isAllowed(studentRole, 'sessions', 'update')).toBe(false);
      expect(isAllowed(studentRole, 'sessions', 'delete')).toBe(false);
    });

    it('ALLOWS student to submit feedback strictly for own record', () => {
      expect(isAllowed(studentRole, 'feedback', 'create')).toBe(true);
      expect(getPermission(studentRole, 'feedback', 'create').scope).toBe('own-record');
    });

    it('ALLOWS student to search training sessions', () => {
      expect(isAllowed(studentRole, 'search', 'read')).toBe(true);
    });
  });

  describe('DEPT_COORDINATOR Scoping Tests', () => {
    const coordRole: UserRole = 'DEPT_COORDINATOR';

    it('scopes students read/create/update strictly to own-department', () => {
      expect(getPermission(coordRole, 'students', 'read').scope).toBe('own-department');
      expect(getPermission(coordRole, 'students', 'create').scope).toBe('own-department');
      expect(getPermission(coordRole, 'students', 'update').scope).toBe('own-department');
    });

    it('DENIES coordinator from deleting students', () => {
      expect(isAllowed(coordRole, 'students', 'delete')).toBe(false);
      expect(getPermission(coordRole, 'students', 'delete').scope).toBe('none');
    });

    it('scopes attendance read/create/update to own-department', () => {
      expect(getPermission(coordRole, 'attendance', 'read').scope).toBe('own-department');
      expect(getPermission(coordRole, 'attendance', 'create').scope).toBe('own-department');
      expect(getPermission(coordRole, 'attendance', 'update').scope).toBe('own-department');
    });

    it('scopes feedback reading to own-department', () => {
      expect(getPermission(coordRole, 'feedback', 'read').scope).toBe('own-department');
      expect(isAllowed(coordRole, 'feedback', 'create')).toBe(false);
    });

    it('scopes dashboard stats to own-department', () => {
      expect(getPermission(coordRole, 'dashboard', 'read').scope).toBe('own-department');
    });

    it('DENIES coordinator from accessing system health', () => {
      expect(isAllowed(coordRole, 'health', 'read')).toBe(false);
    });
  });

  describe('Cross-Department Access Control (canAccessDepartment)', () => {
    const cseCoordinator: AuthContext = {
      id: 'coord-cse-1',
      role: 'DEPT_COORDINATOR',
      department: 'Computer Science & Engineering',
    };

    const tpoUser: AuthContext = {
      id: 'tpo-1',
      role: 'TPO',
    };

    const superAdminUser: AuthContext = {
      id: 'admin-1',
      role: 'SUPER_ADMIN',
    };

    const studentUser: AuthContext = {
      id: 'student-1',
      role: 'STUDENT',
      department: 'Computer Science & Engineering',
    };

    it('allows coordinator to access students in their own department', () => {
      expect(canAccessDepartment(cseCoordinator, 'Computer Science & Engineering')).toBe(true);
      expect(canAccessDepartment(cseCoordinator, 'computer science & engineering')).toBe(true);
    });

    it('REJECTS coordinator from accessing students in other departments', () => {
      expect(canAccessDepartment(cseCoordinator, 'Mechanical Engineering')).toBe(false);
      expect(canAccessDepartment(cseCoordinator, 'Civil Engineering')).toBe(false);
      expect(canAccessDepartment(cseCoordinator, 'Information Technology')).toBe(false);
    });

    it('allows SUPER_ADMIN and TPO cross-department universal access', () => {
      expect(canAccessDepartment(superAdminUser, 'Mechanical Engineering')).toBe(true);
      expect(canAccessDepartment(superAdminUser, 'Computer Science & Engineering')).toBe(true);
      expect(canAccessDepartment(tpoUser, 'Mechanical Engineering')).toBe(true);
      expect(canAccessDepartment(tpoUser, 'Information Technology')).toBe(true);
    });

    it('denies STUDENT from cross-department or coordinator access', () => {
      expect(canAccessDepartment(studentUser, 'Mechanical Engineering')).toBe(false);
      expect(canAccessDepartment(studentUser, 'Computer Science & Engineering')).toBe(false);
    });
  });

  describe('Health Endpoint Restricted to SUPER_ADMIN', () => {
    it('permits SUPER_ADMIN to access health', () => {
      expect(isAllowed('SUPER_ADMIN', 'health', 'read')).toBe(true);
      expect(getPermission('SUPER_ADMIN', 'health', 'read').scope).toBe('all');
    });

    it('DENIES TPO, DEPT_COORDINATOR, and STUDENT from health endpoint', () => {
      expect(isAllowed('TPO', 'health', 'read')).toBe(false);
      expect(isAllowed('DEPT_COORDINATOR', 'health', 'read')).toBe(false);
      expect(isAllowed('STUDENT', 'health', 'read')).toBe(false);
    });
  });

  describe('Placement Status & Data Transfer Action Permissions', () => {
    it('ALLOWS only SUPER_ADMIN and TPO to update_placement on students', () => {
      expect(isAllowed('SUPER_ADMIN', 'students', 'update_placement')).toBe(true);
      expect(getPermission('SUPER_ADMIN', 'students', 'update_placement').scope).toBe('all');

      expect(isAllowed('TPO', 'students', 'update_placement')).toBe(true);
      expect(getPermission('TPO', 'students', 'update_placement').scope).toBe('all');

      expect(isAllowed('DEPT_COORDINATOR', 'students', 'update_placement')).toBe(false);
      expect(getPermission('DEPT_COORDINATOR', 'students', 'update_placement').scope).toBe('none');

      expect(isAllowed('STUDENT', 'students', 'update_placement')).toBe(false);
      expect(getPermission('STUDENT', 'students', 'update_placement').scope).toBe('none');
    });

    it('scopes export and import permissions properly per role', () => {
      expect(getPermission('SUPER_ADMIN', 'students', 'export').scope).toBe('all');
      expect(getPermission('SUPER_ADMIN', 'students', 'import').scope).toBe('all');

      expect(getPermission('TPO', 'students', 'export').scope).toBe('all');
      expect(getPermission('TPO', 'students', 'import').scope).toBe('all');

      expect(getPermission('DEPT_COORDINATOR', 'students', 'export').scope).toBe('own-department');
      expect(getPermission('DEPT_COORDINATOR', 'students', 'import').scope).toBe('own-department');

      expect(getPermission('STUDENT', 'students', 'export').scope).toBe('none');
      expect(getPermission('STUDENT', 'students', 'import').scope).toBe('none');
    });
  });

  describe('Role-Resource-Action Exhaustive Matrix Check', () => {
    const roles = COLLEGE_ROLES;
    const resources: Resource[] = [
      'students',
      'sessions',
      'attendance',
      'feedback',
      'dashboard',
      'search',
      'health',
      'users',
      'audit',
    ];
    const actions: Action[] = [
      'read',
      'create',
      'update',
      'delete',
      'update_placement',
      'export',
      'import',
    ];

    it('returns a valid PermissionRule with a defined scope for every combination', () => {
      for (const role of roles) {
        for (const res of resources) {
          for (const action of actions) {
            const rule = getPermission(role, res, action);
            expect(rule).toBeDefined();
            expect(['all', 'own-department', 'own-record', 'none']).toContain(rule.scope);
          }
        }
      }
    });
  });
});
