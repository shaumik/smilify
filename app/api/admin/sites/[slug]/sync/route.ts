import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getSite, syncSite, SELF_SLUG } from '@/lib/sites';

export async function POST(_req: Request, { params }: { params: { slug: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (params.slug === SELF_SLUG) {
    return NextResponse.json({ error: 'The built-in site syncs with deployments.' }, { status: 422 });
  }
  if (!getSite(params.slug)) return NextResponse.json({ error: 'unknown_site' }, { status: 404 });
  try {
    const site = await syncSite(params.slug);
    return NextResponse.json({ site });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'sync_failed' },
      { status: 422 }
    );
  }
}
