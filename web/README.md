# Health RAG Chatbot — Website (Next.js + PWA)

Next.js (App Router) + TypeScript frontend for Sunrise Family Clinic.
Calls the same FastAPI backend as the Streamlit app. No RAG code here.

## Run locally

```bash
npm install
npm run dev        # http://localhost:3000
```

Backend URL via env var (defaults to `http://localhost:8000`):

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
```

If the backend isn't reachable, the page shows a clear
"Backend not configured / not reachable" banner instead of failing silently.

## Pages / features

- Chat UI — question, answer, sources listed under each answer
- Upload section — clinic PDFs → `POST /upload`
- Patient list — `GET /patients`
- Disclaimer banner on every view: "Decision-support only, not a replacement for a doctor."

## PWA

- Manifest: `app/manifest.ts` (served at `/manifest.webmanifest`), name
  "Health RAG Chatbot — Sunrise Family Clinic", icons in `public/icons/`
  (simple generated cross-on-teal PNGs, no copied branding)
- Service worker: hand-written minimal `public/sw.js` (offline shell cache),
  registered from the root layout. Installable on HTTPS (e.g. Vercel).
- Offline page: `public/offline.html`.

## Deploy (Vercel)

Root directory `web`, framework Next.js. Set env var
`NEXT_PUBLIC_API_URL` to the public backend URL (Cloudflare tunnel or Render).
