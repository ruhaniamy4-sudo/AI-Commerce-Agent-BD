import express from "express";
import mongoose from "mongoose";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Business } from "../../models/Business";
import { Customer } from "../../models/Customer";
import { withTenantContext } from "../../tenancy/context";
import * as checkoutService from "../../services/checkout.service";
import publicRoutes from "../public.routes";

const businessId = new mongoose.Types.ObjectId().toString();
const customerId = new mongoose.Types.ObjectId();
const productId = new mongoose.Types.ObjectId().toString();

const app = express()
  .use(express.json())
  .use((req, _res, next) =>
    withTenantContext(
      {
        businessId,
        userId: "public-storefront",
        membershipId: "public-channel",
        role: "Staff",
      },
      () => next(),
    ),
  )
  .use("/public/store", publicRoutes);

describe("public storefront checkout", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(Business, "findById").mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({
          _id: businessId,
          commerce: {
            storeEnabled: true,
            paymentMethods: ["Cash on Delivery"],
            deliveryFees: { insideDhaka: 80, outsideDhaka: 130 },
          },
        }),
      }),
    } as never);
    vi.spyOn(Customer, "findOneAndUpdate").mockResolvedValue({
      _id: customerId,
    } as never);
    vi.spyOn(checkoutService, "createOrderWithStock").mockResolvedValue({
      orderNumber: "SP-TEST-001",
      status: "pending",
      subtotal: 1490,
      deliveryFee: 80,
      total: 1570,
      paymentMethod: "Cash on Delivery",
    } as never);
  });

  it("creates a tenant-scoped order using server-owned delivery pricing", async () => {
    const response = await request(app)
      .post("/public/store/checkout")
      .set("idempotency-key", "checkout-test-key-001")
      .send({
        customer: { fullName: "Tanvir Hasan", phone: "01712445566" },
        shippingAddress: {
          addressLine1: "House 12, Road 4",
          city: "Dhaka",
          zone: "Dhanmondi",
        },
        items: [{ productId, quantity: 1 }],
        paymentMethod: "Cash on Delivery",
      })
      .expect(201);

    expect(response.body).toMatchObject({
      orderNumber: "SP-TEST-001",
      deliveryFee: 80,
      total: 1570,
      currency: "BDT",
    });
    expect(checkoutService.createOrderWithStock).toHaveBeenCalledWith(
      expect.objectContaining({
        businessId,
        customerId,
        deliveryFee: 80,
        source: "web",
        idempotencyKey: "checkout-test-key-001",
      }),
    );
  });

  it("rejects client-selected payment methods that the merchant did not enable", async () => {
    await request(app)
      .post("/public/store/checkout")
      .set("idempotency-key", "checkout-test-key-002")
      .send({
        customer: { fullName: "Tanvir Hasan", phone: "01712445566" },
        shippingAddress: { addressLine1: "House 12, Road 4", city: "Dhaka" },
        items: [{ productId, quantity: 1 }],
        paymentMethod: "Unverified wallet",
      })
      .expect(400);

    expect(checkoutService.createOrderWithStock).not.toHaveBeenCalled();
  });

  it("requires an idempotency key before creating an order", async () => {
    await request(app)
      .post("/public/store/checkout")
      .send({
        customer: { fullName: "Tanvir Hasan", phone: "01712445566" },
        shippingAddress: { addressLine1: "House 12, Road 4", city: "Dhaka" },
        items: [{ productId, quantity: 1 }],
        paymentMethod: "Cash on Delivery",
      })
      .expect(400);

    expect(checkoutService.createOrderWithStock).not.toHaveBeenCalled();
  });
});
