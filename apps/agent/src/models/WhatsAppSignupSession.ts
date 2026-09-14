import mongoose, { Schema } from 'mongoose';

/**
 * Embedded Signup hands back one business token that covers every number on the
 * WhatsApp Business Account. When that account holds more than one number the
 * merchant still has to choose, so the token is parked here for the few seconds
 * that choice takes — encrypted, scoped to one user, and expired by Mongo itself.
 */
const WhatsAppSignupSessionSchema = new Schema({
    businessId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    status: { type: String, enum: ['NUMBERS_READY', 'COMPLETED', 'FAILED'], default: 'NUMBERS_READY' },
    wabaId: { type: String, required: true },
    wabaName: String,
    coexistence: { type: Boolean, default: false },
    encryptedAccessToken: { type: String, select: false },
    numbers: [{
        choiceId: String,
        phoneNumberId: String,
        displayPhoneNumber: String,
        verifiedName: String,
        qualityRating: String,
        platformType: String,
        codeVerificationStatus: String,
    }],
    errorCode: String,
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
}, { timestamps: true });

WhatsAppSignupSessionSchema.index({ businessId: 1, userId: 1, createdAt: -1 });

export const WhatsAppSignupSession = mongoose.model('WhatsAppSignupSession', WhatsAppSignupSessionSchema);
