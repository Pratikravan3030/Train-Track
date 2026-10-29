import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import AuditLog from '@/models/AuditLog';
import { requirePermission } from '@/lib/auth-guards';

function escapeRegex(text: string) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

export async function GET(request: Request) {
  // Only SUPER_ADMIN has access to institutional audit trails
  const auth = await requirePermission('audit', 'read');
  if (!auth.authorized) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));
    const action = searchParams.get('action');
    const resource = searchParams.get('resource');
    const userEmail = searchParams.get('userEmail');
    const search = searchParams.get('search');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    await dbConnect();

    const query: Record<string, unknown> = {};

    if (action && action !== 'all') {
      query.action = action;
    }

    if (resource && resource !== 'all') {
      query.resource = resource;
    }

    if (userEmail) {
      query.userEmail = { $regex: escapeRegex(userEmail.trim()), $options: 'i' };
    }

    if (search) {
      const escaped = escapeRegex(search.trim());
      query.$or = [
        { action: { $regex: escaped, $options: 'i' } },
        { resource: { $regex: escaped, $options: 'i' } },
        { resourceId: { $regex: escaped, $options: 'i' } },
        { userEmail: { $regex: escaped, $options: 'i' } },
      ];
    }

    if (startDate || endDate) {
      const dateQuery: Record<string, Date> = {};
      if (startDate) {
        dateQuery.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateQuery.$lte = end;
      }
      query.createdAt = dateQuery;
    }

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(query),
    ]);

    return NextResponse.json({
      logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[GET /api/admin/audit-logs error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
