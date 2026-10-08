import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import TrainingSession from '@/models/TrainingSession';
import { requirePermission } from '@/lib/auth-guards';
import { logAudit } from '@/lib/audit';
import { sessionQuerySchema, createSessionSchema } from '@/lib/validations/session';

export async function GET(request: Request) {
  const auth = await requirePermission('sessions', 'read');
  if (!auth.authorized) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const parsedQuery = sessionQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));

    if (!parsedQuery.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsedQuery.error.format() },
        { status: 400 }
      );
    }

    const { page, limit, search, sortBy = 'date', sortOrder = 'desc', all } = parsedQuery.data;

    await dbConnect();

    const filter: Record<string, unknown> = {};

    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      filter.$or = [
        { title: searchRegex },
        { trainer: searchRegex },
        { description: searchRegex },
      ];
    }

    if (all === 'true') {
      const allSessions = await TrainingSession.find(filter).sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 });
      return NextResponse.json(
        {
          data: allSessions,
          pagination: {
            page: 1,
            limit: allSessions.length,
            total: allSessions.length,
            totalPages: 1,
            hasNext: false,
            hasPrev: false,
          },
        },
        { status: 200 }
      );
    }

    const total = await TrainingSession.countDocuments(filter);
    const totalPages = Math.ceil(total / limit) || 1;
    const skip = (page - 1) * limit;

    const sessions = await TrainingSession.find(filter)
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .skip(skip)
      .limit(limit);

    return NextResponse.json(
      {
        data: sessions,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[GET /api/sessions error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requirePermission('sessions', 'create');
  if (!auth.authorized) return auth.response;

  try {
    const json = await request.json();
    const parseResult = createSessionSchema.safeParse(json);

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Validation failed';
      return NextResponse.json({ error: firstError, details: parseResult.error.format() }, { status: 400 });
    }

    const { title, date, trainer, description } = parseResult.data;

    await dbConnect();

    const newSession = await TrainingSession.create({
      title,
      date,
      trainer,
      description: description || '',
    });

    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email || undefined,
      userRole: auth.user.role,
      action: 'CREATE_SESSION',
      resource: 'TrainingSession',
      resourceId: newSession._id.toString(),
      details: { title, trainer },
    });

    return NextResponse.json(newSession, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[POST /api/sessions error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
