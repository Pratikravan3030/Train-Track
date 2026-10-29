import mongoose, { Schema, Document } from 'mongoose';

export type FeedbackSource = 'student' | 'staff';

export interface IFeedback extends Document {
  sessionId: mongoose.Types.ObjectId;
  studentId?: mongoose.Types.ObjectId | null;
  source: FeedbackSource;
  rating: number;
  comment: string;
  isDemoData?: boolean;
  createdAt: Date;
}

const FeedbackSchema: Schema = new Schema({
  sessionId: { type: Schema.Types.ObjectId, ref: 'TrainingSession', required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: false, default: null, index: true },
  source: {
    type: String,
    enum: ['student', 'staff'],
    default: 'student',
    required: true,
    index: true,
  },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, trim: true, default: '' },
  isDemoData: { type: Boolean, default: false, index: true },
  createdAt: { type: Date, default: Date.now },
});

// Enforce one feedback per student per training session (for non-null studentId)
FeedbackSchema.index(
  { sessionId: 1, studentId: 1 },
  {
    unique: true,
    partialFilterExpression: { studentId: { $type: 'objectId' } },
  }
);

export default mongoose.models.Feedback || mongoose.model<IFeedback>('Feedback', FeedbackSchema);
