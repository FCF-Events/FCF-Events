import type { Role } from "@/lib/types";

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  check_in_staff: "Check-in staff",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: "Full organization control, including ownership transfer and all user access.",
  admin: "Manage users, events, communications, integrations, reporting, and check-in.",
  manager: "Manage events, sessions, attendees, discounts, communications, and check-in.",
  check_in_staff: "Use event and session check-in for assigned access.",
  viewer: "Read dashboard, event, attendee, analytics, and audit information.",
};

export const ROLE_ACCESS: Record<Role, string[]> = {
  owner: ["All organization settings", "Users and roles", "All events", "Integrations", "Audit logs"],
  admin: ["Users and roles", "All events", "Communications", "Integrations", "Audit logs"],
  manager: ["Events and sessions", "Attendees", "Discounts", "Communications", "Check-in"],
  check_in_staff: ["Assigned event check-in", "Assigned session check-in"],
  viewer: ["Read-only operations views", "Analytics", "Audit logs"],
};

export const USER_MANAGED_ROLES: Role[] = ["admin", "manager", "check_in_staff", "viewer"];
export const OWNER_MANAGED_ROLES: Role[] = ["owner", ...USER_MANAGED_ROLES];
export const EVENT_ACCESS_ROLES: Role[] = ["manager", "check_in_staff", "viewer"];
