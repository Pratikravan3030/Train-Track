import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import {
  checkRateLimit,
  recordFailedAttempt,
  resetRateLimits,
  extractClientIp,
} from '@/lib/rate-limit';
import { logAudit } from '@/lib/audit';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email.trim().toLowerCase();
        const password = credentials.password;
        const clientIp = extractClientIp((req?.headers as unknown as Headers) || {});

        // 1. Separate IP and Email rate limiting with progressive backoff (Attacker DOS protection)
        const rateCheck = await checkRateLimit(email, clientIp);
        if (!rateCheck.allowed) {
          await logAudit({
            userEmail: email,
            action: 'LOGIN_RATE_LIMITED',
            resource: 'Auth',
            ipAddress: clientIp,
            details: {
              reason: rateCheck.reason,
              retryAfterSeconds: rateCheck.retryAfterSeconds,
            },
          });

          if (rateCheck.reason === 'IP_BLOCKED') {
            throw new Error(
              `Access temporarily blocked due to repeated failed login attempts from this network. Retry in ${Math.ceil(
                (rateCheck.retryAfterSeconds || 1800) / 60
              )} minutes.`
            );
          }

          throw new Error(
            `Account security cooldown active. Please wait ${rateCheck.retryAfterSeconds || 60} seconds before retrying.`
          );
        }

        await dbConnect();

        // 2. Query user from database only (no runtime creation using ADMIN_PASSWORD)
        const userDoc = await User.findOne({ email });

        if (!userDoc) {
          const adminCount = await User.countDocuments({ role: 'SUPER_ADMIN' });
          if (adminCount === 0) {
            throw new Error(
              'No administrator account exists yet. Please run "npm run seed:admin" in your terminal to bootstrap the system.'
            );
          }

          await recordFailedAttempt(email, clientIp);
          await logAudit({
            userEmail: email,
            action: 'LOGIN_FAILED',
            resource: 'Auth',
            ipAddress: clientIp,
            details: { reason: 'User not found' },
          });
          return null;
        }

        if (!userDoc.isActive) {
          await logAudit({
            userId: userDoc._id,
            userEmail: userDoc.email,
            userRole: userDoc.role,
            action: 'LOGIN_INACTIVE_ATTEMPT',
            resource: 'Auth',
            ipAddress: clientIp,
          });
          throw new Error('This account has been deactivated. Please contact the administrator.');
        }

        // 3. Verify password
        const passwordMatch = await bcrypt.compare(password, userDoc.password);

        if (!passwordMatch) {
          const failureStatus = await recordFailedAttempt(email, clientIp);
          await logAudit({
            userId: userDoc._id,
            userEmail: userDoc.email,
            userRole: userDoc.role,
            action: 'LOGIN_FAILED',
            resource: 'Auth',
            ipAddress: clientIp,
            details: {
              reason: 'Incorrect password',
              blocked: failureStatus.blocked,
              blockReason: failureStatus.reason,
              retryAfterSeconds: failureStatus.retryAfterSeconds,
            },
          });
          return null;
        }

        // 4. Successful authentication - Reset rate limit counters
        await resetRateLimits(email, clientIp);
        userDoc.lastLoginAt = new Date();
        await userDoc.save();

        await logAudit({
          userId: userDoc._id,
          userEmail: userDoc.email,
          userRole: userDoc.role,
          action: 'LOGIN_SUCCESS',
          resource: 'Auth',
          ipAddress: clientIp,
        });

        return {
          id: userDoc._id.toString(),
          name: userDoc.name,
          email: userDoc.email,
          role: userDoc.role,
          department: userDoc.department,
          studentId: userDoc.studentId ? userDoc.studentId.toString() : undefined,
          mustChangePassword: userDoc.mustChangePassword || false,
          tokenVersion: userDoc.tokenVersion || 1,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.department = user.department;
        token.studentId = user.studentId;
        token.mustChangePassword = user.mustChangePassword;
        token.tokenVersion = user.tokenVersion || 1;
      }
      if (trigger === 'update') {
        if (session?.mustChangePassword !== undefined) {
          token.mustChangePassword = session.mustChangePassword;
        }
        if (session?.tokenVersion !== undefined) {
          token.tokenVersion = session.tokenVersion;
        }
        try {
          await dbConnect();
          const dbUser = await User.findById(token.id).select(
            'tokenVersion mustChangePassword role department studentId isActive'
          );
          if (dbUser) {
            token.tokenVersion = dbUser.tokenVersion || 1;
            token.mustChangePassword = dbUser.mustChangePassword || false;
            token.role = dbUser.role;
            token.department = dbUser.department;
            token.studentId = dbUser.studentId ? dbUser.studentId.toString() : undefined;
          }
        } catch (err) {
          console.error('[NextAuth trigger=update DB error]:', err);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.department = token.department;
        session.user.studentId = token.studentId;
        session.user.mustChangePassword = token.mustChangePassword;
        session.user.tokenVersion = token.tokenVersion;
      }
      return session;
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
