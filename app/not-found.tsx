import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="login-screen">
      <div className="login-card" style={{ textAlign: 'center' }}>
        <h1 style={{ margin: '0 0 8px' }}>404</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 0 }}>
          This page doesn&apos;t exist or you don&apos;t have access to it.
        </p>
        <Link href="/">Back to the docs</Link>
      </div>
    </div>
  );
}
