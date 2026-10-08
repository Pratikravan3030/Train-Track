import mongoose, { Schema, Document } from 'mongoose';
import { DEPARTMENT_CODES, DepartmentCode } from '@/config/collegeConfig';

export interface IStudent extends Document {
  name: string;
  rollNumber: string;
  department: DepartmentCode; // Canonical department code (e.g., 'CSE', 'IT') - Single Source of Truth
  branch?: string;            // Legacy field (read-only fallback during migration)
  year: string;
  email?: string;
  phone?: string;
  createdAt: Date;
}

const StudentSchema: Schema = new Schema({
  name: { type: String, required: [true, 'Name is required'], trim: true },
  rollNumber: { type: String, required: [true, 'Roll number is required'], unique: true, trim: true, uppercase: true },
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
  year: { type: String, required: [true, 'Academic year is required'] },
  email: { type: String, trim: true, lowercase: true },
  phone: { type: String, trim: true },
  createdAt: { type: Date, default: Date.now },
});

// Explicitly no pre-save sync hook. Department is the single source of truth and must be explicitly set.

export default mongoose.models.Student || mongoose.model<IStudent>('Student', StudentSchema);
