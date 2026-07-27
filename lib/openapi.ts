import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { getConfig } from './config';
import { contentRoot, siteVersion } from './sites';

type Json = any;

export interface ApiParam {
  name: string;
  in: 'path' | 'query' | 'header';
  required: boolean;
  description: string;
  schema: Json;
}

export interface ApiResponse {
  status: string;
  description: string;
  example: Json | undefined;
  schema: Json | undefined;
}

export interface ApiOperation {
  method: string;
  path: string;
  operationId?: string;
  summary: string;
  description: string;
  params: ApiParam[];
  requestBody: { required: boolean; schema: Json; example: Json } | null;
  responses: ApiResponse[];
  security: 'bearer' | 'none';
  server: string;
}

const cachedSpecs = new Map<string, Json>();

export function getSpec(site: string): Json {
  const key = `${site}@${siteVersion(site)}`;
  if (process.env.NODE_ENV === 'production' && cachedSpecs.has(key)) return cachedSpecs.get(key);
  const rel = getConfig(site).api?.openapi ?? 'openapi/openapi.json';
  const file = path.join(contentRoot(site), rel);
  const raw = fs.readFileSync(file, 'utf8');
  const spec = file.endsWith('.yaml') || file.endsWith('.yml') ? yaml.load(raw) : JSON.parse(raw);
  cachedSpecs.set(key, spec);
  return spec;
}

export function resolveRef(spec: Json, node: Json): Json {
  if (node && typeof node === 'object' && typeof node.$ref === 'string') {
    const parts = node.$ref.replace(/^#\//, '').split('/');
    let cur = spec;
    for (const p of parts) cur = cur?.[p];
    return resolveRef(spec, cur);
  }
  return node;
}

/** Generate a plausible example value from a JSON schema. */
export function exampleFromSchema(spec: Json, schema: Json, depth = 0): Json {
  schema = resolveRef(spec, schema);
  if (!schema || depth > 6) return null;
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (schema.enum?.length) return schema.enum[0];
  if (schema.allOf) {
    return Object.assign({}, ...schema.allOf.map((s: Json) => exampleFromSchema(spec, s, depth + 1)));
  }
  if (schema.oneOf?.length) return exampleFromSchema(spec, schema.oneOf[0], depth + 1);
  if (schema.anyOf?.length) return exampleFromSchema(spec, schema.anyOf[0], depth + 1);
  switch (schema.type) {
    case 'object': {
      const obj: Record<string, Json> = {};
      for (const [key, prop] of Object.entries(schema.properties ?? {})) {
        obj[key] = exampleFromSchema(spec, prop, depth + 1);
      }
      return obj;
    }
    case 'array':
      return [exampleFromSchema(spec, schema.items ?? {}, depth + 1)];
    case 'integer':
    case 'number':
      return schema.format === 'int64' ? 42 : 1;
    case 'boolean':
      return true;
    case 'string':
      if (schema.format === 'date-time') return '2026-07-26T12:00:00Z';
      if (schema.format === 'email') return 'user@example.com';
      if (schema.format === 'uri') return 'https://example.com';
      return 'string';
    default:
      return null;
  }
}

/** Look up an operation by "METHOD /path" (the frontmatter `openapi` field). */
export function getOperation(site: string, ref: string): ApiOperation | null {
  const spec = getSpec(site);
  const m = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\S+)$/i.exec(ref.trim());
  if (!m) return null;
  const method = m[1].toLowerCase();
  const opPath = m[2];
  const pathItem = spec.paths?.[opPath];
  const op = pathItem?.[method];
  if (!op) return null;

  const params: ApiParam[] = [...(pathItem.parameters ?? []), ...(op.parameters ?? [])].map(
    (p: Json) => {
      const rp = resolveRef(spec, p);
      return {
        name: rp.name,
        in: rp.in,
        required: !!rp.required,
        description: rp.description ?? '',
        schema: resolveRef(spec, rp.schema ?? {}),
      };
    }
  );

  let requestBody: ApiOperation['requestBody'] = null;
  if (op.requestBody) {
    const rb = resolveRef(spec, op.requestBody);
    const media = rb.content?.['application/json'];
    if (media) {
      const schema = resolveRef(spec, media.schema ?? {});
      requestBody = {
        required: !!rb.required,
        schema,
        example: media.example ?? exampleFromSchema(spec, schema),
      };
    }
  }

  const responses: ApiResponse[] = Object.entries(op.responses ?? {}).map(([status, resp]) => {
    const r = resolveRef(spec, resp);
    const media = r.content?.['application/json'];
    const schema = media ? resolveRef(spec, media.schema ?? {}) : undefined;
    return {
      status,
      description: r.description ?? '',
      example: media?.example ?? (schema ? exampleFromSchema(spec, schema) : undefined),
      schema,
    };
  });

  const security = (op.security ?? spec.security ?? []).length > 0 ? 'bearer' : 'none';
  const server = spec.servers?.[0]?.url ?? '';

  return {
    method: method.toUpperCase(),
    path: opPath,
    operationId: op.operationId,
    summary: op.summary ?? `${method.toUpperCase()} ${opPath}`,
    description: op.description ?? '',
    params,
    requestBody,
    responses,
    security,
    server,
  };
}

/** Flatten an object schema into rows for ParamField-style display. */
export interface SchemaRow {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export function schemaRows(spec: Json, schema: Json): SchemaRow[] {
  schema = resolveRef(spec, schema);
  if (!schema || schema.type !== 'object' || !schema.properties) return [];
  const required: string[] = schema.required ?? [];
  return Object.entries(schema.properties).map(([name, prop]: [string, Json]) => {
    const rp = resolveRef(spec, prop);
    let type = rp.type ?? 'object';
    if (type === 'array') type = `${resolveRef(spec, rp.items ?? {})?.type ?? 'object'}[]`;
    if (rp.enum) type = `enum<${rp.enum.map((e: Json) => JSON.stringify(e)).join(' | ')}>`;
    return {
      name,
      type,
      required: required.includes(name),
      description: rp.description ?? '',
    };
  });
}
