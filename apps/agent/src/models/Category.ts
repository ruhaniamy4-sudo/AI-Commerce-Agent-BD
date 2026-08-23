import mongoose, { Schema, Document } from 'mongoose';
import { tenantPlugin } from '../tenancy/plugin';

export interface ICategory extends Document {
    businessId: mongoose.Types.ObjectId;
    name: string;
    slug: string;
    description?: string;
    parentId?: mongoose.Types.ObjectId; // For hierarchical categories
    image?: string;
    isActive: boolean;
    order: number; // Display order
    createdAt: Date;
    updatedAt: Date;
}

const CategorySchema = new Schema(
    {
        name: { type: String, required: true, trim: true },
        slug: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
        },
        description: { type: String },
        parentId: {
            type: Schema.Types.ObjectId,
            ref: 'Category',
            default: null,
            index: true,
        },
        image: { type: String },
        isActive: { type: Boolean, default: true, index: true },
        order: { type: Number, default: 0 }, // For sorting
    },
    { timestamps: true }
);

CategorySchema.plugin(tenantPlugin);

// Indexes
CategorySchema.index({ businessId: 1, slug: 1 }, { unique: true });
CategorySchema.index({ businessId: 1, parentId: 1, isActive: 1 });
CategorySchema.index({ businessId: 1, order: 1 });

// Pre-save middleware to generate slug
CategorySchema.pre('save', async function (this: ICategory) {
    if (this.isModified('name') && !this.slug) {
        this.slug = this.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
    }
});

export const Category = mongoose.model<ICategory>('Category', CategorySchema);
