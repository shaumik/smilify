import { NextRequest, NextResponse } from 'next/server';
import { requireApiKey } from '../lib';

const POSITIVE = ['great', 'love', 'happy', 'awesome', 'good', 'excellent', 'ship', 'win', 'thanks'];
const NEGATIVE = ['bad', 'sad', 'hate', 'bug', 'broken', 'fail', 'angry', 'incident', 'down'];

export async function POST(req: NextRequest) {
  const denied = requireApiKey(req);
  if (denied) return denied;
  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { type: 'invalid_request_error', message: 'Request body must be valid JSON.' } },
      { status: 400 }
    );
  }
  if (!body.text || typeof body.text !== 'string') {
    return NextResponse.json(
      { error: { type: 'invalid_request_error', message: '`text` is required.' } },
      { status: 400 }
    );
  }
  const words = body.text.toLowerCase().split(/\W+/);
  const pos = words.filter((w) => POSITIVE.includes(w)).length;
  const neg = words.filter((w) => NEGATIVE.includes(w)).length;
  const score = Math.max(-1, Math.min(1, (pos - neg) / Math.max(1, pos + neg)));
  const label = score > 0.2 ? 'positive' : score < -0.2 ? 'negative' : 'neutral';
  return NextResponse.json({
    text: body.text.slice(0, 500),
    sentiment: label,
    score: Number(score.toFixed(2)),
    smile_worthy: label === 'positive',
  });
}
