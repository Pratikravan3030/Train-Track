import mongoose, { Document, Model, Schema } from 'mongoose';
import { COLLEGE_ROLES, UserRole } from '@/config/collegeConfig';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  password: string; // bcrypt hash
  role: UserRole;
  department?: string; // Standard department code for DEPT_COORDINATOR or STUDENT
  studentId?: mongoose.Types.ObjectId; // Reference to Student record if role is STUDENT
  phone?: string;
  isActive: boolean;
  mustChangePassword?: boolean; // Forced password change on first login or after reset
  temporaryPasswordHash?: string; // Track temporary password hash to prevent reuse
  tokenVersion?: number; // Incremented on password change, reset, or deactivation to invalidate active sessions
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: [true, 'Password hash is required'],
    },
    role: {
      type: String,
      enum: COLLEGE_ROLES,
      default: 'STUDENT',
      required: true,
      index: true,
    },
    department: {
      type: String,
      trim: true,
      uppercase: true,
      default: undefined,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      default: undefined,
    },
    phone: {
      type: String,
      trim: true,
      default: undefined,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    mustChangePassword: {
      type: Boolean,
      default: false,
      index: true,
    },
    temporaryPasswordHash: {
      type: String,
      default: undefined,
    },
    tokenVersion: {
      type: Number,
      default: 1,
    },
    lastLoginAt: {
      type: Date,
      default: undefined,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent re-compilation in Next.js hot reload
const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;
