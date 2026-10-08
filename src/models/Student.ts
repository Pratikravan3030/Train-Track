import mongoose, { Schema, Document } from 'mongoose';
import {
  DEPARTMENT_CODES,
  DepartmentCode,
  PLACEMENT_STATUSES,
  PlacementStatus,
} from '@/config/collegeConfig';

export interface IPlacementDetails {
  companyName?: string;
  packageLPA?: number;
  placedDate?: Date;
  reasonForStatusChange?: string;
}

export interface IStudent extends Document {
  name: string;
  rollNumber: string;
  department: DepartmentCode; // Canonical department code (e.g., 'CSE', 'IT') - Single Source of Truth
  branch?: string;            // Legacy field (read-only fallback during migration)
  year: string;
  passoutYear: number;        // Graduating batch (e.g., 2026) - Essential for batch isolation
  placementStatus: PlacementStatus;
  placementDetails?: IPlacementDetails;
  cgpa?: number;
  backlogs?: number;
  resumeUrl?: string;
  resumeFilename?: string;
  email?: string;
  phone?: string;
  createdAt: Date;
}

const StudentSchema: Schema = new Schema({
  name: { type: String, required: [true, 'Name is required'], trim: true },
  rollNumber: {
    type: String,
    required: [true, 'Roll number / PRN is required'],
    unique: true,
    trim: true,
    uppercase: true,
  },
  department: {
    type: String,
    required: [true, 'Department code is required'],
    enum: {
      values: DEPARTMENT_CODES,
      message: '`{VALUE}` is not a valid department code',
    },
    index: true,
    uppercase: true,
    trim: true,
  },
  branch: { type: String, index: true, trim: true }, // Legacy field, kept only for reading pre-migration data
  year: { type: String, required: [true, 'Academic year is required'], trim: true },
  passoutYear: {
    type: Number,
    required: [true, 'Passout year (batch) is required'],
    index: true,
  },
  placementStatus: {
    type: String,
    enum: {
      values: PLACEMENT_STATUSES,
      message: '`{VALUE}` is not a valid placement status',
    },
    default: 'Not Placed',
    index: true,
  },
  placementDetails: {
    companyName: { type: String, trim: true },
    packageLPA: { type: Number, min: 0 },
    placedDate: { type: Date },
    reasonForStatusChange: { type: String, trim: true },
  },
  cgpa: { type: Number, min: 0, max: 10 },
  backlogs: { type: Number, min: 0, default: 0 },
  resumeUrl: { type: String, trim: true },
  resumeFilename: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true },
  phone: { type: String, trim: true },
  createdAt: { type: Date, default: Date.now },
});

// Compound indexes for high-throughput batch and department queries
StudentSchema.index({ department: 1, passoutYear: 1 });
StudentSchema.index({ passoutYear: 1, placementStatus: 1 });
StudentSchema.index({ passoutYear: 1, cgpa: -1 });

export default mongoose.models.Student || mongoose.model<IStudent>('Student', StudentSchema);
