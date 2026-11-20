// The model step: read invoice text, return the fields as JSON.
import { groqChat } from '@/lib/model';
import { loadEnv } from '@/lib/env';

loadEnv();
export const EXTRACT_MODEL = process.env['EXTRACT_MODEL'] ?? 'openai/gpt-oss-20b';

const SYSTEM = `Read the invoice and return JSON only, with exactly these fields:
{"vendor": string, "invoiceNumber": string, "poNumber": string, "requester": string (email),
 "currency": string (3 letters), "lines": [{"description": string, "amount": number}], "total": number}
Copy numbers as they are written. Do not correct anything.`;

export async function groqExtract(text: string): Promise<unknown> {
  const reply = await groqChat({ model: EXTRACT_MODEL, tools: [], messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: text }] });
  const json = reply.content.slice(reply.content.indexOf('{'), reply.content.lastIndexOf('}') + 1);
  try {
    return JSON.parse(json);
  } catch {
    return { _raw: reply.content };
  }
}
