# Deploy — Firebase Hosting (frontend) + Cloud Run (backend)

The React app is served by **Firebase Hosting**; all `/api/**` requests are
proxied to the **Cloud Run** FastAPI backend by the rewrite in `firebase.json`
(so the browser sees one origin — no CORS needed for the API).

## Prerequisites (one-time)
```bash
# Install CLIs
npm i -g firebase-tools
# gcloud: https://cloud.google.com/sdk/docs/install

# Log in & select your project (use YOUR project id)
gcloud auth login
gcloud config set project <YOUR_PROJECT_ID>
firebase login
```
Then put your project id in **`.firebaserc`** (replace `REPLACE_WITH_YOUR_FIREBASE_PROJECT_ID`),
and confirm the **region** in `firebase.json` matches where you deploy Cloud Run
(default `us-central1`).

Enable the APIs once:
```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com
```

---

## 1. Backend → Cloud Run
From the **backend/** folder. Pass your real secrets as env vars (they are NOT
baked into the image — `.env` is git/docker-ignored).
```bash
cd backend
gcloud run deploy cricket-backend \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 2Gi --cpu 1 \
  --min-instances 1 --max-instances 1 \
  --timeout 120 \
  --set-env-vars "^@@^DATABASE_URL=postgresql://USER:PASS@HOST:5432/postgres@@ACCESS_TOKEN_SECRET_KEY=...@@REFRESH_TOKEN_SECRET_KEY=...@@ACCESS_TOKEN_EXPIRE_MINUTES=15@@REFRESH_TOKEN_EXPIRE_DAYS=7@@DEBUG=false@@GEMINI_API_KEY=AIza...@@GEMINI_MODEL=gemini-2.0-flash@@CORS_ORIGINS=[\"https://<YOUR_PROJECT_ID>.web.app\"]"
```
Notes:
- `^@@^` sets `@@` as the delimiter so the `DATABASE_URL` (which contains commas/colons) isn't split.
- The service **must** be named `cricket-backend` in `us-central1` to match `firebase.json` (or edit both).
- `--min-instances 1 --max-instances 1`: the interactive **auction engine keeps state in memory**, so pin a single always-warm instance — otherwise scaling/cold-starts reset an in-progress auction.
- `--memory 2Gi`: ortools + catboost + lightgbm are heavy; first cold start takes ~10–20s.
- Copy the service URL it prints, e.g. `https://cricket-backend-xxxxx.run.app`.

## 2. Frontend → Firebase Hosting
```bash
# (optional) set WebSocket URL to the Cloud Run URL from step 1, then build
#   edit frontend/.env.production → VITE_WS_URL=wss://cricket-backend-xxxxx.run.app
cd frontend
npm ci
npm run build
cd ..
firebase deploy --only hosting
```
This publishes `frontend/dist` to `https://<YOUR_PROJECT_ID>.web.app`. The
`/api/**` rewrite routes API calls to Cloud Run automatically.

## 3. Verify
- Open `https://<YOUR_PROJECT_ID>.web.app` → log in (`csk@cricket-iq.com` / `CSK@1234`).
- API health: `https://<YOUR_PROJECT_ID>.web.app/api/v1` should return the JSON index.
- If the AI agents/Scout show "ML fallback", the `GEMINI_API_KEY` env var on Cloud Run isn't set.

## Redeploys
- Backend: re-run the `gcloud run deploy` command.
- Frontend: `npm run build` then `firebase deploy --only hosting`.

## Notes & caveats
- **WebSockets** don't traverse the Hosting rewrite reliably; the auction/live
  engines work over REST polling regardless. For live WS, point `VITE_WS_URL`
  at the Cloud Run URL and rebuild.
- **Secrets:** for production, prefer Secret Manager
  (`--set-secrets DATABASE_URL=DB_URL:latest`) over `--set-env-vars`.
- The remote Postgres in your `.env` must allow connections from Cloud Run
  (it's a public IP, so it should already work).
