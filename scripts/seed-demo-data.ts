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
import User from '../src/models/User';
import { DEFAULT_PASSOUT_YEAR } from '../src/config/collegeConfig';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ Error: MONGODB_URI environment variable is not defined.');
  process.exit(1);
}

// HARD LIMIT 1: Remote database guard
if (MONGODB_URI.includes('mongodb.net')) {
  console.error('\n❌ HARD LIMIT VIOLATION: MONGODB_URI contains "mongodb.net".');
  console.error('Demo seeding is strictly forbidden on remote or Atlas databases.');
  console.error('Work only against local MongoDB (localhost / 127.0.0.1).\n');
  process.exit(1);
}

// Guard 2: Explicit flag check
if (process.env.ALLOW_DEMO_SEED !== 'true') {
  console.error('\n❌ SEED REFUSED: Demo seeding requires explicit confirmation.');
  console.error('To proceed, you must set: ALLOW_DEMO_SEED=true');
  console.error('Example: ALLOW_DEMO_SEED=true tsx scripts/seed-demo-data.ts\n');
  process.exit(1);
}

async function runSeed() {
  console.log('\nConnecting to local MongoDB...');
  await mongoose.connect(MONGODB_URI!, { serverSelectionTimeoutMS: 5000 });

  const dbName = (mongoose.connection.name || '').toLowerCase();
  const dbHost = (mongoose.connection.host || '').toLowerCase();

  // Guard 3: Database name must NOT be or contain 'traintrack'
  if (dbName === 'traintrack' || dbName.includes('traintrack')) {
    console.error(`\n❌ PROTECTED DATABASE: Target database is "${dbName}".`);
    console.error('Demo data seeder will NEVER touch a database named "traintrack". Aborting.\n');
    await mongoose.disconnect();
    process.exit(1);
  }

  // Guard 4: Host must be localhost/127.0.0.1 OR DB name ends with _preview/_dev/_test
  const isLocalHost = dbHost === 'localhost' || dbHost === '127.0.0.1' || dbHost === '::1';
  const isSafeSuffix = dbName.endsWith('_preview') || dbName.endsWith('_dev') || dbName.endsWith('_test');

  if (!isLocalHost && !isSafeSuffix) {
    console.error(`\n❌ UNSAFE TARGET: Host is "${dbHost}" and DB name is "${dbName}".`);
    console.error('Seeder only runs when host is localhost/127.0.0.1 or DB name ends in _preview, _dev, or _test.\n');
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`\n========================================================================`);
  console.log(`CampusPlace Demo Data Seeder`);
  console.log(`Target Database: "${dbName}"`);
  console.log(`Target Host:     "${dbHost}"`);
  console.log(`Tagging Mode:    isDemoData = true`);
  console.log(`========================================================================\n`);

  // Find a system user to associate registrations/offers
  let staffUser = await User.findOne({ role: { $in: ['TPO', 'SUPER_ADMIN'] } });
  if (!staffUser) {
    // If no admin user exists, fetch or create a transient demo user
    staffUser = await User.findOne({});
  }
  const fallbackUserId = staffUser ? staffUser._id : new mongoose.Types.ObjectId();

  // 1. Edge Case Students
  const demoStudents = [
    {
      name: 'Demo Student Standard [TEST]',
      rollNumber: 'DEMO-CSE-01',
      department: 'CSE',
      year: 'Final Year',
      passoutYear: DEFAULT_PASSOUT_YEAR,
      placementStatus: 'Not Placed',
      cgpa: 8.45,
      backlogs: 0,
      tenthPercentage: 88.5,
      twelfthOrDiplomaPercentage: 85.0,
      email: 'demo.standard@dypcet.test',
      isDemoData: true,
    },
    {
      name: 'Demo Ineligible Backlogs [TEST]',
      rollNumber: 'DEMO-CSE-02',
      department: 'CSE',
      year: 'Final Year',
      passoutYear: DEFAULT_PASSOUT_YEAR,
      placementStatus: 'Not Placed',
      cgpa: 7.2,
      backlogs: 2, // Active backlogs
      tenthPercentage: 75.0,
      twelfthOrDiplomaPercentage: 72.0,
      email: 'demo.backlogs@dypcet.test',
      isDemoData: true,
    },
    {
      name: 'Demo Null Academic Record [TEST]',
      rollNumber: 'DEMO-IT-01',
      department: 'IT',
      year: 'Final Year',
      passoutYear: DEFAULT_PASSOUT_YEAR,
      placementStatus: 'Not Placed',
      cgpa: null, // Unrecorded CGPA
      backlogs: null, // Unrecorded Backlogs
      tenthPercentage: null,
      twelfthOrDiplomaPercentage: null,
      email: 'demo.nullacademics@dypcet.test',
      isDemoData: true,
    },
    {
      name: 'Demo Opted Out Student [TEST]',
      rollNumber: 'DEMO-ME-01',
      department: 'ME',
      year: 'Final Year',
      passoutYear: DEFAULT_PASSOUT_YEAR,
      placementStatus: 'Opted Out',
      cgpa: 8.9,
      backlogs: 0,
      tenthPercentage: 92.0,
      twelfthOrDiplomaPercentage: 90.0,
      email: 'demo.optedout@dypcet.test',
      isDemoData: true,
    },
    {
      name: 'Demo Higher Studies Student [TEST]',
      rollNumber: 'DEMO-ECE-01',
      department: 'ECE',
      year: 'Final Year',
      passoutYear: DEFAULT_PASSOUT_YEAR,
      placementStatus: 'Higher Studies',
      cgpa: 9.1,
      backlogs: 0,
      tenthPercentage: 95.0,
      twelfthOrDiplomaPercentage: 93.0,
      email: 'demo.higherstudies@dypcet.test',
      isDemoData: true,
    },
    {
      name: 'Demo Entrepreneurship Student [TEST]',
      rollNumber: 'DEMO-EE-01',
      department: 'EE',
      year: 'Final Year',
      passoutYear: DEFAULT_PASSOUT_YEAR,
      placementStatus: 'Entrepreneurship',
      cgpa: 7.9,
      backlogs: 0,
      tenthPercentage: 80.0,
      twelfthOrDiplomaPercentage: 81.0,
      email: 'demo.startup@dypcet.test',
      isDemoData: true,
    },
    {
      name: 'Demo Already Placed Dream [TEST]',
      rollNumber: 'DEMO-CSE-03',
      department: 'CSE',
      year: 'Final Year',
      passoutYear: DEFAULT_PASSOUT_YEAR,
      placementStatus: 'Placed',
      placementDetails: {
        companyName: 'Acme Demo Cloud Systems [DEMO]',
        packageLPA: 8.5,
        placedDate: new Date(),
      },
      cgpa: 9.3,
      backlogs: 0,
      tenthPercentage: 94.0,
      twelfthOrDiplomaPercentage: 91.0,
      email: 'demo.placed@dypcet.test',
      isDemoData: true,
    },
  ];

  console.log('Inserting demo students...');
  const insertedStudents = [];
  for (const s of demoStudents) {
    const existing = await Student.findOne({ rollNumber: s.rollNumber });
    if (existing) {
      await Student.updateOne({ _id: existing._id }, { $set: s });
      insertedStudents.push(existing);
    } else {
      const created = await Student.create(s);
      insertedStudents.push(created);
    }
  }

  // 2. Demo Company
  console.log('Creating demo company...');
  let demoCompany = await Company.findOne({ normalizedName: 'acme demo cloud systems [demo]' });
  if (!demoCompany) {
    demoCompany = await Company.create({
      name: 'Acme Demo Cloud Systems [DEMO]',
      sector: 'Information Technology / Cloud',
      website: 'https://example.com/demo-acme',
      hrContacts: [
        {
          name: 'Jane Demo (HR Lead)',
          email: 'jane.demo@example.com',
          phone: '+919999900001',
          designation: 'Campus Recruitment Lead',
        },
      ],
      notes: 'Demo corporation for functional placement drive testing.',
      isDemoData: true,
    });
  }

  // 3. Demo Drives (Closed drive with past deadline + Open drive)
  console.log('Creating demo drives...');
  const pastDeadline = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
  const futureDeadline = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days future

  let pastDrive = await Drive.findOne({ title: 'Acme Closed Drive 2026 [DEMO]' });
  if (!pastDrive) {
    pastDrive = await Drive.create({
      company: demoCompany._id,
      title: 'Acme Closed Drive 2026 [DEMO]',
      role: 'Software Development Engineer - Intern',
      type: 'Internship+PPO',
      ctcLpa: 8.5,
      stipendMonthly: 35000,
      tier: 'Dream',
      registrationDeadline: pastDeadline,
      selectionRounds: ['Online Assessment', 'Technical Round 1', 'HR Round'],
      status: 'Registration Closed',
      eligibilityRules: {
        minCgpa: 7.5,
        maxBacklogs: 0,
        allowedDepartments: ['CSE', 'IT', 'ECE'],
        allowedBatches: [DEFAULT_PASSOUT_YEAR],
        minTenthPercentage: 70,
        minTwelfthOrDiplomaPercentage: 70,
      },
      isDemoData: true,
    });
  }

  let openDrive = await Drive.findOne({ title: 'Acme Open Campus Drive 2026 [DEMO]' });
  if (!openDrive) {
    openDrive = await Drive.create({
      company: demoCompany._id,
      title: 'Acme Open Campus Drive 2026 [DEMO]',
      role: 'Graduate Trainee Engineer',
      type: 'Full-time',
      ctcLpa: 4.8,
      tier: 'Regular',
      registrationDeadline: futureDeadline,
      selectionRounds: ['Aptitude Test', 'Technical Interview', 'Managerial Interview'],
      status: 'Open',
      eligibilityRules: {
        minCgpa: 6.0,
        maxBacklogs: 1,
        allowedDepartments: ['CSE', 'IT', 'ECE', 'EE', 'ME', 'CE'],
        allowedBatches: [DEFAULT_PASSOUT_YEAR],
        minTenthPercentage: 60,
        minTwelfthOrDiplomaPercentage: 60,
      },
      isDemoData: true,
    });
  }

  // 4. Demo Application
  console.log('Creating demo applications...');
  const stdStudent = insertedStudents.find((s) => s.rollNumber === 'DEMO-CSE-01');
  if (stdStudent && openDrive) {
    const existingApp = await Application.findOne({ drive: openDrive._id, student: stdStudent._id });
    if (!existingApp) {
      await Application.create({
        drive: openDrive._id,
        student: stdStudent._id,
        status: 'Applied',
        currentRoundIndex: 0,
        roundResults: [
          {
            roundIndex: 0,
            roundName: 'Aptitude Test',
            status: 'Pending',
            updatedBy: fallbackUserId,
          },
        ],
        statusHistory: [
          {
            status: 'Applied',
            roundIndex: 0,
            changedBy: fallbackUserId,
            reason: 'Registered via demo seed script',
            changedAt: new Date(),
          },
        ],
        eligibilitySnapshot: {
          isEligible: true,
          ineligibilityReasons: [],
          cgpa: stdStudent.cgpa,
          backlogs: stdStudent.backlogs,
          tenthPercentage: stdStudent.tenthPercentage,
          twelfthOrDiplomaPercentage: stdStudent.twelfthOrDiplomaPercentage,
          department: stdStudent.department,
          passoutYear: stdStudent.passoutYear,
          evaluatedAt: new Date(),
          policyCheck: { passesPolicy: true },
        },
        registeredBy: fallbackUserId,
        isDemoData: true,
      });
    }
  }

  // 5. Demo Offer for placed student
  const placedStudent = insertedStudents.find((s) => s.rollNumber === 'DEMO-CSE-03');
  if (placedStudent) {
    const existingOffer = await Offer.findOne({ student: placedStudent._id });
    if (!existingOffer) {
      await Offer.create({
        student: placedStudent._id,
        source: 'Campus Drive',
        companyName: 'Acme Demo Cloud Systems [DEMO]',
        role: 'Cloud Systems Engineer',
        type: 'Full-time',
        ctcLpa: 8.5,
        tier: 'Dream',
        status: 'Accepted',
        offerDate: new Date(),
        placementStatusSync: {
          status: 'Confirmed',
          confirmedAt: new Date(),
          confirmedBy: fallbackUserId,
        },
        isDemoData: true,
      });
    }
  }

  // 6. Demo Training Session with Attendance and Feedback
  console.log('Creating demo training session...');
  let demoSession = await TrainingSession.findOne({ title: 'Full-Stack Testing & Performance [DEMO]' });
  if (!demoSession) {
    demoSession = await TrainingSession.create({
      title: 'Full-Stack Testing & Performance [DEMO]',
      date: new Date(),
      trainer: 'Demo Expert Trainer [TEST]',
      description: 'Hands-on bootcamp session exploring automated testing, load benchmarks, and security audits.',
      isDemoData: true,
    });
  }

  if (demoSession && stdStudent) {
    const existingAtt = await Attendance.findOne({ sessionId: demoSession._id, studentId: stdStudent._id });
    if (!existingAtt) {
      await Attendance.create({
        sessionId: demoSession._id,
        studentId: stdStudent._id,
        present: true,
        markedAt: new Date(),
        isDemoData: true,
      });
    }

    const existingFeedback = await Feedback.findOne({ sessionId: demoSession._id, studentId: stdStudent._id });
    if (!existingFeedback) {
      await Feedback.create({
        sessionId: demoSession._id,
        studentId: stdStudent._id,
        source: 'student',
        rating: 5,
        comment: 'Excellent practical insights into full-stack testing workflows.',
        isDemoData: true,
      });
    }
  }

  console.log('\n✅ DEMO SEED COMPLETED SUCCESSFULLY:');
  console.log(`- ${demoStudents.length} demo students inserted (with edge cases)`);
  console.log(`- 1 demo company created`);
  console.log(`- 2 demo placement drives created (1 closed, 1 open)`);
  console.log(`- 1 demo application & 1 demo accepted offer created`);
  console.log(`- 1 demo training session with attendance and feedback created`);
  console.log(`\nAll records tagged with isDemoData = true for safe automated cleanup.\n`);

  await mongoose.disconnect();
}

runSeed().catch(async (err) => {
  console.error('\n❌ Error during demo seeding:', err);
  await mongoose.disconnect();
  process.exit(1);
});
