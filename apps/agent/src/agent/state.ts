import { BaseMessage } from "@langchain/core/messages";

export interface AgentState {
    conversationId: string;
    agentStatus: "active" | "paused" | "stopped";
    lastHumanActivity: number;
    messages: BaseMessage[];
    psid?: string;
}
