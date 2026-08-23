import mongoose, { Schema, Document } from 'mongoose';
import { tenantPlugin } from '../tenancy/plugin';

export interface IOrderItem {
    productId: mongoose.Types.ObjectId;
    variantId?: string; // If product has variants
    productName: string; // Snapshot
    variantName?: string; // Snapshot
    sku: string; // Snapshot
    quantity: number;
    unitPriceSnapshot: number; // MANDATORY: Price at order time
    subtotal: number;
}

export interface IAddress {
    fullName: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    zone: string; // e.g., "Dhaka North", "Chittagong"
    postalCode?: string;
    country: string;
}

export type OrderStatus =
    | 'pending'
    | 'confirmed'
    | 'packed'
    | 'shipped'
    | 'delivered'
    | 'completed'
    | 'cancelled'
    | 'returned'
    | 'refunded';

export interface IOrder extends Document {
    businessId: mongoose.Types.ObjectId;
    orderNumber: string; // Unique order ID for customer reference
    idempotencyKey?: string;
    invoiceNumber?: string; // Unique invoice ID for accounting
    customerId: mongoose.Types.ObjectId;
    psid?: string; // Facebook PSID if ordered via Messenger

    // Order items with price snapshots
    items: IOrderItem[];

    // Pricing
    subtotal: number;
    deliveryFee: number;
    discount: number;
    total: number;

    // Delivery information (snapshot at order time)
    shippingAddress: IAddress;
    shippingMethod: 'standard' | 'express' | 'overnight'; // Delivery speed

    // Payment
    paymentMethod: string; // e.g., "Cash on Delivery", "bKash", "Card"
    paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';

    // Order status
    status: OrderStatus;
    statusHistory: Array<{
        status: OrderStatus;
        timestamp: Date;
        note?: string;
    }>;

    // Delivery tracking
    estimatedDeliveryDate?: Date;
    actualDeliveryDate?: Date;
    trackingNumber?: string;
    courier?: string;

    // Customer notes
    customerNote?: string;
    adminNote?: string;

    // Source tracking
    source: 'messenger' | 'web' | 'admin'; // Where order was placed
    createdBy?: string; // Admin user ID if manually created

    createdAt: Date;
    updatedAt: Date;
}

const OrderItemSchema = new Schema({
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: String },
    productName: { type: String, required: true },
    variantName: { type: String },
    sku: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPriceSnapshot: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
});

const AddressSchema = new Schema({
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    addressLine1: { type: String, required: true },
    addressLine2: { type: String },
    city: { type: String, required: true },
    zone: { type: String, required: true },
    postalCode: { type: String },
    country: { type: String, default: 'Bangladesh' },
});

const OrderSchema = new Schema(
    {
        orderNumber: { type: String, required: true },
        idempotencyKey: { type: String },
        invoiceNumber: { type: String },
        customerId: {
            type: Schema.Types.ObjectId,
            ref: 'Customer',
            required: true,
            index: true,
        },
        psid: { type: String, index: true },

        items: [OrderItemSchema],

        subtotal: { type: Number, required: true, min: 0 },
        deliveryFee: { type: Number, required: true, min: 0, default: 0 },
        discount: { type: Number, default: 0, min: 0 },
        total: { type: Number, required: true, min: 0 },

        shippingAddress: { type: AddressSchema, required: true },
        shippingMethod: {
            type: String,
            enum: ['standard', 'express', 'overnight'],
            default: 'standard',
        },

        paymentMethod: { type: String, required: true },
        paymentStatus: {
            type: String,
            enum: ['pending', 'paid', 'failed', 'refunded'],
            default: 'pending',
            index: true,
        },

        status: {
            type: String,
            enum: [
                'pending',
                'confirmed',
                'packed',
                'shipped',
                'delivered',
                'completed',
                'cancelled',
                'returned',
                'refunded',
            ],
            default: 'pending',
            index: true,
        },
        statusHistory: [
            {
                status: { type: String, required: true },
                timestamp: { type: Date, default: Date.now },
                note: { type: String },
            },
        ],

        estimatedDeliveryDate: { type: Date },
        actualDeliveryDate: { type: Date },
        trackingNumber: { type: String },
        courier: { type: String },

        customerNote: { type: String },
        adminNote: { type: String },

        source: {
            type: String,
            enum: ['messenger', 'web', 'admin'],
            default: 'messenger',
        },
        createdBy: { type: String }, // Admin user ID if manually created
    },
    { timestamps: true }
);

OrderSchema.plugin(tenantPlugin);

// Indexes for common queries
OrderSchema.index({ businessId: 1, orderNumber: 1 }, { unique: true });
OrderSchema.index(
    { businessId: 1, idempotencyKey: 1 },
    { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);
OrderSchema.index(
    { businessId: 1, invoiceNumber: 1 },
    { unique: true, partialFilterExpression: { invoiceNumber: { $type: 'string' } } }
);
OrderSchema.index({ businessId: 1, customerId: 1, createdAt: -1 });
OrderSchema.index({ businessId: 1, status: 1, createdAt: -1 });

// Generate required identifiers before validation runs.
OrderSchema.pre('validate', function (this: IOrder) {
    if (this.isNew) {
        if (!this.orderNumber) {
            const timestamp = Date.now().toString(36).toUpperCase();
            const random = Math.random().toString(36).substring(2, 6).toUpperCase();
            this.orderNumber = `ORD-${timestamp}-${random}`;
        }
    }
});

// Initialize history and invoice metadata when the validated order is saved.
OrderSchema.pre('save', function (this: IOrder) {
    if (this.isNew) {
        if (!this.statusHistory?.length) {
            this.statusHistory = [
                {
                    status: this.status,
                    timestamp: new Date(),
                    note: 'Order created',
                },
            ];
        }

        if (!this.invoiceNumber && (this.paymentStatus === 'paid' || this.status !== 'pending')) {
            const year = new Date().getFullYear();
            const month = String(new Date().getMonth() + 1).padStart(2, '0');
            const random = Math.random().toString(36).substring(2, 8).toUpperCase();
            this.invoiceNumber = `INV-${year}${month}-${random}`;
        }
    }
});

export const Order = mongoose.model<IOrder>('Order', OrderSchema);
