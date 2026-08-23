import mongoose, { Document, Schema } from 'mongoose';

export interface IMeeting extends Document {
    customerId: mongoose.Types.ObjectId | string;
    title: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    status: 'scheduled' | 'completed' | 'cancelled';
    location?: string;
    googleCalendarEventId?: string;
    timezone?: string;
    meetingType?: 'video' | 'phone' | 'in_person';
    createdAt: Date;
    updatedAt: Date;
}

const MeetingSchema = new Schema(
    {
        customerId: { type: Schema.Types.Mixed, ref: 'Customer', required: true, index: true },
        title: { type: String, required: true, trim: true },
        description: { type: String },
        startTime: { type: Date, required: true, index: true },
        endTime: { type: Date, required: true },
        status: {
            type: String,
            enum: ['scheduled', 'completed', 'cancelled'],
            default: 'scheduled',
            index: true,
        },
        location: { type: String },
        googleCalendarEventId: { type: String, index: true, sparse: true },
        timezone: { type: String, default: 'Asia/Dhaka' },
        meetingType: {
            type: String,
            enum: ['video', 'phone', 'in_person'],
            default: 'video',
        },
    },
    { timestamps: true }
);

MeetingSchema.index({ startTime: 1, endTime: 1, status: 1 });

export const Meeting = mongoose.model<IMeeting>('Meeting', MeetingSchema);
