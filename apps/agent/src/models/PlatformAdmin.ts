import mongoose, { Document, Schema } from 'mongoose';

export interface IPlatformAdmin extends Document {
    name: string;
    email: string;
    passwordHash: string;
    status: 'active' | 'disabled';
    lastLoginAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const PlatformAdminSchema = new Schema<IPlatformAdmin>({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, unique: true },
    passwordHash: { type: String, required: true, select: false },
    status: { type: String, enum: ['active', 'disabled'], default: 'active', index: true },
    lastLoginAt: Date,
}, { timestamps: true });

export const PlatformAdmin = mongoose.model<IPlatformAdmin>('PlatformAdmin', PlatformAdminSchema);
