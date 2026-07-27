import { getAsyncOperation } from '@/lib/asyncapi';
import { getAsyncSpec } from '@/lib/asyncapi';
import { schemaRows } from '@/lib/openapi';
import { compileDocMDX } from '@/lib/mdx';
import type { PageFrontmatter, PagerLink } from '@/lib/content';
import Breadcrumbs from '@/components/Breadcrumbs';
import PageFooter from '@/components/PageFooter';
import SamplesPanel from './SamplesPanel';

function subscribeSamples(server: string, address: string) {
  const js = [
    `const ws = new WebSocket(`,
    `  "${server}?channel=${address}",`,
    `  { headers: { Authorization: \`Bearer \${API_KEY}\` } }`,
    `);`,
    `ws.onmessage = (e) => {`,
    `  const event = JSON.parse(e.data);`,
    `  console.log(event.event, event.data);`,
    `};`,
  ].join('\n');
  const python = [
    'import asyncio, json, websockets',
    '',
    'async def listen():',
    `    url = "${server}?channel=${address}"`,
    '    headers = {"Authorization": f"Bearer {API_KEY}"}',
    '    async with websockets.connect(url, additional_headers=headers) as ws:',
    '        async for raw in ws:',
    '            event = json.loads(raw)',
    '            print(event["event"], event["data"])',
    '',
    'asyncio.run(listen())',
  ].join('\n');
  return [
    { label: 'JavaScript', code: js },
    { label: 'Python', code: python },
  ];
}

export default async function AsyncApiPage({
  site,
  slug,
  asyncapiRef,
  frontmatter,
  intro,
  pager,
}: {
  site: string;
  slug: string;
  asyncapiRef: string;
  frontmatter: PageFrontmatter;
  intro: string;
  pager: { prev: PagerLink | null; next: PagerLink | null };
}) {
  const op = getAsyncOperation(site, asyncapiRef);
  if (!op) {
    return (
      <article className="doc-article">
        <h1>Unknown channel</h1>
        <p>
          No operation <code>{asyncapiRef}</code> found in the AsyncAPI spec.
        </p>
      </article>
    );
  }
  const spec = getAsyncSpec(site);
  const introContent = intro.trim() ? await compileDocMDX(intro, site) : null;

  return (
    <>
      <article className="doc-article api-article">
        <Breadcrumbs site={site} slug={slug} />
        <header className="doc-header">
          <h1>{frontmatter.title ?? op.summary}</h1>
          {(frontmatter.description || op.description) && (
            <p>{frontmatter.description ?? op.description}</p>
          )}
          <div className="api-endpoint">
            <span className={`method method-${op.action === 'receive' ? 'get' : 'post'}`}>
              {op.action.toUpperCase()}
            </span>
            <code>{op.address}</code>
            <span className="proto-chip">{op.protocol}</span>
          </div>
        </header>
        <div className="prose">
          {introContent}
          {op.messages.map((msg) => (
            <div key={msg.name}>
              <h2 className="heading" id={msg.name.replace(/\./g, '-')}>
                <a href={`#${msg.name.replace(/\./g, '-')}`} className="heading-anchor">
                  {msg.title}
                </a>
              </h2>
              {msg.summary && <p>{msg.summary}</p>}
              {schemaRows(spec, msg.payload).map((row) => (
                <div className="field" key={`${msg.name}-${row.name}`}>
                  <div className="field-head">
                    <code className="field-name">{row.name}</code>
                    <span className="field-type">{row.type}</span>
                    {row.required && <span className="field-required">required</span>}
                  </div>
                  {row.description && <div className="field-desc">{row.description}</div>}
                </div>
              ))}
            </div>
          ))}
        </div>
        <PageFooter site={site} slug={slug} pager={pager} feedback />
      </article>
      <aside className="api-panel">
        <SamplesPanel samples={subscribeSamples(op.server, op.address)} />
        {op.messages.map((msg) => (
          <div className="panel" key={msg.name}>
            <div className="panel-title">
              <span className="status-dot ok" /> {msg.name}
            </div>
            <pre className="panel-pre">{JSON.stringify(msg.example, null, 2)}</pre>
          </div>
        ))}
      </aside>
    </>
  );
}
