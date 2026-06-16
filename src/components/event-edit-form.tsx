"use client";

import { useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { Textarea } from "@/components/ui/textarea";
import { updateEventAction } from "@/lib/actions/events";
import type { EventSummary } from "@/lib/types";
import { toDateTimeLocalInputValue } from "@/lib/utils";

export function EventEditForm({ event }: { event: EventSummary }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function submit(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    const formData = new FormData(submitEvent.currentTarget);

    startTransition(async () => {
      const result = await updateEventAction(formData);

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);

      if (
        "persisted" in result &&
        result.persisted &&
        "slug" in result &&
        typeof result.slug === "string" &&
        result.slug !== event.slug
      ) {
        router.replace(`/dashboard/events/${result.slug}`);
        return;
      }

      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <input type="hidden" name="eventId" value={event.id} />
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Title">
          <Input name="title" defaultValue={event.title} required />
        </Field>
        <Field label="Slug">
          <Input name="slug" defaultValue={event.slug} required />
        </Field>
        <Field label="Starts">
          <Input name="startsAt" type="datetime-local" defaultValue={toDateTimeLocalInputValue(event.starts_at)} required />
        </Field>
        <Field label="Ends">
          <Input name="endsAt" type="datetime-local" defaultValue={toDateTimeLocalInputValue(event.ends_at)} required />
        </Field>
        <Field label="Venue">
          <Input name="venueName" defaultValue={event.venue_name ?? ""} />
        </Field>
        <Field label="Room">
          <Input name="room" defaultValue={event.room ?? ""} />
        </Field>
        <Field label="Capacity">
          <Input name="capacity" type="number" min={1} defaultValue={event.capacity ?? ""} />
        </Field>
        <Field label="Minimum age">
          <Input name="minimumAge" type="number" min={18} defaultValue={event.minimum_age} />
        </Field>
      </div>
      <Field label="Address">
        <Input name="address" defaultValue={event.address ?? ""} />
      </Field>
      <Field label="Description">
        <Textarea name="description" defaultValue={event.description} />
      </Field>
      <Field label="Compliance notes">
        <Textarea name="complianceNotes" defaultValue={event.compliance_notes ?? ""} />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Zeffy campaign ID (optional)">
          <Input name="zeffyCampaignId" defaultValue={event.zeffy_campaign_id ?? ""} placeholder="Zeffy campaign UUID only" />
        </Field>
        <Field label="Zeffy form URL (full Zeffy link)">
          <Input name="zeffyFormUrl" type="url" defaultValue={event.zeffy_form_url ?? ""} placeholder="https://www.zeffy.com/..." />
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Status">
          <SelectField
            name="status"
            defaultValue={event.status}
            options={[
              { label: "Draft", value: "draft" },
              { label: "Published", value: "published" },
              { label: "Cancelled", value: "cancelled" },
              { label: "Past", value: "past" },
            ]}
          />
        </Field>
        <Field label="Visibility">
          <SelectField
            name="visibility"
            defaultValue={event.visibility}
            options={[
              { label: "Private", value: "private" },
              { label: "Public", value: "public" },
              { label: "Unlisted", value: "unlisted" },
            ]}
          />
        </Field>
      </div>
      <Button type="submit" disabled={isPending}>
        <Save className="h-4 w-4" aria-hidden />
        {isPending ? "Saving" : "Save Event"}
      </Button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
