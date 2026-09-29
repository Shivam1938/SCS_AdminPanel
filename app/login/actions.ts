"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: string };
export async function signIn(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(), password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) return { error: "Enter a valid email and password." };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    const message = error?.message.toLowerCase() ?? "";
    if (message.includes("email not confirmed")) return { error: "This Supabase Auth account is not email-confirmed yet. Confirm it in the inbox, then try again." };
    if (message.includes("invalid login credentials")) return { error: "Supabase Auth rejected this email/password. Check the exact Auth account email and its password." };
    return { error: "Supabase Auth could not sign in. Check the Auth account and try again." };
  }
  const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  if (profileError) redirect("/access-denied?reason=profile-check");
  if (profile?.role !== "admin") redirect("/access-denied?reason=not-admin");
  redirect("/admin");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
