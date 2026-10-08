import { NextResponse } from 'next/server';
import { z } from 'zod';
import dbConnect from '@/lib/db';
import Student from '@/models/Student';
import TrainingSession from '@/models/TrainingSession';
import { requirePermission } from '@/lib/auth-guards';

const searchQuerySchema = z.object({
  q: z.string().trim().min(1, 'Search term cannot be empty').max(100, 'Search term too long'),
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

export async function GET(request: Request) {
  const auth = await requirePermission('search', 'read');
  if (!auth.authorized) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const parsedQuery = searchQuerySchema.safeParse({
      q: searchParams.get('q') || '',
      limit: searchParams.get('limit') || 5,
    });

    if (!parsedQuery.success) {
      return NextResponse.json(
        { error: 'Invalid search query', details: parsedQuery.error.format() },
        { status: 400 }
      );
    }

    const { q, limit } = parsedQuery.data;
    await dbConnect();

    const regex = { $regex: q, $options: 'i' };

    // 1. Role-scoped student search
    let studentResults: Array<{
      _id: string;
      name: string;
      rollNumber: string;
      branch: string;
      year: string;
    }> = [];

    // Students only search sessions, or their own student record
    if (auth.user.role !== 'STUDENT') {
      const studentFilter: Record<string, unknown> = {
        $or: [
          { name: regex },
          { rollNumber: regex },
          { email: regex },
          { branch: regex },
        ],
      };

      // DEPT_COORDINATOR is strictly scoped to their own department
      if (auth.user.role === 'DEPT_COORDINATOR' && auth.user.department) {
        studentFilter.branch = auth.user.department;
      }

      studentResults = await Student.find(studentFilter)
        .select('name rollNumber branch year email')
        .limit(limit)
        .lean();
    }

    // 2. Training session search (available to all authenticated roles)
    const sessionFilter = {
      $or: [
        { title: regex },
        { trainer: regex },
        { description: regex },
      ],
    };

    const sessionResults = await TrainingSession.find(sessionFilter)
      .select('title date trainer')
      .sort({ date: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json(
      {
        query: q,
        role: auth.user.role,
        departmentScope: auth.user.department || null,
        limits: { perCategory: limit },
        results: {
          students: studentResults,
          sessions: sessionResults,
          totalMatches: studentResults.length + sessionResults.length,
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[GET /api/search error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
