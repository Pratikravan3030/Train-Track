import mongoose, { Schema, Document } from 'mongoose';

export interface IFeedback extends Document {
  sessionId: mongoose.Types.ObjectId;
  studentId?: mongoose.Types.ObjectId | null;
  rating: number;
  comment: string;
  createdAt: Date;
}

const FeedbackSchema: Schema = new Schema({
  sessionId: { type: Schema.Types.ObjectId, ref: 'TrainingSession', required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: false, default: null },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.Feedback || mongoose.model<IFeedback>('Feedback', FeedbackSchema);
