import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Student from '@/models/Student';
import Notice from '@/models/Notice';
import { requireStudentAuth } from '@/lib/auth-guards';

export async function GET() {
  const auth = await requireStudentAuth();
  if (!auth.authorized) return auth.response;

  try {
    await dbConnect();
    const student = await Student.findById(auth.user.studentId);
    if (!student) {
      return NextResponse.json({ error: 'Student record not found' }, { status: 404 });
    }

    const notices = await Notice.find({
      $and: [
        {
          $or: [
            { targetDepartments: { $exists: false } },
            { targetDepartments: { $size: 0 } },
            { targetDepartments: student.department },
          ],
        },
        {
          $or: [
            { targetBatches: { $exists: false } },
            { targetBatches: { $size: 0 } },
            { targetBatches: student.passoutYear },
          ],
        },
      ],
    }).sort({ isPinned: -1, createdAt: -1 });

    return NextResponse.json({ notices });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
