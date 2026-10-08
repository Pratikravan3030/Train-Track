import { UserRole } from '@/config/collegeConfig';
import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface User {
    id: string;
    role: UserRole;
    department?: string;
    studentId?: string;
    mustChangePassword?: boolean;
    tokenVersion?: number;
  }

  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: UserRole;
      department?: string;
      studentId?: string;
      mustChangePassword?: boolean;
      tokenVersion?: number;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: UserRole;
    department?: string;
    studentId?: string;
    mustChangePassword?: boolean;
    tokenVersion?: number;
  }
}
