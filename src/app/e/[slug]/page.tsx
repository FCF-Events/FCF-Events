import { notFound } from "next/navigation";
import { CalendarDays, ExternalLink, MapPin, ShieldCheck, Ticket } from "lucide-react";
import { AddToCalendarButton } from "@/components/add-to-calendar-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RegistrationForm } from "@/components/registration-form";
import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";
import { getEventBySlug, getEventDays, getSessions, getTicketTypes } from "@/lib/data";
import { eventLocationLabel, googleMapsSearchUrl } from "@/lib/utils";

export default async function PublicEventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event || event.status !== "published") notFound();

  const [eventDays, sessions, ticketTypes] = await Promise.all([getEventDays(event.id), getSessions(event.id), getTicketTypes(event.id)]);
  const locationLabel = eventLocationLabel(event.venue_name, event.address) || "Venue TBA";
  const mapsHref = event.address?.trim() ? googleMapsSearchUrl(locationLabel) : null;

  return (
    <main className="min-h-screen bg-[#0b0b0b] text-white">
      <PublicHeader signupHref="#register" />
      <section className="border-b border-white/10">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] md:px-8 md:py-12">
          <div className="min-w-0">
            <Badge className="mb-4">FCF Events</Badge>
            <h1 className="text-3xl font-semibold leading-tight sm:text-4xl md:text-6xl">{event.title}</h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-[#dddddd]">{event.description}</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <AddToCalendarButton
                title={event.title}
                startsAt={event.starts_at}
                endsAt={event.ends_at}
                location={locationLabel}
                description={event.description}
                fileName={`${event.slug}.ics`}
                className="w-full sm:w-auto"
              />
            </div>
            <div className="mt-8 grid gap-3 md:grid-cols-2">
              <Info icon={CalendarDays} label="Date" value={new Date(event.starts_at).toLocaleString()} />
              <Info icon={MapPin} label="Venue" value={locationLabel} href={mapsHref} />
              <Info icon={Ticket} label="Capacity" value={event.capacity ? `${event.capacity} guests` : "Limited capacity"} />
              <Info icon={ShieldCheck} label="Age requirement" value={`${event.minimum_age}+`} />
            </div>
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Compliance Note</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-[#999999]">{event.compliance_notes}</p>
              </CardContent>
            </Card>
          </div>
          <div id="register" className="min-w-0">
            <RegistrationForm event={event} eventDays={eventDays} ticketTypes={ticketTypes} sessions={sessions} />
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        <h2 className="text-2xl font-semibold">Agenda</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {sessions.map((session) => (
            <Card key={session.id}>
              <CardContent className="p-5">
                {session.event_day_id ? (
                  <p className="mb-3 text-xs font-medium uppercase tracking-[0.12em] text-[#999999]">
                    {eventDays.find((day) => day.id === session.event_day_id)?.label}
                  </p>
                ) : null}
                <Badge variant="muted">{session.type}</Badge>
                <h3 className="mt-4 text-lg font-semibold">{session.title}</h3>
                <p className="mt-2 text-sm text-[#999999]">{new Date(session.starts_at).toLocaleTimeString()} · {session.room}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}

function Info({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  value: string;
  href?: string | null;
}) {
  return (
    <div className="rounded-md border border-white/10 bg-[#111111] p-4">
      <Icon className="h-5 w-5 text-[#e50913]" aria-hidden />
      <p className="mt-3 text-sm text-[#999999]">{label}</p>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex min-w-0 items-center gap-1 text-sm font-medium text-white underline-offset-4 transition hover:text-[#ff6b6f] hover:underline"
        >
          {value}
          <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
        </a>
      ) : (
        <p className="mt-1 text-sm font-medium text-white">{value}</p>
      )}
    </div>
  );
}
