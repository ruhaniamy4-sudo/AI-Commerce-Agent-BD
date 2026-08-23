import dotenv from 'dotenv';
import { connectMongo } from '../db/mongodb';
import { Knowledge } from '../models/Knowledge';
import { generateEmbedding } from '../services/embedding.service';

dotenv.config();

const trainingData = [
    {
        query: 'What is Edutechs?',
        answer: 'Edutechs is a modern EdTech platform designed to help institutions manage classrooms, students, payments, and communication digitally.',
    },

];

async function train() {
    try {
        console.log('Connecting to MongoDB...');
        await connectMongo();

        console.log(`Starting training with ${trainingData.length} items...`);

        for (const item of trainingData) {
            console.log(`Processing: ${item.query}`);

            // Generate embedding for the query
            const embedding = await generateEmbedding(item.query);

            // Upsert into database
            await Knowledge.findOneAndUpdate(
                { query: item.query },
                {
                    query: item.query,
                    answer: item.answer,
                    embedding: embedding,
                },
                { upsert: true, new: true }
            );
        }

        console.log('🎉 RAG Training completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Training failed:', error);
        process.exit(1);
    }
}

train();
