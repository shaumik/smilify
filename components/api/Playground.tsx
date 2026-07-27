'use client';

import { useState } from 'react';
import Icon from '../Icon';

interface ParamInput {
  name: string;
  in: 'path' | 'query' | 'header';
  required: boolean;
  example: unknown;
}

export default function Playground({
  method,
  path,
  server,
  params,
  bodyExample,
  needsAuth,
}: {
  method: string;
  path: string;
  server: string;
  params: ParamInput[];
  bodyExample: string | null;
  needsAuth: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [apiKey, setApiKey] = useState('sk_smilify_e7c31b9a4d21');
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(params.map((p) => [p.name, p.example ? String(p.example) : '']))
  );
  const [body, setBody] = useState(bodyExample ?? '');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ status: number; body: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      let url = server + path;
      const query = new URLSearchParams();
      const headers: Record<string, string> = {};
      for (const p of params) {
        const v = values[p.name]?.trim();
        if (!v) {
          if (p.required && p.in === 'path') throw new Error(`Path parameter \`${p.name}\` is required.`);
          continue;
        }
        if (p.in === 'path') url = url.replace(`{${p.name}}`, encodeURIComponent(v));
        else if (p.in === 'query') query.set(p.name, v);
        else headers[p.name] = v;
      }
      if (needsAuth) headers['Authorization'] = `Bearer ${apiKey}`;
      const init: RequestInit = { method, headers };
      if (bodyExample !== null && body.trim()) {
        headers['Content-Type'] = 'application/json';
        init.body = body;
      }
      const qs = query.toString();
      const res = await fetch(url + (qs ? `?${qs}` : ''), init);
      const text = await res.text();
      let pretty = text;
      try {
        pretty = JSON.stringify(JSON.parse(text), null, 2);
      } catch {}
      setResult({ status: res.status, body: pretty });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel playground">
      <button className="panel-title panel-toggle" onClick={() => setOpen((v) => !v)}>
        <Icon name="bolt" size={14} /> Try it
        <Icon name="chevron-down" size={14} className={open ? 'rot' : ''} />
      </button>
      {open && (
        <div className="playground-body">
          {needsAuth && (
            <label className="pg-field">
              <span>
                API key <em>Authorization: Bearer</em>
              </span>
              <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
            </label>
          )}
          {params.map((p) => (
            <label className="pg-field" key={p.name}>
              <span>
                {p.name} <em>{p.in}</em>
                {p.required && <b className="pg-req">*</b>}
              </span>
              <input
                value={values[p.name] ?? ''}
                placeholder={p.example ? String(p.example) : ''}
                onChange={(e) => setValues((v) => ({ ...v, [p.name]: e.target.value }))}
              />
            </label>
          ))}
          {bodyExample !== null && (
            <label className="pg-field">
              <span>
                Body <em>application/json</em>
              </span>
              <textarea
                rows={Math.min(10, (body.match(/\n/g)?.length ?? 0) + 2)}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                spellCheck={false}
              />
            </label>
          )}
          <button className="pg-send" onClick={send} disabled={busy}>
            {busy ? 'Sending…' : `Send ${method} request`}
          </button>
          {error && <div className="pg-error">{error}</div>}
          {result && (
            <div className="pg-result">
              <div className="panel-title">
                <span className={`status-dot ${result.status < 300 ? 'ok' : 'err'}`} />
                {result.status}
              </div>
              <pre className="panel-pre">{result.body}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
