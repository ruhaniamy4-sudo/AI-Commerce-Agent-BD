import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const envPath = path.join(root, 'apps', 'agent', '.env');
if (fs.existsSync(envPath)) for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/); if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
}
const promptSource = fs.readFileSync(path.join(root, 'apps', 'agent', 'src', 'agent', 'prompts.ts'), 'utf8');
const systemPrompt = promptSource.match(/`([\s\S]*)`/)?.[1] || '';
const provider = String(process.env.AI_PROVIDER || 'groq').toLowerCase();
const apiKey = provider === 'openai' ? process.env.OPENAI_API_KEY : process.env.GROQ_API_KEY;
const model = provider === 'openai' ? process.env.OPENAI_MODEL || 'gpt-5.2' : process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const endpoint = provider === 'openai' ? 'https://api.openai.com/v1/chat/completions' : 'https://api.groq.com/openai/v1/chat/completions';
if (!apiKey) throw new Error(`${provider} API key is unavailable`);

const scenarios = [
    { message: 'Zeblaze Vibe 7 Pro er price koto?', mode: 'zero_llm' }, { message: 'picture deo', mode: 'zero_llm' },
    { message: 'stock ache?', mode: 'zero_llm' }, { message: '5000 er moddhe smartwatch dekhaw', mode: 'zero_llm' },
    { message: 'egular moddhe konta better?', mode: 'llm', maxTokens: 300, context: { products: [{ name:'Zeblaze Vibe 7 Pro',price:4990,stock:4,key_facts:['battery 400mAh']},{name:'Haylou Solar Pro',price:4790,stock:6,key_facts:['AMOLED display']}] } },
    { message: 'delivery charge koto?', mode: 'zero_llm' },
    { message: 'Return policy exception ta explain koren', mode: 'llm', maxTokens: 160, context: { knowledge:[{ title:'Returns',content:'Confirmed returns are accepted within 7 days when unused; exceptions require staff review.' }] } },
    { message: 'SSC 27 science batch fee?', mode: 'zero_llm' },
    { message: 'Canada student visa eligibility/process ki?', mode: 'llm', maxTokens: 500, context: { knowledge:[{ title:'Canada student visa process',content:'Explain only the confirmed general steps and documents. Eligibility and outcomes require consultant review.' }] } },
];
const rows=[];
for (const scenario of scenarios) {
    if (scenario.mode === 'zero_llm') { rows.push({ message:scenario.message, mode:scenario.mode, inputTokens:0, outputTokens:0, totalTokens:0 }); continue; }
    const response = await fetch(endpoint, { method:'POST', headers:{ Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json' }, body:JSON.stringify({ model, temperature:0, max_tokens:scenario.maxTokens, messages:[{role:'system',content:systemPrompt},{role:'system',content:`Runtime: concise Banglish; tenant facts: ${JSON.stringify(scenario.context)}`},{role:'user',content:scenario.message}] }) });
    if (!response.ok) throw new Error(`Provider benchmark failed (${response.status}): ${(await response.text()).slice(0,300)}`);
    const result=await response.json(); const usage=result.usage||{};
    rows.push({ message:scenario.message, mode:scenario.mode, inputTokens:usage.prompt_tokens??usage.input_tokens??null, outputTokens:usage.completion_tokens??usage.output_tokens??null, totalTokens:usage.total_tokens??null });
}
const total=(key)=>rows.reduce((sum,row)=>sum+(row[key]||0),0); const totalTokens=total('totalTokens');
console.log(JSON.stringify({ measuredAt:new Date().toISOString(),provider,model,baseline:{replies:9,totalTokens:29497,averageTokensPerReply:3277},optimized:{replies:9,llmCalls:rows.filter(row=>row.mode==='llm').length,zeroLlmReplies:rows.filter(row=>row.mode==='zero_llm').length,inputTokens:total('inputTokens'),outputTokens:total('outputTokens'),totalTokens,averageTokensPerReply:Math.round(totalTokens/9)},rows },null,2));
