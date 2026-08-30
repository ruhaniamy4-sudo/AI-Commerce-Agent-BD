import { Product } from '../models/Product';
import { getImageEmbedding, findSimilarProductsByEmbedding, cosineSimilarity } from './embedding.service';
import { assertTenantBusinessId } from '../tenancy/context';
import { getRagTopK } from './ai-config';

export interface ProductMatchParams {
    businessId: string;
    imageUrl?: string; // Customer's image
    imageEmbedding?: number[]; // Pre-computed embedding
    textQuery?: string; // Optional text from customer
    category?: string;
    features?: string[];
    limit?: number;
    minSimilarity?: number;
    conversationId?: string;
    eventIdentifier?: string;
}

/**
 * RAG-based product matching using vector similarity
 * Primary method: Image embedding similarity
 * Secondary: Text search for refinement
 */
export async function matchProductsWithRAG(params: ProductMatchParams) {
    assertTenantBusinessId(params.businessId, 'products.matchWithRag');
    const {
        imageUrl,
        imageEmbedding: providedEmbedd,
        textQuery,
        category,
        limit = getRagTopK(),
        minSimilarity = 0.7,
    } = params;

    try {
        // Step 1: Get or generate image embedding
        let queryEmbedding = providedEmbedd;

        if (!queryEmbedding && imageUrl) {
            console.log('Generating embedding for customer image...');
            const result = await getImageEmbedding(imageUrl,
                params.conversationId && params.eventIdentifier
                    ? { conversationId: params.conversationId, eventIdentifier: params.eventIdentifier }
                    : undefined
            );
            queryEmbedding = result.embedding;
        }

        if (!queryEmbedding) {
            throw new Error('No image embedding available for matching');
        }

        // Step 2: Fetch products with embeddings (active products only)
        const query: any = {
            isActive: true,
            $or: [
                { imageEmbedding: { $exists: true, $ne: [] } },
                { imageEmbeddings: { $elemMatch: { embedding: { $exists: true, $ne: [] } } } },
            ],
        };

        // Optional category filter
        if (category && category !== 'unknown') {
            const categoryRegex = new RegExp(category, 'i');
            query.$or = [
                { 'categoryId': categoryRegex },
                { 'name': categoryRegex },
            ];
        }

        const products = await Product.find(query)
            .select('_id name basePrice images imageEmbedding imageEmbeddings category description')
            .limit(Math.max(limit * 20, 50))
            .lean();

        console.log(`Searching ${products.length} products with embeddings`);

        // Step 3: Vector similarity search across all image embeddings
        const productsWithMaxSim = products.map(product => {
            let maxSim = 0;

            // Check primary embedding
            if (product.imageEmbedding && product.imageEmbedding.length > 0) {
                maxSim = cosineSimilarity(queryEmbedding!, product.imageEmbedding);
            }

            // Check all other embeddings in the array
            if (product.imageEmbeddings && product.imageEmbeddings.length > 0) {
                product.imageEmbeddings.forEach((ie: any) => {
                    if (ie.embedding && ie.embedding.length > 0) {
                        const sim = cosineSimilarity(queryEmbedding!, ie.embedding);
                        if (sim > maxSim) maxSim = sim;
                    }
                });
            }

            return { product, similarity: maxSim };
        });

        const similarProducts = productsWithMaxSim
            .filter(item => item.similarity >= minSimilarity)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit * 2);

        // Step 4: Optional text query refinement
        let finalResults = similarProducts;

        if (textQuery && textQuery.length > 2) {
            // Re-rank based on text match in name/description
            const textQueryLower = textQuery.toLowerCase();
            finalResults = similarProducts.map(item => {
                const nameMatch = item.product.name.toLowerCase().includes(textQueryLower);
                const descMatch = item.product.description?.toLowerCase().includes(textQueryLower);

                // Boost similarity score if text matches
                const textBoost = (nameMatch ? 0.1 : 0) + (descMatch ? 0.05 : 0);

                return {
                    ...item,
                    similarity: Math.min(1.0, item.similarity + textBoost),
                };
            }).sort((a, b) => b.similarity - a.similarity);
        }

        // Return top N
        const topMatches = finalResults.slice(0, limit);

        console.log(`Matched ${topMatches.length} products:`,
            topMatches.map(m => ({ name: m.product.name, sim: m.similarity.toFixed(3) }))
        );

        return topMatches.map(m => ({ ...m.product, matchConfidence: m.similarity }));

    } catch (error) {
        console.error('Error in RAG product matching:', error);

        // Failing closed prevents an unrelated recent product from being presented
        // as an image match when the embedding provider is unavailable.
        return [];
    }
}

/**
 * Legacy text-based matching (fallback)
 */
export async function matchProductsWithImageContext(params: any) {
    assertTenantBusinessId(params.businessId, 'products.matchWithImageContext');
    const {
        imageDescription,
        textQuery,
        category,
        features = [],
        limit = getRagTopK(),
    } = params;

    try {
        const query: any = { isActive: true };

        // Combine search terms
        const searchTerms = [
            imageDescription,
            textQuery,
            ...(features || []),
        ].filter(Boolean).join(' ');

        if (searchTerms) {
            query.$text = { $search: searchTerms };
        }

        if (category && category !== 'unknown') {
            const categoryRegex = new RegExp(category, 'i');
            query.$or = [
                { 'category': categoryRegex },
                { 'name': categoryRegex },
                { 'description': categoryRegex },
            ];
        }

        const products = await Product.find(
            query,
            searchTerms ? { score: { $meta: 'textScore' } } : {}
        )
            .sort(searchTerms ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
            .limit(limit)
            .lean();

        return products;

    } catch (error) {
        console.error('Error matching products:', error);
        return await Product.find({ isActive: true })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();
    }
}

/**
 * Format products for AI agent response
 */
export function formatProductsForResponse(products: any[]): string {
    if (products.length === 0) {
        return 'No matching products found.';
    }

    return products
        .map((p, i) => {
            const price = p.basePrice?.toLocaleString() || 'Contact for price';
            return `${i + 1}. ${p.name} - ৳${price}`;
        })
        .join('\n');
}
