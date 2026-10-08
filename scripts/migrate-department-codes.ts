/**
 * Idempotent Department Code Migration Script
 *
 * Maps legacy free-text department/branch values to standardized codes (e.g., 'CSE', 'IT', 'ECE').
 *
 * Usage:
 *   Dry-run (default): npx tsx scripts/migrate-department-codes.ts
 *   Apply changes:     npx tsx scripts/migrate-department-codes.ts --apply
 *   Non-interactive:   npx tsx scripts/migrate-department-codes.ts --apply --confirm-db=<database_name>
 */

import readline from 'readline';
import mongoose from 'mongoose';
import dbConnect from '../src/lib/db';
import Student from '../src/models/Student';
import User from '../src/models/User';
import { mapToDepartmentCode } from '../src/lib/departmentMapper';
import { DEPARTMENT_CODES, DepartmentCode } from '../src/config/collegeConfig';

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
  console.log(`  DEPARTMENT CODE MIGRATION`);
  console.log(`  Target Host:          ${dbHost}`);
  console.log(`  Target Database:      ${dbName}`);
  console.log(`  Affected Collections: students, users`);
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

  // 1. Migrate Students
  const students = await Student.find({});
  console.log(`Analyzing ${students.length} student records in 'students' collection...`);

  let studentMigrated = 0;
  let studentAlreadyValid = 0;
  const unmappedStudents: Array<{ id: string; rollNumber: string; branch?: string }> = [];

  for (const student of students) {
    const currentCode = student.department;
    const isCodeValid = currentCode && DEPARTMENT_CODES.includes(currentCode as DepartmentCode);

    if (isCodeValid) {
      studentAlreadyValid++;
      continue;
    }

    const rawValue = student.branch || currentCode;
    const mapped = mapToDepartmentCode(rawValue);

    if (mapped) {
      studentMigrated++;
      if (isApply) {
        student.department = mapped;
        // Keep branch aligned with canonical code
        student.branch = mapped;
        await student.save();
      }
    } else {
      unmappedStudents.push({
        id: student._id.toString(),
        rollNumber: student.rollNumber,
        branch: rawValue,
      });
    }
  }

  // 2. Migrate Users (Coordinators)
  const users = await User.find({ role: 'DEPT_COORDINATOR' });
  console.log(`Analyzing ${users.length} department coordinator accounts in 'users' collection...`);

  let userMigrated = 0;
  let userAlreadyValid = 0;
  const unmappedUsers: Array<{ id: string; email: string; department?: string }> = [];

  for (const user of users) {
    const currentDept = user.department;
    const isCodeValid = currentDept && DEPARTMENT_CODES.includes(currentDept as DepartmentCode);

    if (isCodeValid) {
      userAlreadyValid++;
      continue;
    }

    const mapped = mapToDepartmentCode(currentDept);
    if (mapped) {
      userMigrated++;
      if (isApply) {
        user.department = mapped;
        await user.save();
      }
    } else if (currentDept) {
      unmappedUsers.push({
        id: user._id.toString(),
        email: user.email,
        department: currentDept,
      });
    }
  }

  // Summary Report
  console.log(`\n------------------------------------------------------`);
  console.log(`MIGRATION SUMMARY`);
  console.log(`------------------------------------------------------`);
  console.log(`Students collection:`);
  console.log(`  Total scanned:       ${students.length}`);
  console.log(`  Already valid codes: ${studentAlreadyValid}`);
  console.log(`  To be migrated:      ${studentMigrated}`);
  console.log(`  Unmapped:            ${unmappedStudents.length}`);

  if (unmappedStudents.length > 0) {
    console.log(`\n⚠️  Unmapped Student Records:`);
    unmappedStudents.forEach((s) => {
      console.log(`   - Roll: ${s.rollNumber} | Raw branch: "${s.branch || '<empty>'}"`);
    });
  }

  console.log(`\nUsers collection (Coordinators):`);
  console.log(`  Total scanned:       ${users.length}`);
  console.log(`  Already valid codes: ${userAlreadyValid}`);
  console.log(`  To be migrated:      ${userMigrated}`);
  console.log(`  Unmapped:            ${unmappedUsers.length}`);

  if (unmappedUsers.length > 0) {
    console.log(`\n⚠️  Unmapped Coordinator Accounts:`);
    unmappedUsers.forEach((u) => {
      console.log(`   - Email: ${u.email} | Raw dept: "${u.department || '<empty>'}"`);
    });
  }

  console.log(`------------------------------------------------------`);
  if (!isApply) {
    console.log(`\n💡 To apply these changes permanently, run:`);
    console.log(`   npx tsx scripts/migrate-department-codes.ts --apply\n`);
  } else {
    console.log(`\n✅ Migration successfully committed to database.\n`);
  }

  process.exit(0);
}

runMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
