# Shopping List App

Shopping list with:

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Local mode (`localStorage`) and shared cloud mode (Supabase realtime)

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Enable multi-device sync (Supabase)

1. Create a Supabase project.
2. Run [`supabase/schema.sql`](./supabase/schema.sql) once in Supabase SQL editor.
3. Copy `.env.example` to `.env.local` and fill values:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

4. Restart `npm run dev`.

When env vars are set, the app runs in cloud mode and syncs live across devices.
If not set, it falls back to local mode.

## Deploy to Vercel

Set the same `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel project settings.
