import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Feedback from '@/models/Feedback';
import Student from '@/models/Student';
import { requirePermission } from '@/lib/auth-guards';
import { logAudit } from '@/lib/audit';
import { feedbackQuerySchema, createFeedbackSchema } from '@/lib/validations/feedback';

export async function GET(request: Request) {
  const auth = await requirePermission('feedback', 'read');
  if (!auth.authorized) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const parsedQuery = feedbackQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));

    if (!parsedQuery.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsedQuery.error.format() },
        { status: 400 }
      );
    }

    const { sessionId, page, limit } = parsedQuery.data;
    await dbConnect();

    const filter: Record<string, unknown> = {};
    if (sessionId && sessionId !== 'all') {
      filter.sessionId = sessionId;
    }

    // Department Coordinator: scope feedback results strictly to students in own department
    if (auth.scope === 'own-department') {
      const coordinatorDept = auth.user.department;
      if (!coordinatorDept) {
        return NextResponse.json(
          { error: 'Coordinator profile is missing an assigned department.' },
          { status: 403 }
        );
      }

      const deptStudentIds = await Student.find({
        $or: [{ department: coordinatorDept }, { branch: coordinatorDept }],
      }).distinct('_id');
      filter.studentId = { $in: deptStudentIds };
    }

    const total = await Feedback.countDocuments(filter);
    const totalPages = Math.ceil(total / limit) || 1;
    const skip = (page - 1) * limit;

    const feedback = await Feedback.find(filter)
      .populate('sessionId', 'title date')
      .populate('studentId', 'name rollNumber branch')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return NextResponse.json(
      {
        data: feedback,
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
    console.error('[GET /api/feedback error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requirePermission('feedback', 'create');
  if (!auth.authorized) return auth.response;

  try {
    const json = await request.json();
    const parseResult = createFeedbackSchema.safeParse(json);

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Validation failed';
      return NextResponse.json({ error: firstError, details: parseResult.error.format() }, { status: 400 });
    }

    const { sessionId, rating, comment } = parseResult.data;
    await dbConnect();

    let effectiveStudentId: string | null = null;

    if (auth.user.role === 'STUDENT') {
      // Security enforcement: studentId is ALWAYS derived from the authenticated session
      if (!auth.user.studentId) {
        return NextResponse.json(
          { error: 'Student account is not linked to an institutional student profile.' },
          { status: 400 }
        );
      }
      effectiveStudentId = auth.user.studentId;

      // Enforce one feedback per student per session
      const existing = await Feedback.findOne({
        sessionId,
        studentId: effectiveStudentId,
      });

      if (existing) {
        return NextResponse.json(
          { error: 'You have already submitted feedback for this training session.' },
          { status: 409 }
        );
      }
    } else {
      // Staff roles (SUPER_ADMIN, TPO) submit observer evaluations without impersonating a student
      effectiveStudentId = null;
    }

    const source = auth.user.role === 'STUDENT' ? 'student' : 'staff';

    const newFeedback = await Feedback.create({
      sessionId,
      studentId: effectiveStudentId,
      source,
      rating,
      comment: comment || '',
    });

    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email || undefined,
      userRole: auth.user.role,
      action: 'SUBMIT_FEEDBACK',
      resource: 'Feedback',
      resourceId: newFeedback._id.toString(),
      details: { sessionId, rating, isStudent: auth.user.role === 'STUDENT' },
    });

    return NextResponse.json(newFeedback, { status: 201 });
  } catch (error: unknown) {
    // Catch MongoDB duplicate key error (code 11000) from unique compound index
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: number }).code === 11000) {
      return NextResponse.json(
        { error: 'Duplicate submission: feedback has already been recorded for this session.' },
        { status: 409 }
      );
    }

    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[POST /api/feedback error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
