# FCF Events Setup Guide

## Local Development
1. Copy `.env.example` to `.env.local`.
2. Fill `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `APP_ENCRYPTION_KEY`.
3. Run `npm install`.
4. Apply `supabase/schema.sql` in Supabase SQL editor or with the Supabase CLI.
5. Run `npm run dev` and open `http://localhost:3000`.

## Supabase
- Enable Email Auth for organizer accounts.
- Apply `supabase/schema.sql`.
- Create Storage buckets:
  - `event-banners`: public or signed-read, image uploads only.
  - `organization-assets`: signed-read for logos and private organizer assets.
  - `speaker-images`: public or signed-read, image uploads only.
- Keep `SUPABASE_SERVICE_ROLE_KEY` only in server-side environments.
- Use RLS tests before production launch.

## Twilio
- Add Account SID, Auth Token, sender number, or Messaging Service SID in Dashboard > Settings.
- Configure inbound webhook to `{NEXT_PUBLIC_APP_URL}/api/twilio/inbound`.
- Configure status callback to `{NEXT_PUBLIC_APP_URL}/api/twilio/status`.
- Verify STOP/START handling in Twilio and in FCF opt-out logs before first campaign.

## Airtable
- Create a personal access token with access only to the target base.
- Add Base ID and table names in Dashboard > Airtable Sync.
- Map local fields to Airtable fields.
- Use Sync Now for the first run and inspect `airtable_sync_logs`.

## Vercel
- Add every variable from `.env.example`.
- Set `NEXT_PUBLIC_APP_URL` to the production URL.
- Deploy from the main branch.
- Confirm Twilio webhooks point to the production URL after deployment.

## Scheduled SMS Reminders
- Preferred: configure a Supabase scheduled Edge Function that calls the same reminder dispatcher used by `/api/reminders/dispatch`.
- MVP fallback: call `/api/reminders/dispatch` from a trusted cron with an internal secret header added before production.
- The dispatcher must create one `message_sends` row per registration/reminder idempotency key before sending.

## QR Scanner Testing
- Use HTTPS or localhost so camera permissions work.
- Test on phone, tablet, and laptop.
- Verify success, duplicate, wrong event, revoked ticket, cancelled ticket, and unauthorized staff cases.
