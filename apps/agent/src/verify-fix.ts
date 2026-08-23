import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { SystemPrompt } from './models/SystemPrompt';

dotenv.config();

async function test() {
    try {
        console.log('Connecting to MongoDB...');
        const mongoUri =
            process.env.MONGODB_URI || 'mongodb://localhost:27017/edutechs-ai';
        await mongoose.connect(mongoUri);
        console.log('Connected.');

        console.log('Creating test prompt...');
        const prompt = new SystemPrompt({
            name: 'Verification Test ' + Date.now(),
            content: 'Test content',
            isActive: false,
        });

        console.log('Saving prompt (this should not throw TypeError)...');
        await prompt.save();
        console.log('Successfully saved prompt with ID:', prompt._id);

        // Clean up
        await SystemPrompt.findByIdAndDelete(prompt._id);
        console.log('Cleaned up test prompt.');

        process.exit(0);
    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}

test();
