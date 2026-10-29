import mongoose, { Schema, Document } from 'mongoose';

export const ATTENDANCE_STATUSES = ['Present', 'Absent', 'Late', 'Excused'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export interface IAttendance extends Document {
  sessionId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  present: boolean;
  status: AttendanceStatus;
  markedAt: Date;
  markedBy?: mongoose.Types.ObjectId | null;
  remarks?: string;
  isDemoData?: boolean;
}

const AttendanceSchema: Schema = new Schema({
  sessionId: { type: Schema.Types.ObjectId, ref: 'TrainingSession', required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  present: { type: Boolean, required: true },
  status: {
    type: String,
    enum: ATTENDANCE_STATUSES,
    index: true,
  },
  markedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  remarks: {
    type: String,
    trim: true,
  },
  markedAt: { type: Date, default: Date.now },
  isDemoData: { type: Boolean, default: false, index: true },
});

// Pre-validate hook to sync `status` and `present`
AttendanceSchema.pre('validate', function () {
  if (this.status) {
    this.present = this.status === 'Present' || this.status === 'Late';
  } else if (this.present !== undefined) {
    this.status = this.present ? 'Present' : 'Absent';
  } else {
    this.status = 'Present';
    this.present = true;
  }
});

// Enforce unique session + student combo
AttendanceSchema.index({ sessionId: 1, studentId: 1 }, { unique: true });

export default mongoose.models.Attendance || mongoose.model<IAttendance>('Attendance', AttendanceSchema);
