import mongoose, { Schema, Document } from 'mongoose';

export interface IAttendance extends Document {
  sessionId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  present: boolean;
  markedAt: Date;
}

const AttendanceSchema: Schema = new Schema({
  sessionId: { type: Schema.Types.ObjectId, ref: 'TrainingSession', required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  present: { type: Boolean, required: true },
  markedAt: { type: Date, default: Date.now },
});

// Enforce unique session + student combo
AttendanceSchema.index({ sessionId: 1, studentId: 1 }, { unique: true });

export default mongoose.models.Attendance || mongoose.model<IAttendance>('Attendance', AttendanceSchema);
