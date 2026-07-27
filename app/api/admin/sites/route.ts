import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { isAppConfigured } from '@/lib/github-app';
import { addSite, getSites, SELF_SLUG } from '@/lib/sites';

async function requireAdmin() {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };
  if (user.role !== 'admin') {
    return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
  }
  return { user };
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  return NextResponse.json({
    appConfigured: isAppConfigured(),
    webhookConfigured: !!process.env.GITHUB_WEBHOOK_SECRET,
    sites: getSites().map((s) => ({ ...s, builtIn: s.slug === SELF_SLUG })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  let body: { slug?: string; name?: string; repo?: string; branch?: string; path?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  if (!body.slug?.trim() || !body.repo?.trim()) {
    return NextResponse.json({ error: 'slug and repo are required' }, { status: 400 });
  }
  try {
    const site = await addSite({
      slug: body.slug,
      name: body.name ?? body.slug,
      repo: body.repo,
      branch: body.branch,
      path: body.path,
    });
    return NextResponse.json({ site });
  } catch (e) {
    // addSite keeps the record with lastError on sync failure so the admin
    // can fix credentials/branch and re-sync; surface the reason either way.
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'add_failed' },
      { status: 422 }
    );
  }
}
