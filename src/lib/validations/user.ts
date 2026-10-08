import { z } from 'zod';
import { COLLEGE_ROLES } from '@/config/collegeConfig';

export const passwordComplexityRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+\-=[\]{};':"\\|,.<>/]).{8,}$/;

export const createUserSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
    email: z.string().trim().email('Invalid email address').toLowerCase(),
    role: z.enum(COLLEGE_ROLES),
    department: z.string().trim().optional(),
  })
  .refine(
    (data) => {
      if (data.role === 'DEPT_COORDINATOR') {
        return Boolean(data.department && data.department.trim().length > 0);
      }
      return true;
    },
    {
      message: 'Department code is required for Department Coordinators',
      path: ['department'],
    }
  );

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  role: z.enum(COLLEGE_ROLES).optional(),
  department: z.string().trim().optional(),
  isActive: z.boolean().optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'New password must be at least 8 characters')
      .regex(
        passwordComplexityRegex,
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
      ),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'New passwords do not match',
    path: ['confirmPassword'],
  });
