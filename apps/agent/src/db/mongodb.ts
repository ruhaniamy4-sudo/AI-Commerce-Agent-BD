import mongoose from 'mongoose';

export async function connectMongo() {
    const uri = process.env.MONGODB_URI as string;

    if (!uri) {
        throw new Error('MONGODB_URI not defined');
    }

    await mongoose.connect(uri);
    console.log('🍃 MongoDB connected');

    // Attempt to drop the problematic unique index if it exists
    try {
        await mongoose.connection.db
            ?.collection('clients')
            .dropIndex('email_1');
        console.log('Deleted old email index');
    } catch (e) {
        // Index might not exist or already be dropped, which is fine
    }
}
