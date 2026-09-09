# Atlas

Atlas is a church operations platform. It gives church staff a single place to
coordinate their work — announcements, tasks, meetings ("Huddles"), project
boards, a shared calendar, and a file library — with billing, org/role
management, and AI assistance built in.

The launch product is the **Workspace** module (staff coordination). Two further
modules, **Serve** (volunteer scheduling) and **Care** (pastoral care /
follow-ups / prayer), exist in the codebase but are **post-launch** — gated
behind higher subscription tiers and not part of the founding-church launch
scope.

## Stack

- **Next.js 16** — App Router, Turbopack. Note: this is a modified Next; read
  `AGENTS.md` before writing code.
- **TypeScript**
- **Tailwind CSS 4**
- **Supabase** — Postgres + Auth + Storage, with row-level security (RLS)
  enforced. Server actions use a service-role client; all writes re-check
  permissions server-side.
- **Stripe** — subscription billing across the Workspace / Suite / Ultimate
  tiers, plus a webhook that keeps tier allocations current.
- **Resend** — transactional + notification email.
- **AI** — Anthropic (Claude) as primary, OpenAI as fallback, routed per tier
  through `src/lib/ai/`.
- **Vercel** — hosting/deploy.

**Fonts:** Poppins (headings) + Source Sans 3 (body), loaded via
`next/font/google` in `src/app/layout.tsx`.

## Project layout

Application code lives under **`src/app/`** (App Router), not `app/`. Notable areas:

- `src/app/(app)/` — authenticated app shell and modules (`workspace/`,
  `serve/`, `care/`, `settings/`, `directory/`, …).
- `src/app/actions/` — server actions (the backend surface).
- `src/lib/ai/` — the AI Control Center (client wrappers, model routing, credit
  accounting, feature registry, org guidelines).
- `supabase/migrations/` — SQL migrations (some are doc-only mirrors of changes
  already applied).

## Running locally

Requires **Node 20** and **npm**.

```bash
npm install
npm run dev      # start the dev server (http://localhost:3000)
npm run build    # production build
npm run lint     # eslint
```

## Environment variables

Set these in `.env.local` (names only — get values from the team, never commit them):

```
NEXT_PUBLIC_SITE_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_WORKSPACE
STRIPE_PRICE_SUITE
STRIPE_PRICE_ULTIMATE
STRIPE_PRODUCT_WORKSPACE
STRIPE_PRODUCT_SUITE
STRIPE_PRODUCT_ULTIMATE
RESEND_API_KEY
ANTHROPIC_API_KEY
OPENAI_API_KEY
```

## Where to look

- **`WORKING_ON.md`** — current state and Lucas/Ben coordination. Read this
  first each session.
- **`BACKEND_NOTES.md`** — running history of shipped work (DONE) and queued
  backend hooks (PENDING).
- **`AGENTS.md`** — the Next.js caveat: this version has breaking changes vs.
  what you may know; read the relevant guide in `node_modules/next/dist/docs/`
  before writing code.
