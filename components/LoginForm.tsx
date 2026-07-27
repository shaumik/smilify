'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const ssoError = params.get('error');
  const [error, setError] = useState<string | null>(
    ssoError === 'sso_failed'
      ? 'SSO sign-in failed. Try again or use a local account.'
      : ssoError === 'sso_not_configured'
        ? 'SSO is not configured on this deployment.'
        : null
  );
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          data.error === 'invalid_credentials'
            ? 'Invalid email or password.'
            : 'Sign in failed. Try again.'
        );
        return;
      }
      const next = params.get('next');
      router.push(next && next.startsWith('/') && !next.startsWith('//') ? next : '/');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="login-form" onSubmit={submit}>
      <label>
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          autoComplete="username"
          required
        />
      </label>
      <label>
        Password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••••••"
          autoComplete="current-password"
          required
        />
      </label>
      {error && <div className="login-error">{error}</div>}
      <button type="submit" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
