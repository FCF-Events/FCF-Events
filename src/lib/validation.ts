import { z } from "zod";

export const registrationSchema = z.object({
  eventId: z.string().uuid(),
  ticketTypeId: z.string().uuid(),
  sessionIds: z.array(z.string().uuid()).default([]),
  firstName: z.string().min(1, "First name is required").max(80),
  lastName: z.string().min(1, "Last name is required").max(80),
  email: z.string().email("Use a valid email address"),
  phone: z.string().min(7, "Phone number is required").max(32),
  company: z.string().max(120).optional(),
  roleTitle: z.string().max(120).optional(),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  discountCode: z.string().max(80).optional(),
  smsConsent: z.boolean().default(false),
  emailConsent: z.boolean().default(false),
  privacyAccepted: z.boolean().refine(Boolean, "Privacy and terms acceptance is required"),
});

export const checkInSchema = z.object({
  ticketCode: z.string().min(4).max(120),
  eventId: z.string().uuid(),
  eventDayId: z.string().uuid(),
  sessionId: z.string().uuid().optional().nullable(),
});

export const checkInLookupSchema = z.object({
  eventId: z.string().uuid(),
  eventDayId: z.string().uuid(),
  sessionId: z.string().uuid().optional().nullable(),
  query: z.string().trim().min(2, "Enter at least 2 characters.").max(120),
});

const optionalEmailSchema = z
  .string()
  .trim()
  .email("Use a valid email address.")
  .optional()
  .or(z.literal(""));

const optionalTextSchema = z.string().trim().max(120).optional().or(z.literal(""));

export const walkUpCheckInSchema = z.object({
  eventId: z.string().uuid(),
  eventDayId: z.string().uuid(),
  sessionId: z.string().uuid().optional().nullable(),
  ticketTypeId: z.string().uuid(),
  firstName: z.string().trim().min(1, "First name is required.").max(80),
  lastName: z.string().trim().min(1, "Last name is required.").max(80),
  email: optionalEmailSchema,
  phone: z.string().trim().max(32).optional().or(z.literal("")),
  company: optionalTextSchema,
  roleTitle: optionalTextSchema,
  paymentMode: z.enum(["cash", "comp"]).default("cash"),
});

export const attendeeUpdateSchema = z.object({
  attendeeId: z.string().uuid(),
  firstName: z.string().trim().min(1, "First name is required.").max(80),
  lastName: z.string().trim().min(1, "Last name is required.").max(80),
  email: optionalEmailSchema,
  phone: z.string().trim().max(32).optional().or(z.literal("")),
  company: optionalTextSchema,
  roleTitle: optionalTextSchema,
  dateOfBirth: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().max(4000).optional().or(z.literal("")),
  smsConsent: z.boolean().default(false),
  emailConsent: z.boolean().default(false),
});

export const registrationStatusSchema = z.enum(["pending", "confirmed", "cancelled", "waitlisted"]);
export const paymentStatusSchema = z.enum([
  "not_required",
  "pending",
  "paid",
  "partially_paid",
  "failed",
  "refunded",
  "comped",
]);

export const attendeeRegistrationUpdateSchema = z.object({
  attendeeId: z.string().uuid(),
  registrationId: z.string().uuid(),
  eventId: z.string().uuid(),
  ticketTypeId: z.string().uuid().optional().or(z.literal("")),
  sessionIds: z.array(z.string().uuid()).default([]),
  registrationStatus: registrationStatusSchema,
  paymentStatus: paymentStatusSchema,
});

function validateDateRange(values: { startsAt: string; endsAt: string }, ctx: z.RefinementCtx) {
  const startsAt = Date.parse(values.startsAt);
  const endsAt = Date.parse(values.endsAt);

  if (Number.isNaN(startsAt) || Number.isNaN(endsAt)) {
    ctx.addIssue({
      code: "custom",
      path: ["startsAt"],
      message: "Use valid start and end dates.",
    });
    return;
  }

  if (endsAt <= startsAt) {
    ctx.addIssue({
      code: "custom",
      path: ["endsAt"],
      message: "End time must be after start time.",
    });
  }
}

const eventBaseSchema = z.object({
  title: z.string().min(2).max(160),
  slug: z
    .string()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and dashes"),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  venueName: z.string().max(160).optional(),
  address: z.string().max(240).optional(),
  room: z.string().max(120).optional(),
  description: z.string().max(5000).default(""),
  complianceNotes: z.string().max(5000).optional().or(z.literal("")),
  capacity: z.coerce.number().int().positive().optional(),
  status: z.enum(["draft", "published", "cancelled", "past"]).default("draft"),
  visibility: z.enum(["private", "public", "unlisted"]).default("private"),
  minimumAge: z.coerce.number().int().min(18).max(25).default(19),
  zeffyCampaignId: z.string().trim().max(120).optional(),
  zeffyFormUrl: z
    .string()
    .trim()
    .url("Use a valid Zeffy form URL")
    .max(500)
    .optional()
    .or(z.literal("")),
});

export const eventSchema = eventBaseSchema.superRefine(validateDateRange);

export const eventUpdateSchema = eventBaseSchema
  .extend({
  eventId: z.string().uuid(),
  })
  .superRefine(validateDateRange);

export const sessionTypeSchema = z.enum(["seminar", "panel", "keynote", "workshop", "networking", "vip", "press", "sponsor"]);

const sessionBaseSchema = z.object({
  eventId: z.string().uuid(),
  eventDayId: z.string().uuid().optional().or(z.literal("")),
  title: z.string().trim().min(2).max(160),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and dashes"),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  room: z.string().trim().max(120).optional().or(z.literal("")),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
  capacity: z.coerce.number().int().positive().optional(),
  status: z.enum(["draft", "published", "cancelled", "past"]).default("draft"),
  type: sessionTypeSchema.default("seminar"),
  requiresRegistration: z.boolean().default(false),
  requiresSeparateCheckIn: z.boolean().default(true),
  allowedTicketTypeIds: z.array(z.string().uuid()).default([]),
  waitlistEnabled: z.boolean().default(false),
});

export const sessionSchema = sessionBaseSchema.superRefine(validateDateRange);

export const sessionUpdateSchema = sessionBaseSchema
  .extend({
  sessionId: z.string().uuid(),
  })
  .superRefine(validateDateRange);

export const zeffyEventSettingsSchema = z.object({
  eventId: z.string().uuid(),
  zeffyCampaignId: z.string().trim().max(120).optional(),
  zeffyFormUrl: z
    .string()
    .trim()
    .url("Use a valid Zeffy form URL")
    .max(500)
    .optional()
    .or(z.literal("")),
});

const optionalPositiveIntegerSchema = z.preprocess((value) => {
  const text = String(value ?? "").trim();
  return text ? text : undefined;
}, z.coerce.number().int().positive().optional());

export const ticketTypeSchema = z.object({
  id: z.string().uuid().optional(),
  eventId: z.string().uuid(),
  eventDayIds: z.array(z.string().uuid()).default([]),
  name: z.string().trim().min(2, "Ticket name is required.").max(120),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  price: z
    .string()
    .trim()
    .min(1, "Price is required.")
    .transform((value) => Number(value))
    .refine((value) => Number.isFinite(value), "Enter a valid price.")
    .refine((value) => value >= 0 && value <= 999999, "Price must be between 0 and 999999."),
  currency: z
    .string()
    .trim()
    .length(3, "Use a three-letter currency code.")
    .regex(/^[a-z]+$/i, "Use letters only for currency.")
    .transform((value) => value.toUpperCase()),
  capacityLimit: optionalPositiveIntegerSchema,
  visibility: z.enum(["public", "private", "hidden"]).default("public"),
});

export const ticketTypeDraftSchema = ticketTypeSchema.omit({
  id: true,
  eventId: true,
});

export const eventTicketTypesCreateSchema = z
  .array(ticketTypeDraftSchema)
  .max(20, "Add 20 or fewer ticket types.");

export const discountTypeSchema = z.enum(["percentage", "fixed_amount", "comp", "access_only"]);

export const discountCodeSchema = z
  .object({
    id: z.string().uuid().optional(),
    code: z
      .string()
      .trim()
      .min(2, "Code is required")
      .max(80)
      .regex(/^[A-Z0-9_-]+$/i, "Use letters, numbers, dashes, or underscores")
      .transform((code) => code.toUpperCase()),
    description: z.string().trim().max(240).optional().or(z.literal("")),
    type: discountTypeSchema,
    amount: z.coerce.number().min(0).max(999999),
    appliesToEventIds: z.array(z.string().uuid()).default([]),
    appliesToTicketTypeIds: z.array(z.string().uuid()).default([]),
    maxTotalUses: z.coerce.number().int().positive().optional(),
    oneUsePerAttendee: z.boolean().default(true),
    expiresAt: z.string().optional().or(z.literal("")),
    active: z.boolean().default(true),
    minimumTicketQuantity: z.coerce.number().int().positive().default(1),
    internalNotes: z.string().trim().max(1000).optional().or(z.literal("")),
  })
  .superRefine((values, ctx) => {
    if (values.type === "percentage" && (values.amount <= 0 || values.amount > 100)) {
      ctx.addIssue({
        code: "custom",
        path: ["amount"],
        message: "Percentage discounts must be between 1 and 100.",
      });
    }

    if (values.type === "fixed_amount" && values.amount <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["amount"],
        message: "Fixed amount discounts need an amount.",
      });
    }
  });

export const twilioSettingsSchema = z.object({
  organizationId: z.string().uuid(),
  accountSid: z.string().min(12),
  authToken: z.string().min(12).optional(),
  twilioPhoneNumber: z.string().optional(),
  messagingServiceSid: z.string().optional(),
  defaultSenderName: z.string().min(2).max(80),
  defaultFooter: z.string().min(8).max(160),
  complianceContact: z.string().max(160).optional(),
  quietHoursStart: z.string().optional(),
  quietHoursEnd: z.string().optional(),
  defaultTimezone: z.string().min(2),
});

export const smsSendSchema = z.object({
  organizationId: z.string().uuid(),
  to: z.string().min(7),
  body: z.string().min(8).max(1200),
});

export const emailTemplateSchema = z.object({
  id: z.string().uuid().optional(),
  organizationId: z.string().uuid(),
  name: z.string().trim().min(2, "Template name is required").max(120),
  subject: z.string().trim().min(2, "Subject is required").max(200),
  body: z.string().trim().min(8, "Body is required").max(8000),
});

export const appRoleSchema = z.enum(["owner", "admin", "manager", "check_in_staff", "viewer"]);

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email("Use a valid email address"),
  fullName: z.string().trim().min(2, "Name is required").max(120).optional(),
  password: z.string().min(12, "Use a temporary password with at least 12 characters"),
  role: appRoleSchema,
});

export const updateMemberSchema = z.object({
  userId: z.string().uuid(),
  role: appRoleSchema,
  isActive: z.boolean(),
});

export const eventAccessSchema = z.object({
  userId: z.string().uuid(),
  eventId: z.string().uuid(),
  role: z.enum(["manager", "check_in_staff", "viewer"]),
});

export const accountProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Name is required").max(120),
  phone: z.string().trim().max(40).optional(),
});

export const accountEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email("Use a valid email address"),
});

export const accountPasswordSchema = z
  .object({
    password: z.string().min(12, "Use at least 12 characters"),
    confirmPassword: z.string().min(12, "Confirm your new password"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords must match",
    path: ["confirmPassword"],
  });

export const accountSignupSchema = z
  .object({
    fullName: z.string().trim().min(2, "Name is required").max(120),
    email: z.string().trim().toLowerCase().email("Use a valid email address"),
    password: z.string().min(12, "Use at least 12 characters"),
    confirmPassword: z.string().min(12, "Confirm your password"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords must match",
    path: ["confirmPassword"],
  });

export const ticketEmailSchema = z.object({
  ticketCode: z.string().min(4).max(120),
  recipientEmail: z.string().trim().toLowerCase().email("Use a valid email address"),
});

export const airtableSettingsSchema = z.object({
  organizationId: z.string().uuid(),
  apiToken: z.string().min(8).optional(),
  baseId: z.string().min(4),
  eventsTableName: z.string().min(1),
  sessionsTableName: z.string().min(1),
  attendeesTableName: z.string().min(1),
  registrationsTableName: z.string().min(1),
  ticketsTableName: z.string().min(1),
});
