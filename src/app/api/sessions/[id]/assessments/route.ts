import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Assessment from '@/models/Assessment';
import TrainingSession from '@/models/TrainingSession';
import { requirePermission } from '@/lib/auth-guards';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('assessments', 'read');
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    await dbConnect();

    const session = await TrainingSession.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!session) {
      return NextResponse.json({ error: 'Training session not found' }, { status: 404 });
    }

    const assessments = await Assessment.find({ sessionId: id })
      .sort({ createdAt: -1 })
      .lean();

    const assessmentsWithStats = assessments.map((ass) => {
      const results = ass.results || [];
      const total = results.length;
      const passed = results.filter((r: { passed: boolean }) => r.passed).length;
      const scores = results.map((r: { score: number }) => r.score);
      const avgScore =
        scores.length > 0
          ? parseFloat((scores.reduce((a: number, b: number) => a + b, 0) / scores.length).toFixed(2))
          : 0;
      const passRate = total > 0 ? parseFloat(((passed / total) * 100).toFixed(1)) : 0;
      const maxRecorded = scores.length > 0 ? Math.max(...scores) : 0;

      return {
        ...ass,
        stats: {
          totalStudents: total,
          passedCount: passed,
          failedCount: total - passed,
          passRate,
          averageScore: avgScore,
          highestScore: maxRecorded,
        },
      };
    });

    return NextResponse.json({ assessments: assessmentsWithStats });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[GET /api/sessions/[id]/assessments error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
