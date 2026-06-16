import { ChevronDown, Pencil, Save } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { Textarea } from "@/components/ui/textarea";
import { updateSessionAction } from "@/lib/actions/sessions";
import { getEventDays, getEvents, getSessions, getTicketTypes } from "@/lib/data";
import { toDateTimeLocalInputValue } from "@/lib/utils";

const statusOptions = [
  { label: "Draft", value: "draft" },
  { label: "Published", value: "published" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Past", value: "past" },
];

const sessionTypeOptions = [
  { label: "Seminar", value: "seminar" },
  { label: "Panel", value: "panel" },
  { label: "Keynote", value: "keynote" },
  { label: "Workshop", value: "workshop" },
  { label: "Networking", value: "networking" },
  { label: "VIP", value: "vip" },
  { label: "Press", value: "press" },
  { label: "Sponsor", value: "sponsor" },
];

export default async function SessionsPage() {
  const [events, eventDays, sessions, ticketTypes] = await Promise.all([getEvents(), getEventDays(), getSessions(), getTicketTypes()]);
  const eventOptions = events.map((event) => ({ label: event.title, value: event.id }));
  const eventTitleById = new Map(events.map((event) => [event.id, event.title]));
  const eventDayOptionsByEventId = new Map(
    events.map((event) => [
      event.id,
      eventDays
        .filter((day) => day.event_id === event.id)
        .map((day) => ({ label: `${day.label} - ${new Date(day.starts_at).toLocaleDateString()}`, value: day.id })),
    ]),
  );
  const ticketTypesByEventId = new Map(
    events.map((event) => [event.id, ticketTypes.filter((ticketType) => ticketType.event_id === event.id)]),
  );

  async function updateSession(formData: FormData) {
    "use server";
    await updateSessionAction(formData);
  }

  return (
    <>
      <PageHeader eyebrow="Agenda" title="Sessions" description="Edit seminars, panels, workshops, and networking blocks across events." />
      {sessions.length ? (
        <div className="space-y-3">
          {sessions.map((session) => (
            <Card key={session.id} id={`session-${session.id}`} className="scroll-mt-6 overflow-hidden">
              <details className="group">
                <summary className="list-none cursor-pointer [&::-webkit-details-marker]:hidden">
                  <CardHeader className="transition-colors group-open:border-b group-open:border-white/10">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <CardTitle>{session.title}</CardTitle>
                        <p className="mt-2 text-sm text-[#999999]">{eventTitleById.get(session.event_id) ?? "Unknown event"}</p>
                        <p className="mt-2 text-sm text-[#dddddd]">
                          {new Date(session.starts_at).toLocaleString()} - {session.room ?? "No room"}
                        </p>
                        <p className="mt-1 text-sm text-[#999999]">Capacity: {session.capacity ?? "Unlimited"}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={session.status === "published" ? "success" : "muted"}>{session.status}</Badge>
                        <Badge variant="muted">{session.type}</Badge>
                        <span className="inline-flex h-9 items-center gap-2 rounded-md border border-white/15 px-3 text-sm font-medium text-white transition group-hover:bg-white/10">
                          <Pencil className="h-4 w-4" aria-hidden />
                          <span className="group-open:hidden">Edit</span>
                          <span className="hidden group-open:inline">Close</span>
                          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden />
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                </summary>
                <CardContent className="pt-5">
                  <form action={updateSession} className="space-y-4">
                    <input type="hidden" name="sessionId" value={session.id} />
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Title">
                        <Input name="title" defaultValue={session.title} required />
                      </Field>
                      <Field label="Slug">
                        <Input name="slug" defaultValue={session.slug} required />
                      </Field>
                      <Field label="Event">
                        <SelectField name="eventId" defaultValue={session.event_id} options={eventOptions} />
                      </Field>
                      <Field label="Event day">
                        <SelectField
                          name="eventDayId"
                          defaultValue={session.event_day_id ?? ""}
                          options={[
                            { label: "No day assigned", value: "" },
                            ...(eventDayOptionsByEventId.get(session.event_id) ?? []),
                          ]}
                        />
                      </Field>
                      <Field label="Room">
                        <Input name="room" defaultValue={session.room ?? ""} />
                      </Field>
                      <Field label="Starts">
                        <Input name="startsAt" type="datetime-local" defaultValue={toDateTimeLocalInputValue(session.starts_at)} required />
                      </Field>
                      <Field label="Ends">
                        <Input name="endsAt" type="datetime-local" defaultValue={toDateTimeLocalInputValue(session.ends_at)} required />
                      </Field>
                      <Field label="Capacity">
                        <Input name="capacity" type="number" min={1} defaultValue={session.capacity ?? ""} />
                      </Field>
                      <Field label="Type">
                        <SelectField name="type" defaultValue={session.type} options={sessionTypeOptions} />
                      </Field>
                      <Field label="Status">
                        <SelectField name="status" defaultValue={session.status} options={statusOptions} />
                      </Field>
                    </div>
                    <Field label="Description">
                      <Textarea name="description" defaultValue={session.description} />
                    </Field>
                    <div className="grid gap-3 md:grid-cols-3">
                      <CheckboxField
                        label="Requires registration"
                        name="requiresRegistration"
                        defaultChecked={session.requires_registration}
                      />
                      <CheckboxField
                        label="Separate check-in"
                        name="requiresSeparateCheckIn"
                        defaultChecked={session.requires_separate_check_in}
                      />
                      <CheckboxField label="Waitlist enabled" name="waitlistEnabled" defaultChecked={session.waitlist_enabled} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#dddddd]">Allowed ticket types</p>
                      <div className="mt-2 grid gap-2 md:grid-cols-2">
                        {(ticketTypesByEventId.get(session.event_id) ?? []).map((ticketType) => (
                          <label key={ticketType.id} className="flex items-start gap-3 rounded-md border border-white/10 bg-[#0b0b0b] px-3 py-2 text-sm text-[#dddddd]">
                            <input
                              type="checkbox"
                              name="allowedTicketTypeIds"
                              value={ticketType.id}
                              defaultChecked={session.allowed_ticket_type_ids.includes(ticketType.id)}
                              className="mt-0.5 h-4 w-4 rounded border-white/20 bg-[#111111] accent-[#e50913]"
                            />
                            <span>{ticketType.name}</span>
                          </label>
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-[#999999]">Leave all unchecked to allow every ticket type with access to the selected day.</p>
                    </div>
                    <Button type="submit">
                      <Save className="h-4 w-4" aria-hidden />
                      Save Session
                    </Button>
                  </form>
                </CardContent>
              </details>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-5 text-sm text-[#999999]">No sessions have been created yet.</CardContent>
        </Card>
      )}
    </>
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

function CheckboxField({
  label,
  name,
  defaultChecked,
}: {
  label: string;
  name: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex min-h-10 items-center gap-3 rounded-md border border-white/10 bg-[#0b0b0b] px-3 py-2 text-sm text-[#dddddd]">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-4 w-4 rounded border-white/20 bg-[#111111] accent-[#e50913]"
      />
      <span>{label}</span>
    </label>
  );
}
