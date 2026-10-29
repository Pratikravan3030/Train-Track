import { loadEnvConfig } from '@next/env';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

loadEnvConfig(process.cwd());

import Student from '../src/models/Student';
import User from '../src/models/User';
import TrainingSession from '../src/models/TrainingSession';
import Attendance from '../src/models/Attendance';
import Feedback from '../src/models/Feedback';
import Company from '../src/models/Company';
import Drive from '../src/models/Drive';
import Application from '../src/models/Application';
import Offer from '../src/models/Offer';
import AuditLog from '../src/models/AuditLog';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ Error: MONGODB_URI environment variable is not defined.');
  process.exit(1);
}

// HARD LIMIT 1: Remote database guard
if (MONGODB_URI.includes('mongodb.net')) {
  console.error('\n❌ HARD LIMIT VIOLATION: MONGODB_URI contains "mongodb.net".');
  console.error('Work only against local MongoDB or in-memory test databases.\n');
  process.exit(1);
}

async function exportBackup() {
  console.log('\nConnecting to MongoDB (Read-Only)...');
  await mongoose.connect(MONGODB_URI!, { serverSelectionTimeoutMS: 5000 });

  const dbName = mongoose.connection.name || 'unknown';
  const dbHost = mongoose.connection.host || 'unknown';

  console.log(`\n========================================================================`);
  console.log(`CampusPlace Read-Only Database Export & Backup Tool`);
  console.log(`Target Database: "${dbName}"`);
  console.log(`Target Host:     "${dbHost}"`);
  console.log(`========================================================================\n`);

  console.log('Fetching collections in parallel (read-only)...');

  const [
    students,
    rawUsers,
    sessions,
    attendance,
    feedback,
    companies,
    drives,
    applications,
    offers,
    auditLogs,
  ] = await Promise.all([
    Student.find({}).lean(),
    User.find({}).lean(),
    TrainingSession.find({}).lean(),
    Attendance.find({}).lean(),
    Feedback.find({}).lean(),
    Company.find({}).lean(),
    Drive.find({}).lean(),
    Application.find({}).lean(),
    Offer.find({}).lean(),
    AuditLog.find({}).lean(),
  ]);

  // Sanitize users: Never dump password hashes or sensitive tokens
  const users = rawUsers.map((u) => {
    const sanitized = { ...u } as Record<string, unknown>;
    delete sanitized.password;
    sanitized.password = '[REDACTED]';
    return sanitized;
  });

  const backupData = {
    metadata: {
      exportedAt: new Date().toISOString(),
      databaseName: dbName,
      institution: 'D.Y. Patil College of Engineering & Technology (DYPCET), Kolhapur',
      system: 'CampusPlace T&P Management System',
      version: '1.0.0',
    },
    counts: {
      students: students.length,
      users: users.length,
      trainingSessions: sessions.length,
      attendance: attendance.length,
      feedback: feedback.length,
      companies: companies.length,
      drives: drives.length,
      applications: applications.length,
      offers: offers.length,
      auditLogs: auditLogs.length,
    },
    collections: {
      students,
      users,
      trainingSessions: sessions,
      attendance,
      feedback,
      companies,
      drives,
      applications,
      offers,
      auditLogs,
    },
  };

  const backupDir = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup-${dbName}-${timestamp}.json`;
  const filePath = path.join(backupDir, filename);

  fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2), 'utf-8');

  console.log('✅ BACKUP EXPORT COMPLETE:');
  console.log(`- File Destination: ${filePath}`);
  console.log(`- File Size:        ${(fs.statSync(filePath).size / (1024 * 1024)).toFixed(2)} MB`);
  console.log('\nExported Collection Records:');
  console.table(backupData.counts);
  console.log('\nNote: User passwords are redacted as [REDACTED]. This file is gitignored.\n');

  await mongoose.disconnect();
}

exportBackup().catch(async (err) => {
  console.error('\n❌ Error during backup export:', err);
  await mongoose.disconnect();
  process.exit(1);
});
