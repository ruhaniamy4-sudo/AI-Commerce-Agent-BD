import { Router } from "express";
import mongoose from "mongoose";
import { Category } from "../models/Category";
import { Product } from "../models/Product";
import { Business } from "../models/Business";
import { Customer } from "../models/Customer";
import chatRoutes from "./chat.routes";
import { requireTenantContext } from "../tenancy/context";
import {
  createOrderWithStock,
  OrderCreationError,
} from "../services/checkout.service";
import { normalizeBangladeshPhone } from "../courier/bangladesh-phone";
import { authRateLimit } from "../auth/rate-limit";
import trackingRoutes from './tracking.routes';
import { linkVisit } from '../intelligence/tracking';

const router = Router({ mergeParams: true });

router.use("/chat", chatRoutes);
router.use('/tracking', trackingRoutes);

function publicCommerceSettings(business: any) {
  return {
    storeEnabled: business?.commerce?.storeEnabled !== false,
    currency: "BDT" as const,
    paymentMethods: business?.commerce?.paymentMethods?.length
      ? business.commerce.paymentMethods
      : ["Cash on Delivery"],
    deliveryFees: {
      insideDhaka: Number(business?.commerce?.deliveryFees?.insideDhaka ?? 80),
      outsideDhaka: Number(
        business?.commerce?.deliveryFees?.outsideDhaka ?? 130,
      ),
    },
    deliveryPolicy: business?.commerce?.deliveryPolicy,
    returnPolicy: business?.commerce?.returnPolicy,
    salesChannel: business?.commerce?.salesChannel,
  };
}

function cleanText(value: unknown, max: number) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

router.get("/store", async (_req, res) => {
  const business = await Business.findById(requireTenantContext().businessId)
    .select("name description commerce currency storefront")
    .lean();
  if (!business) return res.status(404).json({ error: "Store not found" });
  res.json({
    name: business.name,
    description: business.description,
    storefront: business.storefront,
    ...publicCommerceSettings(business),
  });
});

router.post(
  "/checkout/quote",
  authRateLimit({ limit: 60, windowMs: 15 * 60 * 1000 }),
  async (req, res) => {
    const city = cleanText(req.body?.city, 120);
    const business = await Business.findById(requireTenantContext().businessId)
      .select("commerce")
      .lean();
    if (!business || business.commerce?.storeEnabled === false)
      return res
        .status(409)
        .json({ error: "Online ordering is not available for this store" });
    const settings = publicCommerceSettings(business);
    const deliveryFee = /dhaka|ঢাকা/i.test(city)
      ? settings.deliveryFees.insideDhaka
      : settings.deliveryFees.outsideDhaka;
    res.json({
      deliveryFee,
      currency: settings.currency,
      paymentMethods: settings.paymentMethods,
    });
  },
);

router.post(
  "/checkout",
  authRateLimit({ limit: 12, windowMs: 15 * 60 * 1000 }),
  async (req, res) => {
    try {
      const businessId = requireTenantContext().businessId;
      const business = await Business.findById(businessId)
        .select("commerce")
        .lean();
      if (!business || business.commerce?.storeEnabled === false)
        return res
          .status(409)
          .json({ error: "Online ordering is not available for this store" });
      const settings = publicCommerceSettings(business);
      const fullName = cleanText(req.body?.customer?.fullName, 120);
      const phone = normalizeBangladeshPhone(
        cleanText(req.body?.customer?.phone, 30),
      );
      const addressLine1 = cleanText(
        req.body?.shippingAddress?.addressLine1,
        300,
      );
      const addressLine2 = cleanText(
        req.body?.shippingAddress?.addressLine2,
        200,
      );
      const city = cleanText(req.body?.shippingAddress?.city, 120);
      const zone = cleanText(req.body?.shippingAddress?.zone, 120) || city;
      const customerNote = cleanText(req.body?.customerNote, 500);
      if (fullName.length < 2 || addressLine1.length < 5 || city.length < 2)
        return res
          .status(400)
          .json({ error: "Enter a valid name, delivery address, and city" });
      const items = Array.isArray(req.body?.items)
        ? req.body.items.slice(0, 25).map((item: any) => ({
            productId: cleanText(item.productId, 80),
            variantId: item.variantId
              ? cleanText(item.variantId, 120)
              : undefined,
            quantity: Number(item.quantity),
          }))
        : [];
      if (
        !items.length ||
        items.some(
          (item: any) =>
            !mongoose.Types.ObjectId.isValid(item.productId) ||
            !Number.isInteger(item.quantity) ||
            item.quantity < 1 ||
            item.quantity > 20,
        )
      )
        return res
          .status(400)
          .json({ error: "Choose valid products and quantities" });
      const paymentMethod =
        cleanText(req.body?.paymentMethod, 80) || settings.paymentMethods[0];
      if (!settings.paymentMethods.includes(paymentMethod))
        return res
          .status(400)
          .json({ error: "Choose an available payment method" });
      const idempotencyKey = cleanText(req.headers["idempotency-key"], 128);
      if (idempotencyKey.length < 12)
        return res
          .status(400)
          .json({ error: "A valid checkout request key is required" });
      const deliveryFee = /dhaka|ঢাকা/i.test(city)
        ? settings.deliveryFees.insideDhaka
        : settings.deliveryFees.outsideDhaka;
      const address = {
        label: "Delivery",
        fullName,
        phone,
        addressLine1,
        ...(addressLine2 ? { addressLine2 } : {}),
        city,
        zone,
        country: "Bangladesh",
        isDefault: true,
      };
      const psid = `web:${phone}`;
      const customer = await Customer.findOneAndUpdate(
        { psid },
        {
          $set: {
            name: fullName,
            phone,
            lastMessageAt: new Date(),
            addresses: [address],
          },
          $setOnInsert: {
            language: "bn",
            tags: ["web-customer"],
            notes: "",
            optedOut: false,
          },
        },
        {
          upsert: true,
          new: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        },
      );
      const order = await createOrderWithStock({
        businessId,
        customerId: customer._id,
        psid,
        items,
        shippingAddress: address,
        deliveryFee,
        paymentMethod,
        source: "web",
        customerNote,
        idempotencyKey,
      });
      await linkVisit(req.body?.visitToken, String(order.customerId), String(order._id));
      res.status(201).json({
        orderNumber: order.orderNumber,
        status: order.status,
        subtotal: order.subtotal,
        deliveryFee: order.deliveryFee,
        total: order.total,
        currency: "BDT",
        paymentMethod: order.paymentMethod,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Checkout failed";
      res
        .status(
          error instanceof OrderCreationError ||
            /valid Bangladesh mobile/.test(message)
            ? 400
            : 500,
        )
        .json({ error: message });
    }
  },
);

router.get("/products", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const query: Record<string, unknown> = { isActive: true };
  if (req.query.search) query.$text = { $search: String(req.query.search) };
  if (req.query.categoryId) query.categoryId = req.query.categoryId;
  const [data, total] = await Promise.all([
    Product.find(query)
      .sort({ isFeatured: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Product.countDocuments(query),
  ]);
  res.json({
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

router.get("/products/:identifier", async (req, res) => {
  const identifier = req.params.identifier;
  const identity = mongoose.Types.ObjectId.isValid(identifier)
    ? { _id: identifier }
    : { slug: identifier };
  const product = await Product.findOne({ ...identity, isActive: true }).lean();
  if (!product) return res.status(404).json({ error: "Product not found" });
  res.json(product);
});

router.get("/categories", async (_req, res) => {
  const categories = await Category.find({ isActive: true })
    .sort({ order: 1, name: 1 })
    .lean();
  res.json(categories);
});

export default router;
