"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const uuidSchema = z.string().uuid();
const text = (formData: FormData, key: string) =>
  String(formData.get(key) ?? "").trim();
const optional = (value: string) => value || null;
function paymentPaidAtForStatus(
  currentStatus: string,
  currentPaidAt: string | null,
  nextStatus: "pending" | "paid" | "refunded",
) {
  if (nextStatus === "pending") return null;
  if (currentPaidAt) return currentPaidAt;
  return nextStatus === "paid" && currentStatus !== "paid"
    ? new Date().toISOString()
    : null;
}
async function uploadTechnicianPhoto(
  formData: FormData,
  technicianId: string,
): Promise<string | null> {
  const file = formData.get("technician_photo");
  if (!(file instanceof File) || file.size === 0) return null;
  const extensions: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
  };
  const extension = extensions[file.type];
  if (!extension)
    throw new Error("Upload a PNG, JPEG, or WebP technician photo.");
  if (file.size > 850 * 1024)
    throw new Error("Choose a technician photo smaller than 850 KB.");
  const admin = createAdminClient();
  const path = `technicians/${technicianId}/${randomUUID()}.${extension}`;
  const { error } = await admin.storage
    .from("profile-photos")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error)
    throw new Error("Could not upload the technician photo. Please try again.");
  return admin.storage.from("profile-photos").getPublicUrl(path).data.publicUrl;
}

async function uploadServicePhoto(
  formData: FormData,
  serviceId: string,
): Promise<string | null> {
  const file = formData.get("service_image");

  if (!(file instanceof File) || file.size === 0) return null;

  const extensions: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
  };

  const extension = extensions[file.type];

  if (!extension)
    throw new Error("Upload a PNG, JPEG, or WebP service image.");

  if (file.size > 2 * 1024 * 1024)
    throw new Error("Choose a service image smaller than 2 MB.");

  const admin = createAdminClient();

  const path = `services/${serviceId}/${randomUUID()}.${extension}`;

  const { error } = await admin.storage
    .from("service-assets")
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error)
    throw new Error("Could not upload the service image. Please try again.");

  return admin.storage
    .from("service-assets")
    .getPublicUrl(path).data.publicUrl;
}

export async function updateProfile(formData: FormData) {
  const id = uuidSchema.parse(text(formData, "id"));
  const input = z
    .object({
      full_name: z.string().max(200),
      phone: z.string().max(50),
      city: z.string().max(120),
    })
    .parse({
      full_name: text(formData, "full_name"),
      phone: text(formData, "phone"),
      city: text(formData, "city"),
    });
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: optional(input.full_name),
      phone: optional(input.phone),
      city: optional(input.city),
    })
    .eq("id", id);
  if (error) throw new Error(`Could not update profile: ${error.message}`);
  revalidatePath("/admin/users");
  revalidatePath("/admin/settings");
}

export async function savePaymentSettings(
  formData: FormData,
): Promise<{ qr_code_url: string | null }> {
  const { user } = await requireAdmin();
  const upiEnabled = ["true", "on"].includes(text(formData, "upi_enabled"));
  const input = z
    .object({ upi_id: z.string().max(255) })
    .parse({ upi_id: text(formData, "upi_id") });
  if (input.upi_id && !/^[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+$/.test(input.upi_id)) {
    throw new Error("Enter a valid UPI ID.");
  }

  const admin = createAdminClient();
  const { data: current, error: lookupError } = await admin
    .from("payment_settings")
    .select("id, qr_code_url")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lookupError)
    throw new Error("Could not load payment settings. Refresh and try again.");

  const file = formData.get("qr_file");
  let qrCodeUrl = current?.qr_code_url ?? null;
  let uploadedPath: string | null = null;
  if (file instanceof File && file.size > 0) {
    const extensions: Record<string, string> = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp",
    };
    const extension = extensions[file.type];
    if (!extension) throw new Error("Upload a PNG, JPEG, or WebP QR image.");
    if (file.size > 850 * 1024)
      throw new Error("Choose a QR image smaller than 850 KB.");
    uploadedPath = `${user.id}/upi-qr/${randomUUID()}.${extension}`;
    const { error: uploadError } = await admin.storage
      .from("payment-assets")
      .upload(uploadedPath, await file.arrayBuffer(), {
        contentType: file.type,
        upsert: false,
      });
    if (uploadError)
      throw new Error("Could not upload the QR image. Please try again.");
    qrCodeUrl = admin.storage.from("payment-assets").getPublicUrl(uploadedPath)
      .data.publicUrl;
  }
  if (upiEnabled && (!input.upi_id || !qrCodeUrl)) {
    if (uploadedPath)
      await admin.storage.from("payment-assets").remove([uploadedPath]);
    throw new Error(
      "Add a UPI ID and upload a QR image before enabling online payment.",
    );
  }

  const values = {
    upi_id: input.upi_id || null,
    upi_enabled: upiEnabled,
    qr_code_url: qrCodeUrl,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  };
  let saveError: { message: string } | null;
  if (current) {
    const { error } = await admin
      .from("payment_settings")
      .update(values)
      .eq("id", current.id);
    saveError = error;
  } else {
    const { error } = await admin
      .from("payment_settings")
      .insert({ id: randomUUID(), ...values });
    saveError = error;
  }
  if (saveError) {
    if (uploadedPath)
      await admin.storage.from("payment-assets").remove([uploadedPath]);
    throw new Error("Could not save payment settings. Please try again.");
  }

  if (uploadedPath && current?.qr_code_url) {
    const marker = "/storage/v1/object/public/payment-assets/";
    const oldPath = String(current.qr_code_url).split(marker)[1]?.split("?")[0];
    if (oldPath && oldPath !== uploadedPath)
      await admin.storage.from("payment-assets").remove([oldPath]);
  }
  revalidatePath("/admin/settings");
  return { qr_code_url: qrCodeUrl };
}

export async function deleteProfileUser(formData: FormData) {
  const id = uuidSchema.parse(text(formData, "id"));
  const { supabase, user } = await requireAdmin();
  if (id === user.id)
    throw new Error("You cannot delete the account you are currently using.");
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (profileError)
    throw new Error(
      `Could not verify the profile before deletion: ${profileError.message}`,
    );
  if (!profile)
    throw new Error(
      "The target profile was not found or is not visible under the current RLS policy.",
    );
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error)
    throw new Error(
      `Could not delete this Auth user. Existing database references or Auth protections may prevent deletion: ${error.message}`,
    );
  revalidatePath("/admin/users");
  revalidatePath("/admin");
}

export async function changeProfileRole(formData: FormData) {
  const id = uuidSchema.parse(text(formData, "id"));
  const role = z
    .enum(["customer", "admin", "technician"])
    .parse(text(formData, "role"));
  const { supabase, user } = await requireAdmin();
  if (id === user.id)
    throw new Error("You cannot change your own role in the Admin Panel.");

  const { data: target, error: lookupError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", id)
    .maybeSingle();
  if (lookupError)
    throw new Error(
      `Could not verify the profile role: ${lookupError.message}`,
    );
  if (!target)
    throw new Error(
      "The target profile was not found or is not visible under the current RLS policy.",
    );
  const { data, error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`Could not change profile role: ${error.message}`);
  if (!data)
    throw new Error(
      "The role was not changed. Check the existing admin RLS policy.",
    );
  revalidatePath("/admin/users");
}

export async function createProfileUser(formData: FormData) {
  const input = z
    .object({
      name: z.string().min(1).max(200),
      email: z.string().email().max(320),
      phone: z.string().max(50),
      city: z.string().max(120),
      role: z.enum(["customer", "admin", "technician"]).default("customer"),
      password: z.string().min(8).max(128),
    })
    .parse({
      name: text(formData, "name"),
      email: text(formData, "email"),
      phone: text(formData, "phone"),
      city: text(formData, "city"),
      role: text(formData, "role") || "customer",
      password: String(formData.get("password") ?? ""),
    });
  await requireAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.name },
  });
  if (error) throw new Error(`Could not create Auth user: ${error.message}`);
  if (!data.user)
    throw new Error("Supabase did not return the created Auth user.");

  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: data.user.id,
      full_name: input.name,
      phone: optional(input.phone),
      city: optional(input.city),
      role: input.role,
    },
    { onConflict: "id" },
  );
  if (profileError) {
    const { error: rollbackError } = await admin.auth.admin.deleteUser(
      data.user.id,
    );
    const rollbackNote = rollbackError
      ? ` The Auth user could not be rolled back: ${rollbackError.message}`
      : " The Auth user was removed.";
    throw new Error(
      `Auth user was created, but its profile could not be saved: ${profileError.message}.${rollbackNote}`,
    );
  }
  revalidatePath("/admin/users");
  revalidatePath("/admin");
}

export async function createTechnician(formData: FormData) {
  const profileIdInput = text(formData, "profile_id");
  const input = z
    .object({
      name: z.string().min(1).max(200),
      phone: z.string().max(50),
      role_title: z.string().max(200),
      about: z.string().max(5000),
      profile_id: profileIdInput ? uuidSchema : z.literal(""),
      skills: z.string().max(2000),
      rating: z.number().min(0).max(5).nullable(),
      reviews_count: z.number().int().min(0).nullable(),
      jobs_completed: z.number().int().min(0).nullable(),
      years_experience: z.number().int().min(0).nullable(),
      on_time_percent: z.number().int().min(0).max(100).nullable(),
      verified: z.boolean(),
    })
    .parse({
      name: text(formData, "name"),
      phone: text(formData, "phone"),
      role_title: text(formData, "role_title"),
      about: text(formData, "about"),
      profile_id: profileIdInput,
      skills: text(formData, "skills"),
      rating: text(formData, "rating")
        ? Number(text(formData, "rating"))
        : null,
      reviews_count: text(formData, "reviews_count")
        ? Number(text(formData, "reviews_count"))
        : null,
      jobs_completed: text(formData, "jobs_completed")
        ? Number(text(formData, "jobs_completed"))
        : null,
      years_experience: text(formData, "years_experience")
        ? Number(text(formData, "years_experience"))
        : null,
      on_time_percent: text(formData, "on_time_percent")
        ? Number(text(formData, "on_time_percent"))
        : null,
      verified: ["on", "true"].includes(String(formData.get("verified"))),
    });
  const { supabase, user } = await requireAdmin();
  if (input.profile_id && input.profile_id === user.id)
    throw new Error(
      "Link another user's profile; you cannot change your own role here.",
    );

  let existingRole: "customer" | "technician" | null = null;
  if (input.profile_id) {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", input.profile_id)
      .maybeSingle();
    if (error)
      throw new Error(
        `Could not verify the selected profile: ${error.message}`,
      );
    if (!profile)
      throw new Error(
        "The selected profile was not found or is not visible under the current RLS policy.",
      );
    if (profile.role === "admin")
      throw new Error(
        "Admin profiles cannot be linked here. Manage admin accounts manually in Supabase.",
      );
    if (profile.role !== "customer" && profile.role !== "technician")
      throw new Error("The selected profile has an unsupported role.");
    existingRole = profile.role;
  }

  const id = randomUUID();
  const avatarUrl = await uploadTechnicianPhoto(formData, id);
  const skills = input.skills
    .split(",")
    .map((skill) => skill.trim())
    .filter(Boolean);
  const { error: insertError } = await supabase.from("technicians").insert({
    id,
    name: input.name,
    phone: optional(input.phone),
    avatar_url: avatarUrl,
    role_title: optional(input.role_title),
    about: optional(input.about),
    profile_id: input.profile_id || null,
    skills: skills.length ? skills : null,
    rating: input.rating,
    reviews_count: input.reviews_count,
    jobs_completed: input.jobs_completed,
    years_experience: input.years_experience,
    on_time_percent: input.on_time_percent,
    verified: input.verified,
  });
  if (insertError)
    throw new Error(
      `Could not create technician record: ${insertError.message}`,
    );

  if (input.profile_id && existingRole !== "technician") {
    const { error: roleError } = await supabase
      .from("profiles")
      .update({ role: "technician" })
      .eq("id", input.profile_id);
    if (roleError) {
      const { error: rollbackError } = await supabase
        .from("technicians")
        .delete()
        .eq("id", id);
      const rollbackMessage = rollbackError
        ? ` The technician record also could not be rolled back: ${rollbackError.message}`
        : " The new technician record was rolled back.";
      throw new Error(
        `Could not set the linked profile role to technician: ${roleError.message}.${rollbackMessage}`,
      );
    }
  }
  revalidatePath("/admin/technicians");
  revalidatePath("/admin/users");
  revalidatePath("/admin");
}

export async function saveTechnician(formData: FormData) {
  const id = uuidSchema.parse(text(formData, "id"));
  const profileIdInput = text(formData, "profile_id");
  const input = z
    .object({
      name: z.string().min(1).max(200),
      phone: z.string().max(50),
      role_title: z.string().max(200),
      about: z.string().max(5000),
      rating: z.number().min(0).max(5).nullable(),
      reviews_count: z.number().int().min(0).nullable(),
      jobs_completed: z.number().int().min(0).nullable(),
      years_experience: z.number().int().min(0).nullable(),
      on_time_percent: z.number().int().min(0).max(100).nullable(),
      skills: z.string().max(2000),
      verified: z.boolean(),
      profile_id: profileIdInput ? uuidSchema : z.literal(""),
    })
    .parse({
      name: text(formData, "name"),
      phone: text(formData, "phone"),
      role_title: text(formData, "role_title"),
      about: text(formData, "about"),
      rating: text(formData, "rating")
        ? Number(text(formData, "rating"))
        : null,
      reviews_count: text(formData, "reviews_count")
        ? Number(text(formData, "reviews_count"))
        : null,
      jobs_completed: text(formData, "jobs_completed")
        ? Number(text(formData, "jobs_completed"))
        : null,
      years_experience: text(formData, "years_experience")
        ? Number(text(formData, "years_experience"))
        : null,
      on_time_percent: text(formData, "on_time_percent")
        ? Number(text(formData, "on_time_percent"))
        : null,
      skills: text(formData, "skills"),
      profile_id: profileIdInput,
      verified: formData.get("verified") === "on",
    });
  const { supabase, user } = await requireAdmin();
  if (input.profile_id && input.profile_id === user.id)
    throw new Error(
      "A technician record cannot be linked to your own admin profile.",
    );
  const { data: current, error: currentError } = await supabase
    .from("technicians")
    .select("profile_id, avatar_url")
    .eq("id", id)
    .maybeSingle();
  if (currentError)
    throw new Error(
      `Could not verify the technician record: ${currentError.message}`,
    );
  if (!current)
    throw new Error(
      "Technician record not found or not visible under the current RLS policy.",
    );

  let shouldPromoteProfile = false;
  if (input.profile_id) {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", input.profile_id)
      .maybeSingle();
    if (error)
      throw new Error(`Could not verify the linked profile: ${error.message}`);
    if (!profile)
      throw new Error(
        "Linked profile not found or not visible under the current RLS policy.",
      );
    if (profile.role === "admin" && input.profile_id !== current.profile_id)
      throw new Error("Admin profiles cannot be linked to technician records.");
    if (
      profile.role !== "admin" &&
      profile.role !== "customer" &&
      profile.role !== "technician"
    )
      throw new Error("The selected profile has an unsupported role.");
    shouldPromoteProfile = profile.role === "customer";
  }
  if (shouldPromoteProfile) {
    const { data, error } = await supabase
      .from("profiles")
      .update({ role: "technician" })
      .eq("id", input.profile_id)
      .select("id")
      .maybeSingle();
    if (error)
      throw new Error(
        `Could not assign the linked profile's technician role: ${error.message}`,
      );
    if (!data)
      throw new Error(
        "Could not assign technician role under the current RLS policy.",
      );
  }
  const skills = input.skills
    .split(",")
    .map((skill) => skill.trim())
    .filter(Boolean);
  const avatarUrl = await uploadTechnicianPhoto(formData, id);
  const removeAvatar = text(formData, "remove_avatar") === "true" && !avatarUrl;
  const currentAvatarPath = String(current.avatar_url ?? "")
    .split("/storage/v1/object/public/profile-photos/")[1]
    ?.split("?")[0];
  const { error } = await supabase
    .from("technicians")
    .update({
      ...input,
      role_title: optional(input.role_title),
      about: optional(input.about),
      skills: skills.length ? skills : null,
      phone: optional(input.phone),
      profile_id: input.profile_id || null,
      ...(avatarUrl
        ? { avatar_url: avatarUrl }
        : removeAvatar
          ? { avatar_url: null }
          : {}),
    })
    .eq("id", id);
  if (error) {
    if (shouldPromoteProfile) {
      const { error: rollbackError } = await supabase
        .from("profiles")
        .update({ role: "customer" })
        .eq("id", input.profile_id);
      const rollbackNote = rollbackError
        ? ` Profile role rollback failed: ${rollbackError.message}`
        : " Linked profile role was restored to customer.";
      throw new Error(
        `Could not update technician: ${error.message}.${rollbackNote}`,
      );
    }
    throw new Error(`Could not update technician: ${error.message}`);
  }
  if ((avatarUrl || removeAvatar) && currentAvatarPath) {
    const { error: removeError } = await createAdminClient()
      .storage.from("profile-photos")
      .remove([decodeURIComponent(currentAvatarPath)]);
    if (removeError)
      console.warn(
        "Could not remove the replaced technician photo:",
        removeError.message,
      );
  }
  revalidatePath("/admin/technicians");
  revalidatePath("/admin");
}

export async function deleteTechnician(formData: FormData) {
  const id = uuidSchema.parse(text(formData, "id"));
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("technicians").delete().eq("id", id);
  if (error) throw new Error(`Could not delete technician: ${error.message}`);
  revalidatePath("/admin/technicians");
  revalidatePath("/admin");
}

export async function saveService(formData: FormData) {
  const id = text(formData, "id");
  const input = z
    .object({
      id: z.string().min(1).max(100),
      name: z.string().min(1).max(200),
      description: z.string().max(5000),
      icon: z.string().max(100),
      image_url: z.string().max(1000).nullable().optional(),
      price: z.number().int().min(0),
      rating: z.number().min(0).max(5).nullable(),
      bookings_count: z.number().int().min(0).nullable(),
      tint: z.string().max(100),
      color: z.string().max(100),
      active: z.boolean(),
      sort: z.number().int().nullable(),
    })
    .parse({
      id,
      name: text(formData, "name"),
      description: text(formData, "description"),
      icon: text(formData, "icon"),
      image_url: text(formData, "image_url"),
      price: Number(text(formData, "price")),
      active: ["on", "true"].includes(String(formData.get("active"))),
      rating: text(formData, "rating")
        ? Number(text(formData, "rating"))
        : null,
      bookings_count: text(formData, "bookings_count")
        ? Number(text(formData, "bookings_count"))
        : null,
      tint: text(formData, "tint"),
      color: text(formData, "color"),
      sort: text(formData, "sort") ? Number(text(formData, "sort")) : null,
    });
  const { supabase } = await requireAdmin();


  const isCreate = formData.get("intent") === "create";

  const serviceImageUrl = await uploadServicePhoto(formData, id);
const removeServiceImage =
  text(formData, "remove_service_image") === "true";

  let currentImageUrl: string | null = null;

if (!isCreate) {
  const { data: currentService, error: currentError } = await supabase
    .from("services")
    .select("image_url")
    .eq("id", id)
    .maybeSingle();

  if (currentError)
    throw new Error(
      `Could not verify the current service image: ${currentError.message}`,
    );

  currentImageUrl = currentService?.image_url ?? null;
}

  let sort = input.sort;
  if (isCreate) {
    const { data: highest, error: sortError } = await supabase
      .from("services")
      .select("sort")
      .not("sort", "is", null)
      .order("sort", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sortError)
      throw new Error(
        `Could not assign the next service display order: ${sortError.message}`,
      );
    sort = Number(highest?.sort ?? 0) + 1;
  }

  const finalImageUrl = serviceImageUrl
  ? serviceImageUrl
  : removeServiceImage
    ? null
    : input.image_url ?? currentImageUrl;
  const payload = {
    ...input,
    sort,
    description: optional(input.description),
    icon: optional(input.icon),
    // image_url: input.image_url ?? null,
    image_url: finalImageUrl,
    tint: optional(input.tint),
    color: optional(input.color),
  };
  const result = isCreate
    ? await supabase.from("services").insert(payload)
    : await supabase.from("services").update(payload).eq("id", id);
  if (result.error)
    throw new Error(`Could not save service: ${result.error.message}`);


  if ((serviceImageUrl || removeServiceImage) && currentImageUrl) {
  const currentImagePath = currentImageUrl
    .split("/storage/v1/object/public/service-assets/")[1]
    ?.split("?")[0];

  if (currentImagePath) {
    const { error: removeError } = await createAdminClient()
      .storage
      .from("service-assets")
      .remove([decodeURIComponent(currentImagePath)]);

    if (removeError) {
      console.warn(
        "Could not remove the replaced service image:",
        removeError.message,
      );
    }
  }
}
  revalidatePath("/admin/services");
  revalidatePath("/admin");
}

export async function deleteService(formData: FormData) {
  const id = z.string().min(1).max(100).parse(text(formData, "id"));
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("services").delete().eq("id", id);
  if (error)
    throw new Error(
      `Could not delete service. Existing bookings or database policies may prevent deletion: ${error.message}`,
    );
  revalidatePath("/admin/services");
  revalidatePath("/admin/bookings");
  revalidatePath("/admin");
}

export async function saveBooking(formData: FormData) {
  const id = uuidSchema.parse(text(formData, "id"));
  const technicianId = text(formData, "technician_id");
  const parseAmount = (key: string) =>
    text(formData, key) ? Number(text(formData, key)) : null;
  const input = z
    .object({
      scheduled_date: z.string().date(),
      scheduled_time: z.string().min(1).max(100),
      technician_id: technicianId ? uuidSchema : z.literal(""),
      notes: z.string().max(5000),
      service_fee: z.number().int().nullable(),
      parts_estimate: z.number().int().nullable(),
      discount: z.number().int().nullable(),
      total: z.number().int().nullable(),
      payment_status: z.enum(["pending", "paid", "refunded"]),
    })
    .parse({
      scheduled_date: text(formData, "scheduled_date"),
      scheduled_time: text(formData, "scheduled_time"),
      technician_id: technicianId,
      notes: text(formData, "notes"),
      service_fee: parseAmount("service_fee"),
      parts_estimate: parseAmount("parts_estimate"),
      discount: parseAmount("discount"),
      total: parseAmount("total"),
      payment_status: text(formData, "payment_status"),
    });
  const { supabase } = await requireAdmin();
  const { data: current, error: currentError } = await supabase
    .from("bookings")
    .select("technician_id, status, payment_status, payment_paid_at")
    .eq("id", id)
    .maybeSingle();
  if (currentError)
    throw new Error(
      `Could not load booking before saving: ${currentError.message}`,
    );
  if (!current)
    throw new Error(
      "Booking not found or not available under the current access policy.",
    );
  if (
    !input.technician_id &&
    ["on_the_way", "in_progress"].includes(current.status)
  ) {
    throw new Error(
      "Keep a technician assigned while this booking is in progress.",
    );
  }
  const nextStatus =
    current.status === "finding_technician" && input.technician_id
      ? "technician_assigned"
      : current.status === "technician_assigned" && !input.technician_id
        ? "finding_technician"
        : current.status;
  const { data, error } = await supabase
    .from("bookings")
    .update({
      ...input,
      technician_id: input.technician_id || null,
      notes: optional(input.notes),
      status: nextStatus,
      payment_paid_at: paymentPaidAtForStatus(
        current.payment_status,
        current.payment_paid_at,
        input.payment_status,
      ),
    })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`Could not update booking: ${error.message}`);
  if (!data)
    throw new Error(
      "Booking was not updated. Check the current access policy and booking status.",
    );
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/payments");
  revalidatePath("/admin");
}

export async function saveBookingPayment(formData: FormData) {
  const id = uuidSchema.parse(text(formData, "id"));
  const payment_status = z
    .enum(["pending", "paid", "refunded"])
    .parse(text(formData, "payment_status"));
  const { supabase } = await requireAdmin();
  const { data: current, error: readError } = await supabase
    .from("bookings")
    .select("payment_status, payment_paid_at")
    .eq("id", id)
    .maybeSingle();
  if (readError)
    throw new Error(
      `Could not load payment status before saving: ${readError.message}`,
    );
  if (!current)
    throw new Error(
      "Booking not found or not available under the current access policy.",
    );
  const { data, error } = await supabase
    .from("bookings")
    .update({
      payment_status,
      payment_paid_at: paymentPaidAtForStatus(
        current.payment_status,
        current.payment_paid_at,
        payment_status,
      ),
    })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error)
    throw new Error(`Could not update payment status: ${error.message}`);
  if (!data)
    throw new Error("Payment status was not updated. Refresh and try again.");
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/payments");
  revalidatePath("/admin");
}

const bookingStatusTransitions: Record<
  string,
  { next: string; label: string }
> = {
  technician_assigned: { next: "on_the_way", label: "on the way" },
  on_the_way: { next: "in_progress", label: "in progress" },
  in_progress: { next: "completed", label: "completed" },
};

export async function advanceBookingStatus(formData: FormData) {
  const id = uuidSchema.parse(text(formData, "id"));
  const expectedStatus = z
    .enum(["technician_assigned", "on_the_way", "in_progress"])
    .parse(text(formData, "expected_status"));
  const transition = bookingStatusTransitions[expectedStatus];
  const { supabase } = await requireAdmin();
  const { data: current, error: readError } = await supabase
    .from("bookings")
    .select("technician_id")
    .eq("id", id)
    .eq("status", expectedStatus)
    .maybeSingle();
  if (readError)
    throw new Error(
      `Could not verify the booking status: ${readError.message}`,
    );
  if (!current)
    throw new Error(
      "The booking status changed or the booking is no longer available. Refresh and try again.",
    );
  if (!current.technician_id)
    throw new Error("Assign a technician before advancing this booking.");
  const { data, error } = await supabase
    .from("bookings")
    .update({ status: transition.next })
    .eq("id", id)
    .eq("status", expectedStatus)
    .select("id")
    .maybeSingle();
  if (error)
    throw new Error(
      `Could not mark the booking ${transition.label}: ${error.message}`,
    );
  if (!data)
    throw new Error(
      "The booking status changed before this update was saved. Refresh and try again.",
    );
  revalidatePath("/admin/bookings");
  revalidatePath("/admin");
}

export async function deleteBooking(formData: FormData) {
  const id = uuidSchema.parse(text(formData, "id"));
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("bookings").delete().eq("id", id);
  if (error)
    throw new Error(
      `Could not delete booking. Existing reviews or database policies may prevent deletion: ${error.message}`,
    );
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/reviews");
  revalidatePath("/admin/payments");
  revalidatePath("/admin");
}

export async function saveReview(formData: FormData) {
  const id = uuidSchema.parse(text(formData, "id"));
  const tags = text(formData, "tags")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const input = z
    .object({
      rating: z.number().int(),
      comment: z.string().max(5000),
      tags: z.array(z.string().max(100)),
    })
    .parse({
      rating: Number(text(formData, "rating")),
      comment: text(formData, "comment"),
      tags,
    });
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("reviews")
    .update({
      ...input,
      comment: optional(input.comment),
      tags: input.tags.length ? input.tags : null,
    })
    .eq("id", id);
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
  const input = z
    .object({
      title: z.string().min(1).max(300),
      body: z.string().max(5000),
      icon: z.string().max(100),
      unread: z.boolean(),
    })
    .parse({
      title: text(formData, "title"),
      body: text(formData, "body"),
      icon: text(formData, "icon"),
      unread: formData.get("unread") === "on",
    });
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("notifications")
    .update({
      ...input,
      body: optional(input.body),
      icon: optional(input.icon),
    })
    .eq("id", id);
  if (error) throw new Error(`Could not update notification: ${error.message}`);
  revalidatePath("/admin/notifications");
}

export async function saveAddress(formData: FormData) {
  const id = uuidSchema.parse(text(formData, "id"));
  const input = z
    .object({
      label: z.string().min(1).max(100),
      line: z.string().min(1).max(2000),
      city: z.string().max(120),
      pincode: z.string().max(20),
      is_default: z.boolean(),
    })
    .parse({
      label: text(formData, "label"),
      line: text(formData, "line"),
      city: text(formData, "city"),
      pincode: text(formData, "pincode"),
      is_default: formData.get("is_default") === "on",
    });
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("addresses")
    .update({
      ...input,
      city: optional(input.city),
      pincode: optional(input.pincode),
    })
    .eq("id", id);
  if (error) throw new Error(`Could not update address: ${error.message}`);
  revalidatePath("/admin/addresses");
  revalidatePath("/admin/users");
}

export async function createAddress(formData: FormData) {
  const input = z
    .object({
      user_id: uuidSchema,
      label: z.string().min(1).max(100),
      line: z.string().min(1).max(2000),
      city: z.string().max(120),
      pincode: z.string().max(20),
      is_default: z.boolean(),
    })
    .parse({
      user_id: text(formData, "user_id"),
      label: text(formData, "label"),
      line: text(formData, "line"),
      city: text(formData, "city"),
      pincode: text(formData, "pincode"),
      is_default: formData.get("is_default") === "on",
    });
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("addresses")
    .insert({
      id: randomUUID(),
      ...input,
      city: optional(input.city),
      pincode: optional(input.pincode),
    });
  if (error) throw new Error(`Could not create address: ${error.message}`);
  revalidatePath("/admin/addresses");
  revalidatePath("/admin/users");
}

export async function deleteAddress(formData: FormData) {
  const id = uuidSchema.parse(text(formData, "id"));
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("addresses").delete().eq("id", id);
  if (error) throw new Error(`Could not delete address: ${error.message}`);
  revalidatePath("/admin/addresses");
  revalidatePath("/admin/users");
}

export async function cancelBooking(formData: FormData) {
  const id = uuidSchema.parse(text(formData, "id"));
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", id)
    .in("status", ["finding_technician", "technician_assigned"])
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`Could not cancel booking: ${error.message}`);
  if (!data)
    throw new Error("This booking is no longer in a cancellable status.");
  revalidatePath("/admin/bookings");
  revalidatePath("/admin");
}

export async function markNotificationRead(formData: FormData) {
  const id = uuidSchema.parse(text(formData, "id"));
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("notifications")
    .update({ unread: false })
    .eq("id", id);
  if (error) throw new Error(`Could not update notification: ${error.message}`);
  revalidatePath("/admin/notifications");
}

export async function createNotification(formData: FormData) {
  const input = z
    .object({
      user_id: uuidSchema,
      title: z.string().min(1).max(300),
      body: z.string().max(5000),
      icon: z.string().max(100),
    })
    .parse({
      user_id: text(formData, "user_id"),
      title: text(formData, "title"),
      body: text(formData, "body"),
      icon: text(formData, "icon"),
    });
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("notifications")
    .insert({
      ...input,
      body: optional(input.body),
      icon: optional(input.icon),
      unread: true,
      created_at: new Date().toISOString(),
    });
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
