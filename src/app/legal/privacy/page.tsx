import { LegalPage } from "@/components/legal-page";

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="FCF Events collects the minimum practical information needed to register attendees, issue tickets, manage check-in, communicate event reminders, and support event operations."
      sections={[
        {
          heading: "Information We Collect",
          body: [
            "Registration may collect name, email, phone number, company, role/title, date of birth, ticket type, selected sessions, consent choices, and custom event responses.",
            "Operational logs may include ticket scans, duplicate attempts, message send status, opt-out records, staff actions, and audit metadata.",
          ],
        },
        {
          heading: "How Information Is Used",
          body: [
            "Information is used to administer events, issue tickets, validate check-in, identify repeat attendance, send opted-in communications, and maintain security/audit records.",
            "Sensitive provider credentials are intended to remain server-side only and must not be exposed in browser code.",
          ],
        },
        {
          heading: "Access, Export, and Deletion",
          body: [
            "Organizers should provide a process to export, correct, delete, or anonymize attendee data where required by applicable privacy law and business retention rules.",
          ],
        },
      ]}
    />
  );
}
