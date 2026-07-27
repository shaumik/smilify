import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { SELF_SLUG } from '@/lib/sites';
import { getDescopeConfig } from '@/lib/descope';
import DescopeLogin from '@/components/DescopeLogin';

export const metadata = { title: 'Sign in' };

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect('/');
  const config = getConfig(SELF_SLUG);
  const descope = getDescopeConfig();
  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <img src="/logo.svg" alt="" width={40} height={40} />
          <h1>{config.name} Docs</h1>
          <p>Internal documentation — sign in to continue</p>
        </div>
        {descope ? (
          <Suspense>
            <DescopeLogin
              projectId={descope.projectId}
              baseUrl={descope.baseUrl}
              flowId={descope.flowId}
            />
          </Suspense>
        ) : (
          <div className="login-setup">
            <strong>Authentication isn&apos;t configured.</strong>
            <p>
              This deployment signs in exclusively through Descope. Set
              <code> DESCOPE_PROJECT_ID</code> (see <code>.env.example</code>) and add this
              origin to the Descope project&apos;s approved domains, then restart.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
