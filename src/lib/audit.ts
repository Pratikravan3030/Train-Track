import AuditLog from '@/models/AuditLog';
import dbConnect from '@/lib/db';
import mongoose from 'mongoose';

export interface AuditLogParams {
  userId?: string | mongoose.Types.ObjectId;
  userEmail?: string;
  userRole?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string;
}

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'hash',
  'secret',
  'token',
  'refreshtoken',
  'authorization',
  'cookie',
]);

function sanitizeDetails(details?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!details) return undefined;
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export async function logAudit(params: AuditLogParams): Promise<void> {
  try {
    await dbConnect();
    const doc = new AuditLog({
      userId: params.userId && mongoose.Types.ObjectId.isValid(String(params.userId))
        ? new mongoose.Types.ObjectId(String(params.userId))
        : undefined,
      userEmail: params.userEmail,
      userRole: params.userRole,
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId,
      details: sanitizeDetails(params.details),
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
    await doc.save();
  } catch (err) {
    // Audit logs must never throw to the user or break primary application flow
    console.error('[Audit Log Error]: Failed to save audit log:', err);
  }
}
