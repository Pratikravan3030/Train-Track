import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  extractClientIp,
  checkRateLimit,
  recordFailedAttempt,
  resetRateLimits,
  computeBackoffSeconds,
  EMAIL_BACKOFF_THRESHOLD,
} from '@/lib/rate-limit';
import LoginAttempt from '@/models/LoginAttempt';

describe('Rate Limiting & Campus NAT Security Tests', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    process.env.MONGODB_URI = uri;
    await mongoose.connect(uri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await LoginAttempt.deleteMany({});
  });

  describe('extractClientIp - Edge Proxy IP Extraction & Fallbacks', () => {
    it('prioritizes x-vercel-forwarded-for over other headers', () => {
      const headers = new Headers({
        'x-vercel-forwarded-for': '203.0.113.195, 10.0.0.1',
        'x-forwarded-for': '198.51.100.22',
        'x-real-ip': '192.0.2.1',
      });
      expect(extractClientIp(headers)).toBe('203.0.113.195');
    });

    it('falls back to x-forwarded-for when x-vercel-forwarded-for is missing', () => {
      const headers = new Headers({
        'x-forwarded-for': '198.51.100.22, 10.0.0.2',
        'x-real-ip': '192.0.2.1',
      });
      expect(extractClientIp(headers)).toBe('198.51.100.22');
    });

    it('falls back to x-real-ip when forward headers are missing', () => {
      const headers = new Headers({
        'x-real-ip': '192.0.2.45',
      });
      expect(extractClientIp(headers)).toBe('192.0.2.45');
    });

    it('handles raw record objects as well as Headers instance', () => {
      const rawHeaders = {
        'x-vercel-forwarded-for': '103.21.244.2',
      };
      expect(extractClientIp(rawHeaders)).toBe('103.21.244.2');
    });

    it('returns null (unidentified client) when no client IP headers are present instead of pooling to 127.0.0.1', () => {
      const emptyHeaders = new Headers();
      expect(extractClientIp(emptyHeaders)).toBeNull();

      const emptyObject = {};
      expect(extractClientIp(emptyObject)).toBeNull();
    });
  });

  describe('Campus NAT Tolerance & Credential Stuffing Defense', () => {
    const campusIp = '103.21.244.10'; // Shared campus NAT public IP for DYPCET

    it('does NOT lock out an entire campus IP when 10 different students fail login', async () => {
      // Simulate 10 students behind DYPCET campus NAT failing their login once
      for (let i = 1; i <= 10; i++) {
        const studentEmail = `student${i}@dypcet.edu`;
        const result = await recordFailedAttempt(studentEmail, campusIp);
        expect(result.blocked).toBe(false);
      }

      // Check an 11th distinct student from the same campus IP:
      // MUST NOT be blocked. Campus NAT shares an IP across thousands of devices.
      const innocentStudentCheck = await checkRateLimit('innocent.student@dypcet.edu', campusIp);
      expect(innocentStudentCheck.allowed).toBe(true);
      expect(innocentStudentCheck.remainingAttempts).toBe(EMAIL_BACKOFF_THRESHOLD);
      expect(innocentStudentCheck.reason).toBeUndefined();
    });

    it('locks out attacking IP only when exceeding distinct email spray threshold (25+ accounts)', async () => {
      const attackerIp = '185.220.101.5';

      // Attacker targets 24 accounts: IP is not yet locked
      for (let i = 1; i <= 24; i++) {
        await recordFailedAttempt(`victim-${i}@dypcet.edu`, attackerIp);
      }
      let check = await checkRateLimit('another-target@dypcet.edu', attackerIp);
      expect(check.allowed).toBe(true);

      // 25th distinct account targeted triggers IP-wide spray block
      const result25 = await recordFailedAttempt('victim-25@dypcet.edu', attackerIp);
      expect(result25.blocked).toBe(true);
      expect(result25.reason).toBe('IP_BLOCKED');
      expect(result25.retryAfterSeconds).toBe(1800);

      // Any subsequent request from this attacker IP is blocked immediately
      check = await checkRateLimit('admin@dypcet.edu', attackerIp);
      expect(check.allowed).toBe(false);
      expect(check.reason).toBe('IP_BLOCKED');
      expect(check.retryAfterSeconds).toBeGreaterThan(0);
      expect(check.remainingAttempts).toBe(0);
    });

    it('protects legitimate admin from lockout even when attacker sprays admin account', async () => {
      const adminEmail = 'superadmin@dypcet.edu';
      const attackerIp = '45.154.255.8';
      const realAdminIp = '103.22.44.11';

      // Attacker targets admin account 5 times from attacker IP
      for (let i = 0; i < 5; i++) {
        await recordFailedAttempt(adminEmail, attackerIp);
      }

      // 1. (Attacker IP + admin) is blocked by backoff
      const attackerCheck = await checkRateLimit(adminEmail, attackerIp);
      expect(attackerCheck.allowed).toBe(false);
      expect(attackerCheck.reason).toBe('BACKOFF_REQUIRED');

      // 2. Real admin IP has zero strikes on its IP record
      const adminIpSprayRecord = await LoginAttempt.findOne({ key: `ip_spray:${realAdminIp}` });
      expect(adminIpSprayRecord).toBeNull();
    });
  });

  describe('Progressive Backoff Without Serverless Sleep', () => {
    const testEmail = 'tpo@dypcet.edu';
    const testIp = '49.36.12.88';

    it('computes exponential backoff formula correctly', () => {
      expect(computeBackoffSeconds(0)).toBe(0);
      expect(computeBackoffSeconds(4)).toBe(0);
      expect(computeBackoffSeconds(5)).toBe(1);  // 2^0 = 1s
      expect(computeBackoffSeconds(6)).toBe(2);  // 2^1 = 2s
      expect(computeBackoffSeconds(7)).toBe(4);  // 2^2 = 4s
      expect(computeBackoffSeconds(8)).toBe(8);  // 2^3 = 8s
      expect(computeBackoffSeconds(11)).toBe(60); // capped at 60s
    });

    it('returns retryAfterSeconds immediately without sleeping inside serverless function', async () => {
      // 4 failures: no backoff yet
      for (let i = 0; i < 4; i++) {
        const res = await recordFailedAttempt(testEmail, testIp);
        expect(res.blocked).toBe(false);
      }
      let check = await checkRateLimit(testEmail, testIp);
      expect(check.allowed).toBe(true);
      expect(check.remainingAttempts).toBe(1);

      // 5th failure: immediately returns BACKOFF_REQUIRED with retryAfterSeconds
      const start = Date.now();
      const res5 = await recordFailedAttempt(testEmail, testIp);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(100); // Proves NO setTimeout sleep took place!
      expect(res5.blocked).toBe(true);
      expect(res5.reason).toBe('BACKOFF_REQUIRED');
      expect(res5.retryAfterSeconds).toBe(1);

      // checkRateLimit also immediately returns allowed: false with retryAfterSeconds
      check = await checkRateLimit(testEmail, testIp);
      expect(check.allowed).toBe(false);
      expect(check.reason).toBe('BACKOFF_REQUIRED');
      expect(check.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    });

    it('falls back to email-only rate limits when client IP is unidentified (null)', async () => {
      const emailOnly = 'faculty@dypcet.edu';

      // 4 failures with unknown IP
      for (let i = 0; i < 4; i++) {
        const res = await recordFailedAttempt(emailOnly, null);
        expect(res.blocked).toBe(false);
      }
      let check = await checkRateLimit(emailOnly, null);
      expect(check.allowed).toBe(true);

      // 5th failure triggers email-only backoff
      const res5 = await recordFailedAttempt(emailOnly, null);
      expect(res5.blocked).toBe(true);
      expect(res5.retryAfterSeconds).toBe(1);

      // Subsequent check returns cool-off
      check = await checkRateLimit(emailOnly, null);
      expect(check.allowed).toBe(false);
      expect(check.retryAfterSeconds).toBeGreaterThan(0);
    });

    it('resets rate limits completely upon successful login', async () => {
      for (let i = 0; i < 3; i++) {
        await recordFailedAttempt(testEmail, testIp);
      }

      // Reset upon successful authentication
      await resetRateLimits(testEmail, testIp);

      const check = await checkRateLimit(testEmail, testIp);
      expect(check.allowed).toBe(true);
      expect(check.remainingAttempts).toBe(EMAIL_BACKOFF_THRESHOLD);
    });
  });
});
