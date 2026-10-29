import mongoose, { Schema, Document, Query } from 'mongoose';
import { 
  DepartmentCode, 
  DEPARTMENT_CODES, 
  TRAINING_CATEGORIES, 
  TrainingCategory 
} from '@/config/collegeConfig';

export { TRAINING_CATEGORIES, type TrainingCategory };

export interface ITrainingSession extends Document {
  title: string;
  date: Date;
  trainer: string;
  description: string;
  category: TrainingCategory;
  targetDepartments: DepartmentCode[];
  targetBatches: number[];
  venue?: string;
  checkInCode?: string;
  checkInCodeExpiresAt?: Date | null;
  isDeleted?: boolean;
  deletedAt?: Date | null;
  deletedBy?: mongoose.Types.ObjectId | null;
  isArchived?: boolean;
  isDemoData?: boolean;
  createdAt: Date;
}

const TrainingSessionSchema: Schema = new Schema({
  title: { type: String, required: true },
  date: { type: Date, required: true },
  trainer: { type: String },
  description: { type: String },
  category: {
    type: String,
    enum: TRAINING_CATEGORIES,
    default: 'Technical',
    index: true,
  },
  targetDepartments: {
    type: [String],
    enum: DEPARTMENT_CODES,
    default: [],
  },
  targetBatches: {
    type: [Number],
    default: [],
  },
  venue: {
    type: String,
    trim: true,
  },
  checkInCode: {
    type: String,
    trim: true,
    uppercase: true,
  },
  checkInCodeExpiresAt: {
    type: Date,
    default: null,
  },
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  isArchived: { type: Boolean, default: false, index: true },
  isDemoData: { type: Boolean, default: false, index: true },
  createdAt: { type: Date, default: Date.now },
});

// Soft delete query filter middleware
TrainingSessionSchema.pre(/^find/, function (this: Query<unknown, ITrainingSession>) {
  const filter = this.getFilter();
  if (filter.isDeleted === undefined) {
    this.where({ isDeleted: { $ne: true } });
  }
});
TrainingSessionSchema.pre('countDocuments', function (this: Query<unknown, ITrainingSession>) {
  const filter = this.getFilter();
  if (filter.isDeleted === undefined) {
    this.where({ isDeleted: { $ne: true } });
  }
});

export default mongoose.models.TrainingSession || mongoose.model<ITrainingSession>('TrainingSession', TrainingSessionSchema);
