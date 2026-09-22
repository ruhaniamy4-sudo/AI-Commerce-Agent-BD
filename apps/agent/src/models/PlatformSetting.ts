import mongoose, { Document, Schema } from 'mongoose';

/** Declared here rather than in the settings service so the schema never waits on a circular import. */
export const SETTING_CATEGORIES = ['platform', 'billing', 'subscription', 'feature', 'integration', 'localization', 'security', 'ai', 'notification', 'compliance', 'support'] as const;
export type SettingCategory = typeof SETTING_CATEGORIES[number];

export interface IPlatformSetting extends Document {
  key: string;
  value: unknown;
  category: SettingCategory;
  description?: string;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
const PlatformSettingSchema = new Schema<IPlatformSetting>({
  key: { type: String, required: true, unique: true, trim: true, maxlength: 120 },
  value: { type: Schema.Types.Mixed, required: true },
  category: { type: String, enum: [...SETTING_CATEGORIES], required: true, index: true },
  description: { type: String, maxlength: 300 },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'PlatformAdmin' },
}, { timestamps: true });
export const PlatformSetting = mongoose.model<IPlatformSetting>('PlatformSetting', PlatformSettingSchema);
