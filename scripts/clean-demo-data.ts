import { loadEnvConfig } from '@next/env';
import mongoose from 'mongoose';

loadEnvConfig(process.cwd());

import Student from '../src/models/Student';
import Company from '../src/models/Company';
import Drive from '../src/models/Drive';
import Application from '../src/models/Application';
import Offer from '../src/models/Offer';
import TrainingSession from '../src/models/TrainingSession';
import Attendance from '../src/models/Attendance';
import Feedback from '../src/models/Feedback';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ Error: MONGODB_URI environment variable is not defined.');
  process.exit(1);
}

// HARD LIMIT 1: Remote database guard
if (MONGODB_URI.includes('mongodb.net')) {
  console.error('\n❌ HARD LIMIT VIOLATION: MONGODB_URI contains "mongodb.net".');
  console.error('Work only against local MongoDB (localhost / 127.0.0.1).\n');
  process.exit(1);
}

async function runCleanup() {
  console.log('\nConnecting to local MongoDB...');
  await mongoose.connect(MONGODB_URI!, { serverSelectionTimeoutMS: 5000 });

  const dbName = (mongoose.connection.name || '').toLowerCase();
  const dbHost = (mongoose.connection.host || '').toLowerCase();

  // Guard 2: Database name must NOT be or contain 'traintrack'
  if (dbName === 'traintrack' || dbName.includes('traintrack')) {
    console.error(`\n❌ PROTECTED DATABASE: Target database is "${dbName}".`);
    console.error('Cleanup tool will NEVER operate on "traintrack". Aborting.\n');
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`\n========================================================================`);
  console.log(`CampusPlace Demo Data Cleanup Tool`);
  console.log(`Target Database: "${dbName}"`);
  console.log(`Target Host:     "${dbHost}"`);
  console.log(`========================================================================\n`);

  const demoFilter = {
    $or: [{ isDemoData: true }, { rollNumber: { $regex: /^DEMO-/i } }, { name: { $regex: /\[DEMO\]|\[TEST\]/i } }],
  };

  const delStudents = await Student.deleteMany(demoFilter);
  const delOffers = await Offer.deleteMany({
    $or: [{ isDemoData: true }, { companyName: { $regex: /\[DEMO\]/i } }],
  });
  const delApps = await Application.deleteMany({ isDemoData: true });
  const delDrives = await Drive.deleteMany({
    $or: [{ isDemoData: true }, { title: { $regex: /\[DEMO\]/i } }],
  });
  const delCompanies = await Company.deleteMany({
    $or: [{ isDemoData: true }, { name: { $regex: /\[DEMO\]/i } }],
  });
  const delFeedback = await Feedback.deleteMany({ isDemoData: true });
  const delAttendance = await Attendance.deleteMany({ isDemoData: true });
  const delSessions = await TrainingSession.deleteMany({
    $or: [{ isDemoData: true }, { title: { $regex: /\[DEMO\]/i } }],
  });

  console.log('✅ Demo Data Removal Summary:');
  console.log(`- Students removed:         ${delStudents.deletedCount}`);
  console.log(`- Offers removed:           ${delOffers.deletedCount}`);
  console.log(`- Applications removed:     ${delApps.deletedCount}`);
  console.log(`- Drives removed:           ${delDrives.deletedCount}`);
  console.log(`- Companies removed:        ${delCompanies.deletedCount}`);
  console.log(`- Attendance logs removed:  ${delAttendance.deletedCount}`);
  console.log(`- Feedbacks removed:        ${delFeedback.deletedCount}`);
  console.log(`- Training sessions removed:${delSessions.deletedCount}`);
  console.log(`\nDemo data cleanup completed cleanly.\n`);

  await mongoose.disconnect();
}

runCleanup().catch(async (err) => {
  console.error('\n❌ Error during demo data cleanup:', err);
  await mongoose.disconnect();
  process.exit(1);
});
