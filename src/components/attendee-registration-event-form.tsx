"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateAttendeeRegistrationEventAction } from "@/lib/actions/attendees";
import type { AttendeeEventTicket, EventSummary, SessionSummary, TicketTypeSummary } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";

const registrationStatusOptions = [
  { label: "Confirmed", value: "confirmed" },
  { label: "Pending", value: "pending" },
  { label: "Waitlisted", value: "waitlisted" },
  { label: "Cancelled", value: "cancelled" },
];

const paymentStatusOptions = [
  { label: "Not required", value: "not_required" },
  { label: "Pending", value: "pending" },
  { label: "Paid", value: "paid" },
  { label: "Partially paid", value: "partially_paid" },
  { label: "Comped", value: "comped" },
  { label: "Failed", value: "failed" },
  { label: "Refunded", value: "refunded" },
];

export function AttendeeRegistrationEventForm({
  attendeeId,
  registration,
  events,
  ticketTypes,
  sessions,
}: {
  attendeeId: string;
  registration: AttendeeEventTicket;
  events: EventSummary[];
  ticketTypes: TicketTypeSummary[];
  sessions: SessionSummary[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [eventId, setEventId] = useState(registration.event_id);
  const [ticketTypeId, setTicketTypeId] = useState(registration.ticket_type_id ?? "");
  const [selectedSessionIds, setSelectedSessionIds] = useState(() => registration.sessions.map((session) => session.id));

  const eventOptions = useMemo(
    () =>
      events.map((event) => ({
        label: `${event.title} - ${formatOptionDate(event.starts_at, event.timezone)}`,
        value: event.id,
      })),
    [events],
  );
  const eventTicketTypes = useMemo(() => ticketTypes.filter((ticketType) => ticketType.event_id === eventId), [eventId, ticketTypes]);
  const eventSessions = useMemo(() => sessions.filter((session) => session.event_id === eventId), [eventId, sessions]);
  const ticketTypeOptions = [
    { label: "No ticket type", value: "" },
    ...eventTicketTypes.map((ticketType) => ({ label: ticketType.name, value: ticketType.id })),
  ];

  function changeEvent(nextEventId: string) {
    setEventId(nextEventId);
    const nextTicketType = ticketTypes.find((ticketType) => ticketType.event_id === nextEventId);
    setTicketTypeId(nextTicketType?.id ?? "");
    setSelectedSessionIds([]);
  }

  function toggleSession(sessionId: string, checked: boolean) {
    setSelectedSessionIds((current) =>
      checked ? [...new Set([...current, sessionId])] : current.filter((id) => id !== sessionId),
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await updateAttendeeRegistrationEventAction(formData);
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
        return;
      }

      toast.error(result.message);
    });
  }

  return (
    <form onSubmit={submit} className="rounded-md border border-white/10 bg-[#0b0b0b] p-4">
      <input type="hidden" name="attendeeId" value={attendeeId} />
      <input type="hidden" name="registrationId" value={registration.registration_id} />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Event">
          <SelectField name="eventId" value={eventId} onChange={(event) => changeEvent(event.target.value)} options={eventOptions} />
        </Field>
        <Field label="Ticket type">
          <SelectField name="ticketTypeId" value={ticketTypeId} onChange={(event) => setTicketTypeId(event.target.value)} options={ticketTypeOptions} />
        </Field>
        <Field label="Registration">
          <SelectField name="registrationStatus" defaultValue={registration.registration_status} options={registrationStatusOptions} />
        </Field>
        <Field label="Payment">
          <SelectField name="paymentStatus" defaultValue={registration.payment_status} options={paymentStatusOptions} />
        </Field>
      </div>

      <div className="mt-4">
        <p className="text-sm font-medium text-[#dddddd]">Sessions</p>
        {eventSessions.length ? (
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {eventSessions.map((session) => (
              <label key={session.id} className="flex items-start gap-3 rounded-md border border-white/10 px-3 py-2 text-sm text-[#dddddd]">
                <input
                  type="checkbox"
                  name="sessionIds"
                  value={session.id}
                  checked={selectedSessionIds.includes(session.id)}
                  onChange={(event) => toggleSession(session.id, event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-white/20 accent-[#e50913]"
                />
                <span>
                  <span className="block text-white">{session.title}</span>
                  <span className="text-xs text-[#999999]">{formatOptionDate(session.starts_at)}</span>
                </span>
              </label>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-[#999999]">No sessions for this event.</p>
        )}
      </div>

      <div className="mt-4 flex justify-end">
        <Button type="submit" variant="outline" disabled={isPending}>
          <RefreshCw className="h-4 w-4" aria-hidden />
          {isPending ? "Updating" : "Update Event"}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function formatOptionDate(value: string, timeZone = "America/Toronto") {
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone,
  }).format(new Date(value));
}
