import Link from "next/link";
import { CalendarDays, Clock, History, MapPin, Ticket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAccountAccess } from "@/lib/auth";
import { getAccountTickets } from "@/lib/data";
import type { AccountTicketSummary } from "@/lib/types";

export default async function AccountPage() {
  const account = await requireAccountAccess();
  const tickets = await getAccountTickets(account.email);
  const now = Date.now();
  const upcoming = tickets.filter((ticket) => new Date(ticket.event_ends_at).getTime() >= now);
  const past = tickets.filter((ticket) => new Date(ticket.event_ends_at).getTime() < now);

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Ticket className="h-5 w-5 text-[#e50913]" aria-hidden />
          <h2 className="text-xl font-semibold">My Tickets</h2>
        </div>
        {upcoming.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {upcoming.map((ticket) => (
              <TicketCard key={ticket.ticket_id} ticket={ticket} />
            ))}
          </div>
        ) : (
          <EmptyState title="No upcoming tickets" text="When you register for an upcoming FCF event, your ticket will show here." />
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <History className="h-5 w-5 text-[#e50913]" aria-hidden />
          <h2 className="text-xl font-semibold">Past Events</h2>
        </div>
        {past.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {past.map((ticket) => (
              <TicketCard key={ticket.ticket_id} ticket={ticket} isPast />
            ))}
          </div>
        ) : (
          <EmptyState title="No past events yet" text="Events move here after the event date has passed." />
        )}
      </section>
    </div>
  );
}

function TicketCard({ ticket, isPast = false }: { ticket: AccountTicketSummary; isPast?: boolean }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Badge variant={isPast ? "muted" : "success"}>{isPast ? "Past event" : "Upcoming"}</Badge>
            <CardTitle className="mt-3">{ticket.event_title}</CardTitle>
            <p className="mt-1 text-sm text-[#999999]">{ticket.ticket_type_name ?? "Event ticket"}</p>
          </div>
          <Badge variant="muted">{ticket.ticket_status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 text-sm text-[#dddddd] sm:grid-cols-2">
          <span className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-[#e50913]" aria-hidden />
            {new Date(ticket.event_starts_at).toLocaleDateString("en-CA", {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
          <span className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#e50913]" aria-hidden />
            {new Date(ticket.event_starts_at).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" })}
          </span>
          <span className="flex items-center gap-2 sm:col-span-2">
            <MapPin className="h-4 w-4 text-[#e50913]" aria-hidden />
            {ticket.venue_name ?? ticket.address ?? "Venue TBA"}
          </span>
        </div>
        <div className="rounded-md border border-white/10 p-3 text-sm text-[#999999]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>Ticket code</span>
            <span className="font-mono text-white">{ticket.ticket_code}</span>
          </div>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>Payment</span>
            <span className="text-white">{ticket.payment_status}</span>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild>
            <Link href={`/ticket/${encodeURIComponent(ticket.ticket_code)}`}>View Ticket</Link>
          </Button>
          {!isPast ? (
            <Button asChild variant="outline">
              <Link href={`/e/${ticket.event_slug}`}>Event Details</Link>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="font-semibold text-white">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-[#999999]">{text}</p>
      </CardContent>
    </Card>
  );
}
