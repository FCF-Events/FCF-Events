"use server";

import { env, isServiceRoleConfigured } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decryptSecret, encryptSecret } from "@/lib/security/encryption";
import { smsSendSchema, twilioSettingsSchema } from "@/lib/validation";
import { sendTwilioSms } from "@/lib/sms/twilio";
import { ensureComplianceFooter } from "@/lib/sms/templates";
import { segmentCount } from "@/lib/utils";
import { writeAuditLog } from "@/lib/audit";

export async function saveTwilioSettings(input: FormData) {
  const parsed = twilioSettingsSchema.safeParse({
    organizationId: input.get("organizationId"),
    accountSid: input.get("accountSid"),
    authToken: input.get("authToken") || undefined,
    twilioPhoneNumber: input.get("twilioPhoneNumber") || undefined,
    messagingServiceSid: input.get("messagingServiceSid") || undefined,
    defaultSenderName: input.get("defaultSenderName"),
    defaultFooter: input.get("defaultFooter"),
    complianceContact: input.get("complianceContact") || undefined,
    quietHoursStart: input.get("quietHoursStart") || undefined,
    quietHoursEnd: input.get("quietHoursEnd") || undefined,
    defaultTimezone: input.get("defaultTimezone"),
  });

  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid Twilio settings." };
  if (!isServiceRoleConfigured()) return { ok: true, message: "Settings validated. Connect Supabase to persist them." };

  const values = parsed.data;
  const supabase = createSupabaseAdminClient();
  const payload = {
    organization_id: values.organizationId,
    account_sid: values.accountSid,
    twilio_phone_number: values.twilioPhoneNumber,
    messaging_service_sid: values.messagingServiceSid,
    default_sender_name: values.defaultSenderName,
    default_footer: values.defaultFooter,
    compliance_contact: values.complianceContact,
    quiet_hours_start: values.quietHoursStart || null,
    quiet_hours_end: values.quietHoursEnd || null,
    default_timezone: values.defaultTimezone,
    ...(values.authToken ? { auth_token_ciphertext: await encryptSecret(values.authToken) } : {}),
  };

  const { error } = await supabase.from("twilio_configs").upsert(payload, { onConflict: "organization_id" });
  if (error) return { ok: false, message: error.message };

  await writeAuditLog({
    organizationId: values.organizationId,
    action: "twilio.settings.updated",
    entityType: "twilio_config",
    metadata: { accountSid: values.accountSid, tokenUpdated: Boolean(values.authToken) },
  });

  return { ok: true, message: "Twilio settings saved." };
}

export async function sendTestSms(input: unknown) {
  const parsed = smsSendSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid test SMS." };
  if (!isServiceRoleConfigured()) return { ok: true, message: "SMS validated. Configure Supabase and Twilio to send." };

  const values = parsed.data;
  const supabase = createSupabaseAdminClient();
  const { data: config } = await supabase
    .from("twilio_configs")
    .select("*")
    .eq("organization_id", values.organizationId)
    .maybeSingle();

  if (!config?.auth_token_ciphertext) return { ok: false, message: "Twilio auth token is not configured." };

  const body = ensureComplianceFooter(values.body, config.default_footer);
  const send = await sendTwilioSms({
    accountSid: config.account_sid,
    authToken: await decryptSecret(config.auth_token_ciphertext),
    from: config.twilio_phone_number,
    messagingServiceSid: config.messaging_service_sid,
    to: values.to,
    body,
    statusCallback: `${env.appUrl.replace(/\/$/, "")}/api/twilio/status`,
  });

  await supabase.from("message_sends").insert({
    organization_id: values.organizationId,
    channel: "sms",
    to_address: values.to,
    body_snapshot: body,
    idempotency_key: `test:${Date.now()}:${values.to}`,
    provider_message_sid: send.sid,
    provider_status: send.status,
    provider_error: send.error,
    status: send.error ? "failed" : "sent",
    segment_count: segmentCount(body),
    sent_at: send.error ? null : new Date().toISOString(),
  });

  if (send.error) return { ok: false, message: send.error };
  return { ok: true, message: "Test SMS sent." };
}
