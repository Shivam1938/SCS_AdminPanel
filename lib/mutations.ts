"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const uuidSchema = z.string().uuid();
const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const optional = (value: string) => value || null;

export async function updateProfile(formData: FormData) {
  const id = uuidSchema.parse(text(formData, "id"));
  const input = z.object({ full_name: z.string().max(200), phone: z.string().max(50), city: z.string().max(120) }).parse({
    full_name: text(formData, "full_name"), phone: text(formData, "phone"), city: text(formData, "city"),
  });
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("profiles").update({ full_name: optional(input.full_name), phone: optional(input.phone), city: optional(input.city) }).eq("id", id);
  if (error) throw new Error(`Could not update profile: ${error.message}`);
  revalidatePath("/admin/users"); revalidatePath("/admin/settings");
}

export async function deleteProfileUser(formData: FormData) {
  const id = uuidSchema.parse(text(formData, "id"));
  const { supabase, user } = await requireAdmin();
  if (id === user.id) throw new Error("You cannot delete the account you are currently using.");
  const { data: profile, error: profileError } = await supabase.from("profiles").select("id").eq("id", id).maybeSingle();
  if (profileError) throw new Error(`Could not verify the profile before deletion: ${profileError.message}`);
  if (!profile) throw new Error("The target profile was not found or is not visible under the current RLS policy.");
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) throw new Error(`Could not delete this Auth user. Existing database references or Auth protections may prevent deletion: ${error.message}`);
  revalidatePath("/admin/users"); revalidatePath("/admin");
}

export async function changeProfileRole(formData: FormData) {
  const id = uuidSchema.parse(text(formData, "id"));
  const role = z.enum(["customer", "admin", "technician"]).parse(text(formData, "role"));
  const { supabase, user } = await requireAdmin();
  if (id === user.id) throw new Error("You cannot change your own role in the Admin Panel.");

  const { data: target, error: lookupError } = await supabase.from("profiles").select("role").eq("id", id).maybeSingle();
  if (lookupError) throw new Error(`Could not verify the profile role: ${lookupError.message}`);
  if (!target) throw new Error("The target profile was not found or is not visible under the current RLS policy.");
  const { data, error } = await supabase.from("profiles").update({ role }).eq("id", id).select("id").maybeSingle();
  if (error) throw new Error(`Could not change profile role: ${error.message}`);
  if (!data) throw new Error("The role was not changed. Check the existing admin RLS policy.");
  revalidatePath("/admin/users");
}

export async function createProfileUser(formData: FormData) {
  const input = z.object({
    name: z.string().min(1).max(200),
    email: z.string().email().max(320),
    phone: z.string().max(50),
    city: z.string().max(120),
    role: z.enum(["customer", "admin", "technician"]).default("customer"),
    password: z.string().min(8).max(128),
  }).parse({
    name: text(formData, "name"), email: text(formData, "email"), phone: text(formData, "phone"),
    city: text(formData, "city"), role: text(formData, "role") || "customer", password: String(formData.get("password") ?? ""),
  });
  await requireAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: input.email, password: input.password, email_confirm: true, user_metadata: { full_name: input.name },
  });
  if (error) throw new Error(`Could not create Auth user: ${error.message}`);
  if (!data.user) throw new Error("Supabase did not return the created Auth user.");

  const { error: profileError } = await admin.from("profiles").upsert({
    id: data.user.id, full_name: input.name, phone: optional(input.phone), city: optional(input.city), role: input.role,
  }, { onConflict: "id" });
  if (profileError) {
    const { error: rollbackError } = await admin.auth.admin.deleteUser(data.user.id);
    const rollbackNote = rollbackError ? ` The Auth user could not be rolled back: ${rollbackError.message}` : " The Auth user was removed.";
    throw new Error(`Auth user was created, but its profile could not be saved: ${profileError.message}.${rollbackNote}`);
  }
  revalidatePath("/admin/users"); revalidatePath("/admin");
}

export async function createTechnician(formData: FormData) {
  const profileIdInput = text(formData, "profile_id");
  const input = z.object({
    name: z.string().min(1).max(200), role_title: z.string().max(200), about: z.string().max(5000),
    profile_id: profileIdInput ? uuidSchema : z.literal(""), skills: z.string().max(2000),
    rating: z.number().min(0).max(5).nullable(), reviews_count: z.number().int().min(0).nullable(),
    jobs_completed: z.number().int().min(0).nullable(), years_experience: z.number().int().min(0).nullable(),
    on_time_percent: z.number().int().min(0).max(100).nullable(), verified: z.boolean(),
  }).parse({
    name: text(formData, "name"), role_title: text(formData, "role_title"), about: text(formData, "about"),
    profile_id: profileIdInput, skills: text(formData, "skills"),
    rating: text(formData, "rating") ? Number(text(formData, "rating")) : null,
    reviews_count: text(formData, "reviews_count") ? Number(text(formData, "reviews_count")) : null,
    jobs_completed: text(formData, "jobs_completed") ? Number(text(formData, "jobs_completed")) : null,
    years_experience: text(formData, "years_experience") ? Number(text(formData, "years_experience")) : null,
    on_time_percent: text(formData, "on_time_percent") ? Number(text(formData, "on_time_percent")) : null,
    verified: ["on", "true"].includes(String(formData.get("verified"))),
  });
  const { supabase, user } = await requireAdmin();
  if (input.profile_id && input.profile_id === user.id) throw new Error("Link another user's profile; you cannot change your own role here.");

  let existingRole: "customer" | "technician" | null = null;
  if (input.profile_id) {
    const { data: profile, error } = await supabase.from("profiles").select("role").eq("id", input.profile_id).maybeSingle();
    if (error) throw new Error(`Could not verify the selected profile: ${error.message}`);
    if (!profile) throw new Error("The selected profile was not found or is not visible under the current RLS policy.");
    if (profile.role === "admin") throw new Error("Admin profiles cannot be linked here. Manage admin accounts manually in Supabase.");
    if (profile.role !== "customer" && profile.role !== "technician") throw new Error("The selected profile has an unsupported role.");
    existingRole = profile.role;
  }

  const id = randomUUID();
  const skills = input.skills.split(",").map((skill) => skill.trim()).filter(Boolean);
  const { error: insertError } = await supabase.from("technicians").insert({
    id, name: input.name, role_title: optional(input.role_title), about: optional(input.about),
    profile_id: input.profile_id || null, skills: skills.length ? skills : null,
    rating: input.rating, reviews_count: input.reviews_count, jobs_completed: input.jobs_completed,
    years_experience: input.years_experience, on_time_percent: input.on_time_percent, verified: input.verified,
  });
  if (insertError) throw new Error(`Could not create technician record: ${insertError.message}`);

  if (input.profile_id && existingRole !== "technician") {
    const { error: roleError } = await supabase.from("profiles").update({ role: "technician" }).eq("id", input.profile_id);
    if (roleError) {
      const { error: rollbackError } = await supabase.from("technicians").delete().eq("id", id);
      const rollbackMessage = rollbackError ? ` The technician record also could not be rolled back: ${rollbackError.message}` : " The new technician record was rolled back.";
      throw new Error(`Could not set the linked profile role to technician: ${roleError.message}.${rollbackMessage}`);
    }
  }
  revalidatePath("/admin/technicians");
  revalidatePath("/admin/users");
  revalidatePath("/admin");
}

export async function saveTechnician(formData: FormData) {
  const id = uuidSchema.parse(text(formData, "id"));
  const profileIdInput = text(formData, "profile_id");
  const input = z.object({
    name: z.string().min(1).max(200), role_title: z.string().max(200), about: z.string().max(5000),
    rating: z.number().min(0).max(5).nullable(), reviews_count: z.number().int().min(0).nullable(),
    jobs_completed: z.number().int().min(0).nullable(), years_experience: z.number().int().min(0).nullable(),
    on_time_percent: z.number().int().min(0).max(100).nullable(), skills: z.string().max(2000), verified: z.boolean(),
    profile_id: profileIdInput ? uuidSchema : z.literal(""),
  }).parse({
    name: text(formData, "name"), role_title: text(formData, "role_title"), about: text(formData, "about"),
    rating: text(formData, "rating") ? Number(text(formData, "rating")) : null,
    reviews_count: text(formData, "reviews_count") ? Number(text(formData, "reviews_count")) : null,
    jobs_completed: text(formData, "jobs_completed") ? Number(text(formData, "jobs_completed")) : null,
    years_experience: text(formData, "years_experience") ? Number(text(formData, "years_experience")) : null,
    on_time_percent: text(formData, "on_time_percent") ? Number(text(formData, "on_time_percent")) : null,
    skills: text(formData, "skills"),
    profile_id: profileIdInput,
    verified: formData.get("verified") === "on",
  });
  const { supabase, user } = await requireAdmin();
  if (input.profile_id && input.profile_id === user.id) throw new Error("A technician record cannot be linked to your own admin profile.");
  const { data: current, error: currentError } = await supabase.from("technicians").select("profile_id").eq("id", id).maybeSingle();
  if (currentError) throw new Error(`Could not verify the technician record: ${currentError.message}`);
  if (!current) throw new Error("Technician record not found or not visible under the current RLS policy.");

  let shouldPromoteProfile = false;
  if (input.profile_id) {
    const { data: profile, error } = await supabase.from("profiles").select("role").eq("id", input.profile_id).maybeSingle();
    if (error) throw new Error(`Could not verify the linked profile: ${error.message}`);
    if (!profile) throw new Error("Linked profile not found or not visible under the current RLS policy.");
    if (profile.role === "admin" && input.profile_id !== current.profile_id) throw new Error("Admin profiles cannot be linked to technician records.");
    if (profile.role !== "admin" && profile.role !== "customer" && profile.role !== "technician") throw new Error("The selected profile has an unsupported role.");
    shouldPromoteProfile = profile.role === "customer";
  }
  if (shouldPromoteProfile) {
    const { data, error } = await supabase.from("profiles").update({ role: "technician" }).eq("id", input.profile_id).select("id").maybeSingle();
    if (error) throw new Error(`Could not assign the linked profile's technician role: ${error.message}`);
    if (!data) throw new Error("Could not assign technician role under the current RLS policy.");
  }
  const skills = input.skills.split(",").map((skill) => skill.trim()).filter(Boolean);
  const { error } = await supabase.from("technicians").update({
    ...input, role_title: optional(input.role_title), about: optional(input.about), skills: skills.length ? skills : null,
    profile_id: input.profile_id || null,
  }).eq("id", id);
  if (error) {
    if (shouldPromoteProfile) {
      const { error: rollbackError } = await supabase.from("profiles").update({ role: "customer" }).eq("id", input.profile_id);
      const rollbackNote = rollbackError ? ` Profile role rollback failed: ${rollbackError.message}` : " Linked profile role was restored to customer.";
      throw new Error(`Could not update technician: ${error.message}.${rollbackNote}`);
    }
    throw new Error(`Could not update technician: ${error.message}`);
  }
  revalidatePath("/admin/technicians"); revalidatePath("/admin");
}

export async function deleteTechnician(formData: FormData) {
  const id = uuidSchema.parse(text(formData, "id"));
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("technicians").delete().eq("id", id);
  if (error) throw new Error(`Could not delete technician: ${error.message}`);
  revalidatePath("/admin/technicians"); revalidatePath("/admin");
}

export async function saveService(formData: FormData) {
  const id = text(formData, "id");
  const input = z.object({
    id: z.string().min(1).max(100), name: z.string().min(1).max(200), description: z.string().max(5000), icon: z.string().max(100),
    price: z.number().int().min(0), rating: z.number().min(0).max(5).nullable(), bookings_count: z.number().int().min(0).nullable(),
    tint: z.string().max(100), color: z.string().max(100), active: z.boolean(), sort: z.number().int().nullable(),
  }).parse({
    id, name: text(formData, "name"), description: text(formData, "description"), icon: text(formData, "icon"),
    price: Number(text(formData, "price")), active: ["on", "true"].includes(String(formData.get("active"))),
    rating: text(formData, "rating") ? Number(text(formData, "rating")) : null,
    bookings_count: text(formData, "bookings_count") ? Number(text(formData, "bookings_count")) : null,
    tint: text(formData, "tint"), color: text(formData, "color"),
    sort: text(formData, "sort") ? Number(text(formData, "sort")) : null,
  });
  const { supabase } = await requireAdmin();
  const payload = { ...input, description: optional(input.description), icon: optional(input.icon), tint: optional(input.tint), color: optional(input.color) };
  const result = formData.get("intent") === "create"
    ? await supabase.from("services").insert(payload)
    : await supabase.from("services").update(payload).eq("id", id);
  if (result.error) throw new Error(`Could not save service: ${result.error.message}`);
  revalidatePath("/admin/services"); revalidatePath("/admin");
}

export async function deleteService(formData: FormData) {
  const id = z.string().min(1).max(100).parse(text(formData, "id"));
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("services").delete().eq("id", id);
  if (error) throw new Error(`Could not delete service. Existing bookings or database policies may prevent deletion: ${error.message}`);
  revalidatePath("/admin/services"); revalidatePath("/admin/bookings"); revalidatePath("/admin");
}

export async function saveBooking(formData: FormData) {
  const id = uuidSchema.parse(text(formData, "id"));
  const technicianId = text(formData, "technician_id");
  const parseAmount = (key: string) => text(formData, key) ? Number(text(formData, key)) : null;
  const input = z.object({
    scheduled_date: z.string().date(), scheduled_time: z.string().min(1).max(100),
    technician_id: technicianId ? uuidSchema : z.literal(""), address_line: z.string().min(1).max(2000),
    notes: z.string().max(5000), service_fee: z.number().int().nullable(), parts_estimate: z.number().int().nullable(),
    discount: z.number().int().nullable(), total: z.number().int().nullable(),
  }).parse({
    scheduled_date: text(formData, "scheduled_date"), scheduled_time: text(formData, "scheduled_time"),
    technician_id: technicianId, address_line: text(formData, "address_line"), notes: text(formData, "notes"),
    service_fee: parseAmount("service_fee"), parts_estimate: parseAmount("parts_estimate"),
    discount: parseAmount("discount"), total: parseAmount("total"),
  });
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("bookings").update({
    ...input, technician_id: input.technician_id || null, notes: optional(input.notes),
  }).eq("id", id);
  if (error) throw new Error(`Could not update booking: ${error.message}`);
  revalidatePath("/admin/bookings"); revalidatePath("/admin/payments"); revalidatePath("/admin");
}

export async function deleteBooking(formData: FormData) {
  const id = uuidSchema.parse(text(formData, "id"));
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("bookings").delete().eq("id", id);
  if (error) throw new Error(`Could not delete booking. Existing reviews or database policies may prevent deletion: ${error.message}`);
  revalidatePath("/admin/bookings"); revalidatePath("/admin/reviews"); revalidatePath("/admin/payments"); revalidatePath("/admin");
}

export async function saveReview(formData: FormData) {
  const id = uuidSchema.parse(text(formData, "id"));
  const tags = text(formData, "tags").split(",").map((tag) => tag.trim()).filter(Boolean);
  const input = z.object({ rating: z.number().int(), comment: z.string().max(5000), tags: z.array(z.string().max(100)) }).parse({
    rating: Number(text(formData, "rating")), comment: text(formData, "comment"), tags,
  });
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("reviews").update({ ...input, comment: optional(input.comment), tags: input.tags.length ? input.tags : null }).eq("id", id);
  if (error) throw new Error(`Could not update review: ${error.message}`);
  revalidatePath("/admin/reviews");
}

export async function deleteReview(formData: FormData) {
  const id = uuidSchema.parse(text(formData, "id"));
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("reviews").delete().eq("id", id);
  if (error) throw new Error(`Could not delete review: ${error.message}`);
  revalidatePath("/admin/reviews");
}

export async function saveNotification(formData: FormData) {
  const id = uuidSchema.parse(text(formData, "id"));
  const input = z.object({ title: z.string().min(1).max(300), body: z.string().max(5000), icon: z.string().max(100), unread: z.boolean() }).parse({
    title: text(formData, "title"), body: text(formData, "body"), icon: text(formData, "icon"), unread: formData.get("unread") === "on",
  });
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("notifications").update({ ...input, body: optional(input.body), icon: optional(input.icon) }).eq("id", id);
  if (error) throw new Error(`Could not update notification: ${error.message}`);
  revalidatePath("/admin/notifications");
}

export async function saveAddress(formData: FormData) {
  const id = uuidSchema.parse(text(formData, "id"));
  const input = z.object({ label: z.string().min(1).max(100), line: z.string().min(1).max(2000), city: z.string().max(120), is_default: z.boolean() }).parse({
    label: text(formData, "label"), line: text(formData, "line"), city: text(formData, "city"), is_default: formData.get("is_default") === "on",
  });
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("addresses").update({ ...input, city: optional(input.city) }).eq("id", id);
  if (error) throw new Error(`Could not update address: ${error.message}`);
  revalidatePath("/admin/addresses"); revalidatePath("/admin/users");
}

export async function createAddress(formData: FormData) {
  const input = z.object({ user_id: uuidSchema, label: z.string().min(1).max(100), line: z.string().min(1).max(2000), city: z.string().max(120), is_default: z.boolean() }).parse({
    user_id: text(formData, "user_id"), label: text(formData, "label"), line: text(formData, "line"),
    city: text(formData, "city"), is_default: formData.get("is_default") === "on",
  });
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("addresses").insert({ id: randomUUID(), ...input, city: optional(input.city) });
  if (error) throw new Error(`Could not create address: ${error.message}`);
  revalidatePath("/admin/addresses"); revalidatePath("/admin/users");
}

export async function deleteAddress(formData: FormData) {
  const id = uuidSchema.parse(text(formData, "id"));
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("addresses").delete().eq("id", id);
  if (error) throw new Error(`Could not delete address: ${error.message}`);
  revalidatePath("/admin/addresses"); revalidatePath("/admin/users");
}

export async function cancelBooking(formData: FormData) {
  const id = uuidSchema.parse(text(formData, "id"));
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id)
    .in("status", ["finding_technician", "technician_assigned"]).select("id").maybeSingle();
  if (error) throw new Error(`Could not cancel booking: ${error.message}`);
  if (!data) throw new Error("This booking is no longer in a cancellable status.");
  revalidatePath("/admin/bookings"); revalidatePath("/admin");
}

export async function markNotificationRead(formData: FormData) {
  const id = uuidSchema.parse(text(formData, "id"));
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("notifications").update({ unread: false }).eq("id", id);
  if (error) throw new Error(`Could not update notification: ${error.message}`);
  revalidatePath("/admin/notifications");
}

export async function createNotification(formData: FormData) {
  const input = z.object({ user_id: uuidSchema, title: z.string().min(1).max(300), body: z.string().max(5000), icon: z.string().max(100) }).parse({
    user_id: text(formData, "user_id"), title: text(formData, "title"), body: text(formData, "body"), icon: text(formData, "icon"),
  });
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("notifications").insert({ ...input, body: optional(input.body), icon: optional(input.icon), unread: true, created_at: new Date().toISOString() });
  if (error) throw new Error(`Could not create notification: ${error.message}`);
  revalidatePath("/admin/notifications");
}

export async function deleteNotification(formData: FormData) {
  const id = uuidSchema.parse(text(formData, "id"));
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("notifications").delete().eq("id", id);
  if (error) throw new Error(`Could not delete notification: ${error.message}`);
  revalidatePath("/admin/notifications");
}
