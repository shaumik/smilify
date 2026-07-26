import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';

// Thumbs up/down page feedback, appended to a local JSONL file.
// Swap for your analytics pipeline in production.
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  let body: { slug?: string; helpful?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  if (typeof body.slug !== 'string' || typeof body.helpful !== 'boolean') {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  const dir = path.join(process.cwd(), 'data');
  fs.mkdirSync(dir, { recursive: true });
  const entry = {
    slug: body.slug.slice(0, 200),
    helpful: body.helpful,
    user: user.email,
    at: new Date().toISOString(),
  };
  fs.appendFileSync(path.join(dir, 'feedback.jsonl'), JSON.stringify(entry) + '\n');
  return NextResponse.json({ ok: true });
}
