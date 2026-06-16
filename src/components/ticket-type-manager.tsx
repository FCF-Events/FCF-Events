"use client";

import { useRouter } from "next/navigation";
import { useTransition, type FormEvent } from "react";
import { Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { createTicketTypeAction, updateTicketTypeAction } from "@/lib/actions/events";
import type { TicketTypeSummary } from "@/lib/types";
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
  ticketTypes,
}: {
  eventId: string;
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
