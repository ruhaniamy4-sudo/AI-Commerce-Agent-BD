import { Router, type Request, type Response } from "express";
import mongoose from "mongoose";
import NodeCache from "node-cache";
import { AuthenticatedRequest, requireAdministrator } from "../auth/middleware";
import { requireTenantContext, tenantDocument } from "../tenancy/context";
import { Conversation } from "../models/Conversation";
import { Customer } from "../models/Customer";
import { Knowledge } from "../models/Knowledge";
import { Message } from "../models/Message";
import { Order } from "../models/Order";
import { Product } from "../models/Product";
import { SystemPrompt } from "../models/SystemPrompt";
import { saveMessage } from "../services/memory.service";
import { sendMessage } from "../services/facebook.service";
import crypto from "crypto";
import {sendWhatsApp} from '../intelligence/whatsapp';
import {
  returnConversationToAI,
  takeOverConversation,
} from "../services/conversation-control.service";

const router = Router();

/**
 * A thread can be addressed by its Mongo id or by the channel conversation id.
 * Casting a channel id like "wa_555_880171" to an ObjectId would throw, so the
 * _id branch is only offered when the id could actually be one.
 */
function conversationBy(rawId: string | string[]) {
  const id = String(rawId);
  return mongoose.isValidObjectId(id)
    ? { $or: [{ _id: id }, { conversationId: id }] }
    : { conversationId: id };
}

/**
 * The merchant inbox.
 *
 * Every connected channel lands in the same list, so the filters carry the
 * meaning: which channel a thread came from, and who owes the customer a reply.
 * Test AI rehearsals live on their own tab rather than burying real customers,
 * and threads with no messages are never listed at all.
 */
export type InboxChannel = 'all' | 'messenger' | 'whatsapp' | 'web' | 'test';
export type InboxState = 'all' | 'unread' | 'needs_attention' | 'human' | 'ai';

const TEST_THREAD = { platform: 'manual', 'metadata.testMode': true } as const;
const CHANNEL_PLATFORMS: Record<Exclude<InboxChannel, 'all' | 'test'>, string[]> = {
    messenger: ['facebook', 'instagram'],
    whatsapp: ['whatsapp'],
    web: ['web-widget', 'web'],
};

/** The channel a thread belongs to, as the inbox tabs name it. */
export function inboxChannelOf(conversation: { platform?: string; metadata?: { testMode?: boolean } }): InboxChannel | 'other' {
    if (conversation.platform === 'manual' && conversation.metadata?.testMode) return 'test';
    const found = (Object.keys(CHANNEL_PLATFORMS) as Array<keyof typeof CHANNEL_PLATFORMS>)
        .find((channel) => CHANNEL_PLATFORMS[channel].includes(String(conversation.platform)));
    return found || 'other';
}

/** Mongo filter for one inbox tab. Empty threads never appear on any of them. */
export function inboxFilter(channel: InboxChannel, state: InboxState) {
    const filter: Record<string, unknown> = { messageCount: { $gt: 0 } };

    if (channel === 'test') Object.assign(filter, TEST_THREAD);
    else if (channel === 'all') filter.$nor = [TEST_THREAD];
    else filter.platform = { $in: CHANNEL_PLATFORMS[channel] };

    if (state === 'unread') filter.unread = true;
    if (state === 'needs_attention') filter.needsHumanHandoff = true;
    if (state === 'human') filter.controlMode = 'HUMAN_ACTIVE';
    if (state === 'ai') filter.controlMode = 'AI_ACTIVE';
    return filter;
}

router.get("/conversations", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
    const search = String(req.query.search || "").trim();
    const sortBy = ["updatedAt", "messageCount", "lastMessageAt"].includes(String(req.query.sortBy))
      ? String(req.query.sortBy)
      : "lastMessageAt";
    const order = (req.query.order as string) === "asc" ? 1 : -1;
    const channel: InboxChannel = ['messenger', 'whatsapp', 'web', 'test'].includes(String(req.query.channel))
      ? (req.query.channel as InboxChannel)
      : 'all';
    const state: InboxState = ['unread', 'needs_attention', 'human', 'ai'].includes(String(req.query.state))
      ? (req.query.state as InboxState)
      : 'all';

    const filter: Record<string, unknown> = inboxFilter(channel, state);

    // Searching by customer resolves the people first, so the thread query stays
    // a plain indexed find rather than an aggregation over every conversation.
    if (search) {
      const pattern = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const matchedCustomers = await Customer.find({ $or: [{ name: pattern }, { phone: pattern }] })
        .select("_id").limit(100).lean();
      filter.$and = [{
        $or: [
          { conversationId: pattern },
          { lastMessagePreview: pattern },
          { psid: pattern },
          ...(matchedCustomers.length ? [{ customerId: { $in: matchedCustomers.map((customer) => customer._id) } }] : []),
        ],
      }];
    }

    const [conversations, total, counts] = await Promise.all([
      Conversation.find(filter)
        .select("conversationId platform customerId psid controlMode needsHumanHandoff handoffReason messageCount lastMessagePreview lastMessageAt lastCustomerMessageAt unread salesStage updatedAt metadata.testMode")
        .populate("customerId", "name phone")
        .sort({ [sortBy]: order })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Conversation.countDocuments(filter),
      inboxCounts(state),
    ]);

    res.json({
      data: conversations.map((conversation: any) => ({
        _id: conversation._id,
        conversationId: conversation.conversationId,
        platform: conversation.platform,
        channel: inboxChannelOf(conversation),
        customer: conversation.customerId
          ? { _id: conversation.customerId._id, name: conversation.customerId.name, phone: conversation.customerId.phone }
          : null,
        psid: conversation.psid,
        controlMode: conversation.controlMode,
        needsHumanHandoff: Boolean(conversation.needsHumanHandoff),
        unread: Boolean(conversation.unread),
        handoffReason: conversation.handoffReason,
        salesStage: conversation.salesStage,
        messageCount: conversation.messageCount || 0,
        lastMessage: conversation.lastMessagePreview || "",
        lastMessageAt: conversation.lastMessageAt || conversation.updatedAt,
        updatedAt: conversation.updatedAt,
      })),
      counts,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

/** How many threads sit behind each tab, so the merchant sees where the work is. */
async function inboxCounts(state: InboxState) {
  const [all, messenger, whatsapp, web, test, needsAttention, unread] = await Promise.all([
    Conversation.countDocuments(inboxFilter('all', state)),
    Conversation.countDocuments(inboxFilter('messenger', state)),
    Conversation.countDocuments(inboxFilter('whatsapp', state)),
    Conversation.countDocuments(inboxFilter('web', state)),
    Conversation.countDocuments(inboxFilter('test', state)),
    Conversation.countDocuments(inboxFilter('all', 'needs_attention')),
    Conversation.countDocuments(inboxFilter('all', 'unread')),
  ]);
  return { all, messenger, whatsapp, web, test, needsAttention, unread };
}

/**
 * A cheap "has anything changed?" check.
 *
 * The dashboard asks for this every few seconds and only refetches the inbox when
 * the version moves, so a quiet shop costs two counts and a timestamp instead of
 * a full conversation listing. Long-lived streams were the alternative, but this
 * deployment sleeps idle connections, so a small poll is the reliable choice.
 */
router.get("/conversations/pulse", async (_req, res) => {
  try {
    const activeFilter = inboxFilter('all', 'all');
    const [latest, unread, needsAttention] = await Promise.all([
      Conversation.findOne(activeFilter).select('lastMessageAt').sort({ lastMessageAt: -1 }).lean(),
      Conversation.countDocuments(inboxFilter('all', 'unread')),
      Conversation.countDocuments(inboxFilter('all', 'needs_attention')),
    ]);
    const lastActivityAt = (latest as any)?.lastMessageAt || null;
    res.json({
      // Anything that should repaint the inbox changes this string.
      version: `${lastActivityAt ? new Date(lastActivityAt).getTime() : 0}:${unread}:${needsAttention}`,
      lastActivityAt,
      unread,
      needsAttention,
    });
  } catch (error) {
    console.error("Error reading inbox pulse:", error);
    res.status(500).json({ error: "Failed to read the inbox pulse" });
  }
});

/** Opening a thread clears its unread mark for the whole team. */
router.post("/conversations/:id/read", async (req: AuthenticatedRequest, res) => {
  const conversation = await Conversation.findOneAndUpdate(
    conversationBy(req.params.id),
    { $set: { unread: false, lastReadAt: new Date(), lastReadBy: req.auth!.userId } },
    { new: true },
  ).select('conversationId unread lastReadAt').lean();
  if (!conversation) return res.status(404).json({ error: "Conversation not found" });
  res.json(conversation);
});

// Get messages for a specific conversation
router.get("/conversations/:id", async (req, res) => {
  const conversation = await Conversation.findOne({
    ...conversationBy(req.params.id),
  }).populate("customerId", "name phone email").lean() as any;
  if (!conversation)
    return res.status(404).json({ error: "Conversation not found" });
  // The thread header needs the person and the channel, not raw platform strings.
  res.json({
    ...conversation,
    channel: inboxChannelOf(conversation),
    customer: conversation.customerId
      ? { _id: conversation.customerId._id, name: conversation.customerId.name, phone: conversation.customerId.phone, email: conversation.customerId.email }
      : null,
  });
});

/**
 * Everything the person answering a thread needs beside the messages: who this
 * is, what they have bought before, and what the AI is in the middle of taking
 * down. Without it, replying means guessing or opening three other pages.
 */
router.get("/conversations/:id/context", async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      ...conversationBy(req.params.id),
    }).populate("customerId", "name phone email language tags addresses totalOrders totalSpent createdAt").lean() as any;
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });

    const customer = conversation.customerId || null;
    // Orders are the source of truth for the totals; the customer counters are a cache.
    const orders = customer
      ? await Order.find({ customerId: customer._id })
          .select("orderNumber status paymentStatus total items createdAt")
          .sort({ createdAt: -1 })
          .limit(5)
          .lean()
      : [];
    // Orders are priced in the business currency, which is BDT for every merchant today.
    const currency = "BDT";
    const [totals] = customer
      ? await Order.aggregate([
          { $match: { customerId: customer._id } },
          { $group: { _id: null, count: { $sum: 1 }, spent: { $sum: "$total" } } },
        ])
      : [];

    const address = customer?.addresses?.find((entry: any) => entry.isDefault) || customer?.addresses?.[0] || null;
    const draft = conversation.metadata?.orderDraft;

    res.json({
      customer: customer && {
        _id: customer._id,
        name: customer.name || null,
        phone: customer.phone || null,
        email: customer.email || null,
        language: customer.language || null,
        tags: customer.tags || [],
        firstSeenAt: customer.createdAt || null,
        address: address && {
          line1: address.addressLine1,
          city: address.city,
          zone: address.zone,
          phone: address.phone,
        },
      },
      stats: {
        orders: totals?.count || 0,
        spent: totals?.spent || 0,
        currency,
        lastOrderAt: (orders[0] as any)?.createdAt || null,
      },
      recentOrders: orders.map((order: any) => ({
        _id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        total: order.total,
        currency,
        items: (order.items || []).reduce((sum: number, item: any) => sum + (item.quantity || 0), 0),
        createdAt: order.createdAt,
      })),
      // What the AI has collected so far, so a takeover does not start from nothing.
      draft: draft?.items?.length
        ? {
            stage: draft.stage,
            items: draft.items.map((item: any) => ({
              name: item.variantName ? `${item.name} (${item.variantName})` : item.name,
              code: item.code || item.sku || null,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              currency: item.currency || "BDT",
            })),
            total: draft.items.reduce((sum: number, item: any) => sum + item.unitPrice * item.quantity, 0),
            fullName: draft.fullName || null,
            phone: draft.phone || null,
            address: [draft.addressLine1, draft.zone, draft.city].filter(Boolean).join(", ") || null,
          }
        : null,
    });
  } catch (error) {
    console.error("Error building conversation context:", error);
    res.status(500).json({ error: "Failed to load conversation context" });
  }
});

router.post("/conversations/:id/take-over", async (req, res) => {
  const conversation = await takeOverConversation(
    req.params.id,
    req.body?.reason,
  );
  if (!conversation)
    return res.status(404).json({ error: "Conversation not found" });
  res.json(conversation);
});

router.post("/conversations/:id/return-to-ai", async (req, res) => {
  const conversation = await returnConversationToAI(req.params.id);
  if (!conversation)
    return res.status(404).json({ error: "Conversation not found" });
  res.json(conversation);
});

router.post("/conversations/:id/messages", async (req: AuthenticatedRequest, res) => {
  const content = String(req.body?.content || "").trim();
  if (!content) return res.status(400).json({ error: "Message content is required" });
  if (content.length > 2000) return res.status(400).json({ error: "Message is too long" });

  const conversation = await Conversation.findOne({
    ...conversationBy(req.params.id),
  });
  if (!conversation) return res.status(404).json({ error: "Conversation not found" });
  if (conversation.controlMode !== "HUMAN_ACTIVE") {
    return res.status(409).json({ error: "Take over this conversation before replying" });
  }

  let delivery: "sent" | "stored" = "stored";
  if (conversation.platform === "facebook") {
    if (!conversation.psid || !conversation.platformPageId) {
      return res.status(409).json({ error: "Messenger delivery information is unavailable" });
    }
    await sendMessage(conversation.psid, content, conversation.platformPageId);
    delivery = "sent";
  }
  if(conversation.platform==='whatsapp') {
    if(!conversation.psid||!conversation.platformPageId)return res.status(409).json({error:'WhatsApp identity unavailable'});
    const lastInbound=await Message.findOne({conversationId:conversation.conversationId,role:'user'}).sort({createdAt:-1});
    if(!lastInbound||Date.now()-new Date(lastInbound.createdAt).getTime()>24*3600000)return res.status(409).json({error:'WhatsApp service window expired; an approved template is required'});
    await sendWhatsApp(conversation.platformPageId,conversation.psid,content);delivery='sent';
  }

  const message = await saveMessage(
    req.auth!.businessId,
    conversation.conversationId,
    "assistant",
    content,
    undefined,
    { messageId: `human:${crypto.randomUUID()}`, platform: conversation.platform, source: "human" },
  );
  res.status(201).json({ message, delivery });
});

router.get("/conversations/:id/messages", async (req, res) => {
  try {
    const { id } = req.params;
    const conversation = await Conversation.findOne({
      ...conversationBy(id),
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const messages = await Message.find({
      conversationId: conversation.conversationId,
    })
      .sort({ createdAt: 1 })
      .lean();

    res.json(messages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// Get all knowledge base entries
router.get("/knowledge", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;
    const type = req.query.type as string;
    const language = req.query.language as string;
    const status = req.query.status as string;
    const skip = (page - 1) * limit;

    const query: any = {};
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { content: { $regex: search, $options: "i" } },
        { tags: { $in: [new RegExp(search, "i")] } },
      ];
    }
    if (type) query.type = type;
    if (language) query.language = language;
    if (status) query.status = status;

    const [knowledge, total] = await Promise.all([
      Knowledge.find(query)
        .sort({ isPinned: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Knowledge.countDocuments(query),
    ]);

    res.json({
      data: knowledge,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching knowledge base:", error);
    res.status(500).json({ error: "Failed to fetch knowledge base" });
  }
});

// Create a new knowledge base entry
router.post(
  "/knowledge",
  requireAdministrator,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { title, content, type, language, tags, status } = req.body;

      if (!title || !content || !type) {
        return res
          .status(400)
          .json({ error: "Title, content, and type are required" });
      }

      const knowledge = new Knowledge(
        tenantDocument({
          title,
          content,
          type,
          language: language || "en",
          tags: tags || [],
          status: status || "active",
          version: 1,
          createdBy: req.auth!.userId,
          updatedBy: req.auth!.userId,
        }),
      );

      await knowledge.save();
      res.status(201).json(knowledge);
    } catch (error) {
      console.error("Error creating knowledge base entry:", error);
      res.status(500).json({ error: "Failed to create knowledge base entry" });
    }
  },
);

// Update a knowledge base entry
router.patch(
  "/knowledge/:id",
  requireAdministrator,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const {
        businessId: _ignoredBusinessId,
        intelligence: _ignoredIntelligence,
        ...updates
      } = req.body;
      updates.updatedBy = req.auth!.userId;
      // Use document save so version history and the deterministic retrieval
      // profile remain synchronized with every merchant edit.
      const knowledge = await Knowledge.findById(id);
      if (!knowledge) return res.status(404).json({ error: "Not found" });
      Object.assign(knowledge, updates);
      await knowledge.save();
      res.json(knowledge);
    } catch (error) {
      res.status(500).json({ error: "Failed to update" });
    }
  },
);

// Delete a knowledge base entry
router.delete("/knowledge/:id", requireAdministrator, async (req, res) => {
  try {
    await Knowledge.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete" });
  }
});

// System Prompts
router.get("/system-prompts", requireAdministrator, async (req, res) => {
  try {
    const prompts = await SystemPrompt.find().sort({ createdAt: -1 });
    res.json({
      data: prompts,
      pagination: { total: prompts.length, page: 1, limit: 100, totalPages: 1 },
    });
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch prompts" });
  }
});

router.get(
  "/system-prompts/active",
  requireAdministrator,
  async (_req, res) => {
    try {
      const prompt = await SystemPrompt.findOne({ isActive: true }).sort({
        updatedAt: -1,
      });
      if (!prompt)
        return res.status(404).json({ error: "No active prompt found" });
      res.json(prompt);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch active prompt" });
    }
  },
);

/**
 * The system prompt is a single global record that drives every tenant's agent, so
 * one merchant administrator editing it used to change every other merchant's
 * replies. Authoring now lives in the platform console
 * (`/platform-admin/prompts`), and merchants keep read access only.
 */
const promptWritesMoved = (_req: Request, res: Response) =>
  res.status(403).json({
    error:
      "The shared system prompt is managed by platform operations. Use Training to shape this workspace's replies.",
    code: "PROMPT_PLATFORM_MANAGED",
  });
router.post("/system-prompts", requireAdministrator, promptWritesMoved);
router.patch("/system-prompts/:id", requireAdministrator, promptWritesMoved);
router.delete("/system-prompts/:id", requireAdministrator, promptWritesMoved);

// Tenant-scoped merchant commerce analytics.
const analyticsCache = new NodeCache({ stdTTL: 300 });

router.get("/analytics", async (req, res) => {
  try {
    const cacheKey = `f_commerce_analytics:${requireTenantContext().businessId}`;
    const cachedData = analyticsCache.get(cacheKey);
    if (cachedData) return res.json(cachedData);

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [
      totalCustomers,
      totalOrders,
      pendingOrders,
      revenueRows,
      statusRows,
      growth,
      productRows,
      channelRows,
      activeProducts,
    ] = await Promise.all([
      Customer.countDocuments(),
      Order.countDocuments(),
      Order.countDocuments({ status: "pending" }),
      Order.aggregate([
        { $match: { status: { $nin: ["cancelled", "returned", "refunded"] } } },
        { $group: { _id: null, revenue: { $sum: "$total" } } },
      ]),
      Order.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: since },
            status: { $nin: ["cancelled", "returned", "refunded"] },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
            revenue: { $sum: "$total" },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, date: "$_id", count: 1, revenue: 1 } },
      ]),
      Order.aggregate([
        { $match: { status: { $nin: ["cancelled", "returned", "refunded"] } } },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.productId",
            name: { $first: "$items.productName" },
            units: { $sum: "$items.quantity" },
            revenue: { $sum: "$items.subtotal" },
          },
        },
        { $sort: { units: -1, revenue: -1 } },
      ]),
      Order.aggregate([
        { $match: { status: { $nin: ["cancelled", "returned", "refunded"] } } },
        {
          $group: {
            _id: "$source",
            orders: { $sum: 1 },
            revenue: { $sum: "$total" },
          },
        },
        { $sort: { orders: -1 } },
      ]),
      Product.find({ isActive: true })
        .select("name stock lowStockThreshold variants")
        .limit(500)
        .lean(),
    ]);
    const soldByProduct = new Map(
      productRows.map((row: any) => [String(row._id), row]),
    );
    const poorPerformingProducts = activeProducts
      .map((product: any) => ({
        productId: String(product._id),
        name: product.name,
        units: Number(soldByProduct.get(String(product._id))?.units || 0),
      }))
      .sort((left, right) => left.units - right.units)
      .slice(0, 5);
    const lowStockProducts = activeProducts.filter((product: any) => {
      const available =
        typeof product.stock === "number"
          ? product.stock
          : (product.variants || []).reduce(
              (sum: number, variant: any) =>
                sum + (typeof variant.stock === "number" ? variant.stock : 0),
              0,
            );
      return available <= Number(product.lowStockThreshold ?? 10);
    });
    const revenue = Number(revenueRows[0]?.revenue || 0);
    const conversionRate = totalCustomers
      ? Number(((totalOrders / totalCustomers) * 100).toFixed(1))
      : 0;
    const insights: string[] = [];
    if (productRows[0])
      insights.push(
        `${productRows[0].name} is the top-selling product with ${productRows[0].units} unit${productRows[0].units === 1 ? "" : "s"} sold.`,
      );
    if (lowStockProducts.length)
      insights.push(
        `${lowStockProducts.length} product${lowStockProducts.length === 1 ? " needs" : "s need"} a stock review.`,
      );
    if (pendingOrders)
      insights.push(
        `${pendingOrders} order${pendingOrders === 1 ? " is" : "s are"} waiting for confirmation.`,
      );

    const data = {
      kpi: {
        totalCustomers,
        totalOrders,
        pendingOrders,
        revenue,
        conversionRate,
      },
      funnel: statusRows.map((row: any) => ({
        stage: row._id,
        count: row.count,
      })),
      growth,
      topProducts: productRows
        .slice(0, 5)
        .map((row: any) => ({
          productId: String(row._id),
          name: row.name,
          units: row.units,
          revenue: row.revenue,
        })),
      poorPerformingProducts,
      channels: channelRows.map((row: any) => ({
        channel: row._id || "unknown",
        orders: row.orders,
        revenue: row.revenue,
      })),
      insights,
    };

    analyticsCache.set(cacheKey, data);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

export default router;
