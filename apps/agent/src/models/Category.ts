import mongoose, { Schema, Document } from 'mongoose';

export interface ICategory extends Document {
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
            unique: true,
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

// Indexes
CategorySchema.index({ parentId: 1, isActive: 1 });
CategorySchema.index({ order: 1 });

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
