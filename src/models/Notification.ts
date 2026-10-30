import mongoose, { Schema, Document } from 'mongoose';

export type NotificationType = 'drive' | 'session' | 'offer' | 'system';

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  studentId?: mongoose.Types.ObjectId;
  title: string;
  message: string;
  link?: string;
  type: NotificationType;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', index: true },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    message: { type: String, required: true, trim: true },
    link: { type: String, trim: true },
    type: {
      type: String,
      enum: ['drive', 'session', 'offer', 'system'],
      default: 'system',
    },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

export default mongoose.models.Notification ||
  mongoose.model<INotification>('Notification', NotificationSchema);
