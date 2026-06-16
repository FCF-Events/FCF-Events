"use server";

import { isServiceRoleConfigured } from "@/lib/env";
import { airtableSettingsSchema } from "@/lib/validation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { encryptSecret } from "@/lib/security/encryption";
import { writeAuditLog } from "@/lib/audit";

export async function saveAirtableSettings(input: FormData) {
  const parsed = airtableSettingsSchema.safeParse({
    organizationId: input.get("organizationId"),
    apiToken: input.get("apiToken") || undefined,
    baseId: input.get("baseId"),
    eventsTableName: input.get("eventsTableName"),
    sessionsTableName: input.get("sessionsTableName"),
    attendeesTableName: input.get("attendeesTableName"),
    registrationsTableName: input.get("registrationsTableName"),
    ticketsTableName: input.get("ticketsTableName"),
  });

  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid Airtable settings." };
  if (!isServiceRoleConfigured()) return { ok: true, message: "Airtable settings validated. Connect Supabase to save them." };

  const values = parsed.data;
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("airtable_configs").upsert(
    {
      organization_id: values.organizationId,
      base_id: values.baseId,
      events_table_name: values.eventsTableName,
      sessions_table_name: values.sessionsTableName,
      attendees_table_name: values.attendeesTableName,
      registrations_table_name: values.registrationsTableName,
      tickets_table_name: values.ticketsTableName,
      active: true,
      ...(values.apiToken ? { api_token_ciphertext: await encryptSecret(values.apiToken) } : {}),
    },
    { onConflict: "organization_id" },
  );

  if (error) return { ok: false, message: error.message };
  await writeAuditLog({
    organizationId: values.organizationId,
    action: "airtable.settings.updated",
    entityType: "airtable_config",
  });
  return { ok: true, message: "Airtable settings saved." };
}

export async function runAirtableSync(organizationId: string) {
  if (!isServiceRoleConfigured()) return { ok: true, message: "Sync request validated. Connect Supabase to record sync logs." };
  const supabase = createSupabaseAdminClient();
  await supabase.from("airtable_sync_logs").insert({
    organization_id: organizationId,
    entity_type: "manual_sync",
    status: "skipped",
    error_message: "TODO_EXTERNAL_PROVIDER_REQUIRED: complete field mappings and token before production sync.",
  });
  return { ok: true, message: "Sync log created. Complete mappings before production sync." };
}
