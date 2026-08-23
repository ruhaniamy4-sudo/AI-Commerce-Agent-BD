import { Conversation } from '../models/Conversation';
import { analyzeProductImage, createImageContext } from './vision.service';
import { matchProductsWithRAG, formatProductsForResponse } from './product-matcher.service';
import { assertTenantBusinessId } from '../tenancy/context';
import { getRagTopK } from './ai-config';

/**
 * Shared logic for processing an image in a conversation
 * Used by both Facebook webhooks and Manual Chat tests
 */
export async function handleImageInput(
    businessId: string,
    convId: string,
    imageUrl: string,
    eventIdentifier?: string
) {
    assertTenantBusinessId(businessId, 'images.handleInput');
    try {
        console.log(`[ImageProcessor] Processing image for conversation: ${convId}`);

        // 1. RAG Matching: Find similar products via vector search
        const matchedProducts = await matchProductsWithRAG({
            businessId,
            imageUrl,
            limit: getRagTopK(),
            minSimilarity: 0.7,
            conversationId: convId,
            eventIdentifier,
        });

        // 2. Vision Analysis: Get descriptive context
        const visionResult = await analyzeProductImage(
            imageUrl,
            eventIdentifier ? { conversationId: convId, eventIdentifier } : undefined
        );

        // 3. Store Image Context in Conversation for AI Agent awareness
        const imageContext = createImageContext(
            imageUrl,
            visionResult,
            matchedProducts.map((p: any) => p._id.toString())
        );

        await Conversation.updateOne(
            { conversationId: convId },
            { $set: { imageContext } }
        );

        return {
            matchedProducts,
            visionResult,
            imageContext
        };
    } catch (error) {
        console.error('[ImageProcessor] Error processing image:', error);
        throw error;
    }
}
