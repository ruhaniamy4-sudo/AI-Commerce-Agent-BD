import OpenAI from 'openai';
import { recordAIUsage } from './ai-usage.service';
import { getAIMaxOutputTokens } from './ai-config';

const getOpenAI = () => {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured');
    return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
};

async function recordUsageSafely(params: Parameters<typeof recordAIUsage>[0]) {
    try {
        await recordAIUsage(params);
    } catch (error) {
        console.error('Failed to record vision usage:', error);
    }
}

export interface VisionAnalysisResult {
    description: string;
    category?: string;
    colors?: string[];
    features?: string[];
    confidence: number;
}

/**
 * Analyzes a product image using OpenAI Vision API
 * Extracts category, features, colors, and provides description
 */
export async function analyzeProductImage(
    imageUrl: string,
    usageContext?: { conversationId: string; eventIdentifier: string }
): Promise<VisionAnalysisResult> {
    try {
        console.log(`Analyzing product image: ${imageUrl}`);

        const model = process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini';
        const response = await getOpenAI().chat.completions.create({
            model,
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: `Analyze this product image and extract the following information in JSON format:
{
  "description": "A detailed description of the product",
  "category": "Product category (electronics, clothing, accessories, etc.)",
  "colors": ["List of visible colors"],
  "features": ["List of notable features like 'wireless', 'USB-C', 'touchscreen', etc."],
  "brand": "Brand name if visible",
  "condition": "new or used based on appearance"
}

Focus on details that would help match this to an e-commerce product catalog.`,
                        },
                        {
                            type: 'image_url',
                            image_url: {
                                url: imageUrl,
                            },
                        },
                    ],
                },
            ],
            max_tokens: Math.min(300, getAIMaxOutputTokens()),
        });
        if (usageContext) await recordUsageSafely({
            ...usageContext,
            eventIdentifier: `${usageContext.eventIdentifier}:image-analysis`,
            operationType: 'vision',
            model,
            response,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('Empty response from Vision API');
        }

        // Parse the JSON response
        let parsedData: any;
        try {
            // Clean up markdown code blocks if present
            const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
            parsedData = JSON.parse(cleanContent);
        } catch (parseError) {
            console.warn('Failed to parse Vision API JSON, using raw text');
            parsedData = {
                description: content,
                category: 'unknown',
            };
        }

        const result: VisionAnalysisResult = {
            description: parsedData.description || 'Product image',
            category: parsedData.category?.toLowerCase(),
            colors: parsedData.colors || [],
            features: [
                ...(parsedData.features || []),
                parsedData.brand ? `brand:${parsedData.brand}` : null,
                parsedData.condition ? `condition:${parsedData.condition}` : null,
            ].filter(Boolean) as string[],
            confidence: response.choices[0]?.finish_reason === 'stop' ? 0.8 : 0.5,
        };

        console.log('Vision analysis result:', result);
        return result;

    } catch (error: any) {
        console.error('Error analyzing product image:', error);

        // Graceful fallback
        return {
            description: 'Unable to analyze image, but I can see you shared a product photo',
            confidence: 0,
        };
    }
}

/**
 * Check if image context is still valid (not expired)
 */
export function isImageContextValid(expiresAt?: Date): boolean {
    if (!expiresAt) return false;
    return new Date() < expiresAt;
}

/**
 * Create image context object with expiration
 */
export function createImageContext(
    url: string,
    analysis: VisionAnalysisResult,
    matchedProductIds: string[] = []
) {
    const ttlMinutes = parseInt(process.env.IMAGE_CONTEXT_TTL_MINUTES || '10', 10);
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    return {
        url,
        timestamp: new Date(),
        aiDescription: analysis.description,
        category: analysis.category,
        features: analysis.features || [],
        matchedProducts: matchedProductIds,
        expiresAt,
    };
}
