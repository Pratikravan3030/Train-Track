import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Assessment, { IAssessmentScore } from '@/models/Assessment';
import TrainingSession from '@/models/TrainingSession';
import Student from '@/models/Student';
import { requirePermission } from '@/lib/auth-guards';
import { logAudit } from '@/lib/audit';
import { parseCsv } from '@/lib/csv';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('assessments', 'import');
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    const body = await request.json();

    const { title, maxScore, passingScore, date, csvText } = body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'Assessment title is required.' }, { status: 400 });
    }

    const numMax = Number(maxScore);
    const numPass = Number(passingScore);

    if (isNaN(numMax) || numMax <= 0) {
      return NextResponse.json({ error: 'Max score must be a positive number.' }, { status: 400 });
    }

    if (isNaN(numPass) || numPass < 0 || numPass > numMax) {
      return NextResponse.json(
        { error: 'Passing score must be between 0 and max score.' },
        { status: 400 }
      );
    }

    if (!csvText || typeof csvText !== 'string' || !csvText.trim()) {
      return NextResponse.json({ error: 'CSV score content is required.' }, { status: 400 });
    }

    await dbConnect();
    const session = await TrainingSession.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!session) {
      return NextResponse.json({ error: 'Training session not found' }, { status: 404 });
    }

    // Parse CSV rows
    const rawRecords = parseCsv(csvText);
    if (rawRecords.length === 0) {
      return NextResponse.json({ error: 'CSV file contains no readable data rows.' }, { status: 400 });
    }

    // Identify column mappings flexibly (case-insensitive)
    const sampleRecord = rawRecords[0];
    const keys = Object.keys(sampleRecord);

    const rollKey = keys.find((k) =>
      ['rollnumber', 'roll_number', 'roll', 'prn', 'roll no', 'student roll'].includes(
        k.toLowerCase().replace(/[^a-z0-9]/g, '')
      )
    );
    const scoreKey = keys.find((k) =>
      ['score', 'marks', 'mark', 'testscore', 'points', 'total'].includes(
        k.toLowerCase().replace(/[^a-z0-9]/g, '')
      )
    );

    if (!rollKey || !scoreKey) {
      return NextResponse.json(
        {
          error:
            'Could not detect required columns. CSV must contain a Roll Number column (e.g. "Roll Number" or "PRN") and a Score column (e.g. "Score" or "Marks").',
        },
        { status: 400 }
      );
    }

    // Extract roll numbers and scores
    const extractedData: { roll: string; score: number; remarks?: string }[] = [];
    rawRecords.forEach((row) => {
      const roll = (row[rollKey] || '').trim().toUpperCase();
      const rawScore = Number(row[scoreKey]);
      if (roll && !isNaN(rawScore)) {
        extractedData.push({
          roll,
          score: Math.min(numMax, Math.max(0, rawScore)),
          remarks: row.remarks || row.Remarks || '',
        });
      }
    });

    if (extractedData.length === 0) {
      return NextResponse.json(
        { error: 'No valid student score rows could be extracted from the CSV.' },
        { status: 400 }
      );
    }

    // Match against active Students in Database
    const distinctRolls = Array.from(new Set(extractedData.map((d) => d.roll)));
    const matchedStudents = await Student.find({
      rollNumber: { $in: distinctRolls },
      isDeleted: { $ne: true },
    })
      .select('_id rollNumber name department')
      .lean();

    const studentMap = new Map<string, typeof matchedStudents[0]>();
    matchedStudents.forEach((st) => {
      studentMap.set(st.rollNumber, st);
    });

    const results: IAssessmentScore[] = [];
    const unmatchedRolls: string[] = [];

    extractedData.forEach((item) => {
      const student = studentMap.get(item.roll);
      if (student) {
        const percentage = parseFloat(((item.score / numMax) * 100).toFixed(1));
        const passed = item.score >= numPass;
        results.push({
          studentId: student._id,
          rollNumber: student.rollNumber,
          studentName: student.name,
          department: student.department,
          score: item.score,
          percentage,
          passed,
          remarks: item.remarks,
        });
      } else {
        unmatchedRolls.push(item.roll);
      }
    });

    if (results.length === 0) {
      return NextResponse.json(
        {
          error: `None of the roll numbers in the CSV could be matched to enrolled students in the database (${unmatchedRolls.slice(0, 5).join(', ')}...).`,
        },
        { status: 400 }
      );
    }

    const assessment = await Assessment.create({
      sessionId: id,
      title: title.trim(),
      maxScore: numMax,
      passingScore: numPass,
      date: date ? new Date(date) : new Date(),
      results,
      createdBy: auth.user.id,
    });

    await logAudit({
      userId: auth.user.id,
      userEmail: auth.user.email || undefined,
      userRole: auth.user.role,
      action: 'IMPORT_ASSESSMENT_SCORES',
      resource: 'Assessment',
      resourceId: assessment._id.toString(),
      details: {
        sessionId: id,
        title: assessment.title,
        matchedRecords: results.length,
        unmatchedCount: unmatchedRolls.length,
      },
    });

    const passedCount = results.filter((r) => r.passed).length;
    const avgScore = parseFloat(
      (results.reduce((a, b) => a + b.score, 0) / results.length).toFixed(2)
    );

    return NextResponse.json(
      {
        message: 'Assessment scores imported successfully',
        assessment,
        summary: {
          totalImported: results.length,
          unmatchedCount: unmatchedRolls.length,
          unmatchedRolls: unmatchedRolls.slice(0, 10),
          passedCount,
          failedCount: results.length - passedCount,
          passRate: parseFloat(((passedCount / results.length) * 100).toFixed(1)),
          averageScore: avgScore,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[POST /api/sessions/[id]/assessments/import error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
