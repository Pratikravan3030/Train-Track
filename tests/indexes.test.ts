import { describe, it, expect } from 'vitest';
import Student from '@/models/Student';
import Company from '@/models/Company';
import Drive from '@/models/Drive';
import Application from '@/models/Application';
import Offer from '@/models/Offer';
import Attendance from '@/models/Attendance';
import Feedback from '@/models/Feedback';
import User from '@/models/User';

describe('Mongoose Schema Checked Indexes Verification', () => {
  it('verifies essential compound and unique indexes on Student model', () => {
    const indexes = Student.schema.indexes();
    // Expected compound indexes:
    const hasDeptBatch = indexes.some(
      ([spec]) => spec.department === 1 && spec.passoutYear === 1
    );
    const hasBatchStatus = indexes.some(
      ([spec]) => spec.passoutYear === 1 && spec.placementStatus === 1
    );
    const hasBatchCgpa = indexes.some(
      ([spec]) => spec.passoutYear === 1 && spec.cgpa === -1
    );

    expect(hasDeptBatch).toBe(true);
    expect(hasBatchStatus).toBe(true);
    expect(hasBatchCgpa).toBe(true);
  });

  it('verifies normalizedName unique index on Company model', () => {
    const indexes = Company.schema.indexes();
    const hasNormalized = indexes.some(([spec]) => spec.normalizedName === 1);
    expect(hasNormalized).toBe(true);
  });

  it('verifies compound and batch indexes on Drive model', () => {
    const indexes = Drive.schema.indexes();
    const hasStatusArchived = indexes.some(
      ([spec]) => spec.status === 1 && spec.isArchived === 1
    );
    const hasBatches = indexes.some(
      ([spec]) => spec['eligibilityRules.allowedBatches'] === 1
    );
    expect(hasStatusArchived).toBe(true);
    expect(hasBatches).toBe(true);
  });

  it('verifies unique compound registration index on Application model', () => {
    const indexes = Application.schema.indexes();
    const hasUniqueDriveStudent = indexes.some(
      ([spec, options]) => spec.drive === 1 && spec.student === 1 && options?.unique === true
    );
    expect(hasUniqueDriveStudent).toBe(true);
  });

  it('verifies status query indexes on Offer model', () => {
    const indexes = Offer.schema.indexes();
    const hasStudentStatus = indexes.some(
      ([spec]) => spec.student === 1 && spec.status === 1
    );
    const hasSourceStatus = indexes.some(
      ([spec]) => spec.source === 1 && spec.status === 1
    );
    expect(hasStudentStatus).toBe(true);
    expect(hasSourceStatus).toBe(true);
  });

  it('verifies unique compound session attendance index', () => {
    const indexes = Attendance.schema.indexes();
    const hasUniqueAtt = indexes.some(
      ([spec, options]) => spec.sessionId === 1 && spec.studentId === 1 && options?.unique === true
    );
    expect(hasUniqueAtt).toBe(true);
  });

  it('verifies unique partial feedback index per student per session', () => {
    const indexes = Feedback.schema.indexes();
    const hasUniqueFeedback = indexes.some(
      ([spec, options]) => spec.sessionId === 1 && spec.studentId === 1 && options?.unique === true
    );
    expect(hasUniqueFeedback).toBe(true);
  });

  it('verifies unique email index on User model', () => {
    const indexes = User.schema.indexes();
    const hasEmail = indexes.some(([spec]) => spec.email === 1);
    expect(hasEmail).toBe(true);
  });
});
