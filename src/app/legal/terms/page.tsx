import { LegalPage } from "@/components/legal-page";

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro="These terms describe the expected use of FCF Events registration, ticketing, communications, and check-in tools. They are a practical website baseline and should be reviewed by counsel before production reliance."
      sections={[
        {
          heading: "Event Registration",
          body: [
            "Attendees must provide accurate registration information and meet the event age requirement shown on the event page.",
            "Tickets may be cancelled, revoked, or refused where required by event policy, venue rules, safety concerns, or applicable law.",
          ],
        },
        {
          heading: "Tickets and Check-in",
          body: [
            "Digital ticket QR codes are issued for event operations and must not be copied, sold, or reused.",
            "A ticket can only be checked in once per applicable event or session scope. Duplicate scans may be logged for security and audit purposes.",
          ],
        },
        {
          heading: "No Legal Advice",
          body: [
            "FCF Events provides registration and event operations tooling. It does not provide legal advice about cannabis, privacy, CASL, tax, venue, or provincial requirements.",
          ],
        },
      ]}
    />
  );
}
