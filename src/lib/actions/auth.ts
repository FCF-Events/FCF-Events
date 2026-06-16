"use server";

import { redirect } from "next/navigation";
import { getPostLoginRedirect } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function signInAction(input: FormData) {
  const email = String(input.get("email") ?? "").trim().toLowerCase();
  const password = String(input.get("password") ?? "");

  if (!email || !password) {
    redirect("/login?error=missing_credentials");
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    redirect("/dashboard");
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect("/login?error=invalid_credentials");
  }

  redirect(await getPostLoginRedirect(data.user?.id ?? null));
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase?.auth.signOut();
  redirect("/login");
}
