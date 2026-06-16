import { LegalPage } from "@/components/legal-page";

export default function CannabisCompliancePage() {
  return (
    <LegalPage
      title="Cannabis Event Compliance Notes"
      intro="Cannabis event rules can vary by federal, provincial, territorial, municipal, venue, age, advertising, and sponsorship requirements. This page is not legal advice."
      sections={[
        {
          heading: "Age-gating",
          body: [
            "Events should configure and enforce the minimum age requirement appropriate to the event location and audience.",
            "Registration may collect date of birth when age validation is required and should minimize retention where possible.",
          ],
        },
        {
          heading: "Responsible Event Copy",
          body: [
            "Event copy should avoid youth-targeted language, glamour or lifestyle claims, risk/daring framing, and cannabis promotional claims that may create compliance risk.",
          ],
        },
        {
          heading: "Organizer Responsibility",
          body: [
            "The organizer is responsible for confirming applicable cannabis, privacy, anti-spam, venue, and accessibility rules before publishing or promoting an event.",
          ],
        },
      ]}
    />
  );
}
