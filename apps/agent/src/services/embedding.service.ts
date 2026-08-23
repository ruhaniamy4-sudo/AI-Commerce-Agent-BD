import dotenv from 'dotenv';
import OpenAI from 'openai';
import axios from 'axios';

dotenv.config();

const openai = new OpenAI({
    apiKey: "",
});


/**
 * Generate text embedding (for standard RAG)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
    try {
        const response = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: text,
            encoding_format: 'float',
        });

        return response.data[0].embedding;
    } catch (error) {
        console.error('Error generating embedding:', error);
        throw error;
    }
}

/**
 * Generate image embedding using OpenAI Vision + Text Embedding
 * Gets detailed description first, then embeds it
 */
export async function generateImageEmbedding(imageUrl: string): Promise<{
    embedding: number[];
    model: string;
}> {
    try {
        console.log(`Generating embedding for image: ${imageUrl}`);

        // Get detailed description using Vision API
        const visionResponse = await openai.chat.completions.create({
            model: 'gpt-4-vision-preview',
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: 'Describe this product in detail for catalog search. Include: category, color, brand, key features, materials, style, and any visible text/logos.',
                        },
                        {
                            type: 'image_url',
                            image_url: { url: imageUrl },
                        },
                    ],
                },
            ],
            max_tokens: 200,
        });

        const description = visionResponse.choices[0]?.message?.content || '';

        // Generate embedding from the description
        const embedding = await generateEmbedding(description);

        return {
            embedding,
            model: 'text-embedding-3-small-via-vision',
        };

    } catch (error: any) {
        console.error('Error generating image embedding:', error);
        throw new Error(`Failed to generate image embedding: ${error.message}`);
    }
}

/**
 * Alternative: Direct CLIP embedding via Hugging Face (better for pure image similarity)
 * Requires HF_API_KEY environment variable
 */
export async function generateCLIPEmbedding(imageUrl: string): Promise<{
    embedding: number[];
    model: string;
}> {
    try {
        const HF_API_KEY = process.env.HF_API_KEY;
        if (!HF_API_KEY) {
            throw new Error('HF_API_KEY not set');
        }

        // Download image as buffer
        const imageResponse = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 10000,
        });
        const imageBuffer = Buffer.from(imageResponse.data);

        // Call Hugging Face CLIP model
        const response = await axios.post(
            'https://api-inference.huggingface.co/models/openai/clip-vit-large-patch14',
            imageBuffer,
            {
                headers: {
                    'Authorization': `Bearer ${HF_API_KEY}`,
                    'Content-Type': 'application/octet-stream',
                },
                timeout: 30000,
            }
        );

        return {
            embedding: response.data,
            model: 'clip-vit-large-patch14',
        };

    } catch (error: any) {
        console.error('CLIP embedding failed:', error.message);
        throw error;
    }
}

/**
 * Generate image embedding using external microservice (FastAPI/Local)
 * Endpoint: http://0.0.0.0:8000/embed_url
 * Returns 512 dimension embedding
 */
export async function generateExternalImageEmbedding(imageUrl: string): Promise<{
    embedding: number[];
    model: string;
}> {
    try {
        const response = await axios.post('http://0.0.0.0:8000/embed_url', {
            url: imageUrl
        }, {
            timeout: 15000
        });

        if (!response.data || !response.data.embedding) {
            throw new Error('Invalid response from external embedding service');
        }

        return {
            embedding: response.data.embedding,
            model: 'external-microservice-512'
        };
    } catch (error: any) {
        console.error('External embedding service failed:', error.message);
        throw error;
    }
}

/**
 * Main function - prioritizes external microservice, falls back to OpenAI Vision
 */
export async function getImageEmbedding(imageUrl: string): Promise<{
    embedding: number[];
    model: string;
}> {
    // 1. Try External Microservice first (User Preferred)
    try {
        return await generateExternalImageEmbedding(imageUrl);
    } catch (error) {
        console.log('External microservice failed, falling back...');
    }

    // 2. Try CLIP if HF key is available
    if (process.env.HF_API_KEY) {
        try {
            return await generateCLIPEmbedding(imageUrl);
        } catch (error) {
            console.log('CLIP failed, falling back to OpenAI Vision');
        }
    }

    // 3. Fallback to OpenAI Vision + Text Embedding
    return await generateImageEmbedding(imageUrl);
}

/**
 * Calculate cosine similarity between two embeddings
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
        throw new Error(`Vector dimension mismatch: ${vecA.length} vs ${vecB.length}`);
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
        return 0;
    }

    return dotProduct / (normA * normB);
}

/**
 * Find most similar products using vector similarity
 * Note: This is in-memory search. For production with large catalogs,
 * use MongoDB Atlas Vector Search for better performance
 */
export async function findSimilarProductsByEmbedding(
    queryEmbedding: number[],
    products: any[],
    limit: number = 5,
    minSimilarity: number = 0.7
): Promise<Array<{ product: any; similarity: number }>> {

    const similarities = products
        .filter(p => p.imageEmbedding && p.imageEmbedding.length > 0)
        .map(product => ({
            product,
            similarity: cosineSimilarity(queryEmbedding, product.imageEmbedding),
        }))
        .filter(item => item.similarity >= minSimilarity) // Only return good matches
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

    console.log(`Found ${similarities.length} similar products (min similarity: ${minSimilarity})`);

    return similarities;
}
