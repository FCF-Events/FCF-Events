# FCF Events QA Checklists

## Manual MVP Flow
- Create an organizer account and assign Owner role.
- Create a published event with capacity, age minimum, ticket types, and two sessions.
- Register a guest from `/e/fcf-business-conference`.
- Confirm a ticket code and QR render on the confirmation page.
- Check in the ticket from `/check-in`.
- Scan the same QR again and verify duplicate warning.
- Register the same attendee for another event and verify repeat attendee analytics.

## Security
- Confirm browser bundles do not contain `SUPABASE_SERVICE_ROLE_KEY`, Twilio auth tokens, Airtable tokens, or `APP_ENCRYPTION_KEY`.
- Confirm RLS blocks cross-organization access.
- Confirm Check-in Staff cannot export attendees or read Twilio settings.
- Confirm Viewer cannot mutate events, attendees, messages, or settings.

## SMS
- Capture SMS consent separately from email consent.
- Send a Twilio test SMS and verify `message_sends` has status, provider SID, body snapshot, and recipient.
- Send a reminder twice and verify the second run is skipped by idempotency key.
- Send STOP to the Twilio number and verify opt-out prevents future sends.
- Verify quiet hours defer or skip sends according to settings.

## Data Integrity
- Attempt registration beyond capacity.
- Attempt expired discount redemption.
- Attempt duplicate discount redemption when one-use-per-attendee is active.
- Attempt session check-in separately from event check-in.
- Cancel an event and confirm reminders are skipped.
