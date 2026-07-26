import { NextRequest, NextResponse } from 'next/server';

// The live "Smilify API" backing the interactive playground demo.
// It behaves like a real external API: its own bearer-key auth,
// error shapes, and an in-memory data store.

export const DEMO_API_KEY = 'sk_demo_smilify_2026';

export interface Smile {
  id: string;
  emoji: string;
  mood: 'joyful' | 'grateful' | 'proud' | 'calm';
  message: string;
  author: string;
  created_at: string;
}

interface Store {
  smiles: Smile[];
  counter: number;
}

const g = globalThis as unknown as { __smilifyStore?: Store };

function seed(): Store {
  return {
    counter: 4,
    smiles: [
      {
        id: 'smile_001',
        emoji: '😄',
        mood: 'joyful',
        message: 'Shipped the new docs platform!',
        author: 'ada@echelonai.com',
        created_at: '2026-07-20T09:30:00Z',
      },
      {
        id: 'smile_002',
        emoji: '🙏',
        mood: 'grateful',
        message: 'Thanks to the platform team for the review.',
        author: 'devon@echelonai.com',
        created_at: '2026-07-21T14:05:00Z',
      },
      {
        id: 'smile_003',
        emoji: '🏆',
        mood: 'proud',
        message: 'Zero incidents this quarter.',
        author: 'sam@echelonai.com',
        created_at: '2026-07-22T17:45:00Z',
      },
    ],
  };
}

export function getStore(): Store {
  if (!g.__smilifyStore) g.__smilifyStore = seed();
  return g.__smilifyStore;
}

export function requireApiKey(req: NextRequest): NextResponse | null {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token !== DEMO_API_KEY) {
    return NextResponse.json(
      {
        error: {
          type: 'authentication_error',
          message: 'Missing or invalid API key. Pass `Authorization: Bearer sk_demo_...`.',
        },
      },
      { status: 401 }
    );
  }
  return null;
}

export function notFound(id: string): NextResponse {
  return NextResponse.json(
    { error: { type: 'not_found', message: `No smile found with id \`${id}\`.` } },
    { status: 404 }
  );
}
