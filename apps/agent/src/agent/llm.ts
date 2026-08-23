import { ChatOpenAI } from "@langchain/openai";
import * as dotenv from "dotenv";

dotenv.config();

export const llm = new ChatOpenAI({
    model: "gpt-5.2",
    temperature: 0,
    apiKey: process.env.OPENAI_API_KEY,
});
