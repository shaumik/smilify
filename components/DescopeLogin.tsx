'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthProvider } from '@descope/react-sdk';

// The Descope web component needs the browser; skip SSR.
const Descope = dynamic(() => import('@descope/react-sdk').then((m) => m.Descope), {
  ssr: false,
  loading: () => <div className="sso-loading">Loading sign-in…</div>,
});

export default function DescopeLogin({
  projectId,
  baseUrl,
  flowId,
}: {
  projectId: string;
  baseUrl: string;
  flowId: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="sso-flow">
      {error && <div className="login-error">{error}</div>}
      <AuthProvider projectId={projectId} baseUrl={baseUrl}>
        <Descope
          flowId={flowId}
          onSuccess={async (e: CustomEvent) => {
            try {
              const res = await fetch('/api/auth/descope/token', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ jwt: e.detail.sessionJwt }),
              });
              if (!res.ok) throw new Error('session exchange failed');
              const next = params.get('next');
              router.push(next && next.startsWith('/') && !next.startsWith('//') ? next : '/');
              router.refresh();
            } catch {
              setError('Sign-in succeeded but the session could not be established. Try again.');
            }
          }}
          onError={() => setError('Sign-in failed. Try again or contact #platform.')}
        />
      </AuthProvider>
    </div>
  );
}
