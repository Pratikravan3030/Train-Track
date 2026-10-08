import LoginAttempt from '@/models/LoginAttempt';
import dbConnect from '@/lib/db';

export interface RateLimitCheckResult {
  allowed: boolean;
  reason?: 'IP_BLOCKED' | 'BACKOFF_REQUIRED' | 'EMAIL_COOLED_OFF';
  retryAfterSeconds?: number;
  remainingAttempts: number;
}

// Thresholds tailored for institutional campus networks
export const IP_EMAIL_BACKOFF_THRESHOLD = 5;      // Failures per (IP + email) pair before backoff
export const EMAIL_BACKOFF_THRESHOLD = 5;          // Failures per email account across all IPs
export const IP_DISTINCT_EMAILS_THRESHOLD = 25;    // Higher threshold: distinct targeted emails from single IP (credential stuffing)
export const IP_LOCKOUT_SECONDS = 1800;            // 30 minutes for IP spray attacks
export const MAX_BACKOFF_SECONDS = 60;             // Progressive backoff capped at 60 seconds

/**
 * Extracts client IP prioritizing un-spoofable edge proxy headers.
 * If no valid IP header is found, returns null (unidentified client) rather than pooling into 127.0.0.1.
 */
export function extractClientIp(
  headers: Headers | Record<string, string | string[] | undefined>
): string | null {
  function getHeader(name: string): string | undefined {
    if (typeof (headers as Headers)?.get === 'function') {
      return (headers as Headers).get(name) || undefined;
    }
    const val = (headers as Record<string, string | string[] | undefined>)[name];
    if (Array.isArray(val)) return val[0];
    return val;
  }

  // 1. Vercel edge proxy header (injected by Vercel edge network, cannot be spoofed by client)
  const vercelIp = getHeader('x-vercel-forwarded-for');
  if (vercelIp && vercelIp.trim()) {
    return vercelIp.split(',')[0].trim();
  }

  // 2. Standard Forwarded header
  const forwardedFor = getHeader('x-forwarded-for');
  if (forwardedFor && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }

  // 3. Real IP header
  const realIp = getHeader('x-real-ip');
  if (realIp && realIp.trim()) {
    return realIp.trim();
  }

  // Return null for unidentified IP — do NOT pool multiple users into 127.0.0.1
  return null;
}

/**
 * Computes exponential backoff seconds based on failed attempt count:
 * 5th failure -> 1s, 6th -> 2s, 7th -> 4s, 8th -> 8s, up to 60s max.
 */
export function computeBackoffSeconds(attempts: number, threshold = 5): number {
  if (attempts < threshold) return 0;
  const excess = attempts - threshold;
  return Math.min(MAX_BACKOFF_SECONDS, Math.pow(2, excess));
}

/**
 * Verifies rate limits without sleeping inside the serverless runtime.
 * Returns allowed=false with clear retryAfterSeconds instead of holding serverless invocations open.
 */
export async function checkRateLimit(
  email: string,
  clientIp: string | null
): Promise<RateLimitCheckResult> {
  try {
    await dbConnect();

    const normalizedEmail = email.trim().toLowerCase();
    const now = new Date();

    // 1. If IP is identified, check IP spray and (IP + email) pair
    if (clientIp) {
      const normalizedIp = clientIp.trim();
      const ipSprayKey = `ip_spray:${normalizedIp}`;
      const ipEmailKey = `ip_email:${normalizedIp}:${normalizedEmail}`;

      const [ipSprayRecord, ipEmailRecord] = await Promise.all([
        LoginAttempt.findOne({ key: ipSprayKey }),
        LoginAttempt.findOne({ key: ipEmailKey }),
      ]);

      // IP-wide spray block (only when hitting 25+ distinct accounts)
      if (ipSprayRecord?.lockedUntil && ipSprayRecord.lockedUntil > now) {
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil((ipSprayRecord.lockedUntil.getTime() - now.getTime()) / 1000)
        );
        return {
          allowed: false,
          reason: 'IP_BLOCKED',
          retryAfterSeconds,
          remainingAttempts: 0,
        };
      }

      // (IP + email) pair backoff check
      if (ipEmailRecord?.lockedUntil && ipEmailRecord.lockedUntil > now) {
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil((ipEmailRecord.lockedUntil.getTime() - now.getTime()) / 1000)
        );
        return {
          allowed: false,
          reason: 'BACKOFF_REQUIRED',
          retryAfterSeconds,
          remainingAttempts: 0,
        };
      }
    }

    // 2. Email-level check (applies whether IP is identified or not)
    const emailKey = `email:${normalizedEmail}`;
    const emailRecord = await LoginAttempt.findOne({ key: emailKey });

    if (emailRecord?.lockedUntil && emailRecord.lockedUntil > now) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((emailRecord.lockedUntil.getTime() - now.getTime()) / 1000)
      );
      return {
        allowed: false,
        reason: 'EMAIL_COOLED_OFF',
        retryAfterSeconds,
        remainingAttempts: 0,
      };
    }

    const attempts = emailRecord?.attempts || 0;
    const remainingAttempts = Math.max(0, EMAIL_BACKOFF_THRESHOLD - attempts);

    return {
      allowed: true,
      remainingAttempts,
    };
  } catch (err) {
    console.error('[RateLimit Check Error]:', err);
    // Fail-open for transient DB errors so legitimate users are not locked out
    return { allowed: true, remainingAttempts: 5 };
  }
}

/**
 * Records a failed attempt for:
 * 1. Targeted email account
 * 2. (IP + email) pair
 * 3. IP spray tracking (distinct email count)
 */
export async function recordFailedAttempt(
  email: string,
  clientIp: string | null
): Promise<{
  blocked: boolean;
  reason?: 'IP_BLOCKED' | 'BACKOFF_REQUIRED';
  retryAfterSeconds?: number;
}> {
  try {
    await dbConnect();

    const normalizedEmail = email.trim().toLowerCase();
    const now = new Date();

    // 1. Update email record
    const emailKey = `email:${normalizedEmail}`;
    let emailRecord = await LoginAttempt.findOne({ key: emailKey });
    if (!emailRecord) {
      emailRecord = new LoginAttempt({ key: emailKey, attempts: 1, lastAttempt: now });
    } else {
      emailRecord.attempts += 1;
      emailRecord.lastAttempt = now;
    }

    if (emailRecord.attempts >= EMAIL_BACKOFF_THRESHOLD) {
      const backoffSec = computeBackoffSeconds(emailRecord.attempts, EMAIL_BACKOFF_THRESHOLD);
      emailRecord.lockedUntil = new Date(Date.now() + backoffSec * 1000);
    }
    await emailRecord.save();

    // 2. If IP is identified, track (IP + email) and IP spray
    if (clientIp) {
      const normalizedIp = clientIp.trim();

      // Pair track
      const ipEmailKey = `ip_email:${normalizedIp}:${normalizedEmail}`;
      let ipEmailRecord = await LoginAttempt.findOne({ key: ipEmailKey });
      if (!ipEmailRecord) {
        ipEmailRecord = new LoginAttempt({ key: ipEmailKey, attempts: 1, lastAttempt: now });
      } else {
        ipEmailRecord.attempts += 1;
        ipEmailRecord.lastAttempt = now;
      }

      let pairBackoffSec = 0;
      if (ipEmailRecord.attempts >= IP_EMAIL_BACKOFF_THRESHOLD) {
        pairBackoffSec = computeBackoffSeconds(ipEmailRecord.attempts, IP_EMAIL_BACKOFF_THRESHOLD);
        ipEmailRecord.lockedUntil = new Date(Date.now() + pairBackoffSec * 1000);
      }
      await ipEmailRecord.save();

      // IP Spray track: count distinct targeted emails
      const ipSprayKey = `ip_spray:${normalizedIp}`;
      let ipSprayRecord = await LoginAttempt.findOne({ key: ipSprayKey });
      if (!ipSprayRecord) {
        ipSprayRecord = new LoginAttempt({
          key: ipSprayKey,
          attempts: 1,
          distinctEmails: [normalizedEmail],
          lastAttempt: now,
        });
      } else {
        const existing = new Set(ipSprayRecord.distinctEmails || []);
        existing.add(normalizedEmail);
        ipSprayRecord.distinctEmails = Array.from(existing);
        ipSprayRecord.attempts = ipSprayRecord.distinctEmails.length;
        ipSprayRecord.lastAttempt = now;
      }

      if ((ipSprayRecord.distinctEmails?.length || 0) >= IP_DISTINCT_EMAILS_THRESHOLD) {
        ipSprayRecord.lockedUntil = new Date(Date.now() + IP_LOCKOUT_SECONDS * 1000);
        await ipSprayRecord.save();
        return {
          blocked: true,
          reason: 'IP_BLOCKED',
          retryAfterSeconds: IP_LOCKOUT_SECONDS,
        };
      }
      await ipSprayRecord.save();

      if (pairBackoffSec > 0) {
        return {
          blocked: true,
          reason: 'BACKOFF_REQUIRED',
          retryAfterSeconds: pairBackoffSec,
        };
      }
    }

    if (emailRecord.lockedUntil && emailRecord.lockedUntil > now) {
      const retryAfterSeconds = Math.ceil((emailRecord.lockedUntil.getTime() - now.getTime()) / 1000);
      return {
        blocked: true,
        reason: 'BACKOFF_REQUIRED',
        retryAfterSeconds,
      };
    }

    return { blocked: false };
  } catch (err) {
    console.error('[RateLimit Record Error]:', err);
    return { blocked: false };
  }
}

/**
 * Resets rate limits for an email and (IP + email) pair upon successful login.
 */
export async function resetRateLimits(email: string, clientIp: string | null): Promise<void> {
  try {
    await dbConnect();
    const normalizedEmail = email.trim().toLowerCase();

    const deletePromises = [LoginAttempt.deleteOne({ key: `email:${normalizedEmail}` })];

    if (clientIp) {
      const normalizedIp = clientIp.trim();
      deletePromises.push(
        LoginAttempt.deleteOne({ key: `ip_email:${normalizedIp}:${normalizedEmail}` })
      );
    }

    await Promise.all(deletePromises);
  } catch (err) {
    console.error('[RateLimit Reset Error]:', err);
  }
}
