# Streaming AI Chat Interface

A deployable Next.js (App Router) project wrapping the `StreamingChat`
component. This is what fixes the `404: NOT_FOUND` you hit on Vercel — that
error means Vercel had no route to serve, because the repo only contained a
loose component file and a README, not an actual Next.js app.

```
streaming-chat-app/
├── app/
│   ├── layout.js        ← root layout
│   └── page.js           ← "/" route — renders <StreamingChat />
├── components/
│   └── StreamingChat.jsx ← the chat UI ("use client")
├── package.json
├── next.config.mjs
└── .gitignore
```

## Run locally

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`.

## Deploy on Vercel

1. Push this **entire folder** to GitHub — `package.json` must be at the
   repo root (or set Vercel's "Root Directory" to wherever it lives).
2. In Vercel: **New Project → Import** this repo.
3. Framework Preset should auto-detect as **Next.js**. If it shows "Other",
   your `package.json` isn't where Vercel expects it — fix the Root
   Directory setting.
4. Leave Build Command (`next build`) and Output Directory as the Next.js
   defaults — don't override them.
5. Deploy.

### If you still get a 404 after this

- Double-check `app/page.js` exists in the deployed repo (not just locally)
  — `git status` / check the GitHub file tree directly.
- In Vercel → Project → Settings → General, confirm **Root Directory**
  points at the folder containing `package.json`.
- Check the Vercel deployment's **Build Logs** tab — a failed build also
  produces this exact 404 page once you hit the URL.

## Status

Still a UI-only build — no API route yet. See the comments at the top of
`components/StreamingChat.jsx` for exactly what to add when you wire up the
real Claude streaming endpoint (matches the FE-07 card).
