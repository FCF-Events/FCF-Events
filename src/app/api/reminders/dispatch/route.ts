import { NextResponse } from "next/server";
import { isServiceRoleConfigured } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  if (!isServiceRoleConfigured()) {
    return NextResponse.json({ ok: true, message: "Reminder dispatch simulated.", sent: 0 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: schedules } = await supabase
    .from("reminder_schedules")
    .select("*, events(*)")
    .eq("active", true)
    .limit(25);

  let queued = 0;
  for (const schedule of schedules ?? []) {
    await supabase.from("airtable_sync_logs").insert({
      organization_id: schedule.organization_id,
      entity_type: "reminder_schedule",
      entity_id: schedule.id,
      status: "skipped",
      error_message: "Dispatcher found schedule. Full Twilio fan-out is handled by the message_sends idempotency workflow.",
    });
    queued += 1;
  }

  return NextResponse.json({ ok: true, queued });
}
