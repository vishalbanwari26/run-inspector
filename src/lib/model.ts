// One place that talks to a model provider. Groq speaks the OpenAI chat
// completions format, so another OpenAI-compatible provider is a base URL away.
import { loadEnv } from './env';

export type ToolDef = { name: string; description: string; parameters: Record<string, unknown> };
export type ModelToolCall = { id: string; name: string; args: Record<string, unknown> };
export type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string; tool_calls?: unknown[] }
  | { role: 'tool'; tool_call_id: string; content: string };
export type ChatRequest = { model: string; messages: ChatMessage[]; tools: ToolDef[] };
export type ChatReply = { content: string; toolCalls: ModelToolCall[]; rawToolCalls: unknown[]; ms: number };
export type ChatFn = (req: ChatRequest) => Promise<ChatReply>;

const BASE_URL = 'https://api.groq.com/openai/v1/chat/completions';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const groqChat: ChatFn = async (req) => {
  loadEnv();
  const key = process.env['GROQ_API_KEY'];
  if (!key) throw new Error('GROQ_API_KEY is not set');
  const body = {
    model: req.model,
    temperature: 0,
    // gpt-oss models think before answering; low effort keeps runs under the token limit.
    ...(req.model.startsWith('openai/gpt-oss') && { reasoning_effort: 'low' }),
    messages: req.messages,
    ...(req.tools.length > 0 && {
      tools: req.tools.map((t) => ({ type: 'function', function: t })),
    }),
  };
  for (let attempt = 1; ; attempt++) {
    const started = Date.now();
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if ((res.status === 429 || res.status >= 500) && attempt < 6) {
      const wait = Number(res.headers.get('retry-after')) * 1000 || 5000 * attempt;
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`model call failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as {
      choices: { message: { content: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } }[];
    };
    const msg = data.choices[0]?.message;
    const raw = msg?.tool_calls ?? [];
    return {
      content: msg?.content ?? '',
      rawToolCalls: raw,
      toolCalls: raw.map((c) => ({ id: c.id, name: c.function.name, args: parseArgs(c.function.arguments) })),
      ms: Date.now() - started,
    };
  }
};

function parseArgs(text: string): Record<string, unknown> {
  try {
    const v = JSON.parse(text || '{}');
    return v && typeof v === 'object' ? v : { _raw: text };
  } catch {
    return { _raw: text };
  }
}
