"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isServiceRoleConfigured, isSupabaseConfigured } from "@/lib/env";
import { requireAccountAccess } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { accountEmailSchema, accountPasswordSchema, accountProfileSchema } from "@/lib/validation";

export async function updateAccountProfileAction(input: FormData) {
  const account = await requireAccountAccess();
  const parsed = accountProfileSchema.safeParse({
    fullName: input.get("fullName"),
    phone: input.get("phone") || undefined,
  });

  if (!parsed.success) redirect("/account/settings?error=profile");
  if (!isSupabaseConfigured() || !account.userId) redirect("/account/settings?updated=demo");

  const values = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } =
    (await supabase?.auth.updateUser({
      data: {
        full_name: values.fullName,
        phone: values.phone ?? null,
      },
    })) ?? {};

  if (error) redirect("/account/settings?error=profile");

  if (isServiceRoleConfigured()) {
    const admin = createSupabaseAdminClient();
    await admin.from("user_profiles").upsert({
      id: account.userId,
      email: account.email,
      full_name: values.fullName,
      phone: values.phone ?? null,
    });

    if (account.email) {
      await admin
        .from("attendees")
        .update({ phone: values.phone ?? null })
        .eq("normalized_email", account.email.trim().toLowerCase());
    }
  }

  revalidatePath("/account");
  revalidatePath("/account/settings");
  redirect("/account/settings?updated=profile");
}

export async function updateAccountEmailAction(input: FormData) {
  const account = await requireAccountAccess();
  const parsed = accountEmailSchema.safeParse({
    email: input.get("email"),
  });

  if (!parsed.success) redirect("/account/settings?error=email");
  if (!isSupabaseConfigured() || !account.userId) redirect("/account/settings?updated=demo");

  const supabase = await createSupabaseServerClient();
  const { error } = (await supabase?.auth.updateUser({ email: parsed.data.email })) ?? {};
  if (error) redirect("/account/settings?error=email");

  if (isServiceRoleConfigured()) {
    const admin = createSupabaseAdminClient();
    await admin.from("user_profiles").upsert({
      id: account.userId,
      email: parsed.data.email,
      full_name: account.fullName,
      phone: account.phone,
    });
  }

  revalidatePath("/account/settings");
  redirect("/account/settings?updated=email");
}

export async function updateAccountPasswordAction(input: FormData) {
  await requireAccountAccess();
  const parsed = accountPasswordSchema.safeParse({
    password: input.get("password"),
    confirmPassword: input.get("confirmPassword"),
  });

  if (!parsed.success) redirect("/account/settings?error=password");
  if (!isSupabaseConfigured()) redirect("/account/settings?updated=demo");

  const supabase = await createSupabaseServerClient();
  const { error } = (await supabase?.auth.updateUser({ password: parsed.data.password })) ?? {};
  if (error) redirect("/account/settings?error=password");

  redirect("/account/settings?updated=password");
}
