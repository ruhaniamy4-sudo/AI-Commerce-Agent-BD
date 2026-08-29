import { ChatOpenAI } from "@langchain/openai";
import * as dotenv from "dotenv";
import { getAIConfiguration } from '../config/runtime';

dotenv.config();

const aiConfig = getAIConfiguration();
export const llm = new ChatOpenAI({
    model: aiConfig.model,
    temperature: 0,
    apiKey: aiConfig.apiKey,
    configuration: aiConfig.baseURL ? { baseURL: aiConfig.baseURL } : undefined,
});
