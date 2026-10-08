import mongoose, { Schema, Document } from 'mongoose';
import {
  DRIVE_TYPES,
  DriveType,
  DRIVE_MODES,
  DriveMode,
  DRIVE_STATUSES,
  DriveStatus,
  OFFER_TIER_NAMES,
  OfferTierName,
  DEPARTMENT_CODES,
  DepartmentCode,
} from '@/config/collegeConfig';

export interface IDriveEligibilityRules {
  minCgpa?: number | null;
  maxBacklogs?: number | null;
  allowedDepartments: DepartmentCode[]; // empty array = no restriction
  allowedBatches: number[];             // empty array = no restriction
  minTenthPercentage?: number | null;
  minTwelfthOrDiplomaPercentage?: number | null;
}

export interface IDrive extends Document {
  company: mongoose.Types.ObjectId;
  role: string;
  type: DriveType;
  jd: string;
  ctcLpa?: number | null;
  stipendMonthly?: number | null;
  tier?: OfferTierName | null; // Manual override or cached resolved tier
  location: string;
  mode: DriveMode;
  driveDate: Date;
  registrationDeadline: Date;
  bondNotes?: string;
  selectionRounds: string[];
  eligibilityRules: IDriveEligibilityRules;
  status: DriveStatus;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const EligibilityRulesSchema = new Schema(
  {
    minCgpa: { type: Number, min: 0, max: 10, default: null },
    maxBacklogs: { type: Number, min: 0, default: null },
    allowedDepartments: {
      type: [String],
      enum: DEPARTMENT_CODES,
      default: [],
    },
    allowedBatches: {
      type: [Number],
      default: [],
    },
    minTenthPercentage: { type: Number, min: 0, max: 100, default: null },
    minTwelfthOrDiplomaPercentage: { type: Number, min: 0, max: 100, default: null },
  },
  { _id: false }
);

const DriveSchema = new Schema(
  {
    company: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company is required'],
      index: true,
    },
    role: {
      type: String,
      required: [true, 'Job role is required'],
      trim: true,
      maxlength: 120,
    },
    type: {
      type: String,
      enum: DRIVE_TYPES,
      required: [true, 'Drive type is required'],
      index: true,
    },
    jd: {
      type: String,
      required: [true, 'Job description is required'],
    },
    ctcLpa: {
      type: Number,
      min: 0,
      default: null,
    },
    stipendMonthly: {
      type: Number,
      min: 0,
      default: null,
    },
    tier: {
      type: String,
      enum: [...OFFER_TIER_NAMES, null],
      default: null,
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true,
    },
    mode: {
      type: String,
      enum: DRIVE_MODES,
      default: 'On-Campus',
      required: true,
    },
    driveDate: {
      type: Date,
      required: [true, 'Drive date is required'],
      index: true,
    },
    registrationDeadline: {
      type: Date,
      required: [true, 'Registration deadline is required'],
      index: true,
    },
    bondNotes: {
      type: String,
      trim: true,
    },
    selectionRounds: {
      type: [String],
      default: ['Online Assessment', 'Technical Interview', 'HR Interview'],
    },
    eligibilityRules: {
      type: EligibilityRulesSchema,
      default: () => ({
        minCgpa: null,
        maxBacklogs: null,
        allowedDepartments: [],
        allowedBatches: [],
        minTenthPercentage: null,
        minTwelfthOrDiplomaPercentage: null,
      }),
    },
    status: {
      type: String,
      enum: DRIVE_STATUSES,
      default: 'Draft',
      index: true,
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

DriveSchema.index({ status: 1, isArchived: 1 });
DriveSchema.index({ 'eligibilityRules.allowedBatches': 1 });

export default mongoose.models.Drive || mongoose.model<IDrive>('Drive', DriveSchema);
