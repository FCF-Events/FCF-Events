import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Clock, MapPin, ShieldCheck, Ticket, UserRound } from "lucide-react";
import { AddToCalendarButton } from "@/components/add-to-calendar-button";
import { PrintTicketButton } from "@/components/print-ticket-button";
import { SendTicketEmailForm } from "@/components/send-ticket-email-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TicketQr } from "@/components/ticket-qr";
import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";
import { getTicketDetails } from "@/lib/data";
import { ticketUrl } from "@/lib/security/qr";
import { currency, eventLocationLabel, googleMapsSearchUrl } from "@/lib/utils";

export default async function TicketPage({ params }: { params: Promise<{ ticketCode: string }> }) {
  const { ticketCode } = await params;
  const decoded = decodeURIComponent(ticketCode);
  const ticket = await getTicketDetails(decoded);
  if (!ticket) notFound();

  const url = ticketUrl(decoded);
  const locationLabel = eventLocationLabel(ticket.venue_name, ticket.address) || "Venue TBA";
  const mapsHref = ticket.address?.trim() ? googleMapsSearchUrl(locationLabel) : null;
  const ticketPrice =
    ticket.ticket_type_price === null ? null : currency(ticket.ticket_type_price, ticket.ticket_type_currency ?? "CAD");

  return (
    <main className="min-h-screen bg-[#0b0b0b] text-white print:bg-white print:text-black">
      <div className="print:hidden">
        <PublicHeader />
      </div>
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex flex-col gap-3 print:hidden lg:flex-row lg:items-center lg:justify-between">
          <Button asChild variant="outline">
            <Link href="/">FCF Events</Link>
          </Button>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <PrintTicketButton />
            <AddToCalendarButton
              title={ticket.event_title}
              startsAt={ticket.event_starts_at}
              endsAt={ticket.event_ends_at}
              location={locationLabel}
              description={`${ticket.event_description}\n\nTicket code: ${ticket.ticket_code}`}
              url={url}
              fileName={`${ticket.event_slug}-ticket.ics`}
            />
            <SendTicketEmailForm ticketCode={decoded} defaultEmail={ticket.attendee_email} />
          </div>
        </div>

        <Card className="border-white/20 print:border-black print:bg-white">
          <CardHeader>
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <Badge className="mb-3 print:border print:border-black print:bg-white print:text-black">FCF Event Ticket</Badge>
                <h1 className="text-3xl font-semibold leading-tight text-white print:text-black md:text-4xl">
                  {ticket.event_title}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#bbbbbb] print:text-gray-700">
                  {ticket.event_description}
                </p>
              </div>
              <Badge variant={ticket.ticket_status === "active" ? "success" : "danger"} className="w-fit capitalize">
                {ticket.ticket_status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Detail icon={CalendarDays} label="Date" value={formatDate(ticket.event_starts_at, ticket.event_timezone)} />
                  <Detail
                    icon={Clock}
                    label="Time"
                    value={`${formatTime(ticket.event_starts_at, ticket.event_timezone)} - ${formatTime(ticket.event_ends_at, ticket.event_timezone)}`}
                  />
                  <Detail icon={MapPin} label="Location" value={locationLabel} href={mapsHref} className="sm:col-span-2" />
                  {ticket.room ? <Detail icon={MapPin} label="Room" value={ticket.room} /> : null}
                  <Detail icon={Ticket} label="Ticket type" value={ticket.ticket_type_name ?? "Event ticket"} />
                  <Detail icon={ShieldCheck} label="Age requirement" value={`${ticket.minimum_age}+`} />
                </div>

                <div className="rounded-md border border-white/10 p-4 print:border-gray-300">
                  <div className="flex items-center gap-2 text-sm font-medium text-white print:text-black">
                    <UserRound className="h-4 w-4 text-[#e50913] print:text-black" aria-hidden />
                    Attendee
                  </div>
                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <Field label="Name" value={ticket.attendee_name} />
                    <Field label="Email" value={ticket.attendee_email ?? "Not provided"} />
                    <Field label="Phone" value={ticket.attendee_phone ?? "Not provided"} />
                    <Field label="Company" value={ticket.attendee_company ?? "Not provided"} />
                    {ticket.attendee_role_title ? <Field label="Role / title" value={ticket.attendee_role_title} /> : null}
                  </dl>
                </div>

                <div className="rounded-md border border-white/10 p-4 print:border-gray-300">
                  <div className="flex items-center gap-2 text-sm font-medium text-white print:text-black">
                    <Ticket className="h-4 w-4 text-[#e50913] print:text-black" aria-hidden />
                    Ticket details
                  </div>
                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <Field label="Code" value={ticket.ticket_code} isCode />
                    <Field label="Issued" value={formatDateTime(ticket.issued_at, ticket.event_timezone)} />
                    <Field label="Registration" value={ticket.registration_status} />
                    <Field label="Payment" value={ticket.payment_status} />
                    {ticketPrice ? <Field label="Price" value={ticketPrice} /> : null}
                  </dl>
                </div>
              </div>

              <aside className="flex flex-col items-center rounded-md border border-white/10 p-5 text-center print:border-gray-300">
                <TicketQr value={url} />
                <p className="mt-5 text-sm text-[#999999] print:text-gray-600">Ticket code</p>
                <p className="mt-2 break-all font-mono text-lg font-semibold tracking-[0.08em] print:text-black">
                  {decoded}
                </p>
                <div className="mt-5 rounded-md border border-white/10 p-4 text-left text-sm leading-6 text-[#dddddd] print:border-gray-300 print:text-gray-800">
                  <div className="mb-2 flex items-center gap-2 font-medium text-white print:text-black">
                    <ShieldCheck className="h-4 w-4" aria-hidden />
                    Secure check-in
                  </div>
                  This QR code contains an opaque ticket URL only. Staff validation checks ticket status server-side.
                </div>
              </aside>
            </div>

            {ticket.sessions.length ? (
              <section>
                <h2 className="text-lg font-semibold text-white print:text-black">Selected Sessions</h2>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {ticket.sessions.map((session) => (
                    <div key={session.id} className="rounded-md border border-white/10 p-4 print:border-gray-300">
                      <Badge variant="muted" className="capitalize print:border print:border-gray-300 print:bg-white print:text-black">
                        {session.type}
                      </Badge>
                      <h3 className="mt-3 font-semibold text-white print:text-black">{session.title}</h3>
                      <p className="mt-2 text-sm text-[#999999] print:text-gray-700">
                        {formatTime(session.starts_at, ticket.event_timezone)} - {formatTime(session.ends_at, ticket.event_timezone)}
                        {session.room ? ` - ${session.room}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {ticket.compliance_notes ? (
              <section className="rounded-md border border-white/10 p-4 text-sm leading-6 text-[#dddddd] print:border-gray-300 print:text-gray-800">
                <div className="mb-2 flex items-center gap-2 font-medium text-white print:text-black">
                  <ShieldCheck className="h-4 w-4 text-[#e50913] print:text-black" aria-hidden />
                  Compliance note
                </div>
                {ticket.compliance_notes}
              </section>
            ) : null}
          </CardContent>
        </Card>

        <section className="mt-6 rounded-lg border border-white/10 bg-[#111111] p-5 print:hidden">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Create your account</h2>
              <p className="mt-1 text-sm leading-6 text-[#999999]">
                Set a password to save this ticket, manage attendee details, and access future FCF event tickets.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button asChild size="lg">
                <Link href={`/signup?${new URLSearchParams({ email: ticket.attendee_email ?? "", redirect: "/account" })}`}>
                  Set Password & Sign Up
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
      <div className="print:hidden">
        <PublicFooter />
      </div>
    </main>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
  href,
  className,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  value: string;
  href?: string | null;
  className?: string;
}) {
  return (
    <div className={`rounded-md border border-white/10 p-4 print:border-gray-300 ${className ?? ""}`}>
      <Icon className="h-5 w-5 text-[#e50913] print:text-black" aria-hidden />
      <p className="mt-3 text-sm text-[#999999] print:text-gray-600">{label}</p>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 block text-sm font-medium text-white underline-offset-4 transition hover:text-[#ff6b6f] hover:underline print:text-black"
        >
          {value}
        </a>
      ) : (
        <p className="mt-1 text-sm font-medium text-white print:text-black">{value}</p>
      )}
    </div>
  );
}

function Field({ label, value, isCode = false }: { label: string; value: string; isCode?: boolean }) {
  return (
    <div>
      <dt className="text-[#999999] print:text-gray-600">{label}</dt>
      <dd className={`mt-1 text-white print:text-black ${isCode ? "break-all font-mono" : ""}`}>{value}</dd>
    </div>
  );
}

function formatDate(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone,
  }).format(new Date(value));
}

function formatDateTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}

function formatTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(value));
}
