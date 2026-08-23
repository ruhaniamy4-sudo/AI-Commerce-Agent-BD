import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';
import { assertTenantBusinessId } from '../tenancy/context';
import { getAIRecentMessageLimit, getAISummaryThreshold } from './ai-config';

const maxSummaryCharacters = 1800;

export async function maybeUpdateConversationSummary(businessId: string, conversationId: string) {
    assertTenantBusinessId(businessId, 'memory.summary');
    const conversation = await Conversation.findOne({ conversationId }).lean();
    if (!conversation) return;
    const threshold = getAISummaryThreshold();
    const recentLimit = getAIRecentMessageLimit();
    const eligibleCount = Math.max(
        0,
        conversation.messageCount - recentLimit - conversation.summarizedMessageCount
    );
    if (eligibleCount < threshold) return;
    const candidates = await Message.find({ conversationId })
        .sort({ createdAt: 1 })
        .skip(conversation.summarizedMessageCount)
        .limit(Math.min(eligibleCount, threshold))
        .select('role content')
        .lean();
    if (!candidates.length) return;

    const compact = candidates.map((message: any) =>
        `${message.role === 'user' ? 'Customer' : 'Assistant'}: ${String(message.content).replace(/\s+/g, ' ').slice(0, 180)}`
    ).join('\n');
    const summary = [conversation.summary, compact].filter(Boolean).join('\n').slice(-maxSummaryCharacters);
    await Conversation.updateOne(
        { conversationId },
        {
            $set: {
                summary,
                summarizedMessageCount: conversation.summarizedMessageCount + candidates.length,
                summaryUpdatedAt: new Date(),
            },
        }
    );
}
