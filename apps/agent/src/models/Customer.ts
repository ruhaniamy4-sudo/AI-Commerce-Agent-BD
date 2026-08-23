import mongoose, { Schema, Document } from 'mongoose';

export interface ICustomer extends Document {
    psid: string; // Page Scoped ID from Facebook
    name?: string;
    phone?: string;
    email?: string;

    // Language preference
    language: 'en' | 'bn' | 'hi';

    // Saved addresses
    addresses: Array<{
        label: string; // "Home", "Office", etc.
        fullName: string;
        phone: string;
        addressLine1: string;
        addressLine2?: string;
        city: string;
        zone: string;
        postalCode?: string;
        country: string;
        isDefault: boolean;
    }>;

    // CRM data
    tags: string[]; // e.g., ["VIP", "frequent-buyer", "interested-in-laptops"]
    notes: string;

    // Activity tracking
    lastMessageAt?: Date;
    totalOrders: number;
    totalSpent: number;

    // Preferences
    optedOut: boolean; // Don't save my info
    metadata?: Record<string, any>;

    createdAt: Date;
    updatedAt: Date;
}

const AddressSubSchema = new Schema({
    label: { type: String, required: true },
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    addressLine1: { type: String, required: true },
    addressLine2: { type: String },
    city: { type: String, required: true },
    zone: { type: String, required: true },
    postalCode: { type: String },
    country: { type: String, default: 'Bangladesh' },
    isDefault: { type: Boolean, default: false },
});

const CustomerSchema = new Schema(
    {
        psid: { type: String, required: true, unique: true },
        name: { type: String, trim: true },
        phone: { type: String, trim: true },
        email: {
            type: String,
            lowercase: true,
            trim: true,
            validate: {
                validator: function (v: string) {
                    return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
                },
                message: 'Invalid email format',
            },
        },

        language: {
            type: String,
            enum: ['en', 'bn', 'hi'],
            default: 'en',
        },

        addresses: [AddressSubSchema],

        tags: [{ type: String }],
        notes: { type: String },

        lastMessageAt: { type: Date, index: true },
        totalOrders: { type: Number, default: 0, min: 0 },
        totalSpent: { type: Number, default: 0, min: 0 },

        optedOut: { type: Boolean, default: false },
        metadata: { type: Schema.Types.Mixed, default: {} },
    },
    { timestamps: true }
);

// Indexes
CustomerSchema.index({ phone: 1 }, { sparse: true });
CustomerSchema.index({ email: 1 }, { sparse: true });
CustomerSchema.index({ lastMessageAt: -1 });
CustomerSchema.index({ totalSpent: -1 });

export const Customer = mongoose.model<ICustomer>('Customer', CustomerSchema);
