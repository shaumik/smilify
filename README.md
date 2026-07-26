# Smilify Docs

A **self-hosted internal documentation platform** — our in-house replacement
for Mintlify. Next.js 14, MDX content, `docs.json` navigation, OpenAPI-driven
API reference with a live playground, full-text search, dark mode, and
authentication on every route.

## Demo

```bash
npm install
npm run dev        # http://localhost:3000
```

You'll be redirected to the sign-in page. Demo accounts:

| Account | Password | Role |
| --- | --- | --- |
| `admin@smilify.dev` | `SmilifyAdmin!2026` | admin — sees the Admin sidebar group |
| `docs@smilify.dev` | `SmilifyDocs!2026` | member — Admin content hidden everywhere |

Things to try in the demo:

1. **Auth**: open any URL signed out → redirected to `/login`. APIs return 401.
2. **Roles**: sign in as each user and compare the sidebar, search results for
   "deployment", and direct navigation to `/admin/deployment` (member → 404).
3. **Search**: press `⌘K` / `Ctrl+K`, fuzzy-typo a query, arrow-key navigate.
4. **API playground**: API Reference tab → *Create a smile* → **Send** — the
   request hits the live in-app demo API. Clear the API key for a real 401.
5. **Dark mode**: toggle in the top bar; code blocks switch Shiki themes.
6. **Components**: the *Components* sidebar group renders every MDX component.
7. **llms.txt**: visit `/llms.txt` for the generated LLM index.

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

## Architecture

```
docs.json              Navigation, branding, and API config (Mintlify-compatible)
content/               MDX documentation pages
openapi/openapi.json   Spec that generates the API Reference tab
middleware.ts          Session guard on every route
lib/                   Config, content, auth, search, OpenAPI parsing
app/                   Next.js App Router: pages, auth APIs, demo API, llms.txt
components/            Shell UI + MDX component library + playground
```

- **Sessions** are HS256 JWTs in an HTTP-only cookie, signed with
  `SESSION_SECRET` (set this in production: `openssl rand -hex 32`).
- **Passwords** are scrypt-hashed with per-user salts (demo store in
  `lib/auth.ts`; designed to be swapped for SSO/OIDC).
- **The demo Smilify API** (`/api/demo/v1/*`) is a real in-app API with its own
  bearer-key auth (`sk_demo_smilify_2026`) so the playground demo is honest.

## Production

```bash
SESSION_SECRET=$(openssl rand -hex 32) npm run build && npm start
```

See the in-app admin-only page `/admin/deployment` for the full checklist.
