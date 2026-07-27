import fs from 'fs';
import path from 'path';

// Append-only event log powering the admin analytics dashboard.
// Swap the sink for your analytics pipeline in production if desired.

export type EventType =
  | 'page_view'
  | 'search'
  | 'assistant'
  | 'llms_txt'
  | 'llms_full'
  | 'raw_md'
  | 'mcp'
  | 'webhook_sync';

export type AgentClass = 'human' | 'ai-agent' | 'script';

export interface AnalyticsEvent {
  type: EventType;
  path?: string;
  query?: string;
  actor?: string;
  agent: AgentClass;
  agentName?: string;
  at?: string;
}

const FILE = path.join(process.cwd(), 'data', 'analytics.jsonl');

const AI_AGENTS: [RegExp, string][] = [
  [/claude-code|claudebot|anthropic/i, 'Claude'],
  [/gptbot|chatgpt|openai/i, 'OpenAI'],
  [/perplexity/i, 'Perplexity'],
  [/gemini|google-extended/i, 'Gemini'],
  [/cursor/i, 'Cursor'],
  [/copilot/i, 'Copilot'],
  [/mcp/i, 'MCP client'],
];

/** Classify a user-agent string into human / AI agent / script traffic. */
export function classifyAgent(userAgent: string | null): { agent: AgentClass; agentName?: string } {
  const ua = userAgent ?? '';
  for (const [re, name] of AI_AGENTS) {
    if (re.test(ua)) return { agent: 'ai-agent', agentName: name };
  }
  if (/mozilla/i.test(ua)) return { agent: 'human' };
  if (!ua) return { agent: 'script' };
  return { agent: 'script', agentName: ua.split('/')[0].slice(0, 40) };
}

export function logEvent(event: AnalyticsEvent): void {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.appendFileSync(FILE, JSON.stringify({ ...event, at: new Date().toISOString() }) + '\n');
  } catch {
    // Analytics must never break a request.
  }
}

export function readEvents(): AnalyticsEvent[] {
  try {
    const raw = fs.readFileSync(FILE, 'utf8');
    return raw
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as AnalyticsEvent;
        } catch {
          return null;
        }
      })
      .filter((e): e is AnalyticsEvent => e !== null);
  } catch {
    return [];
  }
}
