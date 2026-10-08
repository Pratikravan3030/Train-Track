import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Drive from '@/models/Drive';
import Application from '@/models/Application';
import { requirePermission } from '@/lib/auth-guards';
import { shortlistPreviewSchema } from '@/lib/validations/offer';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('drives', 'manage_shortlist');
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    const body = await request.json();
    const parseResult = shortlistPreviewSchema.safeParse(body);

    if (!parseResult.success) {
      const firstError = Object.values(parseResult.error.flatten().fieldErrors)[0]?.[0] || 'Invalid input';
      return NextResponse.json({ error: firstError, details: parseResult.error.format() }, { status: 400 });
    }

    const { targetRoundIndex, rollNumbers } = parseResult.data;
    await dbConnect();

    const drive = await Drive.findById(id).lean();
    if (!drive) {
      return NextResponse.json({ error: 'Drive not found' }, { status: 404 });
    }

    const selectionRounds = drive.selectionRounds || ['Round 1'];
    if (targetRoundIndex < 0 || targetRoundIndex >= selectionRounds.length) {
      return NextResponse.json(
        {
          error: `Target round index ${targetRoundIndex} is out of bounds (Drive has ${selectionRounds.length} rounds).`,
        },
        { status: 400 }
      );
    }

    // Previous round candidates: must be active (not Rejected, not Withdrawn)
    // If targetRoundIndex === 0, candidates are currently 'Applied'
    // If targetRoundIndex > 0, candidates must be at targetRoundIndex - 1 or already at targetRoundIndex
    const applications = await Application.find({
      drive: id,
      status: { $nin: ['Rejected', 'Withdrawn'] },
    })
      .populate('student', 'name rollNumber prn department passoutYear')
      .lean();

    // Verify candidates are not skipping rounds
    if (targetRoundIndex > 0) {
      const candidatesBehind = applications.filter(
        (app) => app.currentRoundIndex < targetRoundIndex - 1
      );
      if (candidatesBehind.length === applications.length && applications.length > 0) {
        return NextResponse.json(
          {
            error: `Cannot skip rounds. Candidates must complete round ${targetRoundIndex - 1} ("${selectionRounds[targetRoundIndex - 1]}") before advancing to round ${targetRoundIndex} ("${selectionRounds[targetRoundIndex]}").`,
          },
          { status: 400 }
        );
      }
    }

    // Set of normalized search identifiers (roll numbers, PRNs)
    const normalizedInputSet = new Set(
      rollNumbers.map((r) => r.trim().toUpperCase())
    );

    const matched: unknown[] = [];
    const omitted: unknown[] = [];
    const matchedInputIdentifiers = new Set<string>();

    for (const app of applications) {
      const stu = app.student as unknown as {
        name: string;
        rollNumber: string;
        prn?: string;
        department: string;
      };

      const rollMatch = stu.rollNumber && normalizedInputSet.has(stu.rollNumber.toUpperCase());
      const prnMatch = stu.prn && normalizedInputSet.has(stu.prn.toUpperCase());

      if (rollMatch || prnMatch) {
        matched.push({
          applicationId: app._id,
          studentId: (app.student as { _id: string })._id,
          name: stu.name,
          rollNumber: stu.rollNumber,
          department: stu.department,
          currentRoundIndex: app.currentRoundIndex,
          currentStatus: app.status,
          alreadyAdvanced: app.currentRoundIndex >= targetRoundIndex,
        });

        if (stu.rollNumber) matchedInputIdentifiers.add(stu.rollNumber.toUpperCase());
        if (stu.prn) matchedInputIdentifiers.add(stu.prn.toUpperCase());
      } else {
        // Candidates who are eligible to advance but omitted from this shortlist
        if (app.currentRoundIndex <= targetRoundIndex) {
          omitted.push({
            applicationId: app._id,
            studentId: (app.student as { _id: string })._id,
            name: stu.name,
            rollNumber: stu.rollNumber,
            department: stu.department,
            currentRoundIndex: app.currentRoundIndex,
            currentStatus: app.status,
          });
        }
      }
    }

    // Unrecognized roll numbers that did not match any active applicant
    const unrecognized = rollNumbers.filter(
      (r) => !matchedInputIdentifiers.has(r.trim().toUpperCase())
    );

    return NextResponse.json({
      targetRoundIndex,
      targetRoundName: selectionRounds[targetRoundIndex],
      counts: {
        totalActiveApplicants: applications.length,
        matchedCount: matched.length,
        omittedCount: omitted.length,
        unrecognizedCount: unrecognized.length,
      },
      matched,
      omitted,
      unrecognized,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[POST /api/drives/[id]/shortlist/preview error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
