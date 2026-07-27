import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import LoginForm from '@/components/LoginForm';

export const metadata = { title: 'Sign in' };

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect('/');
  const config = getConfig();
  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <img src="/logo.svg" alt="" width={40} height={40} />
          <h1>{config.name} Docs</h1>
          <p>Internal documentation — sign in to continue</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
