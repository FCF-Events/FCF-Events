import { isServiceRoleConfigured } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { EmailTemplateSummary } from "@/lib/types";

export const REGISTRATION_CONFIRMATION_TEMPLATE_NAME = "Registration confirmation";

export const EMAIL_TEMPLATE_TOKENS = [
  { token: "{{first_name}}", label: "First name" },
  { token: "{{attendee_name}}", label: "Full name" },
  { token: "{{event}}", label: "Event title" },
  { token: "{{event_start_time}}", label: "Event date and time" },
  { token: "{{venue}}", label: "Venue or address" },
  { token: "{{ticket_type}}", label: "Ticket type" },
  { token: "{{ticket_price}}", label: "Ticket price" },
  { token: "{{ticket_code}}", label: "Ticket code" },
  { token: "{{ticket_url}}", label: "Ticket URL" },
  { token: "{{calendar_url}}", label: "Add to calendar URL" },
];

export type EmailTemplateDraft = {
  name: string;
  subject: string;
  body: string;
};

export type TemplateValues = Record<string, string | number | null | undefined>;

export const DEFAULT_EMAIL_TEMPLATES: EmailTemplateDraft[] = [
  {
    name: REGISTRATION_CONFIRMATION_TEMPLATE_NAME,
    subject: "Your FCF ticket for {{event}}",
    body: [
      "Hi {{first_name}},",
      "",
      "Your registration for {{event}} is confirmed.",
      "",
      "When: {{event_start_time}}",
      "Where: {{venue}}",
      "Ticket: {{ticket_type}} ({{ticket_price}})",
      "Ticket code: {{ticket_code}}",
      "",
      "Open your QR ticket: {{ticket_url}}",
      "Add to calendar: {{calendar_url}}",
      "",
      "Bring this QR code with you for check-in. Staff will validate your ticket status at the door.",
    ].join("\n"),
  },
  {
    name: "Payment pending",
    subject: "Complete payment for {{event}}",
    body: [
      "Hi {{first_name}},",
      "",
      "Your registration for {{event}} is saved, but payment is still pending.",
      "",
      "Once payment is confirmed, your QR ticket will be issued.",
    ].join("\n"),
  },
  {
    name: "Event reminder",
    subject: "Reminder: {{event}} is coming up",
    body: [
      "Hi {{first_name}},",
      "",
      "This is a reminder that {{event}} starts at {{event_start_time}}.",
      "",
      "Where: {{venue}}",
      "Ticket code: {{ticket_code}}",
      "",
      "Open your QR ticket: {{ticket_url}}",
    ].join("\n"),
  },
  {
    name: "Event cancellation",
    subject: "{{event}} has been cancelled",
    body: [
      "Hi {{first_name}},",
      "",
      "{{event}} has been cancelled.",
      "",
      "We will follow up with any next steps separately.",
    ].join("\n"),
  },
];

export function demoEmailTemplates(organizationId: string): EmailTemplateSummary[] {
  return DEFAULT_EMAIL_TEMPLATES.map((template, index) => ({
    id: `99999999-9999-4999-8999-${String(index + 1).padStart(12, "0")}`,
    organization_id: organizationId,
    ...template,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  }));
}

export async function ensureDefaultEmailTemplates(organizationId: string) {
  if (!isServiceRoleConfigured()) return demoEmailTemplates(organizationId);

  const supabase = createSupabaseAdminClient();
  const { data: existingTemplates } = await supabase
    .from("email_templates")
    .select("name")
    .eq("organization_id", organizationId);
  const existingNames = new Set((existingTemplates ?? []).map((template) => template.name));
  const missingTemplates = DEFAULT_EMAIL_TEMPLATES.filter((template) => !existingNames.has(template.name));

  if (missingTemplates.length) {
    await supabase.from("email_templates").insert(
      missingTemplates.map((template) => ({
        organization_id: organizationId,
        name: template.name,
        subject: template.subject,
        body: template.body,
      })),
    );
  }

  const { data } = await supabase
    .from("email_templates")
    .select("*")
    .eq("organization_id", organizationId)
    .order("name");

  return (data ?? []) as EmailTemplateSummary[];
}

export async function getEmailTemplateForSend(organizationId: string, name: string) {
  if (!isServiceRoleConfigured()) {
    return DEFAULT_EMAIL_TEMPLATES.find((template) => template.name === name) ?? null;
  }

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("email_templates")
    .select("name, subject, body")
    .eq("organization_id", organizationId)
    .eq("name", name)
    .maybeSingle();

  if (data) return data as EmailTemplateDraft;
  return DEFAULT_EMAIL_TEMPLATES.find((template) => template.name === name) ?? null;
}

export function renderEmailTemplate(template: string, values: TemplateValues) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
    const value = values[key];
    return value === null || value === undefined ? match : String(value);
  });
}
