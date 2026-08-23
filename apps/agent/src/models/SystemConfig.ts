import mongoose, { Schema } from 'mongoose';

const SystemConfigSchema = new Schema(
    {
        key: { type: String, required: true, unique: true },
        value: { type: Schema.Types.Mixed, required: true },
    },
    { timestamps: true }
);

export const SystemConfig = mongoose.model('SystemConfig', SystemConfigSchema);
