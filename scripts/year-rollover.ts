/**
 * CampusPlace Academic Year Rollover Script
 * 
 * Archives past academic cohort placement drives and training sessions.
 * PRINCIPLE: ARCHIVE NOT DELETE. No data is ever deleted during rollover.
 * 
 * Safety Limits:
 * - Refuses to run against remote databases (mongodb.net) or database named 'traintrack'.
 * - Runs in DRY-RUN mode by default.
 * - Requires explicit `--apply` flag to write changes.
 * 
 * Usage:
 *   npx tsx scripts/year-rollover.ts --batch 2025
 *   npx tsx scripts/year-rollover.ts --batch 2025 --apply
 */

import { loadEnvConfig } from '@next/env';
import mongoose from 'mongoose';

loadEnvConfig(process.cwd());

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/campusplace_dev';

function verifyLocalDatabaseSafety(targetUri: string) {
  if (targetUri.includes('mongodb.net')) {
    console.error('CRITICAL ABORT: MONGODB_URI points to a remote MongoDB Atlas cluster. Refusing to run.');
    process.exit(1);
  }

  const urlObj = new URL(targetUri);
  const dbName = urlObj.pathname.replace(/^\//, '');

  if (dbName === 'traintrack') {
    console.error('CRITICAL ABORT: Refusing to run rollover on database "traintrack".');
    process.exit(1);
  }

  const isLocalHost = urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1';
  if (!isLocalHost) {
    console.error(`CRITICAL ABORT: Host ${urlObj.hostname} is not localhost.`);
    process.exit(1);
  }
}

async function runRollover() {
  verifyLocalDatabaseSafety(uri);

  const args = process.argv.slice(2);
  const isApply = args.includes('--apply');
  const batchIdx = args.indexOf('--batch');
  const targetBatchStr = batchIdx !== -1 && args[batchIdx + 1] ? args[batchIdx + 1] : null;

  if (!targetBatchStr) {
    console.error('ERROR: Missing required --batch <year> argument.');
    console.error('Example: npx tsx scripts/year-rollover.ts --batch 2025 [--apply]');
    process.exit(1);
  }

  const targetBatch = parseInt(targetBatchStr, 10);
  if (isNaN(targetBatch) || targetBatch < 2000 || targetBatch > 2100) {
    console.error(`ERROR: Invalid batch year "${targetBatchStr}".`);
    process.exit(1);
  }

  console.log('='.repeat(70));
  console.log(`CAMPUSPLACE ACADEMIC YEAR ROLLOVER — COHORT ${targetBatch}`);
  console.log(`Mode: ${isApply ? '*** LIVE COMMIT (--apply) ***' : '[DRY-RUN ONLY]'}`);
  console.log(`Target Database: ${new URL(uri).pathname.replace(/^\//, '')} on ${new URL(uri).hostname}`);
  console.log('='.repeat(70));

  await mongoose.connect(uri);

  const db = mongoose.connection.db;
  if (!db) {
    console.error('Failed to establish database connection.');
    process.exit(1);
  }

  const studentsColl = db.collection('students');
  const drivesColl = db.collection('drives');
  const sessionsColl = db.collection('trainingsessions');
  const offersColl = db.collection('offers');

  // 1. Audit Students in target batch
  const studentCount = await studentsColl.countDocuments({
    passoutYear: targetBatch,
    isDeleted: { $ne: true },
  });
  const placedStudentCount = await studentsColl.countDocuments({
    passoutYear: targetBatch,
    placementStatus: 'Placed',
    isDeleted: { $ne: true },
  });

  console.log(`\n1. STUDENT COHORT AUDIT (Batch ${targetBatch}):`);
  console.log(`   - Total active students: ${studentCount}`);
  console.log(`   - Placed students: ${placedStudentCount}`);
  console.log('   - NOTE: Student records remain active and retained for institutional history (NEVER deleted).');

  // 2. Qualifying Offers Audit
  const batchStudentIds = (
    await studentsColl
      .find({ passoutYear: targetBatch, isDeleted: { $ne: true } }, { projection: { _id: 1 } })
      .toArray()
  ).map((s) => s._id);

  const offerCount = await offersColl.countDocuments({
    student: { $in: batchStudentIds },
  });
  console.log(`\n2. OFFERS & OUTCOMES AUDIT:`);
  console.log(`   - Total offers preserved for batch: ${offerCount}`);

  // 3. Drives eligible for archiving
  // Drives targeted specifically to this batch or conducted during that academic cycle
  const driveFilter = {
    isArchived: { $ne: true },
    isDeleted: { $ne: true },
    $or: [
      { 'eligibilityRules.allowedBatches': targetBatch },
      { 'eligibilityRules.allowedBatches': { $size: 0 } },
    ],
  };

  const drivesToArchive = await drivesColl.find(driveFilter).toArray();
  console.log(`\n3. PLACEMENT DRIVES ARCHIVAL:`);
  console.log(`   - Unarchived drives eligible to be archived: ${drivesToArchive.length}`);

  // 4. Training Sessions eligible for archiving
  // Sessions dated before or during the batch graduation window
  const sessionFilter = {
    isArchived: { $ne: true },
    isDeleted: { $ne: true },
    date: { $lte: new Date(`${targetBatch}-07-31T23:59:59.999Z`) },
  };
  const sessionsToArchive = await sessionsColl.find(sessionFilter).toArray();
  console.log(`\n4. TRAINING SESSIONS ARCHIVAL:`);
  console.log(`   - Training sessions eligible to be archived: ${sessionsToArchive.length}`);

  console.log('\n' + '-'.repeat(70));

  if (!isApply) {
    console.log('DRY-RUN SUMMARY:');
    console.log(`  Would archive ${drivesToArchive.length} placement drives.`);
    console.log(`  Would archive ${sessionsToArchive.length} training sessions.`);
    console.log('  Zero records would be deleted.');
    console.log('\nTo execute this rollover, re-run with:');
    console.log(`  npx tsx scripts/year-rollover.ts --batch ${targetBatch} --apply`);
  } else {
    console.log('EXECUTING LIVE ROLLOVER:');

    // Archive Drives
    const driveUpdateResult = await drivesColl.updateMany(driveFilter, {
      $set: { isArchived: true, updatedAt: new Date() },
    });
    console.log(`  ✔ Successfully marked ${driveUpdateResult.modifiedCount} drives as archived.`);

    // Archive Training Sessions
    const sessionUpdateResult = await sessionsColl.updateMany(sessionFilter, {
      $set: { isArchived: true },
    });
    console.log(`  ✔ Successfully marked ${sessionUpdateResult.modifiedCount} sessions as archived.`);

    console.log('\nCONFIRMATION: ARCHIVE COMPLETE.');
    console.log('All historical cohorts, students, and offers are fully preserved.');
  }

  console.log('='.repeat(70));
  await mongoose.disconnect();
}

runRollover().catch((err) => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
