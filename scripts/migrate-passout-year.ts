/**
 * Idempotent Student Passout Year (Batch) Migration Script
 *
 * Populates passoutYear (batch) on legacy Student records missing this field.
 * All operations are strictly additive and non-destructive.
 *
 * Usage:
 *   Dry-run (default): npx tsx scripts/migrate-passout-year.ts
 *   Apply changes:     npx tsx scripts/migrate-passout-year.ts --apply
 *   Non-interactive:   npx tsx scripts/migrate-passout-year.ts --apply --confirm-db=<database_name>
 */

import readline from 'readline';
import mongoose from 'mongoose';
import dbConnect from '../src/lib/db';
import Student from '../src/models/Student';
import { DEFAULT_PASSOUT_YEAR } from '../src/config/collegeConfig';

export function derivePassoutYearFromAcademicYear(academicYear?: string | null): number {
  if (!academicYear) return DEFAULT_PASSOUT_YEAR;
  const lower = academicYear.toLowerCase().trim();

  if (lower.includes('final') || lower.includes('4th') || lower.includes('fourth')) {
    return DEFAULT_PASSOUT_YEAR;
  }
  if (lower.includes('third') || lower.includes('3rd')) {
    return DEFAULT_PASSOUT_YEAR + 1;
  }
  if (lower.includes('second') || lower.includes('2nd')) {
    return DEFAULT_PASSOUT_YEAR + 2;
  }
  if (lower.includes('first') || lower.includes('1st')) {
    return DEFAULT_PASSOUT_YEAR + 3;
  }
  return DEFAULT_PASSOUT_YEAR;
}

async function confirmDatabaseName(dbName: string): Promise<boolean> {
  const confirmArg = process.argv.find((arg) => arg.startsWith('--confirm-db='));
  if (confirmArg) {
    const val = confirmArg.split('=')[1];
    return val === dbName;
  }
  if (process.argv.includes('--yes') || process.env.CI === 'true') {
    return true;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(
      `\n⚠️  PRE-MIGRATION SAFETY CONFIRMATION:\nType the database name "${dbName}" to confirm and proceed with --apply: `,
      (answer) => {
        rl.close();
        resolve(answer.trim() === dbName);
      }
    );
  });
}

async function runMigration() {
  const isApply = process.argv.includes('--apply');
  await dbConnect();

  const dbHost = mongoose.connection.host || 'unknown-host';
  const dbName = mongoose.connection.name || 'unknown-db';

  console.log(`\n======================================================`);
  console.log(`  STUDENT PASSOUT YEAR (BATCH) MIGRATION`);
  console.log(`  Target Host:          ${dbHost}`);
  console.log(`  Target Database:      ${dbName}`);
  console.log(`  Affected Collections: students`);
  console.log(`  Mode:                 ${isApply ? '🚀 APPLY (Writing to DB)' : '🔍 DRY-RUN (No changes will be saved)'}`);
  console.log(`======================================================`);

  if (isApply) {
    console.log(`\n⚠️  BACKUP REMINDER: Ensure you have taken a full database backup`);
    console.log(`   (e.g., mongodump --uri="...") before continuing!`);

    const confirmed = await confirmDatabaseName(dbName);
    if (!confirmed) {
      console.error(`\n❌ Migration aborted: Database name confirmation mismatch. No changes were applied.\n`);
      process.exit(1);
    }
    console.log(`\n🔒 Database confirmed: "${dbName}". Proceeding with migration...\n`);
  }

  const students = await Student.find({});
  console.log(`Analyzing ${students.length} student records in 'students' collection...`);

  let alreadyHasPassoutYear = 0;
  let toBeMigrated = 0;
  const migratedSample: Array<{ rollNumber: string; year: string; assignedBatch: number }> = [];

  for (const student of students) {
    if (student.passoutYear && typeof student.passoutYear === 'number') {
      alreadyHasPassoutYear++;
      continue;
    }

    const assignedBatch = derivePassoutYearFromAcademicYear(student.year);
    toBeMigrated++;

    if (migratedSample.length < 5) {
      migratedSample.push({
        rollNumber: student.rollNumber,
        year: student.year,
        assignedBatch,
      });
    }

    if (isApply) {
      student.passoutYear = assignedBatch;
      if (!student.placementStatus) {
        student.placementStatus = 'Not Placed';
      }
      await student.save();
    }
  }

  console.log(`\n------------------------------------------------------`);
  console.log(`MIGRATION SUMMARY`);
  console.log(`------------------------------------------------------`);
  console.log(`Total students scanned:          ${students.length}`);
  console.log(`Already have passoutYear:        ${alreadyHasPassoutYear}`);
  console.log(`Records to be migrated (batch):  ${toBeMigrated}`);

  if (migratedSample.length > 0) {
    console.log(`\nSample batch assignments:`);
    migratedSample.forEach((sample) => {
      console.log(`   - Roll: ${sample.rollNumber} | Academic Year: "${sample.year}" -> Batch: ${sample.assignedBatch}`);
    });
  }

  console.log(`------------------------------------------------------`);
  if (!isApply) {
    console.log(`\n💡 To apply these changes permanently, run:`);
    console.log(`   npx tsx scripts/migrate-passout-year.ts --apply\n`);
  } else {
    console.log(`\n✅ Migration successfully committed to database.\n`);
  }

  process.exit(0);
}

// Execute migration when invoked directly
if (require.main === module || !process.env.VITEST) {
  runMigration().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}
