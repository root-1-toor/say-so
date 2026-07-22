# Say So — Voice Reviews

Record a review in your **actual voice**, post it, and let anyone press Play.
A transcript is captured in parallel (when the browser supports it) and shown
underneath each review for accessibility and search.

Next.js 14 (App Router) + TypeScript + Tailwind. Zero API keys.

## How it works

- **Audio**: `MediaRecorder` captures webm/opus from the mic. A live level
  meter (Web Audio `AnalyserNode`) shows input while recording. 60s cap.
- **Transcript**: Web Speech API runs in parallel on the same mic stream
  (Chrome/Edge). If unsupported, audio still posts — transcript is optional.
- **Storage**: `app/api/reviews/route.ts` keeps reviews (audio as base64 data
  URLs) **in memory** — demo-grade, resets on redeploy/cold start. For real
  persistence, upload blobs to Vercel Blob or S3 and keep rows in KV/Postgres;
  that route is the only file to touch.

## Run locally

```bash
npm install
npm run dev
```

http://localhost:3000 — allow mic access when prompted.

## Deploy to Vercel (live link in ~60 seconds)

```bash
npm i -g vercel   # if needed
vercel            # accept defaults
vercel --prod     # production URL
```

Or push to GitHub and import at vercel.com/new. Mic access requires HTTPS,
which Vercel provides automatically (localhost is also allowed).

## Browser notes

- Recording + playback: all modern browsers.
- Live transcription: Chrome/Edge (Web Speech API). Safari/Firefox post
  audio-only with a friendly note.
