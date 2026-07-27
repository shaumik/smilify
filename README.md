# Smilify Docs

Our **self-hosted documentation platform** — the in-house replacement for
Mintlify, dogfooding its own docs. Next.js 14, MDX content, `docs.json`
navigation, OpenAPI-driven API reference with a live playground, full-text
search, dark mode, and authentication on every route.

## Running

```bash
npm install
npm run dev        # http://localhost:3000
```

Production:

```bash
SESSION_SECRET=$(openssl rand -hex 32) npm run build && npm start
```

## Sign-in

Two methods, both ending in the same first-party session cookie:

- **Descope SSO (recommended for internal use)** — enabled by setting
  `DESCOPE_PROJECT_ID` (see `.env.example`). Standard OIDC + PKCE, no vendor
  SDK. Register `{APP_URL}/api/auth/descope/callback` as a redirect URI in
  Descope. Descope roles listed in `DESCOPE_ADMIN_ROLES` (default
  `admin, docs-admin`) grant docs admin; everyone else is a member.
- **Local accounts (break-glass / no-IdP environments)** — directory in
  `lib/auth.ts`, scrypt-hashed:

  | Account | Role |
  | --- | --- |
  | `shaumik@echelonai.com` | admin |
  | `guest@echelonai.com` | member |

  Initial passwords were shared out-of-band; rotate by regenerating the hash
  (see the in-app admin page `/admin/user-management`).

## Live demo script

1. **Auth wall** — open any deep link signed out → redirect to `/login`;
   `curl /api/search` → 401. Sign in; you land back on the page you wanted.
2. **The platform itself** — sidebar tabs/groups from `docs.json`, ⌘K search
   (typo-tolerant), dark mode toggle, TOC scroll-spy, prev/next.
3. **Components** — the *Components* sidebar group renders the full MDX
   library: callouts, cards, tabs, accordions, steps, code groups.
4. **API Reference** — *Create a smile* → **Send**: a real request hits the
   live API at `/api/v1` and returns a `201`. Clear the API key → real `401`.
5. **Roles** — sign out, sign in as `guest@echelonai.com`: the Admin sidebar
   group is gone, `/admin/deployment` 404s, and searching "deployment"
   returns no admin pages (filtered server-side).
6. **llms.txt** — visit `/llms.txt`: the generated, role-aware LLM index.

## Feature parity with Mintlify

| Feature | Where |
| --- | --- |
| MDX pages + frontmatter | `content/**/*.mdx` |
| `docs.json` (same schema shape: tabs, groups, colors, navbar, footer) | `docs.json` |
| Callouts / Cards / Tabs / Accordions / Steps / Fields / Frames / Updates | `components/mdx/` |
| Code blocks: Shiki highlighting, titles, line highlighting, copy, CodeGroup | rehype-pretty-code |
| ⌘K search (fuzzy, role-filtered, server-side) | `lib/search.ts` |
| OpenAPI API reference + code samples + interactive Try-It | `lib/openapi.ts`, `components/api/` |
| Dark / light mode with no-flash persistence | `app/layout.tsx` |
| TOC scroll-spy, breadcrumbs, prev/next, feedback widget | `components/` |
| `llms.txt` | `app/llms.txt/route.ts` |
| **Authentication + roles (beyond Mintlify's hosted auth)** | `middleware.ts`, `lib/session.ts`, `lib/auth.ts` |
| **Descope SSO (OIDC + PKCE, role mapping)** | `lib/descope.ts`, `app/api/auth/descope/` |

## Architecture

```
docs.json              Navigation, branding, and API config (Mintlify-compatible)
content/               MDX documentation pages
openapi/openapi.json   Spec that generates the API Reference tab
middleware.ts          Session guard on every route
lib/                   Config, content, auth, search, OpenAPI parsing
app/                   Next.js App Router: pages, auth APIs, Smilify API, llms.txt
components/            Shell UI + MDX component library + playground
```

- **Sessions** are HS256 JWTs in an HTTP-only cookie, signed with
  `SESSION_SECRET` (always set it in production).
- **Passwords** are scrypt-hashed with per-user salts and constant-time
  comparison.
- **The Smilify API** (`/api/v1/*`) serves the playground from an in-app
  sandbox with real bearer-key auth, so the API Reference tab demos against
  live requests. Point `openapi/openapi.json` at the production spec and the
  reference pages regenerate automatically.
