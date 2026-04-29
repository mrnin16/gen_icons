# Icon Forge

Production-ready icon platform: 244 hand-crafted icons across 6 styles (line-art, flat-modern, anime, 3d-clay, neon-glow, liquid-glass), AI-generated custom icons, and one-command export to React, Vue, Svelte, Angular, React Native, Next.js, Flutter, SwiftUI, Kotlin/Compose, or HTML/CSS.

- **Browse / search / filter** 1,464 platform-default icons (244 × 6 styles)
- **AI generation** — pluggable provider (Anthropic / OpenAI / Gemini / Grok) with auto-fallback
- **Per-icon export** — SVG, PNG, Data URL, or paste-ready code in 10 frameworks
- **Per-icon customization** — color picker + stroke-width slider, applied consistently across every export path
- **Package distribution** — `npm install` straight from a tarball URL, direct SVG URLs, or zip downloads

## Stack

- **Frontend** Next.js 16 · React 19 · TypeScript · Tailwind 4 · Framer Motion
- **Backend** Next.js Route Handlers
- **DB** PostgreSQL 16 · Prisma 7 (with `@prisma/adapter-pg`)
- **AI** `@anthropic-ai/sdk` · `openai` · `@google/generative-ai`
- **Defaults** `lucide-static` (MIT) post-processed into 6 styles

## Local development

```bash
# 1. Postgres via Docker
docker compose up -d

# 2. Install + migrate
npm install
npx prisma migrate dev

# 3. Seed 1,464 platform-default icons (no API key needed)
npm run db:seed:defaults

# 4. Run
npm run dev
```

Open <http://localhost:3000>.

### Environment

Copy `.env.example` to `.env` and fill in:

```env
DATABASE_URL="postgresql://iconforge:iconforge_dev@localhost:5433/iconforge"

# Set at least one AI provider key to enable generation
ANTHROPIC_API_KEY=""    # https://console.anthropic.com
OPENAI_API_KEY=""       # https://platform.openai.com/api-keys
GOOGLE_API_KEY=""       # https://aistudio.google.com/apikey
XAI_API_KEY=""          # https://console.x.ai
```

The active provider is set in `src/lib/ai-providers.ts:14` (`ACTIVE_PROVIDER`). If the active provider is unconfigured or errors, the server automatically falls back to other configured providers.

## Deploy to Railway

This repo ships with a `railway.json` that configures build, start, pre-deploy
migrations, seeding, and a healthcheck — so the deploy is essentially:
**create services → set env vars → push**.

### Steps

1. **Create the project on Railway** and add a **Postgres** service. Railway
   provisions it and gives you a `DATABASE_URL` reference variable.
2. **Add this repo** as a second service (New → GitHub Repo → pick this repo).
3. **Set env vars** on the app service (Variables tab):

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | `${{ Postgres.DATABASE_URL }}` *(reference, uses internal URL — faster, no proxy bandwidth)* |
   | One of the AI keys | `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GOOGLE_API_KEY` / `XAI_API_KEY` |
   | *(optional)* model overrides | `ANTHROPIC_MODEL`, `OPENAI_MODEL`, `GEMINI_MODEL`, `GROK_MODEL` |

4. **Deploy.** That's it.

   On every deploy, `railway.json` runs:
   ```bash
   npm run db:migrate:deploy   # prisma migrate deploy
   npm run db:seed:defaults    # seed 1,464 platform icons (idempotent)
   ```

   then starts the server with `npm start`. Health is checked at
   `/api/icons/categories`.

### One-time vs ongoing

The seed is idempotent — it only inserts icons whose slug doesn't already
exist, so re-running on every deploy is cheap (≈5s of indexed lookups) and
also picks up any new icons you add to `prisma/icon-definitions.ts`.

### Internal vs proxy URLs

Railway exposes a Postgres service via two URLs:

- **Internal** (e.g. `postgres.railway.internal:5432`) — used by other Railway
  services in the same project. Faster, free of proxy bandwidth.
- **Public proxy** (e.g. `<host>.proxy.rlwy.net:<port>`) — used to connect from
  outside Railway, like your laptop or a one-off `psql` session.

Always use the **reference variable** (`${{ Postgres.DATABASE_URL }}`) on the
app service so it picks the internal URL automatically.

## Distribute as installable packages

Once deployed, developers can install icons directly from your Icon Forge URL — no npm publish required.

```bash
npm install "https://your-app.up.railway.app/api/packages/react.tgz?style=line-art"
```

```tsx
import { LaptopIcon } from 'icon-forge-react-line-art';

<LaptopIcon size={32} />
```

Supported npm-installable frameworks: React · Next.js · Vue · Svelte · Angular · React Native.
Flutter / SwiftUI / Kotlin: download the zip from the in-app **Get Package** drawer.

For HTML, embed icons directly:

```html
<img src="https://your-app.up.railway.app/svg/laptop-line-art" />
```

## Scripts

| | |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm start` | Production server |
| `npm run db:migrate` | Prisma migrate dev (interactive) |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:seed:defaults` | Seed 1,464 Lucide-derived platform icons (no API key) |
| `npm run db:seed` | AI-generate the full 254 × 2 catalog via the active provider (uses credits) |

## License

MIT. Platform-default icons derived from [Lucide](https://lucide.dev) (ISC). AI-generated icons inherit the licensing of whichever provider produced them.
