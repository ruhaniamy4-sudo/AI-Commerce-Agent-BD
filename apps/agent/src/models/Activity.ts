import mongoose, { Schema } from 'mongoose';

const ActivitySchema = new Schema(
    {
        // Entity Reference
        entityType: {
            type: String,
            required: true,
            enum: ['customer', 'conversation', 'meeting', 'note'],
            index: true,
        },
        entityId: { type: Schema.Types.ObjectId, required: true, index: true },

        // Action Details
        action: {
            type: String,
            required: true,
            enum: [
                'created',
                'updated',
                'deleted',
                'status_changed',
                'assigned',
                'contacted',
                'email_sent',
                'call_made',
                'meeting_scheduled',
                'meeting_completed',
                'deal_won',
                'deal_lost',
            ],
            index: true,
        },

        // Actor
        performedBy: { type: String, required: true }, // User ID or 'system'
        performedByName: { type: String }, // Human-readable name

        // Change Tracking
        changes: [
            {
                field: { type: String },
                oldValue: { type: Schema.Types.Mixed },
                newValue: { type: Schema.Types.Mixed },
            },
        ],

        // Additional Context
        description: { type: String }, // Human-readable description
        metadata: { type: Schema.Types.Mixed }, // Flexible field for extra data
    },
    { timestamps: { createdAt: true, updatedAt: false } } // Only track creation
);

// Compound Indexes
ActivitySchema.index({ entityType: 1, entityId: 1, createdAt: -1 }); // Entity timeline
ActivitySchema.index({ performedBy: 1, createdAt: -1 }); // User activity log
ActivitySchema.index({ action: 1, createdAt: -1 }); // Action-based queries

export const Activity = mongoose.model('Activity', ActivitySchema);
