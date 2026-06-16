import { redirect } from "next/navigation";
import { demoOrganizationId } from "@/lib/demo-data";
import { isServiceRoleConfigured, isSupabaseConfigured } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types";

export const MANAGEMENT_ROLES: Role[] = ["owner", "admin"];
export const DASHBOARD_ROLES: Role[] = ["owner", "admin", "manager", "check_in_staff", "viewer"];

export type CurrentUserAccess = {
  userId: string | null;
  email: string | null;
  organizationId: string;
  role: Role | null;
};

export type CurrentAccountUser = {
  userId: string | null;
  email: string | null;
  fullName: string | null;
  phone: string | null;
  isDemo: boolean;
};

export async function getCurrentUserAccess(): Promise<CurrentUserAccess | null> {
  if (!isSupabaseConfigured()) {
    return {
      userId: null,
      email: null,
      organizationId: demoOrganizationId,
      role: "owner",
    };
  }

  const sessionClient = await createSupabaseServerClient();
  const { data } = sessionClient ? await sessionClient.auth.getUser() : { data: { user: null } };
  const user = data.user;

  if (!user) return null;

  if (!isServiceRoleConfigured()) {
    return {
      userId: user.id,
      email: user.email ?? null,
      organizationId: demoOrganizationId,
      role: null,
    };
  }

  const supabase = createSupabaseAdminClient();
  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, role, is_active")
    .eq("organization_id", demoOrganizationId)
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    userId: user.id,
    email: user.email ?? null,
    organizationId: membership?.organization_id ?? demoOrganizationId,
    role: membership?.is_active ? (membership.role as Role) : null,
  };
}

export async function getCurrentAccountUser(): Promise<CurrentAccountUser | null> {
  if (!isSupabaseConfigured()) {
    return {
      userId: null,
      email: "maya@example.com",
      fullName: "Maya Reed",
      phone: "+14165550100",
      isDemo: true,
    };
  }

  const sessionClient = await createSupabaseServerClient();
  const { data } = sessionClient ? await sessionClient.auth.getUser() : { data: { user: null } };
  const user = data.user;

  if (!user) return null;

  const metadataName = user.user_metadata?.full_name as string | undefined;
  const metadataPhone = user.user_metadata?.phone as string | undefined;
  let profile: { full_name: string | null; phone: string | null; email: string | null } | null = null;

  if (isServiceRoleConfigured()) {
    const supabase = createSupabaseAdminClient();
    const { data: profileData } = await supabase
      .from("user_profiles")
      .select("full_name, phone, email")
      .eq("id", user.id)
      .maybeSingle();
    profile = profileData;
  }

  return {
    userId: user.id,
    email: profile?.email ?? user.email ?? null,
    fullName: profile?.full_name ?? metadataName ?? null,
    phone: profile?.phone ?? metadataPhone ?? null,
    isDemo: false,
  };
}

export async function getPostLoginRedirect(userId: string | null) {
  if (!isServiceRoleConfigured() || !userId) return "/dashboard";

  const supabase = createSupabaseAdminClient();
  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", demoOrganizationId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  return membership ? "/dashboard" : "/account";
}

export async function requireDashboardAccess(allowedRoles: Role[] = DASHBOARD_ROLES) {
  const access = await getCurrentUserAccess();

  if (!access) {
    redirect("/login");
  }

  if (!access.role && isServiceRoleConfigured()) {
    redirect("/login");
  }

  if (!access.role) {
    redirect("/account");
  }

  if (!allowedRoles.includes(access.role)) {
    redirect("/dashboard");
  }

  return access;
}

export async function requireAccountAccess() {
  const account = await getCurrentAccountUser();

  if (!account) {
    redirect("/login");
  }

  return account;
}

export async function requireUserManagementAccess() {
  const access = await requireDashboardAccess(DASHBOARD_ROLES);

  if (!access.role || !MANAGEMENT_ROLES.includes(access.role)) {
    redirect("/dashboard");
  }

  return access;
}

export function canManageUsers(role: Role | null) {
  return Boolean(role && MANAGEMENT_ROLES.includes(role));
}
