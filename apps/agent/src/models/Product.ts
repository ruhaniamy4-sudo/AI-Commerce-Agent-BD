import mongoose, { Schema, Document } from 'mongoose';
import { tenantPlugin } from '../tenancy/plugin';
import { buildProductSearchProfile, SearchProfile } from '../services/knowledge-intelligence.service';

export interface IProductVariant {
    variantId: string;
    name: string; // e.g., "Black 16GB", "Blue 32GB"
    sku: string;
    price: number;
    currency: string;
    stock?: number | null;
    availability?: 'in_stock' | 'out_of_stock' | 'preorder' | 'unknown';
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
    currency: string;
    stock?: number | null;

    // Variants (for multi-variant products like different colors/sizes)
    variants: IProductVariant[];

    // Specs and compatibility
    specs: Record<string, any>; // e.g., { "RAM Type": "DDR4", "Speed": "3200MHz" }
    compatibilityTags: string[]; // e.g., ["DDR4", "Desktop", "Laptop"]

    // Media
    images: string[];
    imageImports?: Array<{ sourceUrl: string; managedUrl?: string; status: 'managed' | 'mirrored' | 'external_fallback'; errorCode?: string }>;

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
    salePrice?: number;
    barcode?: string;
    brand?: string;
    canonicalUrl?: string;
    provenance?: Array<{ sourceType: string; sourceUrl?: string; sourceExternalId?: string; fingerprint: string; lastSeenAt: Date; lastSyncedAt: Date }>;
    merchantConfirmed: boolean;
    availability?: 'in_stock' | 'out_of_stock' | 'preorder' | 'unknown';
    intelligence?: SearchProfile;

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
    currency: { type: String, required: true, trim: true, uppercase: true, default: 'BDT' },
    stock: { type: Number, min: 0, default: null },
    availability: { type: String, enum: ['in_stock', 'out_of_stock', 'preorder', 'unknown'], default: 'unknown' },
    images: [{ type: String }],
    specs: { type: Schema.Types.Mixed },
    isActive: { type: Boolean, default: true },
});

const ProductIntelligenceSchema = new Schema({
    profileVersion: { type: Number, default: 1 },
    searchableText: String,
    terms: [{ type: String }],
    colors: [{ type: String }],
    sizes: [{ type: String }],
    materials: [{ type: String }],
    categories: [{ type: String }],
    useCases: [{ type: String }],
    facts: [{ subject: String, predicate: String, value: Schema.Types.Mixed, unit: String, confidence: { type: String, enum: ['confirmed', 'supported'] } }],
    riskLevel: { type: String, enum: ['normal', 'high'], default: 'normal' },
    sourceHash: String,
}, { _id: false });

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
        currency: { type: String, required: true, trim: true, uppercase: true, default: 'BDT' },
        stock: { type: Number, min: 0, default: null },

        variants: [ProductVariantSchema],

        specs: { type: Schema.Types.Mixed, default: {} },
        compatibilityTags: [{ type: String }],

        images: [{ type: String }],
        imageImports: [{
            sourceUrl: { type: String, required: true }, managedUrl: String,
            status: { type: String, enum: ['managed', 'mirrored', 'external_fallback'], required: true }, errorCode: String,
        }],

        warrantyMonths: { type: Number, default: 0, min: 0 },
        isReturnable: { type: Boolean, default: true },
        returnDays: { type: Number, default: 7 },

        metaTitle: { type: String },
        metaDescription: { type: String },
        isActive: { type: Boolean, default: true, index: true },
        isFeatured: { type: Boolean, default: false, index: true },

        lowStockThreshold: { type: Number, default: 10 },
        salePrice: { type: Number, min: 0 },
        barcode: { type: String, trim: true },
        brand: { type: String, trim: true },
        canonicalUrl: { type: String, trim: true },
        provenance: [{
            sourceType: { type: String, required: true }, sourceUrl: String, sourceExternalId: String,
            fingerprint: { type: String, required: true }, lastSeenAt: { type: Date, default: Date.now }, lastSyncedAt: { type: Date, default: Date.now },
        }],
        merchantConfirmed: { type: Boolean, default: true },
        availability: { type: String, enum: ['in_stock', 'out_of_stock', 'preorder', 'unknown'], default: 'unknown' },
        intelligence: { type: ProductIntelligenceSchema, select: false },

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
ProductSchema.index(
    { businessId: 1, name: 'text', description: 'text' },
    {
        name: 'businessId_1_name_text_description_text',
        default_language: 'none',
        language_override: '_mongoTextLanguage',
    }
);
ProductSchema.index({ businessId: 1, categoryId: 1, isActive: 1 });
ProductSchema.index({ businessId: 1, compatibilityTags: 1 });
ProductSchema.index({ businessId: 1, basePrice: 1 });
ProductSchema.index({ businessId: 1, canonicalUrl: 1 }, { sparse: true });
ProductSchema.index({ businessId: 1, barcode: 1 }, { sparse: true });
ProductSchema.index({ businessId: 1, isFeatured: 1, isActive: 1 });
ProductSchema.index({ businessId: 1, 'intelligence.terms': 1, isActive: 1 });
// MongoDB does not allow a compound multikey index across two array fields.
ProductSchema.index({ businessId: 1, 'intelligence.colors': 1, isActive: 1 });
ProductSchema.index({ businessId: 1, 'intelligence.sizes': 1, isActive: 1 });

// Virtual for low stock check
ProductSchema.virtual('isLowStock').get(function (this: IProduct) {
    return typeof this.stock === 'number' && this.stock <= this.lowStockThreshold;
});

ProductSchema.pre('validate', function (this: IProduct) {
    if (this.isNew || ['name', 'description', 'brand', 'specs', 'compatibilityTags', 'variants'].some((path) => this.isModified(path))) {
        this.intelligence = buildProductSearchProfile(this.toObject({ depopulate: true }));
    }
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
