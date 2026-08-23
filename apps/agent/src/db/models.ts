import mongoose, { Schema } from "mongoose";

const ConversationSchema = new Schema(
    {
        conversationId: { type: String, required: true, unique: true },
    },
    { timestamps: true }
);

export const Conversation = mongoose.model(
    "Conversation",
    ConversationSchema
);
