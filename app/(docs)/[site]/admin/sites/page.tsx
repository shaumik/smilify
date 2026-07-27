import { notFound } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { isAppConfigured } from '@/lib/github-app';
import { SELF_SLUG } from '@/lib/sites';
import Breadcrumbs from '@/components/Breadcrumbs';
import SitesManager from '@/components/admin/SitesManager';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Connected repos' };

export default async function SitesPage({ params }: { params: { site: string } }) {
  // Platform-wide dashboard: lives on the built-in site only.
  if (params.site !== SELF_SLUG) notFound();
  const user = await getSessionUser();
  if (!user || user.role !== 'admin') notFound();

  const appConfigured = isAppConfigured();
  const webhookConfigured = !!process.env.GITHUB_WEBHOOK_SECRET;

  return (
    <article className="doc-article dash-article">
      <Breadcrumbs site={SELF_SLUG} slug="admin/sites" />
      <header className="doc-header">
        <h1>Connected repos</h1>
        <p>
          Each connected repository becomes a docs site, served at{' '}
          <code>/&lt;slug&gt;</code> and re-synced on every push.
        </p>
      </header>

      {!appConfigured && (
        <div className="setup-notice">
          <strong>GitHub App not configured.</strong> Set <code>GITHUB_APP_ID</code> and{' '}
          <code>GITHUB_APP_PRIVATE_KEY</code> to connect <code>owner/repo</code> sources. Until
          then you can still connect repos by full git URL or local path (development only).
        </div>
      )}
      {appConfigured && !webhookConfigured && (
        <div className="setup-notice">
          <strong>Webhook secret not set.</strong> Set <code>GITHUB_WEBHOOK_SECRET</code> and
          point the App&apos;s webhook at <code>/api/github/webhook</code> so pushes sync
          automatically. Manual sync still works below.
        </div>
      )}

      <SitesManager />
    </article>
  );
}
