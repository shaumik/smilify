// GitHub App integration: the platform authenticates to customer repos as
// an installed GitHub App (like Mintlify's), minting short-lived
// installation tokens on demand — no per-repo PATs stored anywhere.
//
// Setup (org admin, one time):
//   1. GitHub org → Settings → Developer settings → GitHub Apps → New App
//      - Permissions: Repository contents: Read-only
//      - Webhook URL: https://<docs-host>/api/github/webhook (+ secret)
//      - Subscribe to: Push
//   2. Install the App on the repos to document.
//   3. Set GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY (PEM, raw or base64),
//      GITHUB_WEBHOOK_SECRET in the platform env.
import { createHmac, createPrivateKey, timingSafeEqual } from 'crypto';
import { SignJWT } from 'jose';

const API = process.env.GITHUB_API_URL ?? 'https://api.github.com';

export function isAppConfigured(): boolean {
  return !!(process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY);
}

function privateKeyPem(): string {
  const raw = process.env.GITHUB_APP_PRIVATE_KEY ?? '';
  if (raw.includes('BEGIN')) return raw.replace(/\\n/g, '\n');
  return Buffer.from(raw, 'base64').toString('utf8');
}

/** Short-lived App JWT (RS256, iss = app id). */
async function appJwt(): Promise<string> {
  const key = createPrivateKey(privateKeyPem());
  return new SignJWT({})
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(process.env.GITHUB_APP_ID!)
    .setIssuedAt(Math.floor(Date.now() / 1000) - 30)
    .setExpirationTime('9m')
    .sign(key);
}

async function gh(path: string, token: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'x-github-api-version': '2022-11-28',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`GitHub API ${path}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  return res.json();
}

/**
 * Mint an installation token scoped to one repo. Requires the App to be
 * installed on that repo — the error otherwise names the install URL.
 */
export async function installationToken(owner: string, repo: string): Promise<string> {
  const jwt = await appJwt();
  let installation: { id: number };
  try {
    installation = await gh(`/repos/${owner}/${repo}/installation`, jwt);
  } catch (e) {
    throw new Error(
      `The GitHub App is not installed on ${owner}/${repo}. Install it from the App's page (Settings → GitHub Apps), then retry. (${e instanceof Error ? e.message : e})`
    );
  }
  const tokenResp = await gh(`/app/installations/${installation.id}/access_tokens`, jwt, {
    method: 'POST',
    body: JSON.stringify({ repositories: [repo], permissions: { contents: 'read' } }),
  });
  return tokenResp.token as string;
}

/** Verify a GitHub webhook signature (X-Hub-Signature-256). */
export function verifyWebhookSignature(payload: string, signature: string | null): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
