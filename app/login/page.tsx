import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { getDescopeConfig } from '@/lib/descope';
import LoginForm from '@/components/LoginForm';

export const metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const user = await getSessionUser();
  if (user) redirect('/');
  const config = getConfig();
  const sso = getDescopeConfig() !== null;
  const next = searchParams.next;
  const startUrl = `/api/auth/descope/start${next ? `?next=${encodeURIComponent(next)}` : ''}`;
  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <img src="/logo.svg" alt="" width={40} height={40} />
          <h1>{config.name} Docs</h1>
          <p>Internal documentation — sign in to continue</p>
        </div>
        {sso && (
          <>
            <a className="sso-btn" href={startUrl}>
              Continue with Descope SSO
            </a>
            <div className="login-divider">
              <span>or use a local account</span>
            </div>
          </>
        )}
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
