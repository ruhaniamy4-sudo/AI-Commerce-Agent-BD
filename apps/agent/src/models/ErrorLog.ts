import mongoose, { Schema, Document } from 'mongoose';

export interface IErrorLog extends Document {
    type: string;
    message: string;
    stack?: string;
    context: Record<string, any>;
    timestamp: Date;
}

const ErrorLogSchema = new Schema(
    {
        type: { type: String, required: true, index: true },
        message: { type: String, required: true },
        stack: { type: String },
        context: { type: Schema.Types.Mixed, default: {} },
        timestamp: { type: Date, default: Date.now, index: true },
    },
    { timestamps: { createdAt: 'timestamp', updatedAt: false } }
);

export const ErrorLog = mongoose.model<IErrorLog>('ErrorLog', ErrorLogSchema);
