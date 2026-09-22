import mongoose, { Document, Schema } from 'mongoose';

export const ANNOUNCEMENT_SEVERITIES = ['info', 'success', 'warning', 'critical'] as const;
export const ANNOUNCEMENT_AUDIENCES = ['all', 'plan', 'status', 'business'] as const;
export const ANNOUNCEMENT_STATUSES = ['draft', 'scheduled', 'published', 'expired'] as const;

export interface IPlatformAnnouncement extends Document {
    title: string;
    body: string;
    severity: typeof ANNOUNCEMENT_SEVERITIES[number];
    /** `all` reaches every workspace; the rest read the matching target field below. */
    audience: typeof ANNOUNCEMENT_AUDIENCES[number];
    planSlugs: string[];
    subscriptionStatuses: string[];
    businessIds: mongoose.Types.ObjectId[];
    status: typeof ANNOUNCEMENT_STATUSES[number];
    dismissible: boolean;
    emailDelivery: boolean;
    startsAt?: Date;
    endsAt?: Date;
    publishedAt?: Date;
    createdBy: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const PlatformAnnouncementSchema = new Schema<IPlatformAnnouncement>({
    title: { type: String, required: true, trim: true, maxlength: 140 },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    severity: { type: String, enum: [...ANNOUNCEMENT_SEVERITIES], default: 'info' },
    audience: { type: String, enum: [...ANNOUNCEMENT_AUDIENCES], default: 'all' },
    planSlugs: { type: [String], default: [] },
    subscriptionStatuses: { type: [String], default: [] },
    businessIds: { type: [Schema.Types.ObjectId], ref: 'Business', default: [] },
    status: { type: String, enum: [...ANNOUNCEMENT_STATUSES], default: 'draft', index: true },
    dismissible: { type: Boolean, default: true },
    emailDelivery: { type: Boolean, default: false },
    startsAt: Date,
    endsAt: Date,
    publishedAt: Date,
    createdBy: { type: Schema.Types.ObjectId, ref: 'PlatformAdmin', required: true },
}, { timestamps: true });

// The merchant-facing read filters on status and window on every dashboard load.
PlatformAnnouncementSchema.index({ status: 1, startsAt: 1, endsAt: 1 });
export const PlatformAnnouncement = mongoose.model<IPlatformAnnouncement>('PlatformAnnouncement', PlatformAnnouncementSchema);
