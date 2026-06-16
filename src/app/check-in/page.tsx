import { CheckInScanner } from "@/components/check-in-scanner";
import { PageHeader } from "@/components/page-header";
import { PublicHeader } from "@/components/public-header";
import { listCheckInAttendees } from "@/lib/actions/check-in";
import { getEvents, getSessions, getTicketTypes } from "@/lib/data";

export default async function PublicCheckInPage() {
  const [events, sessions, ticketTypes] = await Promise.all([getEvents(), getSessions(), getTicketTypes()]);
  const initialAttendeeList = events[0]?.id
    ? await listCheckInAttendees({ eventId: events[0].id, sessionId: null })
    : { attendees: [] };

  return (
    <main className="min-h-screen bg-[#0b0b0b] text-white">
      <PublicHeader />
      <section className="px-4 py-6 md:px-8">
        <PageHeader eyebrow="FCF Staff" title="Check-in Mode" description="Camera-first check-in for tablets, phones, and laptops." />
        <CheckInScanner
          events={events}
          sessions={sessions}
          ticketTypes={ticketTypes}
          initialAttendees={initialAttendeeList.attendees}
        />
      </section>
    </main>
  );
}
