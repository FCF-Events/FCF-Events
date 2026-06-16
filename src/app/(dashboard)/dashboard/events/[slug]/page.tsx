import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Pencil, Users } from "lucide-react";
import { EventEditForm } from "@/components/event-edit-form";
import { EventZeffySettingsForm } from "@/components/event-zeffy-settings-form";
import { PageHeader } from "@/components/page-header";
import { TicketTypeManager } from "@/components/ticket-type-manager";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getEventAttendees, getEventBySlug, getSessions, getTicketTypes } from "@/lib/data";
import { eventLocationLabel, googleMapsSearchUrl } from "@/lib/utils";

export default async function EventDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  const [sessions, ticketTypes, attendees] = await Promise.all([
    getSessions(event.id),
    getTicketTypes(event.id),
    getEventAttendees(event.id),
  ]);
  const locationLabel = eventLocationLabel(event.venue_name, event.address);
  const mapsHref = event.address?.trim() ? googleMapsSearchUrl(locationLabel) : null;

  return (
    <>
      <PageHeader
        eyebrow="Event"
        title={event.title}
        description={event.description}
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link href={`/dashboard/events/${event.slug}#edit-event`}>
                <Pencil className="h-4 w-4" aria-hidden />
                Edit
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href={`/dashboard/events/${event.slug}#attendees`}>
                <Users className="h-4 w-4" aria-hidden />
                Attendees
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/e/${event.slug}`}>
                <ExternalLink className="h-4 w-4" aria-hidden />
                Public Page
              </Link>
            </Button>
          </div>
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
            <Info label="Zeffy campaign" value={event.zeffy_campaign_id ?? "Not configured"} />
            <Info
              label="Zeffy form"
              value={
                event.zeffy_form_url ? (
                  <a
                    href={event.zeffy_form_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-white underline-offset-4 transition hover:text-[#ff6b6f] hover:underline"
                  >
                    Open form
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  </a>
                ) : (
                  "Not configured"
                )
              }
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Ticket Types</CardTitle>
          </CardHeader>
          <CardContent>
            <TicketTypeManager eventId={event.id} ticketTypes={ticketTypes} />
          </CardContent>
        </Card>
      </div>
      <Card id="edit-event" className="mt-4 scroll-mt-6">
        <CardHeader>
          <CardTitle>Edit Event</CardTitle>
        </CardHeader>
        <CardContent>
          <EventEditForm event={event} />
        </CardContent>
      </Card>
      <Card id="attendees" className="mt-4 scroll-mt-6">
        <CardHeader>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <CardTitle>Attendees</CardTitle>
            <Badge variant="muted">{attendees.length} registered</Badge>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {attendees.length ? (
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="text-[#999999]">
                <tr className="border-b border-white/10">
                  <th className="py-3 pr-4 font-medium">Name</th>
                  <th className="py-3 pr-4 font-medium">Company</th>
                  <th className="py-3 pr-4 font-medium">Contact</th>
                  <th className="py-3 pr-4 font-medium">Ticket</th>
                  <th className="py-3 pr-4 font-medium">Registration</th>
                  <th className="py-3 pr-4 font-medium">Payment</th>
                  <th className="py-3 font-medium">Check-in</th>
                </tr>
              </thead>
              <tbody>
                {attendees.map((attendee) => (
                  <tr key={attendee.registration_id} className="border-b border-white/5">
                    <td className="py-4 pr-4 text-white">
                      <p className="font-medium">{attendee.full_name}</p>
                      <p className="text-[#999999]">{attendee.role_title ?? "No role listed"}</p>
                    </td>
                    <td className="py-4 pr-4 text-[#dddddd]">{attendee.company ?? "No company"}</td>
                    <td className="py-4 pr-4 text-[#999999]">
                      <p>{attendee.email ?? "No email"}</p>
                      <p>{attendee.phone ?? "No phone"}</p>
                    </td>
                    <td className="py-4 pr-4 text-[#dddddd]">
                      <p>{attendee.ticket_type_name ?? "No ticket type"}</p>
                      <p className="text-[#999999]">{attendee.ticket_code ?? "No ticket issued"}</p>
                    </td>
                    <td className="py-4 pr-4">
                      <div className="space-y-2">
                        <StatusBadge status={attendee.registration_status} />
                        <p className="text-[#999999]">{formatDateTime(attendee.registered_at)}</p>
                      </div>
                    </td>
                    <td className="py-4 pr-4">
                      <PaymentBadge status={attendee.payment_status} />
                    </td>
                    <td className="py-4">
                      {attendee.checked_in_at ? (
                        <div className="space-y-2">
                          <Badge variant="success">Checked in</Badge>
                          <p className="text-[#999999]">{formatDateTime(attendee.checked_in_at)}</p>
                        </div>
                      ) : (
                        <Badge variant="muted">Not checked in</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="rounded-md border border-white/10 px-4 py-8 text-sm text-[#999999]">
              No attendees have registered for this event yet.
            </div>
          )}
        </CardContent>
      </Card>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Zeffy Payment Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <EventZeffySettingsForm event={event} />
        </CardContent>
      </Card>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Agenda</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {sessions.map((session) => (
            <div key={session.id} className="rounded-md border border-white/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium text-white">{session.title}</p>
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/dashboard/sessions#session-${session.id}`}>
                    <Pencil className="h-4 w-4" aria-hidden />
                    Edit
                  </Link>
                </Button>
              </div>
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

function StatusBadge({ status }: { status: string }) {
  const variant = status === "confirmed" ? "success" : status === "cancelled" ? "danger" : "muted";
  return <Badge variant={variant}>{labelize(status)}</Badge>;
}

function PaymentBadge({ status }: { status: string }) {
  const variant = ["paid", "comped", "not_required"].includes(status)
    ? "success"
    : ["failed", "refunded"].includes(status)
      ? "danger"
      : "muted";
  return <Badge variant={variant}>{labelize(status)}</Badge>;
}

function labelize(value: string) {
  return value.replace(/_/g, " ");
}

function formatDateTime(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Not recorded";
}
