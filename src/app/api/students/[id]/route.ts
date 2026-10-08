import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Student from '@/models/Student';
import Attendance from '@/models/Attendance';
import Feedback from '@/models/Feedback';
import { requirePermission, canAccessDepartment } from '@/lib/auth-guards';
import { logAudit } from '@/lib/audit';
import { updateStudentSchema } from '@/lib/validations/student';
import { resolveStudentDepartment } from '@/lib/departmentMapper';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('students', 'read');
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;

    await dbConnect();
    const student = await Student.findById(id);
    if (!student) {
      return NextResponse.json({ error: 'Student record not found' }, { status: 404 });
    }

    // Role check: coordinator can only access students from their department
    if (!canAccessDepartment(auth.user, student.department || student.branch)) {
      return NextResponse.json(
        { error: 'Forbidden. You do not have permission to view students from other departments.' },
        { status: 403 }
      );
    }

    // Fetch student's attendance history
    const attendance = await Attendance.find({ studentId: id })
      .populate('sessionId', 'title date trainer')
      .sort({ markedAt: -1 });

    // Fetch student's feedback history
    const feedback = await Feedback.find({ studentId: id })
      .populate('sessionId', 'title date')
      .sort({ createdAt: -1 });

    return NextResponse.json({ student, attendance, feedback }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[GET /api/students/[id] error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('students', 'update');
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    const body = await request.json();
    const parseResult = updateStudentSchema.safeParse(body);

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Invalid input data';
      return NextResponse.json({ error: firstError, details: parseResult.error.format() }, { status: 400 });
    }

    await dbConnect();

    const currentStudent = await Student.findById(id);
    if (!currentStudent) {
      return NextResponse.json({ error: 'Student record not found' }, { status: 404 });
    }

    if (!canAccessDepartment(auth.user, currentStudent.department || currentStudent.branch)) {
      return NextResponse.json(
        { error: 'Forbidden. You cannot modify students outside your department.' },
        { status: 403 }
      );
    }

    const { name, rollNumber, department: rawDept, branch: rawBranch, year, email, phone } = parseResult.data;

    let validatedDepartment: string | undefined = undefined;
    if (rawDept || rawBranch) {
      try {
        validatedDepartment = resolveStudentDepartment({ department: rawDept, branch: rawBranch });
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : 'Invalid department' },
          { status: 400 }
        );
      }
    }

    if (validatedDepartment && !canAccessDepartment(auth.user, validatedDepartment)) {
      return NextResponse.json(
        { error: 'Forbidden. You cannot transfer students outside your department.' },
        { status: 403 }
      );
    }

    // Check unique rollNumber if changed
    if (rollNumber && rollNumber !== currentStudent.rollNumber) {
      const duplicate = await Student.findOne({ rollNumber, _id: { $ne: id } });
      if (duplicate) {
        return NextResponse.json(
          { error: `Another student with Roll Number / PRN "${rollNumber}" already exists.` },
          { status: 409 }
        );
      }
    }

    const updatePayload: Record<string, unknown> = {};
    if (name !== undefined) updatePayload.name = name;
    if (rollNumber !== undefined) updatePayload.rollNumber = rollNumber;
    if (year !== undefined) updatePayload.year = year;
    if (email !== undefined) updatePayload.email = email;
    if (phone !== undefined) updatePayload.phone = phone;
    if (validatedDepartment !== undefined) {
      updatePayload.department = validatedDepartment;
      // Do not write to legacy branch field!
    }

    const updatedStudent = await Student.findByIdAndUpdate(
      id,
      updatePayload,
      { new: true, runValidators: true }
    );

    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email || undefined,
      userRole: auth.user.role,
      action: 'UPDATE_STUDENT',
      resource: 'Student',
      resourceId: id,
      details: { rollNumber: updatedStudent?.rollNumber, branch: updatedStudent?.branch },
    });

    return NextResponse.json(updatedStudent, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[PUT /api/students/[id] error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('students', 'delete');
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;

    await dbConnect();
    const deletedStudent = await Student.findByIdAndDelete(id);
    if (!deletedStudent) {
      return NextResponse.json({ error: 'Student record not found' }, { status: 404 });
    }

    // Cascade delete attendance and feedback
    await Promise.all([
      Attendance.deleteMany({ studentId: id }),
      Feedback.deleteMany({ studentId: id }),
    ]);

    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email || undefined,
      userRole: auth.user.role,
      action: 'DELETE_STUDENT',
      resource: 'Student',
      resourceId: id,
      details: { rollNumber: deletedStudent.rollNumber, name: deletedStudent.name },
    });

    return NextResponse.json({ message: 'Student and related records deleted successfully' }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[DELETE /api/students/[id] error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
