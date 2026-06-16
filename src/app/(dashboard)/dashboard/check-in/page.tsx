import { PageHeader } from "@/components/page-header";
import { CheckInScanner } from "@/components/check-in-scanner";
import { listCheckInAttendees } from "@/lib/actions/check-in";
import { getEventDays, getEvents, getSessions, getTicketTypes } from "@/lib/data";

export default async function DashboardCheckInPage() {
  const [events, eventDays, sessions, ticketTypes] = await Promise.all([getEvents(), getEventDays(), getSessions(), getTicketTypes()]);
  const initialEventDayId = events[0]?.id ? eventDays.find((day) => day.event_id === events[0].id)?.id : null;
  const initialAttendeeList = events[0]?.id && initialEventDayId
    ? await listCheckInAttendees({ eventId: events[0].id, eventDayId: initialEventDayId, sessionId: null })
    : { attendees: [] };

  return (
    <>
      <PageHeader eyebrow="Staff Mode" title="Check-in" description="Scan QR codes first, then fall back to ticket codes, guest lookup, or walk-up entry." />
      <CheckInScanner
        events={events}
        eventDays={eventDays}
        sessions={sessions}
        ticketTypes={ticketTypes}
        initialAttendees={initialAttendeeList.attendees}
      />
    </>
  );
}
