import { compileMDX } from 'next-mdx-remote/rsc';
import remarkGfm from 'remark-gfm';
import { getOperation, getSpec, schemaRows } from '@/lib/openapi';
import { codeSamples } from '@/lib/samples';
import type { PageFrontmatter, PagerLink } from '@/lib/content';
import { mdxComponents } from '@/components/mdx';
import Breadcrumbs from '@/components/Breadcrumbs';
import PageFooter from '@/components/PageFooter';
import Playground from './Playground';
import SamplesPanel from './SamplesPanel';

export default async function ApiPage({
  slug,
  openapiRef,
  frontmatter,
  intro,
  pager,
}: {
  slug: string;
  openapiRef: string;
  frontmatter: PageFrontmatter;
  intro: string;
  pager: { prev: PagerLink | null; next: PagerLink | null };
}) {
  const op = getOperation(openapiRef);
  if (!op) {
    return (
      <article className="doc-article">
        <h1>Unknown operation</h1>
        <p>
          No operation <code>{openapiRef}</code> found in the OpenAPI spec.
        </p>
      </article>
    );
  }
  const spec = getSpec();

  let introContent: React.ReactNode = null;
  if (intro.trim()) {
    const { content } = await compileMDX({
      source: intro,
      components: mdxComponents,
      options: { mdxOptions: { remarkPlugins: [remarkGfm] } },
    });
    introContent = content;
  }

  const bodyRows = op.requestBody ? schemaRows(spec, op.requestBody.schema) : [];
  const okResponse = op.responses.find((r) => r.status.startsWith('2'));
  const responseRows = okResponse?.schema ? schemaRows(spec, okResponse.schema) : [];
  const samples = codeSamples(op);

  return (
    <>
      <article className="doc-article api-article">
        <Breadcrumbs slug={slug} />
        <header className="doc-header">
          <h1>{frontmatter.title ?? op.summary}</h1>
          {(frontmatter.description || op.description) && (
            <p>{frontmatter.description ?? op.description}</p>
          )}
          <div className="api-endpoint">
            <span className={`method method-${op.method.toLowerCase()}`}>{op.method}</span>
            <code>{op.path}</code>
          </div>
        </header>
        <div className="prose">
          {introContent}
          {op.security === 'bearer' && (
            <>
              <h2 className="heading" id="authorization">
                <a href="#authorization" className="heading-anchor">
                  Authorization
                </a>
              </h2>
              <div className="field">
                <div className="field-head">
                  <code className="field-name">Authorization</code>
                  <span className="field-kind">header</span>
                  <span className="field-type">string</span>
                  <span className="field-required">required</span>
                </div>
                <div className="field-desc">
                  Bearer authentication of the form <code>Bearer &lt;api-key&gt;</code>.
                </div>
              </div>
            </>
          )}
          {op.params.length > 0 && (
            <>
              <h2 className="heading" id="parameters">
                <a href="#parameters" className="heading-anchor">
                  Parameters
                </a>
              </h2>
              {op.params.map((p) => (
                <div className="field" key={`${p.in}-${p.name}`}>
                  <div className="field-head">
                    <code className="field-name">{p.name}</code>
                    <span className="field-kind">{p.in}</span>
                    <span className="field-type">
                      {p.schema.enum
                        ? `enum<${p.schema.enum.map((e: unknown) => JSON.stringify(e)).join(' | ')}>`
                        : p.schema.type ?? 'string'}
                    </span>
                    {p.required && <span className="field-required">required</span>}
                    {p.schema.default !== undefined && (
                      <span className="field-default">default: {String(p.schema.default)}</span>
                    )}
                  </div>
                  {p.description && <div className="field-desc">{p.description}</div>}
                </div>
              ))}
            </>
          )}
          {bodyRows.length > 0 && (
            <>
              <h2 className="heading" id="body">
                <a href="#body" className="heading-anchor">
                  Body
                </a>
              </h2>
              {bodyRows.map((row) => (
                <div className="field" key={row.name}>
                  <div className="field-head">
                    <code className="field-name">{row.name}</code>
                    <span className="field-kind">body</span>
                    <span className="field-type">{row.type}</span>
                    {row.required && <span className="field-required">required</span>}
                  </div>
                  {row.description && <div className="field-desc">{row.description}</div>}
                </div>
              ))}
            </>
          )}
          {responseRows.length > 0 && (
            <>
              <h2 className="heading" id="response">
                <a href="#response" className="heading-anchor">
                  Response
                </a>
              </h2>
              {responseRows.map((row) => (
                <div className="field" key={row.name}>
                  <div className="field-head">
                    <code className="field-name">{row.name}</code>
                    <span className="field-type">{row.type}</span>
                  </div>
                  {row.description && <div className="field-desc">{row.description}</div>}
                </div>
              ))}
            </>
          )}
        </div>
        <PageFooter slug={slug} pager={pager} feedback />
      </article>
      <aside className="api-panel">
        <Playground
          method={op.method}
          path={op.path}
          server={op.server}
          params={op.params.map((p) => ({
            name: p.name,
            in: p.in,
            required: p.required,
            example: p.schema.default ?? p.schema.example ?? '',
          }))}
          bodyExample={op.requestBody ? JSON.stringify(op.requestBody.example, null, 2) : null}
          needsAuth={op.security === 'bearer'}
        />
        <SamplesPanel samples={samples} />
        {okResponse?.example !== undefined && (
          <div className="panel">
            <div className="panel-title">
              <span className="status-dot ok" /> {okResponse.status} response
            </div>
            <pre className="panel-pre">{JSON.stringify(okResponse.example, null, 2)}</pre>
          </div>
        )}
      </aside>
    </>
  );
}
