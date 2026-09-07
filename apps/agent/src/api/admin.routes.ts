import { Router } from "express";
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
import { invalidatePromptCache } from "../services/systemPrompt.service";
import { saveMessage } from "../services/memory.service";
import { sendMessage } from "../services/facebook.service";
import crypto from "crypto";
import {sendWhatsApp} from '../intelligence/whatsapp';
import {
  returnConversationToAI,
  takeOverConversation,
} from "../services/conversation-control.service";

const router = Router();

// Get all conversations with pagination, search, and sort
router.get("/conversations", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || "";
    const sortBy = (req.query.sortBy as string) || "updatedAt";
    const order = (req.query.order as string) === "asc" ? 1 : -1;
    const skip = (page - 1) * limit;

    const pipeline: any[] = [];

    // 1. Lookup Customer details
    pipeline.push({
      $lookup: {
        from: "customers",
        let: { customerId: "$customerId", businessId: "$businessId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$_id", "$$customerId"] },
                  { $eq: ["$businessId", "$$businessId"] },
                ],
              },
            },
          },
        ],
        as: "customerData",
      },
    });

    // 2. Lookup message count
    pipeline.push({
      $lookup: {
        from: "messages",
        let: { convId: "$conversationId", businessId: "$businessId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$conversationId", "$$convId"] },
                  { $eq: ["$businessId", "$$businessId"] },
                ],
              },
            },
          },
          { $count: "count" },
        ],
        as: "msgCount",
      },
    });

    // 3. Lookup last message
    pipeline.push({
      $lookup: {
        from: "messages",
        let: { convId: "$conversationId", businessId: "$businessId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$conversationId", "$$convId"] },
                  { $eq: ["$businessId", "$$businessId"] },
                ],
              },
            },
          },
          { $sort: { createdAt: -1 } },
          { $limit: 1 },
        ],
        as: "lastMessageData",
      },
    });

    // 4. Project and flatten fields
    pipeline.push({
      $addFields: {
        customer: { $arrayElemAt: ["$customerData", 0] },
        messageCount: {
          $ifNull: [{ $arrayElemAt: ["$msgCount.count", 0] }, 0],
        },
        lastMessage: {
          $ifNull: [{ $arrayElemAt: ["$lastMessageData.content", 0] }, ""],
        },
      },
    });

    // 5. Build search query
    if (search) {
      const searchRegex = new RegExp(search, "i");
      pipeline.push({
        $match: {
          $or: [
            { conversationId: searchRegex },
            { lastMessage: searchRegex },
            { "customer.name": searchRegex },
            { "customer.phone": searchRegex },
          ],
        },
      });
    }

    // 6. Sorting
    const sortStage: any = {};
    sortStage[sortBy] = order;
    pipeline.push({ $sort: sortStage });

    // 7. Calculate total count
    const countPipeline = [...pipeline, { $count: "total" }];
    const [totalResult] = await Conversation.aggregate(countPipeline);
    const total = totalResult ? totalResult.total : 0;

    // 8. Pagination
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });

    const conversations = await Conversation.aggregate(pipeline);

    res.json({
      data: conversations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

// Get messages for a specific conversation
router.get("/conversations/:id", async (req, res) => {
  const conversation = await Conversation.findOne({
    $or: [{ _id: req.params.id }, { conversationId: req.params.id }],
  }).lean();
  if (!conversation)
    return res.status(404).json({ error: "Conversation not found" });
  res.json(conversation);
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
    $or: [{ _id: req.params.id }, { conversationId: req.params.id }],
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
      $or: [{ _id: id }, { conversationId: id }],
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

router.post("/system-prompts", requireAdministrator, async (req, res) => {
  try {
    const prompt = await SystemPrompt.create(req.body);
    await invalidatePromptCache();
    res.status(201).json(prompt);
  } catch (e) {
    res.status(500).json({ error: "Failed to create prompt" });
  }
});

router.patch("/system-prompts/:id", requireAdministrator, async (req, res) => {
  try {
    const prompt = await SystemPrompt.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      },
    );
    if (!prompt) return res.status(404).json({ error: "Prompt not found" });
    await invalidatePromptCache();
    res.json(prompt);
  } catch (error) {
    res.status(500).json({ error: "Failed to update prompt" });
  }
});

router.delete("/system-prompts/:id", requireAdministrator, async (req, res) => {
  try {
    const prompt = await SystemPrompt.findByIdAndDelete(req.params.id);
    if (!prompt) return res.status(404).json({ error: "Prompt not found" });
    await invalidatePromptCache();
    res.json({ message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete prompt" });
  }
});

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
