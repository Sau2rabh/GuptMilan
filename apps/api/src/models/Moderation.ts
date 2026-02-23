import mongoose, { Schema, Document } from 'mongoose';

export interface IReport extends Document {
  reporterSessionId: string;
  reportedSessionId: string;
  reason: string;
  evidence?: string;
  timestamp: Date;
}

const ReportSchema = new Schema({
  reporterSessionId: { type: String, required: true },
  reportedSessionId: { type: String, required: true },
  reason: { type: String, required: true },
  evidence: { type: String },
  timestamp: { type: Date, default: Date.now },
});

export const Report = mongoose.model<IReport>('Report', ReportSchema);

export interface IBan extends Document {
  hashedIdentifier: string; // Hashed IP or browser fingerprint
  reason: string;
  expiresAt?: Date;
  timestamp: Date;
}

const BanSchema = new Schema({
  hashedIdentifier: { type: String, required: true, index: true },
  reason: { type: String },
  expiresAt: { type: Date },
  timestamp: { type: Date, default: Date.now },
});

export const Ban = mongoose.model<IBan>('Ban', BanSchema);
