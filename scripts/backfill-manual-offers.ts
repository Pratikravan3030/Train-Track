import { loadEnvConfig } from '@next/env';
import mongoose from 'mongoose';
import readline from 'readline';

loadEnvConfig(process.cwd());

import Student from '../src/models/Student';
import Offer from '../src/models/Offer';
import { resolveOfferTier } from '../src/config/collegeConfig';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ Error: MONGODB_URI environment variable is not defined.');
  process.exit(1);
}

const isApplyMode = process.argv.includes('--apply');

async function promptConfirmation(promptText: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(promptText, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function backfillManualOffers() {
  try {
    console.log('\nConnecting to MongoDB...');
    await mongoose.connect(MONGODB_URI!, { serverSelectionTimeoutMS: 5000 });

    const dbName = mongoose.connection.name || 'unknown';
    const dbHost = mongoose.connection.host || 'unknown';

    console.log(`\n========================================================================`);
    console.log(`CampusPlace Migration Tool: Backfill Manual Offers from Placed Students`);
    console.log(`Target Database: "${dbName}"`);
    console.log(`Target Host:     "${dbHost}"`);
    console.log(`Execution Mode:  ${isApplyMode ? '⚠️  APPLY (LIVE WRITES)' : '🛡️  DRY-RUN (INSPECT ONLY)'}`);
    console.log(`========================================================================\n`);

    console.log('MIGRATION ASSUMPTIONS:');
    console.log('------------------------------------------------------------------------');
    console.log('1. Source is set to "Off-Campus / Manual" (drive and application remain unset).');
    console.log('2. Offer.type defaults to "Full-time" (the college-standard default placement type).');
    console.log('3. Offer.status is set to "Accepted" since student profile is already Placed.');
    console.log('4. Offer.companyName is extracted directly from Student.placementDetails.companyName.');
    console.log('5. Offer.ctcLpa is extracted from Student.placementDetails.packageLPA.');
    console.log('6. Offer.tier is dynamically derived via resolveOfferTier(packageLPA).');
    console.log('7. placementStatusSync is initialized as status: "Confirmed" with confirmedAt timestamp.');
    console.log('8. Students who already have an Offer record are skipped to guarantee idempotency.');
    console.log('------------------------------------------------------------------------\n');

    // Find all placed students
    const placedStudents = await Student.find({ placementStatus: 'Placed' }).lean();
    console.log(`Found ${placedStudents.length} student(s) with placementStatus = 'Placed'.`);

    const candidateOffers: Array<{
      studentId: mongoose.Types.ObjectId;
      rollNumber: string;
      name: string;
      companyName: string;
      packageLPA: number;
      tier: string;
      placedDate: Date;
    }> = [];

    let alreadyHasOfferCount = 0;

    for (const student of placedStudents) {
      // Check if student already has an offer
      const existingOffer = await Offer.findOne({ student: student._id });
      if (existingOffer) {
        alreadyHasOfferCount++;
        continue;
      }

      const companyName = student.placementDetails?.companyName?.trim() || 'Off-Campus Employer';
      const packageLPA = student.placementDetails?.packageLPA ?? 0;
      const tier = resolveOfferTier(packageLPA);
      const placedDate = student.placementDetails?.placedDate || student.createdAt || new Date();

      candidateOffers.push({
        studentId: student._id as mongoose.Types.ObjectId,
        rollNumber: student.rollNumber,
        name: student.name,
        companyName,
        packageLPA,
        tier,
        placedDate,
      });
    }

    console.log(`Already have Offer records: ${alreadyHasOfferCount}`);
    console.log(`Eligible for manual Offer creation: ${candidateOffers.length}\n`);

    if (candidateOffers.length > 0) {
      console.log('PROPOSED OFFERS TO CREATE:');
      console.log('------------------------------------------------------------------------------------------------');
      console.log('PRN'.padEnd(16) + 'Name'.padEnd(24) + 'Company'.padEnd(24) + 'CTC'.padEnd(12) + 'Tier');
      console.log('------------------------------------------------------------------------------------------------');
      for (const item of candidateOffers.slice(0, 25)) {
        console.log(
          item.rollNumber.padEnd(16) +
          item.name.slice(0, 22).padEnd(24) +
          item.companyName.slice(0, 22).padEnd(24) +
          `${item.packageLPA} LPA`.padEnd(12) +
          item.tier
        );
      }
      if (candidateOffers.length > 25) {
        console.log(`... and ${candidateOffers.length - 25} more records.`);
      }
      console.log('------------------------------------------------------------------------------------------------\n');
    }

    if (!isApplyMode) {
      console.log('🛡️  DRY RUN COMPLETE: Zero database modifications were made.');
      console.log('To apply these changes, run with: npm run migrate:offers (or tsx scripts/backfill-manual-offers.ts --apply)\n');
      await mongoose.disconnect();
      return;
    }

    if (candidateOffers.length === 0) {
      console.log('No new offers to backfill. Database is already synchronized.');
      await mongoose.disconnect();
      return;
    }

    // Safety verification before applying live writes
    console.log(`⚠️  DANGER: You are about to insert ${candidateOffers.length} manual Offer documents into "${dbName}".`);
    const typedConfirmation = await promptConfirmation(`Type "${dbName}" to confirm and proceed: `);

    if (typedConfirmation !== dbName) {
      console.error('\n❌ Confirmation mismatch. Migration aborted without modifications.\n');
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log('\nInserting Offer documents...');
    const offersToInsert = candidateOffers.map((item) => ({
      student: item.studentId,
      source: 'Off-Campus / Manual' as const,
      companyName: item.companyName,
      role: 'Graduate Engineer Trainee',
      type: 'Full-time' as const,
      ctcLpa: item.packageLPA,
      tier: item.tier,
      status: 'Accepted' as const,
      offerDate: item.placedDate,
      decidedAt: item.placedDate,
      decisionReason: 'Historical placement record backfill',
      placementStatusSync: {
        status: 'Confirmed' as const,
        confirmedAt: item.placedDate,
      },
    }));

    const inserted = await Offer.insertMany(offersToInsert, { ordered: true });
    console.log(`✅ Successfully backfilled ${inserted.length} manual Offer records.\n`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('Migration failed with error:', error);
    process.exit(1);
  }
}

backfillManualOffers();
