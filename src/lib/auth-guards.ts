import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { UserRole, isStudentPortalEnabled } from '@/config/collegeConfig';
import { Resource, Action, PermissionScope, getPermission } from '@/lib/permissions';
import { mapToDepartmentCode } from '@/lib/departmentMapper';
import dbConnect from '@/lib/db';
import User from '@/models/User';

export interface AuthContext {
  id: string;
  name?: string | null;
  email?: string | null;
  role: UserRole;
  department?: string;
  studentId?: string;
  mustChangePassword?: boolean;
  tokenVersion?: number;
}

export type PermissionAuthResult =
  | { authorized: true; user: AuthContext; scope: PermissionScope }
  | { authorized: false; response: NextResponse };

export type AuthResult =
  | { authorized: true; user: AuthContext }
  | { authorized: false; response: NextResponse };

export interface GuardOptions {
  allowPasswordChangePending?: boolean;
}

/**
 * Validates the session user against MongoDB:
 * 1. Confirms the user still exists in the database.
 * 2. Confirms the user account is active (isActive === true).
 * 3. Confirms the tokenVersion matches the database (session invalidation).
 * 4. Confirms mustChangePassword is not blocking access (unless explicitly allowed).
 */
async function validateUserSession(
  sessionUser: AuthContext,
  options?: GuardOptions
): Promise<{ valid: true; user: AuthContext } | { valid: false; response: NextResponse }> {
  // Global feature flag check: When student portal is disabled, student sessions are rejected with 403
  if (sessionUser.role === 'STUDENT' && !isStudentPortalEnabled()) {
    return {
      valid: false,
      response: NextResponse.json(
        { error: 'Student portal is currently disabled. Please contact the Training & Placement Cell.' },
        { status: 403 }
      ),
    };
  }

  // If user has an identifier, verify against MongoDB
  if (sessionUser.id) {
    try {
      await dbConnect();
      const isValidObjectId = mongoose.Types.ObjectId.isValid(sessionUser.id);
      const dbUser = isValidObjectId
        ? await User.findById(sessionUser.id).select(
            'isActive tokenVersion mustChangePassword role department studentId'
          )
        : sessionUser.email
        ? await User.findOne({ email: sessionUser.email.toLowerCase() }).select(
            'isActive tokenVersion mustChangePassword role department studentId'
          )
        : null;

      if (!dbUser) {
        return {
          valid: false,
          response: NextResponse.json(
            { error: 'User account no longer exists.' },
            { status: 401 }
          ),
        };
      }

      if (!dbUser.isActive) {
        return {
          valid: false,
          response: NextResponse.json(
            { error: 'Account has been deactivated. Please contact administrator.' },
            { status: 403 }
          ),
        };
      }

      // Check session invalidation (tokenVersion mismatch)
      const sessionVersion = sessionUser.tokenVersion ?? 1;
      const currentDbVersion = dbUser.tokenVersion ?? 1;
      if (sessionVersion !== currentDbVersion) {
        return {
          valid: false,
          response: NextResponse.json(
            { error: 'Session has been invalidated. Please sign in again.' },
            { status: 401 }
          ),
        };
      }

      // Check forced password change requirement
      const mustChange = dbUser.mustChangePassword ?? sessionUser.mustChangePassword ?? false;
      if (mustChange && !options?.allowPasswordChangePending) {
        return {
          valid: false,
          response: NextResponse.json(
            {
              error: 'Password change required before accessing this resource.',
              code: 'PASSWORD_CHANGE_REQUIRED',
            },
            { status: 403 }
          ),
        };
      }

      // Synchronize latest active DB state onto the session context
      sessionUser.role = dbUser.role;
      sessionUser.department = dbUser.department;
      sessionUser.studentId = dbUser.studentId ? dbUser.studentId.toString() : undefined;
      sessionUser.mustChangePassword = dbUser.mustChangePassword;
      sessionUser.tokenVersion = dbUser.tokenVersion;
    } catch (err) {
      console.error('[validateUserSession error]:', err);
      // If DB error, fail-safe check for mustChangePassword
      if (sessionUser.mustChangePassword && !options?.allowPasswordChangePending) {
        return {
          valid: false,
          response: NextResponse.json(
            {
              error: 'Password change required before accessing this resource.',
              code: 'PASSWORD_CHANGE_REQUIRED',
            },
            { status: 403 }
          ),
        };
      }
    }
  } else {
    // If no ID is present, enforce mustChangePassword from token
    if (sessionUser.mustChangePassword && !options?.allowPasswordChangePending) {
      return {
        valid: false,
        response: NextResponse.json(
          {
            error: 'Password change required before accessing this resource.',
            code: 'PASSWORD_CHANGE_REQUIRED',
          },
          { status: 403 }
        ),
      };
    }
  }

  return { valid: true, user: sessionUser };
}

/**
 * Enforces role x resource x action using the central RBAC policy in src/lib/permissions.ts.
 * Implements default-deny: if scope is 'none', returns 403 Forbidden.
 */
export async function requirePermission(
  resource: Resource,
  action: Action,
  options?: GuardOptions
): Promise<PermissionAuthResult> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Unauthorized. Please sign in to access this resource.' },
        { status: 401 }
      ),
    };
  }

  const sessionUser = session.user as AuthContext;
  const validation = await validateUserSession(sessionUser, options);
  if (!validation.valid) {
    return { authorized: false, response: validation.response };
  }

  const user = validation.user;
  const permission = getPermission(user.role, resource, action);

  if (permission.scope === 'none') {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          error: `Forbidden. Role '${user.role}' is not permitted to perform '${action}' on '${resource}'.`,
        },
        { status: 403 }
      ),
    };
  }

  return {
    authorized: true,
    user,
    scope: permission.scope,
  };
}

/**
 * Verifies session and asserts that the user holds one of the required roles.
 * Returns either an authorized user context or a ready-to-return NextResponse (401 or 403).
 */
export async function requireAuth(
  allowedRoles?: UserRole[],
  options?: GuardOptions
): Promise<AuthResult> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Unauthorized. Please log in to access this resource.' },
        { status: 401 }
      ),
    };
  }

  const sessionUser = session.user as AuthContext;
  const validation = await validateUserSession(sessionUser, options);
  if (!validation.valid) {
    return { authorized: false, response: validation.response };
  }

  const user = validation.user;

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          error: `Forbidden. Role '${user.role}' does not have sufficient permission for this action.`,
        },
        { status: 403 }
      ),
    };
  }

  return {
    authorized: true,
    user,
  };
}

/**
 * Checks if a user has access to a specific department resource.
 * SUPER_ADMIN and TPO have universal cross-department access.
 * DEPT_COORDINATOR can only view/manage their assigned department.
 */
export function canAccessDepartment(user: AuthContext, departmentName?: string): boolean {
  if (user.role === 'SUPER_ADMIN' || user.role === 'TPO') {
    return true;
  }
  if (user.role === 'DEPT_COORDINATOR') {
    if (!departmentName) return true;
    const userCode = mapToDepartmentCode(user.department) || user.department?.trim().toUpperCase();
    const targetCode = mapToDepartmentCode(departmentName) || departmentName.trim().toUpperCase();
    if (userCode && targetCode && userCode === targetCode) {
      return true;
    }
    return user.department?.trim().toLowerCase() === departmentName.trim().toLowerCase();
  }
  return false;
}

/**
 * Guard restricted strictly to students accessing their self-service portal.
 * Enforces:
 * 1. STUDENT_PORTAL_ENABLED feature flag (403 if disabled)
 * 2. Authenticated session exists (401 if not)
 * 3. Role is STUDENT and linked to a valid studentId (403 if not)
 */
export async function requireStudentAuth(
  options?: GuardOptions
): Promise<
  | { authorized: true; user: AuthContext & { studentId: string } }
  | { authorized: false; response: NextResponse }
> {
  if (!isStudentPortalEnabled()) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Student portal is currently disabled. Please contact the Training & Placement Cell.' },
        { status: 403 }
      ),
    };
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Unauthorized. Please sign in to access the student portal.' },
        { status: 401 }
      ),
    };
  }

  const sessionUser = session.user as AuthContext;
  const validation = await validateUserSession(sessionUser, options);
  if (!validation.valid) {
    return { authorized: false, response: validation.response };
  }

  const user = validation.user;
  if (user.role !== 'STUDENT' || !user.studentId) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Forbidden. This portal is restricted to enrolled students with active records.' },
        { status: 403 }
      ),
    };
  }

  return {
    authorized: true,
    user: user as AuthContext & { studentId: string },
  };
}
