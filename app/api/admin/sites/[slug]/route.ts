import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getSite, removeSite } from '@/lib/sites';

export async function DELETE(_req: Request, { params }: { params: { slug: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!getSite(params.slug)) return NextResponse.json({ error: 'unknown_site' }, { status: 404 });
  try {
    removeSite(params.slug);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'remove_failed' },
      { status: 422 }
    );
  }
}
