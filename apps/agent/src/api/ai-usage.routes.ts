import { Router } from 'express';
import { AIUsage } from '../models/AIUsage';

const router = Router();

router.get('/ai-usage/summary', async (req, res) => {
    const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const [summary] = await AIUsage.aggregate([
        { $match: { createdAt: { $gte: from } } },
        {
            $group: {
                _id: null,
                requests: { $sum: 1 },
                inputTokens: { $sum: { $ifNull: ['$inputTokens', 0] } },
                outputTokens: { $sum: { $ifNull: ['$outputTokens', 0] } },
                totalTokens: { $sum: { $ifNull: ['$totalTokens', 0] } },
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
        estimatedCost: summary?.unknownCostRequests ? null : summary?.estimatedCost || 0,
    });
});

export default router;
