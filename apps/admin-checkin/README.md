# FCF Admin Check-in App

Android-focused Expo app for staff check-in. It reuses the web app check-in APIs for event context, QR/manual ticket check-in, guest lookup, attendee list refresh, and walk-up registration.

## Setup

1. Copy `.env.example` to `.env`.
2. Set `EXPO_PUBLIC_APP_URL` to the FCF Events web app.
   - Android emulator against a local Next server: `http://10.0.2.2:3000`
   - Physical Android device: use the computer's LAN URL, for example `http://192.168.1.20:3000`
   - Production: use the deployed HTTPS app URL.
3. Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` to the same public Supabase values used by the web app.

## Run

```bash
npm install
npm run android
```

From the repo root:

```bash
npm run mobile:checkin:android
```

## Verify

```bash
npm run typecheck
```

From the repo root:

```bash
npm run mobile:checkin:typecheck
```
