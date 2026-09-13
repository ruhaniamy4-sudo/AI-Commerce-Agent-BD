import { ChatOpenAI } from "@langchain/openai";
import { loadEnv } from '../config/env';
import { getAIConfiguration } from '../config/runtime';

loadEnv();

const aiConfig = getAIConfiguration();
export const llm = new ChatOpenAI({
    model: aiConfig.model,
    temperature: 0,
    apiKey: aiConfig.apiKey,
    configuration: aiConfig.baseURL ? { baseURL: aiConfig.baseURL } : undefined,
});
