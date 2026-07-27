import fs from 'fs';
import path from 'path';
import { notFound } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { readEvents } from '@/lib/analytics';
import { getPage } from '@/lib/content';
import { SELF_SLUG } from '@/lib/sites';
import Breadcrumbs from '@/components/Breadcrumbs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Analytics' };

interface FeedbackEntry {
  slug: string;
  helpful: boolean;
}

function readFeedback(): FeedbackEntry[] {
  try {
    return fs
      .readFileSync(path.join(process.cwd(), 'data', 'feedback.jsonl'), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l) as FeedbackEntry;
        } catch {
          return null;
        }
      })
      .filter((e): e is FeedbackEntry => e !== null);
  } catch {
    return [];
  }
}

function tally<T>(items: T[], key: (item: T) => string | undefined): [string, number][] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    if (!k) continue;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
}

function BarList({ rows, unit }: { rows: [string, number][]; unit: string }) {
  if (rows.length === 0) return <p className="dash-empty">No {unit} recorded yet.</p>;
  const max = rows[0][1];
  return (
    <table className="dash-table">
      <tbody>
        {rows.slice(0, 8).map(([label, count]) => (
          <tr key={label}>
            <td className="dash-label">{label}</td>
            <td className="dash-bar-cell">
              <span className="dash-bar" style={{ width: `${(count / max) * 100}%` }} />
            </td>
            <td className="dash-value">{count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function AnalyticsPage({ params }: { params: { site: string } }) {
  // Platform-wide dashboard: lives on the built-in site only.
  if (params.site !== SELF_SLUG) notFound();
  const user = await getSessionUser();
  if (!user || user.role !== 'admin') notFound();

  const events = readEvents();
  const feedback = readFeedback();

  const pageViews = events.filter((e) => e.type === 'page_view');
  const searches = events.filter((e) => e.type === 'search');
  const assistant = events.filter((e) => e.type === 'assistant');
  const aiTraffic = events.filter(
    (e) => e.agent === 'ai-agent' || ['llms_txt', 'llms_full', 'raw_md', 'mcp'].includes(e.type)
  );
  const helpful = feedback.filter((f) => f.helpful).length;

  const topPages = tally(pageViews, (e) => e.path);
  const topSearches = tally(searches, (e) => e.query);
  const agentSurfaces = tally(
    events.filter((e) => ['llms_txt', 'llms_full', 'raw_md', 'mcp'].includes(e.type)),
    (e) => (e.type === 'mcp' ? `MCP ${e.path ?? ''}` : e.path ?? e.type)
  );
  const agentNames = tally(aiTraffic, (e) => e.agentName ?? (e.agent === 'script' ? 'scripts' : undefined));
  const feedbackByPage = tally(feedback, (f) => `${f.helpful ? '👍' : '👎'} /${f.slug}`);

  const tiles = [
    { label: 'Page views', value: pageViews.length },
    { label: 'Searches', value: searches.length },
    { label: 'Agent requests', value: aiTraffic.length },
    { label: 'Assistant questions', value: assistant.length },
    {
      label: 'Feedback score',
      value: feedback.length ? `${Math.round((helpful / feedback.length) * 100)}%` : '—',
      sub: feedback.length ? `${feedback.length} responses` : 'no responses yet',
    },
  ];

  const stub = getPage(SELF_SLUG, 'admin/analytics');

  return (
    <article className="doc-article dash-article">
      <Breadcrumbs site={SELF_SLUG} slug="admin/analytics" />
      <header className="doc-header">
        <h1>Analytics</h1>
        <p>{stub?.frontmatter.description ?? 'Traffic, search, agent, and feedback activity.'}</p>
      </header>

      <div className="dash-tiles">
        {tiles.map((t) => (
          <div key={t.label} className="dash-tile">
            <span className="dash-tile-label">{t.label}</span>
            <span className="dash-tile-value">{t.value}</span>
            {t.sub && <span className="dash-tile-sub">{t.sub}</span>}
          </div>
        ))}
      </div>

      <div className="dash-grid">
        <section className="dash-card">
          <h2>Top pages</h2>
          <BarList rows={topPages} unit="page views" />
        </section>
        <section className="dash-card">
          <h2>Top searches</h2>
          <BarList rows={topSearches} unit="searches" />
        </section>
        <section className="dash-card">
          <h2>AI &amp; agent traffic</h2>
          <BarList rows={agentSurfaces} unit="agent requests" />
          {agentNames.length > 0 && (
            <>
              <h3>By client</h3>
              <BarList rows={agentNames} unit="agent clients" />
            </>
          )}
        </section>
        <section className="dash-card">
          <h2>Page feedback</h2>
          <BarList rows={feedbackByPage} unit="feedback" />
        </section>
      </div>

      <p className="dash-note">
        Events are appended to <code>data/analytics.jsonl</code> and{' '}
        <code>data/feedback.jsonl</code> on this host. Point the sink at the analytics pipeline
        for durable, multi-instance aggregation.
      </p>
    </article>
  );
}
