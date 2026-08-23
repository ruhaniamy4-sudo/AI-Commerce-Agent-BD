import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Product } from '../models/Product';
import { getImageEmbedding } from '../services/embedding.service';

dotenv.config();

/**
 * Script to generate embeddings for all existing products that don't have them
 */
async function runBatchEmbedding() {
    try {
        console.log('Starting batch embedding for products...');

        // Connect to MongoDB
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/edutechs';
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        // Find ALL products with images to re-embed with the new model
        const products = await Product.find({
            images: { $exists: true, $not: { $size: 0 } }
        });

        console.log(`Found ${products.length} products to embed`);

        for (const product of products) {
            try {
                const imageUrl = product.images[0];
                if (!imageUrl) continue;

                console.log(`Processing product: ${product.name} (${product._id}) with ${product.images.length} images`);

                const embeddingPromises = product.images.map(url => getImageEmbedding(url));
                const results = await Promise.all(embeddingPromises);

                const imageEmbeddings = results.map((res, index) => ({
                    url: product.images[index],
                    embedding: res.embedding,
                    model: res.model,
                    updatedAt: new Date()
                }));

                await Product.updateOne(
                    { _id: product._id },
                    {
                        $set: {
                            imageEmbeddings: imageEmbeddings,
                            // Backwards compatibility
                            imageEmbedding: results[0].embedding,
                            imageEmbeddingModel: results[0].model,
                            lastEmbeddingUpdate: new Date()
                        }
                    }
                );

                console.log(`Successfully embedded ${product.name}`);

                // Sleep briefly to avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 500));

            } catch (error: any) {
                console.error(`Failed to embed product ${product.name}:`, error.message);
            }
        }

        console.log('Batch embedding complete!');
        process.exit(0);

    } catch (error) {
        console.error('Error in batch embedding:', error);
        process.exit(1);
    }
}

// Check if running directly
if (require.main === module) {
    runBatchEmbedding();
}

export { runBatchEmbedding };
