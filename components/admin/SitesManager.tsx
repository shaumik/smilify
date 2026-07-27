'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

interface SiteRow {
  slug: string;
  name: string;
  repo: string | null;
  branch: string;
  path: string;
  addedAt: string;
  lastSyncAt?: string;
  lastCommit?: string;
  lastError?: string;
  builtIn?: boolean;
}

const EMPTY_FORM = { slug: '', name: '', repo: '', branch: 'main', path: '' };

export default function SitesManager() {
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch('/api/admin/sites');
    if (res.ok) {
      const data = await res.json();
      setSites(data.sites);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setBusy('add');
    setError(null);
    const res = await fetch('/api/admin/sites', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setForm(EMPTY_FORM);
    } else {
      setError(data.error ?? `Connect failed (HTTP ${res.status})`);
    }
    await refresh();
    setBusy(null);
  }

  async function sync(slug: string) {
    setBusy(slug);
    setError(null);
    const res = await fetch(`/api/admin/sites/${slug}/sync`, { method: 'POST' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? `Sync failed (HTTP ${res.status})`);
    }
    await refresh();
    setBusy(null);
  }

  async function remove(slug: string) {
    if (!window.confirm(`Disconnect "${slug}"? Its synced copy is deleted (the source repo is untouched).`)) {
      return;
    }
    setBusy(slug);
    setError(null);
    const res = await fetch(`/api/admin/sites/${slug}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? `Remove failed (HTTP ${res.status})`);
    }
    await refresh();
    setBusy(null);
  }

  if (loading) return <p className="dash-empty">Loading…</p>;

  return (
    <div className="sites-manager">
      {error && <div className="sites-error">{error}</div>}

      <div className="dash-card">
        <h2>Sites</h2>
        <table className="dash-table sites-table">
          <thead>
            <tr>
              <th>Site</th>
              <th>Source</th>
              <th>Last sync</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sites.map((s) => (
              <tr key={s.slug}>
                <td>
                  <Link href={`/${s.slug}`} className="sites-link">
                    {s.name}
                  </Link>
                  <div className="sites-sub">/{s.slug}</div>
                </td>
                <td>
                  {s.builtIn ? (
                    <span className="sites-sub">built-in (this deployment)</span>
                  ) : (
                    <>
                      <code>{s.repo}</code>
                      <div className="sites-sub">
                        {s.branch}
                        {s.path ? ` · /${s.path}` : ''}
                      </div>
                    </>
                  )}
                </td>
                <td>
                  {s.builtIn ? (
                    <span className="sites-sub">—</span>
                  ) : s.lastError ? (
                    <span className="sites-status err" title={s.lastError}>
                      ✕ {s.lastError.slice(0, 80)}
                    </span>
                  ) : s.lastSyncAt ? (
                    <span className="sites-status ok">
                      ✓ {new Date(s.lastSyncAt).toLocaleString()}
                      {s.lastCommit ? ` @ ${s.lastCommit.slice(0, 7)}` : ''}
                    </span>
                  ) : (
                    <span className="sites-sub">never</span>
                  )}
                </td>
                <td className="sites-actions">
                  {!s.builtIn && (
                    <>
                      <button
                        className="sites-btn"
                        disabled={busy !== null}
                        onClick={() => sync(s.slug)}
                      >
                        {busy === s.slug ? 'Syncing…' : 'Sync'}
                      </button>
                      <button
                        className="sites-btn danger"
                        disabled={busy !== null}
                        onClick={() => remove(s.slug)}
                      >
                        Disconnect
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="dash-card">
        <h2>Connect a repository</h2>
        <form className="sites-form" onSubmit={connect}>
          <label>
            Slug
            <input
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              placeholder="acme"
              pattern="[a-z0-9][a-z0-9-]*"
              required
            />
          </label>
          <label>
            Name
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Acme Docs"
            />
          </label>
          <label>
            Repository
            <input
              value={form.repo}
              onChange={(e) => setForm({ ...form, repo: e.target.value })}
              placeholder="owner/repo"
              required
            />
          </label>
          <label>
            Branch
            <input
              value={form.branch}
              onChange={(e) => setForm({ ...form, branch: e.target.value })}
              placeholder="main"
            />
          </label>
          <label>
            Docs path
            <input
              value={form.path}
              onChange={(e) => setForm({ ...form, path: e.target.value })}
              placeholder="docs/ (optional)"
            />
          </label>
          <button className="sites-btn primary" type="submit" disabled={busy !== null}>
            {busy === 'add' ? 'Connecting…' : 'Connect & sync'}
          </button>
        </form>
        <p className="dash-note">
          The repo needs a <code>docs.json</code> (at the docs path) plus <code>content/</code>{' '}
          MDX pages — the same format as this site. <code>owner/repo</code> sources authenticate
          through the GitHub App; pushes to the tracked branch sync automatically via webhook.
        </p>
      </div>
    </div>
  );
}
