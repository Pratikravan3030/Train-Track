import mongoose, { Schema, Document } from 'mongoose';

export interface IStudent extends Document {
  name: string;
  rollNumber: string;
  branch: string;
  year: string;
  email: string;
  createdAt: Date;
}

const StudentSchema: Schema = new Schema({
  name: { type: String, required: true },
  rollNumber: { type: String, required: true, unique: true },
  branch: { type: String },
  year: { type: String },
  email: { type: String },
  createdAt: { type: Date, default: Date.now },
});

// Use existing model if already compiled, otherwise compile a new one
export default mongoose.models.Student || mongoose.model<IStudent>('Student', StudentSchema);
