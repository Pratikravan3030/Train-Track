import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Student from '@/models/Student';
import Attendance from '@/models/Attendance';
import Feedback from '@/models/Feedback';
import { requirePermission, canAccessDepartment } from '@/lib/auth-guards';
import { logAudit } from '@/lib/audit';
import { updateStudentSchema } from '@/lib/validations/student';
import { resolveStudentDepartment } from '@/lib/departmentMapper';
import { calculateProfileCompleteness } from '@/lib/profile-completeness';
import { redactStudentDemographics } from '@/lib/demographic-redaction';

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

    const studentObj = student.toObject ? student.toObject() : student;
    const completeness = calculateProfileCompleteness(studentObj);
    const isOwnRecord = auth.user.studentId === id;
    const redactedStudent = redactStudentDemographics(studentObj, auth.user.role, Boolean(isOwnRecord));

    return NextResponse.json(
      { student: redactedStudent, attendance, feedback, completeness },
      { status: 200 }
    );
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

    const {
      name,
      rollNumber,
      department: rawDept,
      branch: rawBranch,
      year,
      passoutYear,
      placementStatus,
      placementDetails,
      statusChangeReason,
      cgpa,
      backlogs,
      tenthPercentage,
      twelfthOrDiplomaPercentage,
      resumeUrl,
      email,
      phone,
      gender,
      dateOfBirth,
      division,
      semesterSgpa,
      backlogHistory,
      skills,
      certifications,
      projects,
      internships,
      socialLinks,
      photoUrl,
    } = parseResult.data;

    // Field whitelisting per role: Only TPO and SUPER_ADMIN can modify placement status
    if (auth.user.role === 'DEPT_COORDINATOR') {
      if (placementStatus !== undefined || placementDetails !== undefined) {
        return NextResponse.json(
          {
            error:
              'Forbidden. Placement status changes can only be performed by TPO and Super Administrators.',
          },
          { status: 403 }
        );
      }
    }

    let isPlacementStatusChanged = false;
    if (placementStatus !== undefined && placementStatus !== currentStudent.placementStatus) {
      isPlacementStatusChanged = true;
      // Moving out of 'Placed' status strictly requires a reason
      if (currentStudent.placementStatus === 'Placed' && placementStatus !== 'Placed') {
        if (!statusChangeReason || !statusChangeReason.trim()) {
          return NextResponse.json(
            {
              error:
                "A mandatory reason (statusChangeReason) is required when moving a student out of 'Placed' status.",
            },
            { status: 400 }
          );
        }
      }
    }

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
    if (passoutYear !== undefined) updatePayload.passoutYear = passoutYear;
    if (email !== undefined) updatePayload.email = email;
    if (phone !== undefined) updatePayload.phone = phone;
    if (gender !== undefined) updatePayload.gender = gender;
    if (dateOfBirth !== undefined) updatePayload.dateOfBirth = dateOfBirth;
    if (division !== undefined) updatePayload.division = division;
    if (semesterSgpa !== undefined) updatePayload.semesterSgpa = semesterSgpa;
    if (backlogHistory !== undefined) updatePayload.backlogHistory = backlogHistory;
    if (skills !== undefined) updatePayload.skills = skills;
    if (certifications !== undefined) updatePayload.certifications = certifications;
    if (projects !== undefined) updatePayload.projects = projects;
    if (internships !== undefined) updatePayload.internships = internships;
    if (socialLinks !== undefined) updatePayload.socialLinks = socialLinks;
    if (photoUrl !== undefined) updatePayload.photoUrl = photoUrl;
    if (cgpa !== undefined) updatePayload.cgpa = cgpa;
    if (backlogs !== undefined) updatePayload.backlogs = backlogs;
    if (tenthPercentage !== undefined) updatePayload.tenthPercentage = tenthPercentage;
    if (twelfthOrDiplomaPercentage !== undefined)
      updatePayload.twelfthOrDiplomaPercentage = twelfthOrDiplomaPercentage;
    if (resumeUrl !== undefined) updatePayload.resumeUrl = resumeUrl;
    if (validatedDepartment !== undefined) {
      updatePayload.department = validatedDepartment;
      // Do not write to legacy branch field!
    }
    if (placementStatus !== undefined) {
      updatePayload.placementStatus = placementStatus;
      const details = { ...(currentStudent.placementDetails?.toObject?.() || currentStudent.placementDetails || {}) };
      if (placementDetails) {
        Object.assign(details, placementDetails);
      }
      if (statusChangeReason) {
        details.reasonForStatusChange = statusChangeReason;
      }
      updatePayload.placementDetails = details;
    } else if (placementDetails !== undefined) {
      updatePayload.placementDetails = placementDetails;
    }

    const updatedStudent = await Student.findByIdAndUpdate(
      id,
      updatePayload,
      { new: true, runValidators: true }
    );

    if (isPlacementStatusChanged) {
      await logAudit({
        userId: auth.user.id,
        userEmail: auth.user.email || undefined,
        userRole: auth.user.role,
        action: 'UPDATE_PLACEMENT_STATUS',
        resource: 'Student',
        resourceId: id,
        details: {
          rollNumber: currentStudent.rollNumber,
          previousStatus: currentStudent.placementStatus,
          newStatus: placementStatus,
          reason: statusChangeReason || undefined,
        },
      });
    }

    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email || undefined,
      userRole: auth.user.role,
      action: 'UPDATE_STUDENT',
      resource: 'Student',
      resourceId: id,
      details: { rollNumber: updatedStudent?.rollNumber, department: updatedStudent?.department },
    });

    const studentObj = updatedStudent?.toObject ? updatedStudent.toObject() : updatedStudent;
    const completeness = studentObj ? calculateProfileCompleteness(studentObj) : null;
    const isOwnRecord = auth.user.studentId === id;
    const redactedStudent = studentObj
      ? redactStudentDemographics(studentObj, auth.user.role, Boolean(isOwnRecord))
      : null;

    return NextResponse.json(
      {
        ...(redactedStudent || {}),
        student: redactedStudent,
        completeness,
      },
      { status: 200 }
    );
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
    const student = await Student.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!student) {
      return NextResponse.json({ error: 'Student record not found' }, { status: 404 });
    }

    // Soft delete: flag record, record deletion metadata
    student.isDeleted = true;
    student.deletedAt = new Date();
    student.deletedBy = auth.user.id;
    await student.save();

    // Clean up associated attendance and feedback records
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
      details: { rollNumber: student.rollNumber, name: student.name, softDelete: true },
    });

    return NextResponse.json({ message: 'Student soft deleted successfully' }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[DELETE /api/students/[id] error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
