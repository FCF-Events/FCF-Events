import { LegalPage } from "@/components/legal-page";

export default function CommunicationsPolicyPage() {
  return (
    <LegalPage
      title="CASL, SMS, and Email Communications"
      intro="FCF Events is designed to support consent-aware event communications. This page summarizes operational rules that should be reviewed against Canadian Anti-Spam Legislation and applicable privacy requirements."
      sections={[
        {
          heading: "Consent Capture",
          body: [
            "SMS consent and email consent should be captured separately with source, timestamp, message purpose, and the consent language shown to the attendee.",
            "Marketing messages must not be sent to attendees who have not consented or who have opted out.",
          ],
        },
        {
          heading: "Opt-out Handling",
          body: [
            "SMS reminders should identify the organizer where appropriate and include unsubscribe language such as Reply STOP to unsubscribe.",
            "STOP and other opt-out events should be logged, applied to the attendee communication profile, and respected before future sends.",
          ],
        },
        {
          heading: "Message Records",
          body: [
            "Each campaign or reminder should keep a body snapshot, recipient, provider status, error details, idempotency key, and send timestamp for auditability.",
          ],
        },
      ]}
    />
  );
}
