"use client";

import { useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateEventZeffySettingsAction } from "@/lib/actions/events";
import type { EventSummary } from "@/lib/types";

export function EventZeffySettingsForm({ event }: { event: EventSummary }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function submit(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    const formData = new FormData(submitEvent.currentTarget);

    startTransition(async () => {
      const result = await updateEventZeffySettingsAction(formData);

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
      <input type="hidden" name="eventId" value={event.id} />
      <Field label="Campaign ID (optional)">
        <Input name="zeffyCampaignId" defaultValue={event.zeffy_campaign_id ?? ""} placeholder="Zeffy campaign UUID only" />
      </Field>
      <Field label="Form URL (full Zeffy link)">
        <Input name="zeffyFormUrl" type="url" defaultValue={event.zeffy_form_url ?? ""} placeholder="https://www.zeffy.com/..." />
      </Field>
      <Button type="submit" disabled={isPending}>
        <Save className="h-4 w-4" aria-hidden />
        {isPending ? "Saving" : "Save Zeffy"}
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
