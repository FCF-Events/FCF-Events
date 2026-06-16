"use client";

import { useRouter } from "next/navigation";
import { useTransition, type FormEvent } from "react";
import { Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { createTicketTypeAction, updateTicketTypeAction } from "@/lib/actions/events";
import type { EventDaySummary, TicketTypeSummary } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";

const visibilityOptions = [
  { label: "Public", value: "public" },
  { label: "Private", value: "private" },
  { label: "Hidden", value: "hidden" },
];

export function TicketTypeManager({
  eventId,
  eventDays,
  ticketTypes,
}: {
  eventId: string;
  eventDays: EventDaySummary[];
  ticketTypes: TicketTypeSummary[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const result = await createTicketTypeAction(formData);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      form.reset();
      router.refresh();
    });
  }

  function submitUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await updateTicketTypeAction(formData);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {ticketTypes.length ? (
        <div className="space-y-3">
          {ticketTypes.map((ticket) => (
            <form key={ticket.id} onSubmit={submitUpdate} className="rounded-md border border-white/10 p-4">
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="id" value={ticket.id} />
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <Field label="Name">
                  <Input name="name" defaultValue={ticket.name} required />
                </Field>
                <Field label="Price">
                  <Input name="price" type="number" min={0} step="0.01" defaultValue={ticket.price} required />
                </Field>
                <Field label="Currency">
                  <Input name="currency" defaultValue={ticket.currency} maxLength={3} required />
                </Field>
                <Field label="Capacity">
                  <Input name="capacityLimit" type="number" min={1} defaultValue={ticket.capacity_limit ?? ""} />
                </Field>
                <Field label="Visibility">
                  <SelectField name="visibility" defaultValue={ticket.visibility} options={visibilityOptions} />
                </Field>
              </div>
              {eventDays.length ? (
                <DayAccessField eventDays={eventDays} selectedDayIds={ticket.event_day_ids} />
              ) : null}
              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                <Field label="Description">
                  <Input name="description" defaultValue={ticket.description} />
                </Field>
                <Button type="submit" variant="outline" disabled={isPending}>
                  <Save className="h-4 w-4" aria-hidden />
                  Save Ticket
                </Button>
              </div>
            </form>
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-white/15 p-4 text-sm text-[#999999]">
          No ticket types yet.
        </div>
      )}

      <form onSubmit={submitCreate} className="rounded-md border border-white/10 bg-[#0b0b0b] p-4">
        <p className="text-sm font-medium text-white">Add Ticket Type</p>
        <input type="hidden" name="eventId" value={eventId} />
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Field label="Name">
            <Input name="name" placeholder="General Admission" required />
          </Field>
          <Field label="Price">
            <Input name="price" type="number" min={0} step="0.01" placeholder="0" required />
          </Field>
          <Field label="Currency">
            <Input name="currency" defaultValue="CAD" maxLength={3} required />
          </Field>
          <Field label="Capacity">
            <Input name="capacityLimit" type="number" min={1} />
          </Field>
          <Field label="Visibility">
            <SelectField name="visibility" defaultValue="public" options={visibilityOptions} />
          </Field>
        </div>
        {eventDays.length ? (
          <DayAccessField eventDays={eventDays} selectedDayIds={eventDays.map((day) => day.id)} />
        ) : null}
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <Field label="Description">
            <Input name="description" placeholder="Optional" />
          </Field>
          <Button type="submit" disabled={isPending}>
            <Plus className="h-4 w-4" aria-hidden />
            Add Ticket
          </Button>
        </div>
      </form>
    </div>
  );
}

function DayAccessField({ eventDays, selectedDayIds }: { eventDays: EventDaySummary[]; selectedDayIds: string[] }) {
  return (
    <div className="mt-3">
      <p className="text-sm font-medium text-[#dddddd]">Included days</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {eventDays.map((day) => (
          <label key={day.id} className="flex items-start gap-3 rounded-md border border-white/10 px-3 py-2 text-sm text-[#dddddd]">
            <input
              type="checkbox"
              name="eventDayIds"
              value={day.id}
              defaultChecked={!selectedDayIds.length || selectedDayIds.includes(day.id)}
              className="mt-0.5 h-4 w-4 rounded border-white/20 accent-[#e50913]"
            />
            <span>
              <span className="block text-white">{day.label}</span>
              <span className="text-xs text-[#999999]">{formatDayRange(day)}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
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

function formatDayRange(day: EventDaySummary) {
  return `${new Date(day.starts_at).toLocaleDateString()} - ${new Date(day.ends_at).toLocaleDateString()}`;
}
