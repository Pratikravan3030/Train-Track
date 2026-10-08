import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Drive from '@/models/Drive';
import Application from '@/models/Application';
import { requirePermission } from '@/lib/auth-guards';
import { logAudit } from '@/lib/audit';
import { shortlistConfirmSchema } from '@/lib/validations/offer';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('drives', 'manage_shortlist');
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    const body = await request.json();
    const parseResult = shortlistConfirmSchema.safeParse(body);

    if (!parseResult.success) {
      const firstError = Object.values(parseResult.error.flatten().fieldErrors)[0]?.[0] || 'Invalid input';
      return NextResponse.json({ error: firstError, details: parseResult.error.format() }, { status: 400 });
    }

    const { targetRoundIndex, shortlistedRollNumbers, eliminateOmitted, rejectionReason } =
      parseResult.data;
    await dbConnect();

    const drive = await Drive.findById(id);
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

    // Set of shortlisted roll numbers (normalized)
    const shortlistedSet = new Set(
      shortlistedRollNumbers.map((r) => r.trim().toUpperCase())
    );

    // Active applications
    const applications = await Application.find({
      drive: id,
      status: { $nin: ['Rejected', 'Withdrawn'] },
    }).populate('student');

    let advancedCount = 0;
    let alreadyAdvancedCount = 0;
    let eliminatedCount = 0;

    const isFinalRound = targetRoundIndex === selectionRounds.length - 1;
    const newStatus = isFinalRound ? 'Selected' : 'In Round';

    for (const app of applications) {
      const stu = app.student as unknown as {
        _id: mongoose.Types.ObjectId;
        rollNumber: string;
        prn?: string;
      };

      const isShortlisted =
        (stu.rollNumber && shortlistedSet.has(stu.rollNumber.toUpperCase())) ||
        (stu.prn && shortlistedSet.has(stu.prn.toUpperCase()));

      if (isShortlisted) {
        // Idempotency: Skip if candidate is already at or past target round with current status
        if (app.currentRoundIndex === targetRoundIndex && app.status === newStatus) {
          alreadyAdvancedCount++;
          continue;
        }

        // Mark previous round as Passed if applicable
        if (targetRoundIndex > 0 && app.roundResults && app.roundResults[targetRoundIndex - 1]) {
          app.roundResults[targetRoundIndex - 1].status = 'Passed';
          app.roundResults[targetRoundIndex - 1].updatedBy = new mongoose.Types.ObjectId(auth.user.id);
          app.roundResults[targetRoundIndex - 1].updatedAt = new Date();
        }

        app.currentRoundIndex = targetRoundIndex;
        app.status = newStatus;
        app.statusHistory.push({
          status: newStatus,
          roundIndex: targetRoundIndex,
          changedBy: new mongoose.Types.ObjectId(auth.user.id),
          reason: `Advanced to round ${targetRoundIndex + 1} (${selectionRounds[targetRoundIndex]}) via shortlist confirm`,
          changedAt: new Date(),
        });

        await app.save();
        advancedCount++;
      } else if (eliminateOmitted) {
        // Eliminate candidate from the previous round
        if (app.currentRoundIndex < targetRoundIndex && app.status !== 'Rejected') {
          const elimRound = Math.max(0, targetRoundIndex - 1);
          if (app.roundResults && app.roundResults[elimRound]) {
            app.roundResults[elimRound].status = 'Failed';
            app.roundResults[elimRound].updatedBy = new mongoose.Types.ObjectId(auth.user.id);
            app.roundResults[elimRound].updatedAt = new Date();
          }

          app.status = 'Rejected';
          app.statusHistory.push({
            status: 'Rejected',
            roundIndex: elimRound,
            changedBy: new mongoose.Types.ObjectId(auth.user.id),
            reason: rejectionReason || `Eliminated in shortlist for ${selectionRounds[targetRoundIndex]}`,
            changedAt: new Date(),
          });

          await app.save();
          eliminatedCount++;
        }
      }
    }

    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email || undefined,
      userRole: auth.user.role,
      action: 'UPDATE_SHORTLIST',
      resource: 'Drive',
      resourceId: id,
      details: {
        targetRoundIndex,
        targetRoundName: selectionRounds[targetRoundIndex],
        advancedCount,
        alreadyAdvancedCount,
        eliminatedCount,
        eliminateOmitted,
      },
    });

    return NextResponse.json({
      message: 'Shortlist confirmed successfully.',
      targetRoundIndex,
      targetRoundName: selectionRounds[targetRoundIndex],
      summary: {
        advancedCount,
        alreadyAdvancedCount,
        eliminatedCount,
        eliminateOmitted,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[POST /api/drives/[id]/shortlist/confirm error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
