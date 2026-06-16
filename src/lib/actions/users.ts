"use server";

import { revalidatePath } from "next/cache";
import { demoOrganizationId } from "@/lib/demo-data";
import { isServiceRoleConfigured } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireUserManagementAccess } from "@/lib/auth";
import { createUserSchema, eventAccessSchema, updateMemberSchema } from "@/lib/validation";
import { writeAuditLog } from "@/lib/audit";
import { EVENT_ACCESS_ROLES, OWNER_MANAGED_ROLES, USER_MANAGED_ROLES } from "@/lib/roles";
import type { Role } from "@/lib/types";

function assignableRolesFor(role: Role | null) {
  return role === "owner" ? OWNER_MANAGED_ROLES : USER_MANAGED_ROLES;
}

export async function createManagedUserAction(input: FormData) {
  const access = await requireUserManagementAccess();
  const parsed = createUserSchema.safeParse({
    email: input.get("email"),
    fullName: input.get("fullName") || undefined,
    password: input.get("password"),
    role: input.get("role"),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid user." };
  }

  if (!isServiceRoleConfigured()) {
    return { ok: true, message: "Demo mode: user details validated. Connect Supabase to persist users." };
  }

  const values = parsed.data;
  if (!assignableRolesFor(access.role).includes(values.role)) {
    return { ok: false, message: "You cannot assign that role." };
  }

  const supabase = createSupabaseAdminClient();
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: values.email,
    password: values.password,
    email_confirm: true,
    user_metadata: { full_name: values.fullName ?? "" },
  });

  if (createError || !created.user) {
    return { ok: false, message: createError?.message ?? "Could not create user." };
  }

  await supabase.from("user_profiles").upsert({
    id: created.user.id,
    email: values.email,
    full_name: values.fullName ?? null,
  });

  const { error: memberError } = await supabase.from("organization_members").upsert(
    {
      organization_id: demoOrganizationId,
      user_id: created.user.id,
      role: values.role,
      is_active: true,
    },
    { onConflict: "organization_id,user_id" },
  );

  if (memberError) return { ok: false, message: memberError.message };

  await writeAuditLog({
    organizationId: demoOrganizationId,
    actorUserId: access.userId ?? undefined,
    action: "user.created",
    entityType: "user",
    entityId: created.user.id,
    metadata: { email: values.email, role: values.role },
  });

  revalidatePath("/dashboard/users");
  return { ok: true, message: "User created." };
}

export async function updateManagedUserAction(input: FormData) {
  const access = await requireUserManagementAccess();
  const parsed = updateMemberSchema.safeParse({
    userId: input.get("userId"),
    role: input.get("role"),
    isActive: input.get("isActive") === "true",
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid user update." };
  }

  if (!isServiceRoleConfigured()) {
    return { ok: true, message: "Demo mode: user access validated. Connect Supabase to persist it." };
  }

  const values = parsed.data;
  if (!assignableRolesFor(access.role).includes(values.role)) {
    return { ok: false, message: "You cannot assign that role." };
  }

  if (values.userId === access.userId && (!values.isActive || values.role !== access.role)) {
    return { ok: false, message: "You cannot change or deactivate your own access from this page." };
  }

  const supabase = createSupabaseAdminClient();
  const { data: existing } = await supabase
    .from("organization_members")
    .select("role, is_active")
    .eq("organization_id", demoOrganizationId)
    .eq("user_id", values.userId)
    .maybeSingle();

  if (access.role !== "owner" && existing?.role === "owner") {
    return { ok: false, message: "Only an owner can change owner access." };
  }

  if (values.role !== "owner") {
    const { count } = await supabase
      .from("organization_members")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", demoOrganizationId)
      .eq("role", "owner")
      .eq("is_active", true)
      .neq("user_id", values.userId);

    if (existing?.role === "owner" && existing.is_active && (count ?? 0) === 0) {
      return { ok: false, message: "Keep at least one active owner before changing this owner." };
    }
  }

  const { error } = await supabase
    .from("organization_members")
    .update({ role: values.role, is_active: values.isActive })
    .eq("organization_id", demoOrganizationId)
    .eq("user_id", values.userId);

  if (error) return { ok: false, message: error.message };

  await writeAuditLog({
    organizationId: demoOrganizationId,
    actorUserId: access.userId ?? undefined,
    action: "user.access.updated",
    entityType: "user",
    entityId: values.userId,
    metadata: { role: values.role, isActive: values.isActive },
  });

  revalidatePath("/dashboard/users");
  return { ok: true, message: "User access updated." };
}

export async function grantEventAccessAction(input: FormData) {
  const access = await requireUserManagementAccess();
  const parsed = eventAccessSchema.safeParse({
    userId: input.get("userId"),
    eventId: input.get("eventId"),
    role: input.get("role"),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid event access." };
  }

  if (!isServiceRoleConfigured()) {
    return { ok: true, message: "Demo mode: event access validated. Connect Supabase to persist it." };
  }

  const values = parsed.data;
  if (!EVENT_ACCESS_ROLES.includes(values.role)) {
    return { ok: false, message: "Choose an event-level access role." };
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("event_staff_assignments").upsert(
    {
      organization_id: demoOrganizationId,
      user_id: values.userId,
      event_id: values.eventId,
      role: values.role,
    },
    { onConflict: "event_id,user_id" },
  );

  if (error) return { ok: false, message: error.message };

  await writeAuditLog({
    organizationId: demoOrganizationId,
    actorUserId: access.userId ?? undefined,
    action: "user.event_access.granted",
    entityType: "user",
    entityId: values.userId,
    metadata: { eventId: values.eventId, role: values.role },
  });

  revalidatePath("/dashboard/users");
  return { ok: true, message: "Event access granted." };
}

export async function revokeEventAccessAction(input: FormData) {
  const access = await requireUserManagementAccess();
  const userId = String(input.get("userId") ?? "");
  const eventId = String(input.get("eventId") ?? "");

  if (!userId || !eventId) {
    return { ok: false, message: "Choose a user and event." };
  }

  if (!isServiceRoleConfigured()) {
    return { ok: true, message: "Demo mode: event access removed locally." };
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("event_staff_assignments")
    .delete()
    .eq("organization_id", demoOrganizationId)
    .eq("user_id", userId)
    .eq("event_id", eventId);

  if (error) return { ok: false, message: error.message };

  await writeAuditLog({
    organizationId: demoOrganizationId,
    actorUserId: access.userId ?? undefined,
    action: "user.event_access.revoked",
    entityType: "user",
    entityId: userId,
    metadata: { eventId },
  });

  revalidatePath("/dashboard/users");
  return { ok: true, message: "Event access revoked." };
}
