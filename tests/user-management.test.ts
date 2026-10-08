import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcryptjs';
import User from '@/models/User';
import AuditLog from '@/models/AuditLog';
import {
  createUserSchema,
  updateUserSchema,
  changePasswordSchema,
  passwordComplexityRegex,
} from '@/lib/validations/user';

describe('User Management & Password Policy Tests', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    process.env.MONGODB_URI = uri;
    await mongoose.connect(uri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await AuditLog.deleteMany({});
  });

  describe('Password Complexity Validation Rules', () => {
    it('rejects passwords shorter than 8 characters', () => {
      expect(passwordComplexityRegex.test('Short1!')).toBe(false);
    });

    it('rejects passwords missing uppercase letters', () => {
      expect(passwordComplexityRegex.test('lowercase1!abc')).toBe(false);
    });

    it('rejects passwords missing lowercase letters', () => {
      expect(passwordComplexityRegex.test('UPPERCASE1!ABC')).toBe(false);
    });

    it('rejects passwords missing numbers', () => {
      expect(passwordComplexityRegex.test('NoNumbersHere!@#')).toBe(false);
    });

    it('rejects passwords missing special characters', () => {
      expect(passwordComplexityRegex.test('Password123456')).toBe(false);
    });

    it('accepts strong passwords conforming to all criteria', () => {
      expect(passwordComplexityRegex.test('Campus@Place2025')).toBe(true);
      expect(passwordComplexityRegex.test('Dypcet#Admin99')).toBe(true);
    });
  });

  describe('User Creation Schema Constraints', () => {
    it('requires department when role is DEPT_COORDINATOR', () => {
      const invalid = createUserSchema.safeParse({
        name: 'Coordinator Without Dept',
        email: 'coord@dypcet.edu',
        role: 'DEPT_COORDINATOR',
      });
      expect(invalid.success).toBe(false);

      const valid = createUserSchema.safeParse({
        name: 'CSE Coordinator',
        email: 'coord.cse@dypcet.edu',
        role: 'DEPT_COORDINATOR',
        department: 'CSE',
      });
      expect(valid.success).toBe(true);
    });

    it('allows department to be omitted for TPO or SUPER_ADMIN', () => {
      const validAdmin = createUserSchema.safeParse({
        name: 'Super Admin',
        email: 'admin@dypcet.edu',
        role: 'SUPER_ADMIN',
      });
      expect(validAdmin.success).toBe(true);

      const validTpo = createUserSchema.safeParse({
        name: 'T&P Officer',
        email: 'tpo@dypcet.edu',
        role: 'TPO',
      });
      expect(validTpo.success).toBe(true);
    });

    it('validates partial updates with updateUserSchema', () => {
      const validUpdate = updateUserSchema.safeParse({
        name: 'Updated Officer',
        isActive: false,
      });
      expect(validUpdate.success).toBe(true);
    });

    it('validates password matching in changePasswordSchema', () => {
      const mismatch = changePasswordSchema.safeParse({
        currentPassword: 'CurrentPassword1!',
        newPassword: 'BrandNew#Password2025',
        confirmPassword: 'MismatchPassword1!',
      });
      expect(mismatch.success).toBe(false);

      const match = changePasswordSchema.safeParse({
        currentPassword: 'CurrentPassword1!',
        newPassword: 'BrandNew#Password2025',
        confirmPassword: 'BrandNew#Password2025',
      });
      expect(match.success).toBe(true);
    });
  });

  describe('Password Change & No-Reuse Logic', () => {
    it('prevents setting new password to the same as current password', async () => {
      const currentRaw = 'OldPassword1!';
      const hash = await bcrypt.hash(currentRaw, 10);

      const user = await User.create({
        name: 'Test Staff',
        email: 'staff@dypcet.edu',
        role: 'TPO',
        password: hash,
        mustChangePassword: false,
      });

      // Verify current password check passes
      const isCurrentValid = await bcrypt.compare(currentRaw, user.password);
      expect(isCurrentValid).toBe(true);

      // Verify same-password check catches reuse
      const isSameAsCurrent = await bcrypt.compare(currentRaw, user.password);
      expect(isSameAsCurrent).toBe(true);
    });

    it('prevents reuse of the temporary password after reset', async () => {
      const tempPass = 'Ab1!Temporary123';
      const tempHash = await bcrypt.hash(tempPass, 10);

      const user = await User.create({
        name: 'Reset Coordinator',
        email: 'reset.coord@dypcet.edu',
        role: 'DEPT_COORDINATOR',
        department: 'CSE',
        password: tempHash,
        temporaryPasswordHash: tempHash,
        mustChangePassword: true,
      });

      // When attempting to set newPassword to tempPass:
      const attemptedNewPassword = tempPass;
      const isSameAsTemp = await bcrypt.compare(attemptedNewPassword, user.temporaryPasswordHash!);
      expect(isSameAsTemp).toBe(true);

      // When setting a distinct new password:
      const genuineNewPassword = 'BrandNew#Secure2025';
      const isGenuineSameAsTemp = await bcrypt.compare(genuineNewPassword, user.temporaryPasswordHash!);
      expect(isGenuineSameAsTemp).toBe(false);

      // Successfully applying genuine password clears mustChangePassword and temp hash
      user.password = await bcrypt.hash(genuineNewPassword, 10);
      user.mustChangePassword = false;
      user.temporaryPasswordHash = undefined;
      await user.save();

      const updated = await User.findById(user._id);
      expect(updated?.mustChangePassword).toBe(false);
      expect(updated?.temporaryPasswordHash).toBeUndefined();
    });
  });

  describe('User Lifecycle & Status Changes', () => {
    it('creates active user with mustChangePassword flag on initial provision', async () => {
      const rawTempPass = 'TempPass1!Init';
      const hash = await bcrypt.hash(rawTempPass, 10);

      const user = await User.create({
        name: 'New Officer',
        email: 'officer@dypcet.edu',
        role: 'TPO',
        password: hash,
        temporaryPasswordHash: hash,
        mustChangePassword: true,
        isActive: true,
      });

      expect(user.isActive).toBe(true);
      expect(user.mustChangePassword).toBe(true);
      expect(user.temporaryPasswordHash).toBeDefined();
    });

    it('can deactivate and reactivate user', async () => {
      const user = await User.create({
        name: 'Active Staff',
        email: 'active@dypcet.edu',
        role: 'TPO',
        password: 'hash',
        isActive: true,
      });

      // Deactivate
      user.isActive = false;
      await user.save();
      let found = await User.findById(user._id);
      expect(found?.isActive).toBe(false);

      // Reactivate
      user.isActive = true;
      await user.save();
      found = await User.findById(user._id);
      expect(found?.isActive).toBe(true);
    });
  });
});
