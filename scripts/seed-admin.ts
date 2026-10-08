import { loadEnvConfig } from '@next/env';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// Load environment variables like Next.js does
loadEnvConfig(process.cwd());

import User from '../src/models/User';

const MONGODB_URI = process.env.MONGODB_URI;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

async function seedAdmin() {
  if (!MONGODB_URI) {
    console.error('❌ Error: MONGODB_URI environment variable is not defined.');
    process.exit(1);
  }

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('❌ Error: ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required.');
    console.error('Please configure them in your .env or deployment environment.');
    process.exit(1);
  }

  console.log('Connecting to database...');
  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
  });

  const dbName = mongoose.connection.name || 'unknown';
  const dbHost = mongoose.connection.host || 'unknown';
  console.log(`Connected to database: "${dbName}" on host: "${dbHost}"`);
  console.log('Checking for existing administrator accounts...');

  const normalizedEmail = ADMIN_EMAIL.trim().toLowerCase();
  const existingUser = await User.findOne({ email: normalizedEmail });

  if (existingUser) {
    console.log(`ℹ️ User with email "${normalizedEmail}" already exists with role: "${existingUser.role}".`);
    console.log('No destructive changes performed. Exiting safely.');
    await mongoose.disconnect();
    process.exit(0);
  }

  console.log('Hashing password securely with bcrypt...');
  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const admin = await User.create({
    name: 'T&P Super Administrator',
    email: normalizedEmail,
    password: hashedPassword,
    role: 'SUPER_ADMIN',
    isActive: true,
  });

  console.log(`✅ Super Admin created successfully!`);
  console.log(`   User ID: ${admin._id}`);
  console.log(`   Email:   ${admin.email}`);
  console.log(`   Role:    ${admin.role}`);
  console.log('Database was NOT wiped. Existing data is completely safe.');

  await mongoose.disconnect();
  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error('❌ Error running seed-admin:', err);
  process.exit(1);
});
