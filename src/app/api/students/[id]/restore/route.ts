import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Student from '@/models/Student';
import { requirePermission } from '@/lib/auth-guards';
import { logAudit } from '@/lib/audit';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Only SUPER_ADMIN can restore soft-deleted records
  const auth = await requirePermission('students', 'restore');
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    await dbConnect();

    // Query specifically for the soft-deleted student
    const student = await Student.findOne({ _id: id, isDeleted: true });
    if (!student) {
      return NextResponse.json(
        { error: 'Soft-deleted student record not found' },
        { status: 404 }
      );
    }

    student.isDeleted = false;
    student.deletedAt = null;
    student.deletedBy = null;
    await student.save();

    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email || undefined,
      userRole: auth.user.role,
      action: 'RESTORE_STUDENT',
      resource: 'Student',
      resourceId: id,
      details: { rollNumber: student.rollNumber, name: student.name },
    });

    return NextResponse.json(
      { message: 'Student restored successfully', student },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[POST /api/students/[id]/restore error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
