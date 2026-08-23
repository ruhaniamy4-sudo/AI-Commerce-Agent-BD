import { Conversation } from '../models/Conversation';
import { analyzeProductImage, createImageContext } from './vision.service';
import { matchProductsWithRAG, formatProductsForResponse } from './product-matcher.service';

/**
 * Shared logic for processing an image in a conversation
 * Used by both Facebook webhooks and Manual Chat tests
 */
export async function handleImageInput(convId: string, imageUrl: string) {
    try {
        console.log(`[ImageProcessor] Processing image for conversation: ${convId}`);

        // 1. RAG Matching: Find similar products via vector search
        const matchedProducts = await matchProductsWithRAG({
            imageUrl,
            limit: 5,
            minSimilarity: 0.7,
        });

        // 2. Vision Analysis: Get descriptive context
        const visionResult = await analyzeProductImage(imageUrl);

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
