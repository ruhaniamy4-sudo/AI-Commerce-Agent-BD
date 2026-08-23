import mongoose, { Schema, Document } from 'mongoose';
import { tenantPlugin } from '../tenancy/plugin';

export interface IProductVariant {
    variantId: string;
    name: string; // e.g., "Black 16GB", "Blue 32GB"
    sku: string;
    price: number;
    stock: number;
    images: string[];
    specs?: Record<string, any>; // Variant-specific specs
    isActive: boolean;
}

export interface IProduct extends Document {
    businessId: mongoose.Types.ObjectId;
    name: string;
    slug: string;
    description: string;
    categoryId: mongoose.Types.ObjectId;

    // Default price and stock (for single-variant products)
    basePrice: number;
    stock: number;

    // Variants (for multi-variant products like different colors/sizes)
    variants: IProductVariant[];

    // Specs and compatibility
    specs: Record<string, any>; // e.g., { "RAM Type": "DDR4", "Speed": "3200MHz" }
    compatibilityTags: string[]; // e.g., ["DDR4", "Desktop", "Laptop"]

    // Media
    images: string[];

    // Warranty and policies
    warrantyMonths: number;
    isReturnable: boolean;
    returnDays?: number;

    // SEO and visibility
    metaTitle?: string;
    metaDescription?: string;
    isActive: boolean;
    isFeatured: boolean;

    // Inventory alerts
    lowStockThreshold: number;

    // RAG - Image Embeddings for Visual Search
    imageEmbedding?: number[]; // Vector embedding of primary product image
    imageEmbeddingModel?: string; // Model used (e.g., 'clip-vit-large-patch14')
    lastEmbeddingUpdate?: Date; // Track when embedding was last generated

    // Multiple embeddings for all product images
    imageEmbeddings?: {
        url: string;
        embedding: number[];
        model: string;
        updatedAt: Date;
    }[];

    // Timestamps
    createdAt: Date;
    updatedAt: Date;
}

const ProductVariantSchema = new Schema({
    variantId: { type: String, required: true },
    name: { type: String, required: true },
    sku: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    images: [{ type: String }],
    specs: { type: Schema.Types.Mixed },
    isActive: { type: Boolean, default: true },
});

const ProductSchema = new Schema(
    {
        name: { type: String, required: true, trim: true },
        slug: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
        },
        description: { type: String, required: true },
        categoryId: {
            type: Schema.Types.ObjectId,
            ref: 'Category',
            required: true,
            index: true,
        },

        basePrice: { type: Number, required: true, min: 0 },
        stock: { type: Number, required: true, min: 0, default: 0 },

        variants: [ProductVariantSchema],

        specs: { type: Schema.Types.Mixed, default: {} },
        compatibilityTags: [{ type: String }],

        images: [{ type: String }],

        warrantyMonths: { type: Number, default: 0, min: 0 },
        isReturnable: { type: Boolean, default: true },
        returnDays: { type: Number, default: 7 },

        metaTitle: { type: String },
        metaDescription: { type: String },
        isActive: { type: Boolean, default: true, index: true },
        isFeatured: { type: Boolean, default: false, index: true },

        lowStockThreshold: { type: Number, default: 10 },

        // RAG - Image Embeddings for Visual Search
        imageEmbedding: [{ type: Number }], // Array of floats for vector embedding
        imageEmbeddingModel: { type: String }, // Track which model generated the embedding
        lastEmbeddingUpdate: { type: Date }, // When embedding was last updated

        // Multiple embeddings for all product images
        imageEmbeddings: [
            {
                url: { type: String, required: true },
                embedding: [{ type: Number, required: true }],
                model: { type: String, required: true },
                updatedAt: { type: Date, default: Date.now },
            },
        ],
    },
    { timestamps: true }
);

ProductSchema.plugin(tenantPlugin);

// Indexes for common queries
ProductSchema.index({ businessId: 1, slug: 1 }, { unique: true });
ProductSchema.index(
    { businessId: 1, 'variants.sku': 1 },
    { unique: true, partialFilterExpression: { 'variants.sku': { $exists: true } } }
);
ProductSchema.index({ businessId: 1, name: 'text', description: 'text' });
ProductSchema.index({ businessId: 1, categoryId: 1, isActive: 1 });
ProductSchema.index({ businessId: 1, compatibilityTags: 1 });
ProductSchema.index({ businessId: 1, basePrice: 1 });
ProductSchema.index({ businessId: 1, isFeatured: 1, isActive: 1 });

// Virtual for low stock check
ProductSchema.virtual('isLowStock').get(function (this: IProduct) {
    return this.stock <= this.lowStockThreshold;
});

// Pre-save middleware to generate slug
ProductSchema.pre('save', async function (this: IProduct) {
    if (this.isModified('name') && !this.slug) {
        this.slug = this.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
    }
});

export const Product = mongoose.model<IProduct>('Product', ProductSchema);
