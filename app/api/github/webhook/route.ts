import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/github-app';
import { sitesForRepoPush, syncSite } from '@/lib/sites';
import { logEvent } from '@/lib/analytics';

// GitHub App webhook: a push to a connected repo's branch re-syncs every
// site backed by it. Authenticated by HMAC signature, not a session —
// this is how docs stay continuously up to date without manual publishes.
export async function POST(req: NextRequest) {
  const payload = await req.text();
  if (!verifyWebhookSignature(payload, req.headers.get('x-hub-signature-256'))) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  const event = req.headers.get('x-github-event');
  if (event === 'ping') return NextResponse.json({ ok: true, pong: true });
  if (event !== 'push') return NextResponse.json({ ok: true, ignored: event });

  let body: { ref?: string; repository?: { full_name?: string } };
  try {
    body = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }
  const fullName = body.repository?.full_name;
  const branch = body.ref?.replace(/^refs\/heads\//, '');
  if (!fullName || !branch) return NextResponse.json({ ok: true, ignored: 'no repo/ref' });

  const sites = sitesForRepoPush(fullName, branch);
  const synced: string[] = [];
  const failed: Record<string, string> = {};
  for (const site of sites) {
    try {
      await syncSite(site.slug);
      synced.push(site.slug);
    } catch (e) {
      failed[site.slug] = e instanceof Error ? e.message : String(e);
    }
  }
  logEvent({
    type: 'webhook_sync',
    path: `${fullName}@${branch}`,
    actor: 'github-webhook',
    agent: 'script',
    query: synced.join(',') || undefined,
  });
  return NextResponse.json({ ok: true, synced, failed });
}
