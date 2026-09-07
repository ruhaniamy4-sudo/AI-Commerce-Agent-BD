import mongoose, { Document, Schema } from 'mongoose';

export interface IPlatformSetting extends Document {
  key: string;
  value: unknown;
  category: 'platform'|'billing'|'subscription'|'feature'|'integration';
  description?: string;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
const PlatformSettingSchema = new Schema<IPlatformSetting>({
  key: { type: String, required: true, unique: true, trim: true, maxlength: 120 },
  value: { type: Schema.Types.Mixed, required: true },
  category: { type: String, enum: ['platform','billing','subscription','feature','integration'], required: true, index: true },
  description: { type: String, maxlength: 300 },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'PlatformAdmin' },
}, { timestamps: true });
export const PlatformSetting = mongoose.model<IPlatformSetting>('PlatformSetting', PlatformSettingSchema);
