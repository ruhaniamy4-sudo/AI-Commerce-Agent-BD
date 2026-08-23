import mongoose, { Document, Schema } from 'mongoose';

export interface IBusiness extends Document {
    name: string;
    slug: string;
    status: 'active' | 'suspended';
    createdAt: Date;
    updatedAt: Date;
}

const BusinessSchema = new Schema<IBusiness>({
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true, unique: true },
    status: { type: String, enum: ['active', 'suspended'], default: 'active', index: true },
}, { timestamps: true });

export const Business = mongoose.model<IBusiness>('Business', BusinessSchema);
