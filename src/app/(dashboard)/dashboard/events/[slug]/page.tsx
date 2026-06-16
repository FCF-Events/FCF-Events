import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getEventBySlug, getSessions, getTicketTypes } from "@/lib/data";
import { currency, eventLocationLabel, googleMapsSearchUrl } from "@/lib/utils";

export default async function EventDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  const [sessions, ticketTypes] = await Promise.all([getSessions(event.id), getTicketTypes(event.id)]);
  const locationLabel = eventLocationLabel(event.venue_name, event.address);
  const mapsHref = event.address?.trim() ? googleMapsSearchUrl(locationLabel) : null;

  return (
    <>
      <PageHeader
        eyebrow="Event"
        title={event.title}
        description={event.description}
        action={
          <Button asChild variant="outline">
            <Link href={`/e/${event.slug}`}>
              <ExternalLink className="h-4 w-4" aria-hidden />
              Public Page
            </Link>
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Event Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Info label="Status" value={<Badge variant={event.status === "published" ? "success" : "muted"}>{event.status}</Badge>} />
            <Info label="Visibility" value={event.visibility} />
            <Info label="Start" value={new Date(event.starts_at).toLocaleString()} />
            <Info label="End" value={new Date(event.ends_at).toLocaleString()} />
            <Info
              label="Venue"
              value={
                mapsHref ? (
                  <a
                    href={mapsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-white underline-offset-4 transition hover:text-[#ff6b6f] hover:underline"
                  >
                    {locationLabel}
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  </a>
                ) : (
                  locationLabel || "No venue"
                )
              }
            />
            <Info label="Capacity" value={event.capacity ?? "Unlimited"} />
            <Info label="Minimum age" value={`${event.minimum_age}+`} />
            <Info label="Compliance" value={event.compliance_notes ?? "No notes"} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Ticket Types</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {ticketTypes.map((ticket) => (
              <div key={ticket.id} className="rounded-md border border-white/10 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-white">{ticket.name}</p>
                  <p className="text-sm text-[#dddddd]">{currency(ticket.price, ticket.currency)}</p>
                </div>
                <p className="mt-2 text-sm text-[#999999]">{ticket.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Agenda</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {sessions.map((session) => (
            <div key={session.id} className="rounded-md border border-white/10 p-4">
              <p className="font-medium text-white">{session.title}</p>
              <p className="mt-1 text-sm text-[#999999]">{new Date(session.starts_at).toLocaleTimeString()} · {session.room}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm text-[#999999]">{label}</p>
      <div className="mt-1 text-sm text-white">{value}</div>
    </div>
  );
}
