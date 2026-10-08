import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Drive from '@/models/Drive';
import Application from '@/models/Application';
import Student from '@/models/Student';
import { requirePermission } from '@/lib/auth-guards';
import { logAudit } from '@/lib/audit';
import { serializeCsv } from '@/lib/csv';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('drives', 'export');
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    const url = new URL(request.url);
    const preset = url.searchParams.get('preset') || 'company'; // 'company' | 'internal'
    const status = url.searchParams.get('status');

    await dbConnect();

    const drive = await Drive.findById(id).populate('company', 'name').lean();
    if (!drive) {
      return NextResponse.json({ error: 'Drive not found' }, { status: 404 });
    }

    const filter: Record<string, unknown> = { drive: id };
    if (status) {
      filter.status = status;
    }

    // Role-based department scoping for DEPT_COORDINATOR
    if (auth.user.role === 'DEPT_COORDINATOR') {
      const deptStudentIds = await Student.find({ department: auth.user.department }).distinct('_id');
      filter.student = { $in: deptStudentIds };
    }

    const applications = await Application.find(filter)
      .populate('student')
      .sort({ createdAt: -1 })
      .lean();

    const companyName =
      drive.company && typeof drive.company === 'object' && 'name' in drive.company
        ? (drive.company as { name: string }).name
        : 'Company';

    // Base origin for resume links
    const origin = url.origin || 'https://campusplace.dypcet.ac.in';

    // Preset column selection
    // NOTE: 'company' preset strictly excludes DOB and Gender until Phase 3b.
    let csvHeaders: { key: string; label: string }[];

    if (preset === 'internal') {
      csvHeaders = [
        { key: 'rollNumber', label: 'Roll Number' },
        { key: 'prn', label: 'PRN' },
        { key: 'name', label: 'Student Name' },
        { key: 'department', label: 'Department' },
        { key: 'passoutYear', label: 'Batch' },
        { key: 'cgpa', label: 'CGPA' },
        { key: 'backlogs', label: 'Active Backlogs' },
        { key: 'tenthPercentage', label: '10th Percentage' },
        { key: 'twelfthOrDiplomaPercentage', label: '12th/Diploma Percentage' },
        { key: 'status', label: 'Application Status' },
        { key: 'currentRound', label: 'Current Selection Round' },
        { key: 'isEligible', label: 'Met Criteria' },
        { key: 'isOverride', label: 'Staff Override' },
        { key: 'overrideReason', label: 'Override Reason' },
        { key: 'isLate', label: 'Late Registration' },
        { key: 'resumeUrl', label: 'Resume Link' },
        { key: 'appliedAt', label: 'Registration Date' },
      ];
    } else {
      // Default: 'company' sharing preset
      csvHeaders = [
        { key: 'rollNumber', label: 'Roll Number' },
        { key: 'prn', label: 'PRN' },
        { key: 'name', label: 'Candidate Name' },
        { key: 'department', label: 'Department' },
        { key: 'passoutYear', label: 'Graduation Year' },
        { key: 'cgpa', label: 'CGPA' },
        { key: 'backlogs', label: 'Active Backlogs' },
        { key: 'tenthPercentage', label: '10th %' },
        { key: 'twelfthOrDiplomaPercentage', label: '12th/Diploma %' },
        { key: 'status', label: 'Current Status' },
        { key: 'currentRound', label: 'Current Round' },
        { key: 'resumeUrl', label: 'Resume URL' },
      ];
    }

    const selectionRounds = drive.selectionRounds || ['Round 1'];

    const dataRows = applications.map((app) => {
      const s = app.student as unknown as {
        _id: mongoose.Types.ObjectId;
        name: string;
        rollNumber: string;
        prn?: string;
        department: string;
        passoutYear: number;
        cgpa?: number | null;
        backlogs?: number | null;
        tenthPercentage?: number | null;
        twelfthOrDiplomaPercentage?: number | null;
        resumeUrl?: string;
        resumeStorageKey?: string;
      };

      const resumeUrl = s?.resumeStorageKey || s?.resumeUrl
        ? `${origin}/api/students/${s._id}/resume`
        : 'Not Uploaded';

      const roundName = selectionRounds[app.currentRoundIndex] || `Round ${app.currentRoundIndex + 1}`;

      return {
        rollNumber: s?.rollNumber || '',
        prn: s?.prn || '',
        name: s?.name || '',
        department: s?.department || '',
        passoutYear: s?.passoutYear || '',
        cgpa: s?.cgpa != null ? s.cgpa : 'Not Recorded',
        backlogs: s?.backlogs != null ? s.backlogs : 'Not Recorded',
        tenthPercentage: s?.tenthPercentage != null ? s.tenthPercentage : 'Not Recorded',
        twelfthOrDiplomaPercentage:
          s?.twelfthOrDiplomaPercentage != null ? s.twelfthOrDiplomaPercentage : 'Not Recorded',
        status: app.status,
        currentRound: roundName,
        isEligible: app.eligibilitySnapshot?.isEligible ? 'Yes' : 'No',
        isOverride: app.eligibilitySnapshot?.policyCheck?.overrideReason ? 'Yes' : 'No',
        overrideReason: app.eligibilitySnapshot?.policyCheck?.overrideReason || '',
        isLate: app.isLateRegistration ? 'Yes' : 'No',
        resumeUrl,
        appliedAt: app.createdAt ? new Date(app.createdAt).toISOString().split('T')[0] : '',
      };
    });

    const csvContent = serializeCsv(csvHeaders, dataRows, { sanitizeFormulas: true });

    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email || undefined,
      userRole: auth.user.role,
      action: 'EXPORT_DRIVE_APPLICANTS',
      resource: 'Drive',
      resourceId: id,
      details: {
        preset,
        count: applications.length,
        companyName,
        role: drive.role,
      },
    });

    const sanitizedRole = (drive.role || 'Drive').replace(/[^a-zA-Z0-9_-]/g, '_');
    const sanitizedCompany = companyName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${sanitizedCompany}_${sanitizedRole}_Applicants_${preset}.csv`;

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
    console.error('[GET /api/drives/[id]/export error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
