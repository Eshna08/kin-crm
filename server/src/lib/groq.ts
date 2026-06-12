import 'dotenv/config';
import Groq from 'groq-sdk';

// Default to the lighter, free, high-limit model. Override with GROQ_MODEL if desired.
const MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

let client: Groq | null = null;
function getClient(): Groq | null {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  if (!client) client = new Groq({ apiKey: key });
  return client;
}

// When we get rate-limited, stop calling until this time so we don't burn the
// quota (or spam the API) further — we just serve fallbacks during the cooldown.
let cooldownUntil = 0;

function setCooldownFromError(msg: string) {
  let secs = 60;
  const m = msg.match(/try again in (?:(\d+)m)?([\d.]+)s/i);
  if (m) secs = (m[1] ? Number(m[1]) * 60 : 0) + Number(m[2]);
  secs = Math.min(Math.max(secs, 30), 300); // clamp 30s–5min so we periodically retry
  cooldownUntil = Date.now() + secs * 1000;
}

function extractJSON(text: string): unknown {
  let t = text.trim();
  t = t.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const firstObj = t.indexOf('{');
  const firstArr = t.indexOf('[');
  let start = -1;
  if (firstObj === -1) start = firstArr;
  else if (firstArr === -1) start = firstObj;
  else start = Math.min(firstObj, firstArr);
  if (start === -1) return JSON.parse(t);
  const open = t[start];
  const close = open === '{' ? '}' : ']';
  const end = t.lastIndexOf(close);
  const slice = end > start ? t.slice(start, end + 1) : t.slice(start);
  return JSON.parse(slice);
}

/**
 * Call Groq expecting JSON. Returns `fallback` if the key is missing, we're in a
 * rate-limit cooldown, or anything goes wrong — so the app never blocks on AI.
 */
export async function groqJSON<T>(system: string, user: string, fallback: T): Promise<T> {
  const groq = getClient();
  if (!groq) return fallback;
  if (Date.now() < cooldownUntil) return fallback; // in cooldown — skip the call

  try {
    const completion = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0.7,
      max_tokens: 1024,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? '';
    return extractJSON(raw) as T;
  } catch (err) {
    const msg = (err as Error).message || '';
    if (/429|rate.?limit/i.test(msg)) {
      setCooldownFromError(msg);
      console.warn('[groq] rate-limited — serving fallbacks for the next cooldown window.');
    } else {
      console.error('[groq] call failed, using fallback:', msg.slice(0, 200));
    }
    return fallback;
  }
}

export const groqModel = MODEL;
