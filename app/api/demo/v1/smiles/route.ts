import { NextRequest, NextResponse } from 'next/server';
import { getStore, requireApiKey, Smile } from '../../lib';

const MOODS = ['joyful', 'grateful', 'proud', 'calm'] as const;

export async function GET(req: NextRequest) {
  const denied = requireApiKey(req);
  if (denied) return denied;
  const store = getStore();
  const mood = req.nextUrl.searchParams.get('mood');
  const limitParam = Number(req.nextUrl.searchParams.get('limit') ?? '10');
  const limit = Math.min(Math.max(Number.isFinite(limitParam) ? limitParam : 10, 1), 100);
  let data = store.smiles;
  if (mood) data = data.filter((s) => s.mood === mood);
  return NextResponse.json({ data: data.slice(0, limit), has_more: data.length > limit });
}

export async function POST(req: NextRequest) {
  const denied = requireApiKey(req);
  if (denied) return denied;
  let body: Partial<Smile>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { type: 'invalid_request_error', message: 'Request body must be valid JSON.' } },
      { status: 400 }
    );
  }
  if (!body.message || typeof body.message !== 'string') {
    return NextResponse.json(
      { error: { type: 'invalid_request_error', message: '`message` is required.' } },
      { status: 400 }
    );
  }
  const mood = MOODS.includes(body.mood as any) ? (body.mood as Smile['mood']) : 'joyful';
  const store = getStore();
  store.counter += 1;
  const smile: Smile = {
    id: `smile_${String(store.counter).padStart(3, '0')}`,
    emoji: typeof body.emoji === 'string' && body.emoji ? body.emoji.slice(0, 8) : '😄',
    mood,
    message: body.message.slice(0, 280),
    author: typeof body.author === 'string' ? body.author.slice(0, 100) : 'anonymous',
    created_at: new Date().toISOString(),
  };
  store.smiles.unshift(smile);
  return NextResponse.json(smile, { status: 201 });
}
