import { BaseMessage } from "@langchain/core/messages";

export interface AgentState {
    businessId: string;
    eventIdentifier: string;
    conversationId: string;
    agentStatus: "active" | "paused" | "stopped";
    lastHumanActivity: number;
    messages: BaseMessage[];
    psid?: string;
}
