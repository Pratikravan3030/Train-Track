import mongoose, { Schema, Document } from 'mongoose';

export interface ITrainingSession extends Document {
  title: string;
  date: Date;
  trainer: string;
  description: string;
  createdAt: Date;
}

const TrainingSessionSchema: Schema = new Schema({
  title: { type: String, required: true },
  date: { type: Date, required: true },
  trainer: { type: String },
  description: { type: String },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.TrainingSession || mongoose.model<ITrainingSession>('TrainingSession', TrainingSessionSchema);
