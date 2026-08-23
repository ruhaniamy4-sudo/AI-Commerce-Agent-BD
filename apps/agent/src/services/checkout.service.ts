import mongoose from 'mongoose';
import { Order } from '../models/Order';
import { Product } from '../models/Product';
import { Customer } from '../models/Customer';

interface CreateOrderParams {
    psid: string;
    items: { sku: string; quantity: number; variantId?: string }[];
    address?: any;
}

export interface CreateOrderWithStockParams {
    customerId: mongoose.Types.ObjectId | string;
    psid?: string;
    items: Array<{
        productId?: mongoose.Types.ObjectId | string;
        variantId?: string;
        sku?: string;
        quantity: number;
    }>;
    shippingAddress: Record<string, unknown>;
    shippingMethod?: 'standard' | 'express' | 'overnight';
    paymentMethod?: string;
    paymentStatus?: 'pending' | 'paid' | 'failed' | 'refunded';
    deliveryFee?: number;
    discount?: number;
    status?: string;
    source?: 'messenger' | 'web' | 'admin';
    createdBy?: string;
    customerNote?: string;
    adminNote?: string;
}

export class OrderCreationError extends Error {}

export const createOrderWithStock = async (params: CreateOrderWithStockParams) => {
    if (!params.items?.length) throw new OrderCreationError('At least one order item is required');

    const deliveryFee = Number(params.deliveryFee || 0);
    const discount = Number(params.discount || 0);
    if (deliveryFee < 0 || discount < 0) {
        throw new OrderCreationError('Delivery fee and discount cannot be negative');
    }

    const session = await mongoose.startSession();
    let createdOrder: InstanceType<typeof Order> | undefined;

    try {
        await session.withTransaction(async () => {
            const customer = await Customer.findById(params.customerId).session(session);
            if (!customer) throw new OrderCreationError('Customer not found');

            const normalizedItems: Array<Record<string, unknown>> = [];
            let subtotal = 0;

            for (const item of params.items) {
                const quantity = Number(item.quantity);
                if (!Number.isInteger(quantity) || quantity < 1) {
                    throw new OrderCreationError('Item quantity must be a positive integer');
                }

                const selector = item.productId
                    ? { _id: item.productId }
                    : { 'variants.sku': item.sku };
                const product = await Product.findOne(selector).session(session);
                if (!product) throw new OrderCreationError('Product not found');

                const variant = item.variantId
                    ? product.variants.find((candidate) => candidate.variantId === item.variantId)
                    : item.sku
                      ? product.variants.find((candidate) => candidate.sku === item.sku)
                      : undefined;

                const unitPrice = variant?.price ?? product.basePrice;
                const sku = variant?.sku || item.sku || product.slug;
                const lineSubtotal = unitPrice * quantity;

                const stockUpdate = variant
                    ? await Product.findOneAndUpdate(
                          {
                              _id: product._id,
                              variants: {
                                  $elemMatch: {
                                      variantId: variant.variantId,
                                      stock: { $gte: quantity },
                                  },
                              },
                          },
                          { $inc: { 'variants.$.stock': -quantity } },
                          { new: true, session }
                      )
                    : await Product.findOneAndUpdate(
                          { _id: product._id, stock: { $gte: quantity } },
                          { $inc: { stock: -quantity } },
                          { new: true, session }
                      );

                if (!stockUpdate) {
                    throw new OrderCreationError(`Insufficient stock for ${product.name}`);
                }

                normalizedItems.push({
                    productId: product._id,
                    variantId: variant?.variantId,
                    productName: product.name,
                    variantName: variant?.name,
                    sku,
                    quantity,
                    unitPriceSnapshot: unitPrice,
                    subtotal: lineSubtotal,
                });
                subtotal += lineSubtotal;
            }

            if (discount > subtotal + deliveryFee) {
                throw new OrderCreationError('Discount cannot exceed the order value');
            }

            createdOrder = new Order({
                customerId: customer._id,
                psid: params.psid,
                items: normalizedItems,
                subtotal,
                deliveryFee,
                discount,
                total: subtotal + deliveryFee - discount,
                shippingAddress: params.shippingAddress,
                shippingMethod: params.shippingMethod || 'standard',
                paymentMethod: params.paymentMethod || 'Cash on Delivery',
                paymentStatus: params.paymentStatus || 'pending',
                status: params.status || 'pending',
                source: params.source || 'messenger',
                createdBy: params.createdBy,
                customerNote: params.customerNote,
                adminNote: params.adminNote,
            });
            await createdOrder.save({ session });

            await Customer.updateOne(
                { _id: customer._id },
                { $inc: { totalOrders: 1, totalSpent: createdOrder.total } },
                { session }
            );
        });
    } finally {
        await session.endSession();
    }

    if (!createdOrder) throw new OrderCreationError('Order transaction did not complete');
    return createdOrder;
};

export const createOrder = async (params: CreateOrderParams) => {
    try {
        console.log(`Creating order for PSID ${params.psid}`);

        const customer = await Customer.findOne({ psid: params.psid });
        if (!customer) throw new Error('Customer not found');

        const order = await createOrderWithStock({
            customerId: customer._id,
            psid: params.psid,
            items: params.items,
            shippingAddress: params.address || customer.addresses[0] || {},
        });

        console.log(`Order created: ${order.orderNumber}`);
        return { success: true, orderId: order._id, total: order.total };

    } catch (error: any) {
        console.error('Create Order Failed:', error.message);
        return { success: false, error: error.message };
    }
};
