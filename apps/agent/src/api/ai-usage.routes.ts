import { Router } from 'express';
import { AIUsage } from '../models/AIUsage';
import { AuthenticatedRequest, requireAdministrator } from '../auth/middleware';
import { evaluateBusinessAIAccess } from '../services/business-ai-access.service';

const router = Router();

/**
 * Whether the AI is currently allowed to reply, and how much of the allowance
 * is gone. Kept out of the billing payload so the warning banner works for
 * whoever runs the workspace, without handing them invoices and plan pricing.
 */
router.get('/ai-access', requireAdministrator, async (req: AuthenticatedRequest, res) => {
    const access = await evaluateBusinessAIAccess(req.auth!.businessId);
    res.json({
        allowed: access.allowed,
        reason: access.reason || null,
        limits: access.limits || null,
        consumed: access.consumed ?? null,
        warnAt: access.warnAt ?? 0.8,
    });
});

router.get('/ai-usage/summary', requireAdministrator, async (req, res) => {
    const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const [summary] = await AIUsage.aggregate([
        { $match: { createdAt: { $gte: from } } },
        {
            $group: {
                _id: null,
                requests: { $sum: 1 },
                llmCalls: { $sum: { $cond: [{ $in: ['$operationType', ['chat', 'rag-assisted-chat']] }, 1, 0] } },
                nonGenerationAiCalls: { $sum: { $cond: [{ $in: ['$operationType', ['vision', 'embedding']] }, 1, 0] } },
                inputTokens: { $sum: { $ifNull: ['$inputTokens', 0] } },
                outputTokens: { $sum: { $ifNull: ['$outputTokens', 0] } },
                totalTokens: { $sum: { $ifNull: ['$totalTokens', 0] } },
                cachedTokens: { $sum: { $ifNull: ['$cachedTokens', 0] } },
                estimatedCost: { $sum: { $ifNull: ['$estimatedCost', 0] } },
                unknownCostRequests: {
                    $sum: { $cond: [{ $eq: ['$estimatedCost', null] }, 1, 0] },
                },
            },
        },
    ]);
    res.json({
        period: { from: from.toISOString(), to: new Date().toISOString(), days },
        requests: summary?.requests || 0,
        inputTokens: summary?.inputTokens || 0,
        outputTokens: summary?.outputTokens || 0,
        totalTokens: summary?.totalTokens || 0,
        cachedTokens: summary?.cachedTokens || 0,
        llmCalls: summary?.llmCalls || 0,
        nonGenerationAiCalls: summary?.nonGenerationAiCalls || 0,
        estimatedCost: summary?.unknownCostRequests ? null : summary?.estimatedCost || 0,
    });
});

export default router;
