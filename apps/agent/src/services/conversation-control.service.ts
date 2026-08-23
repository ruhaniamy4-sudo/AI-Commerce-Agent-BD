import { IConversation, Conversation } from '../models/Conversation';
import mongoose from 'mongoose';

export const isAIActive = (conversation?: Pick<IConversation, 'controlMode'> | null) =>
    conversation?.controlMode === 'AI_ACTIVE';

export async function invokeIfAIActive<T>(
    conversationId: string,
    invoke: () => Promise<T>
): Promise<T | null> {
    const active = await Conversation.findOne({ conversationId, controlMode: 'AI_ACTIVE' }).select('_id').lean();
    if (!active) return null;
    return invoke();
}

const conversationIdentity = (identifier: string) => mongoose.Types.ObjectId.isValid(identifier)
    ? { $or: [{ _id: identifier }, { conversationId: identifier }] }
    : { conversationId: identifier };

export async function takeOverConversation(identifier: string, reason = 'Human agent took over') {
    return Conversation.findOneAndUpdate(
        conversationIdentity(identifier),
        {
            $set: {
                controlMode: 'HUMAN_ACTIVE',
                aiEnabled: false,
                needsHumanHandoff: true,
                handoffReason: reason,
            },
        },
        { new: true }
    );
}

export async function returnConversationToAI(identifier: string) {
    return Conversation.findOneAndUpdate(
        conversationIdentity(identifier),
        {
            $set: { controlMode: 'AI_ACTIVE', aiEnabled: true, needsHumanHandoff: false },
            $unset: { handoffReason: 1 },
        },
        { new: true }
    );
}
