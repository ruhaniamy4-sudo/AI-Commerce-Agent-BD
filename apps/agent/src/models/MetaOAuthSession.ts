import mongoose, { Schema } from 'mongoose';

const MetaOAuthSessionSchema = new Schema({
    businessId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    nonce: { type: String, required: true },
    status: { type: String, enum: ['CONNECTING','PAGES_READY','COMPLETED','FAILED'], default: 'CONNECTING' },
    metaUserId: String,
    pages: [{ choiceId: String, pageId: String, name: String, picture: String, category: String, permissions: [String], encryptedAccessToken: { type: String, select: false } }],
    errorCode: String,
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
}, { timestamps: true });

MetaOAuthSessionSchema.index({ businessId: 1, userId: 1, createdAt: -1 });

export const MetaOAuthSession = mongoose.model('MetaOAuthSession', MetaOAuthSessionSchema);
