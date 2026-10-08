import mongoose, { Schema, Document } from 'mongoose';

export interface IHRContact {
  name: string;
  email: string;
  phone?: string;
  designation?: string;
}

export interface ICompany extends Document {
  name: string; // Stored as typed (not uppercased)
  normalizedName: string; // Lowercased and trimmed for unique index matching
  sector: string;
  website?: string;
  hrContacts: IHRContact[];
  preSystemHistory?: string; // Free-text notes for historical visits prior to CampusPlace
  notes?: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const HRContactSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    designation: { type: String, trim: true },
  },
  { _id: true }
);

const CompanySchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
      maxlength: 150,
    },
    normalizedName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    sector: {
      type: String,
      required: [true, 'Sector is required'],
      trim: true,
      maxlength: 100,
      index: true,
    },
    website: {
      type: String,
      trim: true,
    },
    hrContacts: {
      type: [HRContactSchema],
      default: [],
    },
    preSystemHistory: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-validate hook to sync normalizedName
CompanySchema.pre('validate', function () {
  if (this.name) {
    this.normalizedName = this.name.trim().toLowerCase();
  }
});

export default mongoose.models.Company || mongoose.model<ICompany>('Company', CompanySchema);
