import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Student from '@/models/Student';
import { requirePermission } from '@/lib/auth-guards';
import { parseCsv } from '@/lib/csv';
import { resolveStudentDepartment } from '@/lib/departmentMapper';
import { DEFAULT_PASSOUT_YEAR } from '@/config/collegeConfig';
import {
  normalizeHeader,
  normalizeAcademicYear,
  importStudentRowSchema,
  PreviewRowResult,
  ImportPreviewResponse,
} from '@/lib/validations/student-import';

export async function POST(request: Request) {
  const auth = await requirePermission('students', 'import');
  if (!auth.authorized) return auth.response;

  try {
    let csvContent = '';
    let targetBatch = DEFAULT_PASSOUT_YEAR;

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ error: 'No CSV file uploaded' }, { status: 400 });
      }
      csvContent = await file.text();
      const batchParam = formData.get('batch');
      if (batchParam) {
        targetBatch = parseInt(String(batchParam), 10) || DEFAULT_PASSOUT_YEAR;
      }
    } else {
      const body = await request.json();
      csvContent = body.csvContent || '';
      if (body.batch) {
        targetBatch = parseInt(String(body.batch), 10) || DEFAULT_PASSOUT_YEAR;
      }
    }

    if (!csvContent.trim()) {
      return NextResponse.json({ error: 'CSV file is empty' }, { status: 400 });
    }

    const rawRecords = parseCsv(csvContent);
    if (rawRecords.length === 0) {
      return NextResponse.json({ error: 'CSV file contains no student data rows' }, { status: 400 });
    }

    await dbConnect();

    const previewRows: PreviewRowResult[] = [];
    const seenRollNumbersInFile = new Map<string, number>();
    let duplicateCount = 0;
    let validCount = 0;
    let errorCount = 0;

    for (let index = 0; index < rawRecords.length; index++) {
      const original = rawRecords[index];
      const rowNumber = index + 2; // Line 1 is headers, Line 2 is first data row
      const errors: string[] = [];
      let isDuplicate = false;
      let duplicateType: 'file' | 'database' | null = null;
      let duplicateDetails: string | undefined = undefined;

      // Normalize record keys
      const normalizedRow: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(original)) {
        normalizedRow[normalizeHeader(k)] = v;
      }

      // Fill default target batch if not provided in row
      if (!normalizedRow.passoutYear || isNaN(Number(normalizedRow.passoutYear))) {
        normalizedRow.passoutYear = targetBatch;
      } else {
        normalizedRow.passoutYear = Number(normalizedRow.passoutYear);
      }

      if (normalizedRow.year) {
        normalizedRow.year = normalizeAcademicYear(String(normalizedRow.year));
      } else {
        normalizedRow.year = 'Final Year';
      }

      if (normalizedRow.cgpa !== undefined && normalizedRow.cgpa !== '') {
        normalizedRow.cgpa = Number(normalizedRow.cgpa);
      } else {
        delete normalizedRow.cgpa;
      }

      if (normalizedRow.backlogs !== undefined && normalizedRow.backlogs !== '') {
        normalizedRow.backlogs = Number(normalizedRow.backlogs);
      } else {
        normalizedRow.backlogs = 0;
      }

      if (normalizedRow.email === '') delete normalizedRow.email;
      if (normalizedRow.phone === '') delete normalizedRow.phone;

      // Validate department
      let canonicalDept: string | undefined = undefined;
      const rawDept = String(normalizedRow.department || '');
      try {
        canonicalDept = resolveStudentDepartment({ department: rawDept });
        normalizedRow.department = canonicalDept;
      } catch (deptErr) {
        errors.push(deptErr instanceof Error ? deptErr.message : `Invalid department: "${rawDept}"`);
      }

      // Department coordinator scoping check
      if (
        auth.user.role === 'DEPT_COORDINATOR' &&
        canonicalDept &&
        auth.user.department &&
        canonicalDept !== auth.user.department
      ) {
        errors.push(
          `Forbidden: As ${auth.user.department} Coordinator, you cannot import students for department "${canonicalDept}".`
        );
      }

      // PRN/Roll Number checks
      const rollNumber = String(normalizedRow.rollNumber || '').trim().toUpperCase();
      if (!rollNumber) {
        errors.push('PRN / Roll Number is required.');
      } else {
        normalizedRow.rollNumber = rollNumber;

        // 1. Check duplicate within the same file
        if (seenRollNumbersInFile.has(rollNumber)) {
          const priorRow = seenRollNumbersInFile.get(rollNumber)!;
          isDuplicate = true;
          duplicateType = 'file';
          duplicateDetails = `Duplicate in file: PRN "${rollNumber}" appears multiple times (previously seen on line ${priorRow}).`;
          errors.push(duplicateDetails);
          duplicateCount++;
        } else {
          seenRollNumbersInFile.set(rollNumber, rowNumber);

          // 2. Check duplicate in database
          const existingStudent = await Student.findOne({ rollNumber });
          if (existingStudent) {
            isDuplicate = true;
            duplicateType = 'database';
            duplicateDetails = `Duplicate in database: Student with PRN "${rollNumber}" already exists (${existingStudent.name}, Dept: ${existingStudent.department}, Batch: ${existingStudent.passoutYear}).`;
            errors.push(duplicateDetails);
            duplicateCount++;
          }
        }
      }

      // Validate schema
      const parseResult = importStudentRowSchema.safeParse(normalizedRow);
      if (!parseResult.success) {
        for (const issue of parseResult.error.issues) {
          errors.push(`${issue.path.join('.')}: ${issue.message}`);
        }
      }

      const isValid = errors.length === 0;
      if (isValid) {
        validCount++;
      } else {
        errorCount++;
      }

      previewRows.push({
        rowNumber,
        original,
        parsedData: parseResult.success ? parseResult.data : undefined,
        canonicalDepartment: canonicalDept,
        isValid,
        errors,
        isDuplicate,
        duplicateType,
        duplicateDetails,
      });
    }

    const responseData: ImportPreviewResponse = {
      totalRows: rawRecords.length,
      validRows: validCount,
      errorRows: errorCount,
      duplicateCount,
      targetBatch,
      rows: previewRows,
    };

    return NextResponse.json(responseData, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[POST /api/students/import/preview error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
