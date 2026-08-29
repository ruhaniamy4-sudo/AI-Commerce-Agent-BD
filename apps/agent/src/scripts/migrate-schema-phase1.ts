/**
 * Database Migration Script - Phase 1: Non-Breaking Changes
 *
 * This script handles:
 * 1. Adding default values to new optional fields
 * 2. Backfilling denormalized conversation metrics
 * 3. Setting platform fields based on source
 * 4. Initializing soft delete flags
 *
 * Run with: NODE_ENV=production node scripts/migrate-schema-phase1.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Customer } from '../models/Customer';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';
import { Meeting } from '../models/Meeting';
import { initializeScriptTenantContext } from '../tenancy/script-context';

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI;

async function connectDB() {
    try {
        if (!MONGO_URI) throw new Error('MONGODB_URI is required');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
}

async function migrateClients() {
    console.log('\n📊 Migrating Clients...');

    const updateOperations = await Customer.updateMany(
        {},
        {
            $set: {
                // Initialize new fields with defaults if not present
                isActive: true,
                leadScore: 50,
                tags: [],
            },
        }
    );

    console.log(`  ✓ Updated ${updateOperations.modifiedCount} clients with default values`);

    // Update dealStatus for backward compatibility
    const statusMapping = {
        'pending': 'new',
        'called': 'contacted',
        'demo_scheduled': 'demo_scheduled',
        'demo_given': 'demo_completed',
        'in_progress': 'negotiation',
        'signed': 'closed_won',
        'negative': 'closed_lost',
    };

    for (const [oldStatus, newStatus] of Object.entries(statusMapping)) {
        const result = await Customer.updateMany(
            { dealStatus: oldStatus },
            { $set: { dealStatus: newStatus } }
        );
        if (result.modifiedCount > 0) {
            console.log(`  ✓ Mapped ${result.modifiedCount} clients from '${oldStatus}' to '${newStatus}'`);
        }
    }
}

async function migrateConversations() {
    console.log('\n💬 Migrating Conversations...');

    const conversations = await Conversation.find({});
    let updated = 0;

    for (const conv of conversations) {
        // Get message count and last message
        const messages = await Message.find({ conversationId: conv.conversationId })
            .sort({ createdAt: -1 })
            .limit(1);

        const messageCount = await Message.countDocuments({ conversationId: conv.conversationId });
        const lastMessage = messages[0];

        // Determine platform based on source (if linked to customer)
        let platform = 'facebook'; // default
        if (conv.customerId) {
            const client = await Customer.findById(conv.customerId);
            if ((client as any)?.source === 'whatsapp') platform = 'whatsapp';
            else if ((client as any)?.source === 'web-widget') platform = 'web-widget';
        }

        await Conversation.updateOne(
            { _id: conv._id },
            {
                $set: {
                    platform,
                    status: 'active',
                    messageCount,
                    lastMessageAt: lastMessage?.createdAt,
                    lastMessagePreview: lastMessage?.content?.substring(0, 200),
                },
            }
        );
        updated++;
    }

    console.log(`  ✓ Updated ${updated} conversations with denormalized metrics`);
}

async function migrateMeetings() {
    console.log('\n📅 Migrating Meetings...');

    // Convert string customerIds to ObjectIds
    const meetings = await Meeting.find({ customerId: { $type: 'string' } });
    let converted = 0;

    for (const meeting of meetings) {
        try {
            // Try to find matching customer
            const clientIdStr = meeting.customerId as unknown as string;
            const client = await Customer.findOne({
                $or: [
                    { _id: new mongoose.Types.ObjectId(clientIdStr) },
                    { email: clientIdStr },
                    { phone: clientIdStr },
                ],
            });

            if (client) {
                await Meeting.updateOne(
                    { _id: meeting._id },
                    {
                        $set: {
                            customerId: client._id,
                            timezone: 'Asia/Dhaka',
                            meetingType: 'video',
                        },
                    }
                );
                converted++;
            } else {
                console.warn(`  ⚠️  Could not find customer for meeting ${meeting._id} with customerId: ${clientIdStr}`);
            }
        } catch (error) {
            console.error(`  ❌ Error converting meeting ${meeting._id}:`, error);
        }
    }

    console.log(`  ✓ Converted ${converted} meeting customerIds from String to ObjectId`);
}

async function createIndexes() {
    console.log('\n🔍 Creating Indexes...');

    try {
        await Customer.createIndexes();
        console.log('  ✓ Created Customer indexes');

        await Conversation.createIndexes();
        console.log('  ✓ Created Conversation indexes');

        await Message.createIndexes();
        console.log('  ✓ Created Message indexes');

        await Meeting.createIndexes();
        console.log('  ✓ Created Meeting indexes');
    } catch (error) {
        console.error('  ❌ Error creating indexes:', error);
    }
}

async function main() {
    console.log('🚀 Starting Schema Migration - Phase 1\n');
    console.log('⚠️  This will modify your database. Ensure you have a backup!\n');

        await connectDB();
        await initializeScriptTenantContext();

    try {
        await migrateClients();
        await migrateConversations();
        await migrateMeetings();
        await createIndexes();

        console.log('\n✅ Migration completed successfully!');
        console.log('\n📝 Next Steps:');
        console.log('  1. Verify the changes in your database');
        console.log('  2. Update frontend TypeScript interfaces');
        console.log('  3. Deploy updated backend code');
        console.log('  4. Run Phase 2 migration for breaking changes\n');
    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Run migration
if (require.main === module) {
    main();
}

export { main as runMigration };
