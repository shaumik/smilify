import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { getConfig } from './config';
import { exampleFromSchema, resolveRef } from './openapi';

type Json = any;

export interface AsyncMessage {
  name: string;
  title: string;
  summary: string;
  payload: Json;
  example: Json;
}

export interface AsyncOperation {
  action: 'send' | 'receive';
  channelKey: string;
  address: string;
  summary: string;
  description: string;
  protocol: string;
  server: string;
  messages: AsyncMessage[];
}

let cachedSpec: Json | null = null;

export function getAsyncSpec(): Json | null {
  if (cachedSpec && process.env.NODE_ENV === 'production') return cachedSpec;
  const rel = (getConfig().api as Json)?.asyncapi ?? 'asyncapi/asyncapi.json';
  const file = path.join(process.cwd(), rel);
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, 'utf8');
  cachedSpec = file.endsWith('.yaml') || file.endsWith('.yml') ? yaml.load(raw) : JSON.parse(raw);
  return cachedSpec;
}

/**
 * Look up an event operation by the frontmatter `asyncapi` field:
 * "<send|receive> <channelKey>", e.g. "receive smileEvents".
 * Supports AsyncAPI 3.0 (channels + operations + components.messages).
 */
export function getAsyncOperation(ref: string): AsyncOperation | null {
  const spec = getAsyncSpec();
  if (!spec) return null;
  const m = /^(send|receive)\s+(\S+)$/i.exec(ref.trim());
  if (!m) return null;
  const action = m[1].toLowerCase() as 'send' | 'receive';
  const channelKey = m[2];
  const channel = spec.channels?.[channelKey];
  if (!channel) return null;

  // Find the matching operation (for summary/description), if declared.
  let op: Json = null;
  for (const candidate of Object.values(spec.operations ?? {}) as Json[]) {
    const target = candidate?.channel?.$ref ?? '';
    if (candidate?.action === action && target.endsWith(`/channels/${channelKey}`)) {
      op = candidate;
      break;
    }
  }

  const messages: AsyncMessage[] = Object.entries(channel.messages ?? {}).map(
    ([name, msgRef]: [string, Json]) => {
      const msg = resolveRef(spec, msgRef);
      const payload = resolveRef(spec, msg?.payload ?? {});
      return {
        name: msg?.name ?? name,
        title: msg?.title ?? msg?.name ?? name,
        summary: msg?.summary ?? '',
        payload,
        example: msg?.examples?.[0]?.payload ?? exampleFromSchema(spec, payload),
      };
    }
  );

  const serverEntry = (Object.values(spec.servers ?? {}) as Json[])[0] ?? {};
  const server = serverEntry.host
    ? `${serverEntry.protocol ?? 'wss'}://${serverEntry.host}${serverEntry.pathname ?? ''}`
    : '';

  return {
    action,
    channelKey,
    address: channel.address ?? channelKey,
    summary: op?.summary ?? channel.summary ?? `${action} ${channel.address ?? channelKey}`,
    description: op?.description ?? channel.description ?? '',
    protocol: serverEntry.protocol ?? 'wss',
    server,
    messages,
  };
}
