import { AgentState } from '../agent/state';
import { SystemConfig } from '../models/SystemConfig';

let currentAgentStatus: AgentState['agentStatus'] = 'active';
let lastHumanActivityTime: number = Date.now();
let isInitialized = false;

const AGENT_STATUS_KEY = 'agent_status';

const initializeStatus = async () => {
    if (isInitialized) return;
    try {
        const config = await SystemConfig.findOne({ key: AGENT_STATUS_KEY });
        if (config) {
            currentAgentStatus = config.value as AgentState['agentStatus'];
        } else {
            // Default to stopped if not set, or keep active if you prefer
            await SystemConfig.create({
                key: AGENT_STATUS_KEY,
                value: currentAgentStatus,
            });
        }
        isInitialized = true;
    } catch (error) {
        console.error('Error initializing agent status from DB:', error);
    }
};

export const startAgent = async () => {
    currentAgentStatus = 'active';
    await SystemConfig.findOneAndUpdate(
        { key: AGENT_STATUS_KEY },
        { value: 'active' },
        { upsert: true }
    );
    console.log('Agent started and persisted.');
    return 'active';
};

export const stopAgent = async () => {
    currentAgentStatus = 'stopped';
    await SystemConfig.findOneAndUpdate(
        { key: AGENT_STATUS_KEY },
        { value: 'stopped' },
        { upsert: true }
    );
    console.log('Agent stopped and persisted.');
    return 'stopped';
};

export const getAgentStatus = async (): Promise<AgentState['agentStatus']> => {
    if (!isInitialized) {
        await initializeStatus();
    }
    return currentAgentStatus;
};

export const updateLastHumanActivity = async () => {
    lastHumanActivityTime = Date.now();
    // Usually we don't need to persist this as it's very frequent,
    // but we could if needed.
};

export const getLastHumanActivity = async (): Promise<number> => {
    return lastHumanActivityTime;
};
