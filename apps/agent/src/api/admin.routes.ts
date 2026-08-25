import { Router } from 'express';
import NodeCache from 'node-cache';
import { AuthenticatedRequest, requireAdministrator } from '../auth/middleware';
import { requireTenantContext, tenantDocument } from '../tenancy/context';
import { Conversation } from '../models/Conversation';
import { Customer } from '../models/Customer';
import { Knowledge } from '../models/Knowledge';
import { Message } from '../models/Message';
import { Order } from '../models/Order';
import { SystemPrompt } from '../models/SystemPrompt';
import { invalidatePromptCache } from '../services/systemPrompt.service';
import { returnConversationToAI, takeOverConversation } from '../services/conversation-control.service';

const router = Router();

// Get all conversations with pagination, search, and sort
router.get('/conversations', async (req, res) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const search = (req.query.search as string) || '';
        const sortBy = (req.query.sortBy as string) || 'updatedAt';
        const order = (req.query.order as string) === 'asc' ? 1 : -1;
        const skip = (page - 1) * limit;

        const pipeline: any[] = [];

        // 1. Lookup Customer details
        pipeline.push({
            $lookup: {
                from: 'customers',
                let: { customerId: '$customerId', businessId: '$businessId' },
                pipeline: [{
                    $match: {
                        $expr: {
                            $and: [
                                { $eq: ['$_id', '$$customerId'] },
                                { $eq: ['$businessId', '$$businessId'] },
                            ],
                        },
                    },
                }],
                as: 'customerData',
            },
        });

        // 2. Lookup message count
        pipeline.push({
            $lookup: {
                from: 'messages',
                let: { convId: '$conversationId', businessId: '$businessId' },
                pipeline: [
                    {
                        $match: {
                            $expr: { $and: [
                                { $eq: ['$conversationId', '$$convId'] },
                                { $eq: ['$businessId', '$$businessId'] },
                            ] },
                        },
                    },
                    { $count: 'count' },
                ],
                as: 'msgCount',
            },
        });

        // 3. Lookup last message
        pipeline.push({
            $lookup: {
                from: 'messages',
                let: { convId: '$conversationId', businessId: '$businessId' },
                pipeline: [
                    {
                        $match: {
                            $expr: { $and: [
                                { $eq: ['$conversationId', '$$convId'] },
                                { $eq: ['$businessId', '$$businessId'] },
                            ] },
                        },
                    },
                    { $sort: { createdAt: -1 } },
                    { $limit: 1 },
                ],
                as: 'lastMessageData',
            },
        });

        // 4. Project and flatten fields
        pipeline.push({
            $addFields: {
                customer: { $arrayElemAt: ['$customerData', 0] },
                messageCount: {
                    $ifNull: [{ $arrayElemAt: ['$msgCount.count', 0] }, 0],
                },
                lastMessage: {
                    $ifNull: [
                        { $arrayElemAt: ['$lastMessageData.content', 0] },
                        '',
                    ],
                },
            },
        });

        // 5. Build search query
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            pipeline.push({
                $match: {
                    $or: [
                        { conversationId: searchRegex },
                        { lastMessage: searchRegex },
                        { 'customer.name': searchRegex },
                        { 'customer.phone': searchRegex },
                    ],
                },
            });
        }

        // 6. Sorting
        const sortStage: any = {};
        sortStage[sortBy] = order;
        pipeline.push({ $sort: sortStage });

        // 7. Calculate total count
        const countPipeline = [...pipeline, { $count: 'total' }];
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
        console.error('Error fetching conversations:', error);
        res.status(500).json({ error: 'Failed to fetch conversations' });
    }
});

// Get messages for a specific conversation
router.get('/conversations/:id', async (req, res) => {
    const conversation = await Conversation.findOne({
        $or: [{ _id: req.params.id }, { conversationId: req.params.id }],
    }).lean();
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    res.json(conversation);
});

router.post('/conversations/:id/take-over', async (req, res) => {
    const conversation = await takeOverConversation(req.params.id, req.body?.reason);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    res.json(conversation);
});

router.post('/conversations/:id/return-to-ai', async (req, res) => {
    const conversation = await returnConversationToAI(req.params.id);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    res.json(conversation);
});

router.get('/conversations/:id/messages', async (req, res) => {
    try {
        const { id } = req.params;
        const conversation = await Conversation.findOne({
            $or: [{ _id: id }, { conversationId: id }],
        });

        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        const messages = await Message.find({
            conversationId: conversation.conversationId,
        })
            .sort({ createdAt: 1 })
            .lean();

        res.json(messages);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// Get all knowledge base entries
router.get('/knowledge', async (req, res) => {
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
                { title: { $regex: search, $options: 'i' } },
                { content: { $regex: search, $options: 'i' } },
                { tags: { $in: [new RegExp(search, 'i')] } },
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
        console.error('Error fetching knowledge base:', error);
        res.status(500).json({ error: 'Failed to fetch knowledge base' });
    }
});

// Create a new knowledge base entry
router.post('/knowledge', requireAdministrator, async (req: AuthenticatedRequest, res) => {
    try {
        const { title, content, type, language, tags, status } = req.body;

        if (!title || !content || !type) {
            return res.status(400).json({ error: 'Title, content, and type are required' });
        }

        const knowledge = new Knowledge(tenantDocument({
            title,
            content,
            type,
            language: language || 'en',
            tags: tags || [],
            status: status || 'active',
            version: 1,
            createdBy: req.auth!.userId,
            updatedBy: req.auth!.userId,
        }));

        await knowledge.save();
        res.status(201).json(knowledge);
    } catch (error) {
        console.error('Error creating knowledge base entry:', error);
        res.status(500).json({ error: 'Failed to create knowledge base entry' });
    }
});

// Update a knowledge base entry
router.patch('/knowledge/:id', requireAdministrator, async (req: AuthenticatedRequest, res) => {
    try {
        const { id } = req.params;
        const { businessId: _ignoredBusinessId, ...updates } = req.body;
        updates.updatedBy = req.auth!.userId;
        const knowledge = await Knowledge.findByIdAndUpdate(id, updates, { new: true });
        if (!knowledge) return res.status(404).json({ error: 'Not found' });
        res.json(knowledge);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update' });
    }
});

// Delete a knowledge base entry
router.delete('/knowledge/:id', requireAdministrator, async (req, res) => {
    try {
        await Knowledge.findByIdAndDelete(req.params.id);
        res.json({ message: 'Deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete' });
    }
});

// System Prompts
router.get('/system-prompts', requireAdministrator, async (req, res) => {
    try {
        const prompts = await SystemPrompt.find().sort({ createdAt: -1 });
        res.json({ data: prompts, pagination: { total: prompts.length, page: 1, limit: 100, totalPages: 1 } });
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch prompts' });
    }
});

router.get('/system-prompts/active', requireAdministrator, async (_req, res) => {
    try {
        const prompt = await SystemPrompt.findOne({ isActive: true }).sort({ updatedAt: -1 });
        if (!prompt) return res.status(404).json({ error: 'No active prompt found' });
        res.json(prompt);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch active prompt' });
    }
});

router.post('/system-prompts', requireAdministrator, async (req, res) => {
    try {
        const prompt = await SystemPrompt.create(req.body);
        await invalidatePromptCache();
        res.status(201).json(prompt);
    } catch (e) {
        res.status(500).json({ error: 'Failed to create prompt' });
    }
});

router.patch('/system-prompts/:id', requireAdministrator, async (req, res) => {
    try {
        const prompt = await SystemPrompt.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        });
        if (!prompt) return res.status(404).json({ error: 'Prompt not found' });
        await invalidatePromptCache();
        res.json(prompt);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update prompt' });
    }
});

router.delete('/system-prompts/:id', requireAdministrator, async (req, res) => {
    try {
        const prompt = await SystemPrompt.findByIdAndDelete(req.params.id);
        if (!prompt) return res.status(404).json({ error: 'Prompt not found' });
        await invalidatePromptCache();
        res.json({ message: 'Deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete prompt' });
    }
});

// Analytics (Simplified for F-Commerce)
const analyticsCache = new NodeCache({ stdTTL: 300 });

router.get('/analytics', async (req, res) => {
    try {
        const cacheKey = `f_commerce_analytics:${requireTenantContext().businessId}`;
        const cachedData = analyticsCache.get(cacheKey);
        if (cachedData) return res.json(cachedData);

        const totalCustomers = await Customer.countDocuments();
        const totalOrders = await Order.countDocuments();
        const pendingOrders = await Order.countDocuments({ status: 'pending' });

        const data = {
            kpi: {
                totalCustomers,
                totalOrders,
                pendingOrders
            },
            funnel: [],
            institutes: [],
            executives: [],
            growth: []
            // Add more stats as needed
        };

        analyticsCache.set(cacheKey, data);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

export default router;
