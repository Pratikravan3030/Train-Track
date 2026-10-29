import mongoose, { Schema, Document } from 'mongoose';

export interface IAssessmentScore {
  studentId: mongoose.Types.ObjectId;
  rollNumber: string;
  studentName?: string;
  department?: string;
  score: number;
  percentage: number;
  passed: boolean;
  remarks?: string;
}

export interface IAssessment extends Document {
  sessionId: mongoose.Types.ObjectId;
  title: string;
  maxScore: number;
  passingScore: number;
  date?: Date;
  results: IAssessmentScore[];
  createdBy?: mongoose.Types.ObjectId;
  isDemoData?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AssessmentScoreSchema = new Schema(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    rollNumber: { type: String, required: true, uppercase: true, trim: true },
    studentName: { type: String, trim: true },
    department: { type: String, trim: true },
    score: { type: Number, required: true, min: 0 },
    percentage: { type: Number, required: true, min: 0, max: 100 },
    passed: { type: Boolean, required: true },
    remarks: { type: String, trim: true },
  },
  { _id: true }
);

const AssessmentSchema = new Schema(
  {
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: 'TrainingSession',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    maxScore: { type: Number, required: true, min: 1 },
    passingScore: { type: Number, required: true, min: 0 },
    date: { type: Date, default: Date.now },
    results: { type: [AssessmentScoreSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    isDemoData: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

export default mongoose.models.Assessment || mongoose.model<IAssessment>('Assessment', AssessmentSchema);
