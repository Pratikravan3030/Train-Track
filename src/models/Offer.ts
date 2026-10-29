import mongoose, { Schema, Document } from 'mongoose';
import {
  OFFER_TYPES,
  OfferType,
  OFFER_SOURCES,
  OfferSource,
  OFFER_STATUSES,
  OfferStatus,
  OFFER_TIER_NAMES,
  OfferTierName,
} from '@/config/collegeConfig';

export interface IPlacementStatusSync {
  status: 'None' | 'Proposed' | 'Confirmed' | 'Reverted';
  proposedAt?: Date;
  confirmedAt?: Date;
  confirmedBy?: mongoose.Types.ObjectId;
  revertedAt?: Date;
  revertedBy?: mongoose.Types.ObjectId;
  revertReason?: string;
}

export interface IPolicyOverride {
  hasOverride: boolean;
  reason?: string;
  overriddenBy?: mongoose.Types.ObjectId;
  overriddenAt?: Date;
}

export interface IOffer extends Document {
  application?: mongoose.Types.ObjectId; // Optional for Off-Campus / Manual
  drive?: mongoose.Types.ObjectId;       // Optional for Off-Campus / Manual
  student: mongoose.Types.ObjectId;
  source: OfferSource;
  companyName: string;
  role: string;
  type: OfferType;
  ctcLpa?: number | null;
  stipendMonthly?: number | null;
  tier?: OfferTierName | null;
  offerLetterUrl?: string;
  offerLetterStorageKey?: string;
  offerLetterFilename?: string;
  status: OfferStatus;
  offerDate: Date;
  decidedAt?: Date;
  decisionReason?: string;
  placementStatusSync: IPlacementStatusSync;
  policyOverride?: IPolicyOverride;
  isDemoData?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const OfferSchema = new Schema(
  {
    application: {
      type: Schema.Types.ObjectId,
      ref: 'Application',
      default: undefined,
      index: true,
    },
    drive: {
      type: Schema.Types.ObjectId,
      ref: 'Drive',
      default: undefined,
      index: true,
    },
    student: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student is required'],
      index: true,
    },
    source: {
      type: String,
      enum: OFFER_SOURCES,
      required: [true, 'Offer source is required'],
      index: true,
    },
    companyName: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
    },
    role: {
      type: String,
      required: [true, 'Role is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: OFFER_TYPES,
      required: [true, 'Offer type is required'],
      index: true,
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
    offerLetterUrl: {
      type: String,
      trim: true,
    },
    offerLetterStorageKey: {
      type: String,
      trim: true,
    },
    offerLetterFilename: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: OFFER_STATUSES,
      default: 'Pending',
      index: true,
    },
    offerDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    decidedAt: {
      type: Date,
    },
    decisionReason: {
      type: String,
      trim: true,
    },
    placementStatusSync: {
      status: {
        type: String,
        enum: ['None', 'Proposed', 'Confirmed', 'Reverted'],
        default: 'None',
      },
      proposedAt: { type: Date },
      confirmedAt: { type: Date },
      confirmedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      revertedAt: { type: Date },
      revertedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      revertReason: { type: String, trim: true },
    },
    policyOverride: {
      hasOverride: { type: Boolean, default: false },
      reason: { type: String, trim: true },
      overriddenBy: { type: Schema.Types.ObjectId, ref: 'User' },
      overriddenAt: { type: Date },
    },
    isDemoData: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

OfferSchema.index({ student: 1, status: 1 });
OfferSchema.index({ source: 1, status: 1 });

export default mongoose.models.Offer || mongoose.model<IOffer>('Offer', OfferSchema);
