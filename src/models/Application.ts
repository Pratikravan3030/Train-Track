import mongoose, { Schema, Document } from 'mongoose';
import { APPLICATION_STATUSES, ApplicationStatus } from '@/config/collegeConfig';

export interface IRoundResult {
  roundIndex: number;
  roundName: string;
  status: 'Passed' | 'Failed' | 'Pending' | 'Absent';
  feedback?: string;
  updatedBy: mongoose.Types.ObjectId;
  updatedAt: Date;
}

export interface IStatusHistoryEntry {
  status: ApplicationStatus;
  roundIndex: number;
  changedBy: mongoose.Types.ObjectId;
  reason?: string;
  changedAt: Date;
}

export interface IEligibilitySnapshot {
  isEligible: boolean;
  ineligibilityReasons: string[];
  cgpa: number | null;
  backlogs: number | null;
  tenthPercentage: number | null;
  twelfthOrDiplomaPercentage: number | null;
  department: string;
  passoutYear: number;
  evaluatedAt: Date;
  policyCheck: {
    passesPolicy: boolean;
    warning?: string;
    overriddenBy?: mongoose.Types.ObjectId;
    overrideReason?: string;
  };
}

export interface IApplication extends Document {
  drive: mongoose.Types.ObjectId;
  student: mongoose.Types.ObjectId;
  status: ApplicationStatus;
  currentRoundIndex: number;
  roundResults: IRoundResult[];
  statusHistory: IStatusHistoryEntry[];
  eligibilitySnapshot: IEligibilitySnapshot;
  registeredBy: mongoose.Types.ObjectId; // User who submitted registration (student or staff)
  isLateRegistration?: boolean;
  lateRegistrationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RoundResultSchema = new Schema(
  {
    roundIndex: { type: Number, required: true },
    roundName: { type: String, required: true },
    status: {
      type: String,
      enum: ['Passed', 'Failed', 'Pending', 'Absent'],
      default: 'Pending',
    },
    feedback: { type: String, trim: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const StatusHistorySchema = new Schema(
  {
    status: { type: String, enum: APPLICATION_STATUSES, required: true },
    roundIndex: { type: Number, required: true },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, trim: true },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const EligibilitySnapshotSchema = new Schema(
  {
    isEligible: { type: Boolean, required: true },
    ineligibilityReasons: { type: [String], default: [] },
    cgpa: { type: Number, default: null },
    backlogs: { type: Number, default: null },
    tenthPercentage: { type: Number, default: null },
    twelfthOrDiplomaPercentage: { type: Number, default: null },
    department: { type: String, required: true },
    passoutYear: { type: Number, required: true },
    evaluatedAt: { type: Date, default: Date.now },
    policyCheck: {
      passesPolicy: { type: Boolean, default: true },
      warning: { type: String },
      overriddenBy: { type: Schema.Types.ObjectId, ref: 'User' },
      overrideReason: { type: String },
    },
  },
  { _id: false }
);

const ApplicationSchema = new Schema(
  {
    drive: {
      type: Schema.Types.ObjectId,
      ref: 'Drive',
      required: [true, 'Drive is required'],
      index: true,
    },
    student: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student is required'],
      index: true,
    },
    status: {
      type: String,
      enum: APPLICATION_STATUSES,
      default: 'Applied',
      index: true,
    },
    currentRoundIndex: {
      type: Number,
      default: 0,
    },
    roundResults: {
      type: [RoundResultSchema],
      default: [],
    },
    statusHistory: {
      type: [StatusHistorySchema],
      default: [],
    },
    eligibilitySnapshot: {
      type: EligibilitySnapshotSchema,
      required: true,
    },
    registeredBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isLateRegistration: {
      type: Boolean,
      default: false,
    },
    lateRegistrationReason: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// One application per student per drive
ApplicationSchema.index({ drive: 1, student: 1 }, { unique: true });
ApplicationSchema.index({ drive: 1, status: 1 });

export default mongoose.models.Application ||
  mongoose.model<IApplication>('Application', ApplicationSchema);
