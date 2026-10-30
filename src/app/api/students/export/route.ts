import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Student from '@/models/Student';
import { requirePermission, canAccessDepartment } from '@/lib/auth-guards';
import { logAudit } from '@/lib/audit';
import { serializeCsv } from '@/lib/csv';
import { DEFAULT_PASSOUT_YEAR } from '@/config/collegeConfig';
import { canViewDemographics } from '@/lib/demographic-redaction';

export async function GET(request: Request) {
  const auth = await requirePermission('students', 'export');
  if (!auth.authorized) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const batchParam = searchParams.get('batch') || searchParams.get('passoutYear');
    const effectiveBatch =
      batchParam && batchParam !== 'all'
        ? parseInt(batchParam, 10)
        : batchParam === 'all'
        ? null
        : DEFAULT_PASSOUT_YEAR;

    const requestedDept = searchParams.get('department') || searchParams.get('branch');
    const placementStatus = searchParams.get('placementStatus');

    // Scoping check for coordinator
    if (auth.user.role === 'DEPT_COORDINATOR' && requestedDept) {
      if (!canAccessDepartment(auth.user, requestedDept)) {
        return NextResponse.json(
          { error: 'Forbidden. You cannot export student rosters outside your department.' },
          { status: 403 }
        );
      }
    }

    const effectiveDept =
      auth.user.role === 'DEPT_COORDINATOR' ? auth.user.department : requestedDept;

    await dbConnect();

    const andConditions: Record<string, unknown>[] = [];

    // Batch isolation
    if (effectiveBatch) {
      andConditions.push({ passoutYear: effectiveBatch });
    }

    // Department filtering
    if (effectiveDept && effectiveDept !== 'all') {
      andConditions.push({
        $or: [{ department: effectiveDept }, { branch: effectiveDept }],
      });
    }

    // Placement status filtering
    if (placementStatus && placementStatus !== 'all') {
      andConditions.push({ placementStatus });
    }

    const filter = andConditions.length > 0 ? { $and: andConditions } : {};
    const students = await Student.find(filter).sort({ rollNumber: 1 });

    const csvHeaders = [
      { key: 'rollNumber', label: 'PRN / Roll Number' },
      { key: 'name', label: 'Student Name' },
      { key: 'department', label: 'Department' },
      { key: 'year', label: 'Academic Year' },
      { key: 'passoutYear', label: 'Batch (Passout Year)' },
      { key: 'placementStatus', label: 'Placement Status' },
      { key: 'companyName', label: 'Company' },
      { key: 'packageLPA', label: 'Package (LPA)' },
      { key: 'cgpa', label: 'CGPA' },
      { key: 'backlogs', label: 'Active Backlogs' },
      { key: 'tenthPercentage', label: '10th Percentage' },
      { key: 'twelfthOrDiplomaPercentage', label: '12th/Diploma Percentage' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
    ];

    const dataRows = students.map((s) => ({
      rollNumber: s.rollNumber,
      name: s.name,
      department: s.department || s.branch || '',
      year: s.year,
      passoutYear: s.passoutYear,
      placementStatus: s.placementStatus || 'Not Placed',
      companyName: s.placementDetails?.companyName || '',
      packageLPA: s.placementDetails?.packageLPA ?? '',
      cgpa: s.cgpa != null ? s.cgpa : '',
      backlogs: s.backlogs != null ? s.backlogs : '',
      tenthPercentage: s.tenthPercentage != null ? s.tenthPercentage : '',
      twelfthOrDiplomaPercentage: s.twelfthOrDiplomaPercentage != null ? s.twelfthOrDiplomaPercentage : '',
      email: s.email || '',
      phone: canViewDemographics(auth.user.role) ? (s.phone || '') : '[REDACTED]',
    }));

    const csvContent = serializeCsv(csvHeaders, dataRows);

    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email || undefined,
      userRole: auth.user.role,
      action: 'EXPORT_STUDENTS',
      resource: 'Student',
      details: {
        count: students.length,
        batch: effectiveBatch || 'all',
        department: effectiveDept || 'ALL',
      },
    });

    const filename = `DYPCET-Students-Batch-${effectiveBatch || 'All'}-${effectiveDept || 'All'}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[GET /api/students/export error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
