import { loadEnvConfig } from '@next/env';
import mongoose from 'mongoose';

loadEnvConfig(process.cwd());

import Student from '../src/models/Student';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ Error: MONGODB_URI environment variable is not defined.');
  process.exit(1);
}

async function reportIncompleteStudents() {
  try {
    console.log('Connecting to database in read-only mode...');
    await mongoose.connect(MONGODB_URI!, { serverSelectionTimeoutMS: 5000 });

    const dbName = mongoose.connection.name || 'unknown';
    const dbHost = mongoose.connection.host || 'unknown';
    console.log(`\n=============================================================`);
    console.log(`DYPCET T&P Data Audit: Incomplete Student Eligibility Records`);
    console.log(`Database: "${dbName}" on host: "${dbHost}"`);
    console.log(`=============================================================\n`);

    const students = await Student.find({}).lean();
    console.log(`Total Student Records: ${students.length}\n`);

    const incompleteRecords: Array<{
      rollNumber: string;
      name: string;
      department: string;
      passoutYear: number | string;
      missing: string[];
      notes: string[];
    }> = [];

    let countMissingCgpa = 0;
    let countMissingBacklogs = 0;
    let countMissingTenth = 0;
    let countMissingTwelfth = 0;
    let countMissingBatch = 0;
    let countDefaultZeroArtifacts = 0;

    for (const student of students) {
      const missing: string[] = [];
      const notes: string[] = [];

      if (student.cgpa == null) {
        missing.push('CGPA');
        countMissingCgpa++;
      }

      if (student.backlogs == null) {
        missing.push('Backlogs');
        countMissingBacklogs++;
      } else if (student.backlogs === 0 && student.cgpa == null) {
        // Explicitly flag possible default-0 artifact
        notes.push('possible default-0 artifact (backlogs=0 with missing CGPA)');
        countDefaultZeroArtifacts++;
      }

      if (student.tenthPercentage == null) {
        missing.push('10th %');
        countMissingTenth++;
      }

      if (student.twelfthOrDiplomaPercentage == null) {
        missing.push('12th/Diploma %');
        countMissingTwelfth++;
      }

      if (student.passoutYear == null) {
        missing.push('Passout Year (Batch)');
        countMissingBatch++;
      }

      if (missing.length > 0 || notes.length > 0) {
        incompleteRecords.push({
          rollNumber: student.rollNumber,
          name: student.name,
          department: student.department || student.branch || 'Unknown',
          passoutYear: student.passoutYear ?? 'Missing',
          missing,
          notes,
        });
      }
    }

    console.log('SUMMARY OF MISSING ELIGIBILITY ATTRIBUTES:');
    console.log('-------------------------------------------');
    console.log(`Students missing CGPA:                  ${countMissingCgpa}`);
    console.log(`Students missing Backlogs:              ${countMissingBacklogs}`);
    console.log(`Students missing 10th Percentage:       ${countMissingTenth}`);
    console.log(`Students missing 12th/Diploma %:        ${countMissingTwelfth}`);
    console.log(`Students missing Graduation Batch:      ${countMissingBatch}`);
    console.log(`Suspected "default 0" Backlog Artifacts: ${countDefaultZeroArtifacts}`);
    console.log(`-------------------------------------------`);
    console.log(`Total Students with Incomplete Data:    ${incompleteRecords.length} / ${students.length}\n`);

    if (incompleteRecords.length > 0) {
      console.log('SAMPLE INCOMPLETE RECORDS (First 20):');
      console.log('-------------------------------------------------------------------------------------------------');
      console.log(
        'PRN'.padEnd(16) +
        'Name'.padEnd(24) +
        'Dept'.padEnd(8) +
        'Batch'.padEnd(8) +
        'Missing Fields / Notes'
      );
      console.log('-------------------------------------------------------------------------------------------------');
      for (const item of incompleteRecords.slice(0, 20)) {
        const details = [...item.missing, ...item.notes].join(', ');
        console.log(
          item.rollNumber.padEnd(16) +
          item.name.slice(0, 22).padEnd(24) +
          item.department.padEnd(8) +
          String(item.passoutYear).padEnd(8) +
          details
        );
      }
      console.log('-------------------------------------------------------------------------------------------------\n');
    }

    await mongoose.disconnect();
    console.log('Audit completed successfully.\n');
  } catch (error) {
    console.error('Audit failed with error:', error);
    process.exit(1);
  }
}

reportIncompleteStudents();
