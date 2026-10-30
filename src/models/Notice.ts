import mongoose, { Schema, Document } from 'mongoose';
import { DepartmentCode, DEPARTMENT_CODES } from '@/config/collegeConfig';

export interface INotice extends Document {
  title: string;
  content: string;
  targetDepartments: DepartmentCode[];
  targetBatches: number[];
  isPinned: boolean;
  publishedBy?: mongoose.Types.ObjectId;
  publisherName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const NoticeSchema: Schema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, required: true, trim: true },
    targetDepartments: {
      type: [String],
      enum: DEPARTMENT_CODES,
      default: [],
    },
    targetBatches: {
      type: [Number],
      default: [],
    },
    isPinned: { type: Boolean, default: false },
    publishedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    publisherName: { type: String, trim: true },
  },
  { timestamps: true }
);

NoticeSchema.index({ createdAt: -1 });
NoticeSchema.index({ isPinned: -1, createdAt: -1 });

export default mongoose.models.Notice || mongoose.model<INotice>('Notice', NoticeSchema);
