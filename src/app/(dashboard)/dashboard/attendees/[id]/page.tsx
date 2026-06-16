import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, ExternalLink, QrCode } from "lucide-react";
import { AttendeeProfileForm } from "@/components/attendee-profile-form";
import { AttendeeRegistrationEventForm } from "@/components/attendee-registration-event-form";
import { PageHeader } from "@/components/page-header";
import { SendTicketEmailForm } from "@/components/send-ticket-email-form";
import { TicketQr } from "@/components/ticket-qr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAttendeeById, getAttendeeEventTickets, getEvents, getSessions, getTicketTypes } from "@/lib/data";
import { ticketUrl } from "@/lib/security/qr";
import type { AttendeeEventTicket, EventSummary, SessionSummary, TicketTypeSummary } from "@/lib/types";
import { currency } from "@/lib/utils";

export default async function AttendeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [attendee, registrations, events, ticketTypes, sessions] = await Promise.all([
    getAttendeeById(id),
    getAttendeeEventTickets(id),
    getEvents(),
    getTicketTypes(),
    getSessions(),
  ]);

  if (!attendee) notFound();
  const historyStats = buildHistoryStats(registrations);

  return (
    <>
      <PageHeader
        eyebrow="Attendee"
        title={attendee.full_name}
        description="Edit attendee contact details and review event history, assignments, ticket numbers, and QR codes."
        action={
          <Button asChild variant="outline">
            <Link href="/dashboard/attendees">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Attendees
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_0.72fr]">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <AttendeeProfileForm attendee={attendee} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activity</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <Metric label="Registered events" value={attendee.events_registered_count} />
            <Metric label="Event check-ins" value={attendee.events_attended_count} />
            <Metric label="Session check-ins" value={attendee.sessions_attended_count} />
            <Metric label="Last registered" value={formatOptionalDate(attendee.last_registered_at)} />
            <Metric label="Last attended" value={formatOptionalDate(attendee.last_attended_at)} />
            <Metric label="First seen" value={formatOptionalDate(attendee.first_seen_at)} />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Event History & Tickets</CardTitle>
              <p className="mt-1 text-sm text-[#999999]">Event history, current assignments, issued ticket numbers, and QR codes.</p>
            </div>
            <Badge variant="muted">{registrations.length} registrations</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <HistoryMetric label="Upcoming" value={historyStats.upcoming} />
            <HistoryMetric label="Past" value={historyStats.past} />
            <HistoryMetric label="Checked in" value={historyStats.checkedIn} />
            <HistoryMetric label="Balance" value={currency(historyStats.balance)} />
          </div>

          {registrations.length ? (
            registrations.map((registration) => (
              <RegistrationTicketCard
                key={registration.registration_id}
                attendeeId={attendee.id}
                registration={registration}
                attendeeEmail={attendee.email}
                events={events}
                ticketTypes={ticketTypes}
                sessions={sessions}
              />
            ))
          ) : (
            <div className="rounded-md border border-white/10 p-5 text-sm text-[#999999]">
              No event registrations found for this attendee.
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function RegistrationTicketCard({
  attendeeId,
  registration,
  attendeeEmail,
  events,
  ticketTypes,
  sessions,
}: {
  attendeeId: string;
  registration: AttendeeEventTicket;
  attendeeEmail: string | null;
  events: EventSummary[];
  ticketTypes: TicketTypeSummary[];
  sessions: SessionSummary[];
}) {
  const ticketHref = registration.ticket_code ? `/ticket/${encodeURIComponent(registration.ticket_code)}` : null;
  const qrValue = registration.ticket_code ? ticketUrl(registration.ticket_code) : null;
  const balance = Math.max(0, registration.amount_due - registration.amount_paid);

  return (
    <div className="rounded-md border border-white/10 p-4">
      <div className="grid gap-5 xl:grid-cols-[1fr_auto]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <Link href={`/dashboard/events/${registration.event_slug}`} className="inline-flex items-center gap-2 text-base font-semibold text-white hover:text-[#ff6b6f]">
                <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
                <span className="truncate">{registration.event_title}</span>
              </Link>
              <p className="mt-1 text-sm text-[#999999]">
                {formatEventDate(registration.event_starts_at, registration.event_timezone)}
                {registration.venue_name ? ` - ${registration.venue_name}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="muted">{registration.event_status}</Badge>
              <Badge variant={statusBadgeVariant(registration.registration_status)}>{registration.registration_status}</Badge>
              <Badge variant={statusBadgeVariant(registration.payment_status)}>{registration.payment_status}</Badge>
              {registration.ticket_status ? (
                <Badge variant={statusBadgeVariant(registration.ticket_status)}>{registration.ticket_status}</Badge>
              ) : (
                <Badge variant="muted">No ticket</Badge>
              )}
            </div>
          </div>

          <div className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-3">
            <Info label="Ticket number" value={registration.ticket_code ?? "Not issued yet"} mono={Boolean(registration.ticket_code)} />
            <Info label="Ticket type" value={registration.ticket_type_name ?? "Event ticket"} />
            <Info label="Registered" value={formatEventDate(registration.registered_at, registration.event_timezone)} />
            <Info label="Issued" value={formatOptionalDate(registration.issued_at, registration.event_timezone)} />
            <Info label="Amount due" value={currency(registration.amount_due)} />
            <Info label="Amount paid" value={currency(registration.amount_paid)} />
            <Info label="Balance" value={currency(balance)} />
            <Info label="Event check-in" value={formatOptionalDate(registration.checked_in_at, registration.event_timezone)} />
            <Info label="Session check-ins" value={String(registration.session_check_in_count)} />
          </div>

          <div>
            <p className="text-sm font-medium text-white">Selected sessions</p>
            {registration.sessions.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {registration.sessions.map((session) => (
                  <Badge key={session.id} variant="muted">
                    {session.title}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-sm text-[#999999]">No sessions selected.</p>
            )}
          </div>

          <AttendeeRegistrationEventForm
            attendeeId={attendeeId}
            registration={registration}
            events={events}
            ticketTypes={ticketTypes}
            sessions={sessions}
          />
        </div>

        <div className="flex flex-col gap-3">
          {qrValue && registration.ticket_code ? (
            <>
              <TicketQr value={qrValue} size={176} />
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={ticketHref ?? "#"}>
                    <ExternalLink className="h-4 w-4" aria-hidden />
                    Open Ticket
                  </Link>
                </Button>
                <SendTicketEmailForm ticketCode={registration.ticket_code} defaultEmail={attendeeEmail} />
              </div>
            </>
          ) : (
            <div className="flex w-full max-w-[220px] flex-col items-center justify-center rounded-md border border-dashed border-white/15 p-5 text-center text-sm text-[#999999]">
              <QrCode className="mb-2 h-6 w-6 text-[#dddddd]" aria-hidden />
              Ticket QR appears here after payment or ticket issue.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HistoryMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-white/10 bg-[#0b0b0b] p-3">
      <p className="text-xs uppercase tracking-[0.12em] text-[#666666]">{label}</p>
      <p className="mt-2 text-base font-semibold text-white">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-white/10 bg-[#0b0b0b] p-4">
      <p className="text-sm text-[#999999]">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.12em] text-[#666666]">{label}</p>
      <p className={`mt-1 break-words text-[#dddddd] ${mono ? "font-mono text-xs tracking-[0.08em]" : ""}`}>{value}</p>
    </div>
  );
}

function statusBadgeVariant(status: string | null): "default" | "muted" | "success" | "danger" {
  if (!status) return "muted";
  if (["active", "confirmed", "paid", "not_required", "comped"].includes(status)) return "success";
  if (["cancelled", "revoked", "failed", "refunded"].includes(status)) return "danger";
  return "muted";
}

function formatOptionalDate(value: string | null, timeZone = "America/Toronto") {
  if (!value) return "None";
  return formatEventDate(value, timeZone);
}

function formatEventDate(value: string, timeZone = "America/Toronto") {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}

function buildHistoryStats(registrations: AttendeeEventTicket[]) {
  const now = Date.now();

  return registrations.reduce(
    (stats, registration) => {
      const isPast = new Date(registration.event_ends_at).getTime() < now || registration.event_status === "past";
      const balance = Math.max(0, registration.amount_due - registration.amount_paid);

      return {
        upcoming: stats.upcoming + (!isPast && registration.registration_status !== "cancelled" ? 1 : 0),
        past: stats.past + (isPast ? 1 : 0),
        checkedIn: stats.checkedIn + (registration.checked_in_at ? 1 : 0),
        balance: stats.balance + balance,
      };
    },
    { upcoming: 0, past: 0, checkedIn: 0, balance: 0 },
  );
}
