import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectMongo } from '../db/mongodb';
import { hashPassword } from '../auth/password';
import { Business } from '../models/Business';
import { BusinessChannel } from '../models/BusinessChannel';
import { BusinessMember } from '../models/BusinessMember';
import { User } from '../models/User';
import { Category } from '../models/Category';
import { Conversation } from '../models/Conversation';
import { Customer } from '../models/Customer';
import { Knowledge } from '../models/Knowledge';
import { Message } from '../models/Message';
import { Order } from '../models/Order';
import { Product } from '../models/Product';
import { WebhookEvent } from '../models/WebhookEvent';
import { AIUsage } from '../models/AIUsage';
import { repairLanguageNeutralTextIndexes } from '../db/text-index-migration';
import { repairSetupQuestionUniqueIndex } from '../db/setup-question-index-migration';
import { PASSWORD_MIN_LENGTH } from '@edutechs/shared';
import { AuthSession } from '../models/AuthSession';
import { AuthActionToken } from '../models/AuthActionToken';

dotenv.config();

const tenantModels = [AIUsage, Category, Conversation, Customer, Knowledge, Message, Order, Product, WebhookEvent];

async function dropLegacyGlobalUniqueIndexes() {
    const legacyIndexes: Record<string, string[]> = {
        categories: ['slug_1'],
        conversations: ['conversationId_1'],
        customers: ['psid_1'],
        orders: ['orderNumber_1', 'invoiceNumber_1'],
        products: ['slug_1', 'variants.sku_1'],
        webhookevents: ['eventId_1'],
    };

    for (const [collectionName, names] of Object.entries(legacyIndexes)) {
        const collection = mongoose.connection.collection(collectionName);
        const existing = await collection.indexes().catch(() => []);
        for (const name of names) {
            if (existing.some((index) => index.name === name)) await collection.dropIndex(name);
        }
    }
}

async function main() {
    const ownerEmail = process.env.BOOTSTRAP_OWNER_EMAIL?.toLowerCase();
    const ownerPassword = process.env.BOOTSTRAP_OWNER_PASSWORD;
    if (!ownerEmail || !ownerPassword) {
        throw new Error('BOOTSTRAP_OWNER_EMAIL and BOOTSTRAP_OWNER_PASSWORD are required');
    }
    if (ownerPassword.length < PASSWORD_MIN_LENGTH) {
        throw new Error(`BOOTSTRAP_OWNER_PASSWORD must be at least ${PASSWORD_MIN_LENGTH} characters`);
    }

    // Migrations must inspect and replace incompatible legacy indexes before
    // Mongoose attempts schema-driven index creation in the background.
    mongoose.set('autoIndex', false);
    await connectMongo();

    const business = await Business.findOneAndUpdate(
        { slug: process.env.DEFAULT_BUSINESS_SLUG || 'default-business' },
        {
            $setOnInsert: {
                name: process.env.DEFAULT_BUSINESS_NAME || 'Default Business',
                status: 'active',
            },
        },
        { upsert: true, new: true, runValidators: true }
    );

    let user = await User.findOne({ email: ownerEmail }).select('+passwordHash');
    if (!user) {
        user = await User.create({
            name: process.env.BOOTSTRAP_OWNER_NAME || 'Business Owner',
            email: ownerEmail,
            passwordHash: await hashPassword(ownerPassword),
            status: 'active',
            emailVerified: true,
            emailVerifiedAt: new Date(),
            emailVerificationMethod: 'bootstrap',
        });
    }

    await User.updateOne(
        { _id: user._id, emailVerified: { $ne: true } },
        { $set: { emailVerified: true, emailVerifiedAt: new Date(), emailVerificationMethod: 'bootstrap' } }
    );
    await User.collection.updateMany(
        { emailVerified: true, emailVerifiedAt: null },
        [{ $set: { emailVerifiedAt: { $ifNull: ['$updatedAt', '$createdAt'] }, emailVerificationMethod: { $ifNull: ['$emailVerificationMethod', 'legacy'] } } }]
    );

    await BusinessMember.updateOne(
        { businessId: business._id, userId: user._id },
        { $set: { role: 'Owner', status: 'active' } },
        { upsert: true }
    );

    await BusinessChannel.updateOne(
        { platform: 'web', externalId: process.env.DEFAULT_WEB_CHANNEL_ID || 'storefront' },
        { $set: { businessId: business._id, name: 'Storefront', status: 'active' } },
        { upsert: true }
    );

    for (const model of tenantModels) {
        const result = await model.collection.updateMany(
            { businessId: { $exists: false } },
            { $set: { businessId: business._id } }
        );
        console.log(`${model.modelName}: backfilled ${result.modifiedCount}`);
    }

    await Conversation.collection.updateMany(
        { controlMode: { $exists: false } },
        [{
            $set: {
                controlMode: {
                    $cond: [
                        { $or: [{ $eq: ['$aiEnabled', false] }, { $eq: ['$needsHumanHandoff', true] }] },
                        'HUMAN_ACTIVE',
                        'AI_ACTIVE',
                    ],
                },
                summarizedMessageCount: { $ifNull: ['$summarizedMessageCount', 0] },
            },
        }]
    );

    await dropLegacyGlobalUniqueIndexes();
    await repairLanguageNeutralTextIndexes(mongoose.connection);
    const setupQuestionIndex = await repairSetupQuestionUniqueIndex(mongoose.connection);
    console.log(
        `Knowledge setup-question audit: ${setupQuestionIndex.legacyMissingCount} missing, `
        + `${setupQuestionIndex.legacyNullCount} explicit null, `
        + `${setupQuestionIndex.duplicateGroupCount} real duplicate group(s), `
        + `${setupQuestionIndex.reconciledRecordCount} record(s) reconciled`
    );
    for (const model of tenantModels) await model.createIndexes();
    for (const model of [User, BusinessMember, AuthSession, AuthActionToken]) await model.createIndexes();

    console.log(`Tenancy migration complete for ${business.name} (${business._id})`);
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => mongoose.disconnect());
