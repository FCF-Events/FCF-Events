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
  sessionId: z.string().uuid().optional().nullable(),
});

export const eventSchema = z.object({
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
  capacity: z.coerce.number().int().positive().optional(),
  status: z.enum(["draft", "published", "cancelled", "past"]).default("draft"),
  visibility: z.enum(["private", "public", "unlisted"]).default("private"),
  minimumAge: z.coerce.number().int().min(18).max(25).default(19),
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
