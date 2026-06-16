import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { SelectField } from "@/components/ui/select-field";
import { createEventAction } from "@/lib/actions/events";
import { getEvents } from "@/lib/data";

export default async function EventsPage() {
  const events = await getEvents();

  async function createEvent(formData: FormData) {
    "use server";
    await createEventAction(formData);
  }

  return (
    <>
      <PageHeader
        eyebrow="Programming"
        title="Events"
        description="Create, publish, and manage conferences, seminars, networking nights, and private events."
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Event List</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {events.map((event) => (
              <Link key={event.id} href={`/dashboard/events/${event.slug}`} className="block rounded-md border border-white/10 p-4 transition hover:bg-white/5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium text-white">{event.title}</p>
                    <p className="mt-1 text-sm text-[#999999]">{new Date(event.starts_at).toLocaleString()} - {event.venue_name}</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={event.status === "published" ? "success" : "muted"}>{event.status}</Badge>
                    <Badge variant="muted">{event.visibility}</Badge>
                  </div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>New Event</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createEvent} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Title"><Input name="title" required /></Field>
                <Field label="Slug"><Input name="slug" required placeholder="fcf-summer-conference" /></Field>
                <Field label="Starts"><Input name="startsAt" type="datetime-local" required /></Field>
                <Field label="Ends"><Input name="endsAt" type="datetime-local" required /></Field>
                <Field label="Venue"><Input name="venueName" /></Field>
                <Field label="Room"><Input name="room" /></Field>
                <Field label="Capacity"><Input name="capacity" type="number" min={1} /></Field>
                <Field label="Minimum age"><Input name="minimumAge" type="number" defaultValue={19} min={18} /></Field>
              </div>
              <Field label="Address"><Input name="address" /></Field>
              <Field label="Description"><Textarea name="description" /></Field>
              <Field label="Compliance notes"><Textarea name="complianceNotes" /></Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Zeffy campaign ID"><Input name="zeffyCampaignId" placeholder="Optional after Zeffy form is created" /></Field>
                <Field label="Zeffy form URL"><Input name="zeffyFormUrl" type="url" placeholder="https://www.zeffy.com/..." /></Field>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Status">
                  <SelectField name="status" options={[
                    { label: "Draft", value: "draft" },
                    { label: "Published", value: "published" },
                    { label: "Cancelled", value: "cancelled" },
                    { label: "Past", value: "past" },
                  ]} />
                </Field>
                <Field label="Visibility">
                  <SelectField name="visibility" options={[
                    { label: "Private", value: "private" },
                    { label: "Public", value: "public" },
                    { label: "Unlisted", value: "unlisted" },
                  ]} />
                </Field>
              </div>
              <Button type="submit">
                <CalendarPlus className="h-4 w-4" aria-hidden />
                Create Event
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
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
