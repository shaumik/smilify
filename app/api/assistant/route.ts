import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getSessionUser } from '@/lib/auth';
import { search } from '@/lib/search';
import { getPage } from '@/lib/content';
import { getConfig } from '@/lib/config';
import { classifyAgent, logEvent } from '@/lib/analytics';

// Ask AI: search-grounded docs assistant with citations.
// Requires ANTHROPIC_API_KEY; the UI shows a setup notice when unset.
const MODEL = process.env.ASSISTANT_MODEL ?? 'claude-opus-5';
const MAX_CONTEXT_CHARS = 6000;

function configured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export async function GET() {
  return NextResponse.json({ configured: configured(), model: configured() ? MODEL : null });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!configured()) {
    return NextResponse.json(
      { error: 'not_configured', hint: 'Set ANTHROPIC_API_KEY to enable the assistant.' },
      { status: 503 }
    );
  }
  let body: { question?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  const question = body.question?.trim();
  if (!question) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  logEvent({
    type: 'assistant',
    query: question.slice(0, 200),
    actor: user.email,
    ...classifyAgent(req.headers.get('user-agent')),
  });

  // Ground the answer in the pages this user's role is allowed to see.
  const hits = search(question, user.role, 6);
  const sources = hits.map((h) => {
    const page = getPage(h.slug);
    return {
      slug: h.slug,
      title: h.title,
      content: (page?.content ?? '').slice(0, MAX_CONTEXT_CHARS),
    };
  });

  const context = sources
    .map((s) => `<page slug="${s.slug}" title="${s.title}">\n${s.content}\n</page>`)
    .join('\n\n');

  const client = new Anthropic();
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 1500,
      output_config: { effort: 'low' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: `You are the documentation assistant for ${getConfig().name}, an internal docs platform. Answer questions using ONLY the documentation pages provided. Cite pages inline using their slug in square brackets, e.g. [quickstart] or [api-reference/introduction]. If the docs don't cover the question, say so plainly and suggest the closest relevant page. Keep answers focused and concise.`,
      messages: [
        {
          role: 'user',
          content: `Documentation pages:\n\n${context || '(no matching pages found)'}\n\nQuestion: ${question}`,
        },
      ],
    });

    if (response.stop_reason === 'refusal') {
      return NextResponse.json({
        answer: "I can't help with that question.",
        sources: [],
      });
    }
    const answer = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    return NextResponse.json({
      answer,
      sources: sources.map(({ slug, title }) => ({ slug, title })),
    });
  } catch (e) {
    console.error('assistant error:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'assistant_failed' }, { status: 502 });
  }
}
