import mongoose, { Document, Model, Schema } from 'mongoose';

export interface ILoginAttempt extends Document {
  _id: mongoose.Types.ObjectId;
  key: string; // Identifier: email, ip_email, or ip_spray
  attempts: number;
  distinctEmails?: string[]; // Track unique targeted emails for spray detection
  lockedUntil?: Date;
  lastAttempt: Date;
  createdAt: Date;
}

const LoginAttemptSchema = new Schema<ILoginAttempt>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    distinctEmails: {
      type: [String],
      default: undefined,
    },
    lockedUntil: {
      type: Date,
      default: undefined,
    },
    lastAttempt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Expire login attempt documents automatically after 2 hours
LoginAttemptSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7200 });

const LoginAttempt: Model<ILoginAttempt> =
  mongoose.models.LoginAttempt || mongoose.model<ILoginAttempt>('LoginAttempt', LoginAttemptSchema);

export default LoginAttempt;
