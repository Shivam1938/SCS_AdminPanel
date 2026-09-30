"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import { z } from "zod";
import {
  changeProfileRole, createAddress, createNotification, createProfileUser, createTechnician,
  saveAddress, saveBooking, saveBookingPayment, saveNotification, saveReview, saveService, saveTechnician, updateProfile,
} from "@/lib/mutations";
import type { JsonRow } from "@/lib/data";

function EditorDialog({ title, buttonLabel, children, className = "button secondary small" }: { title: string; buttonLabel: string; children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  return <><button className={className} type="button" onClick={() => ref.current?.showModal()}>{buttonLabel}</button>
    <dialog ref={ref} className="dialog"><div className="dialog-head"><strong>{title}</strong><button className="icon-button" type="button" onClick={() => ref.current?.close()}>Close</button></div>{children}</dialog></>;
}

const serviceSchema = z.object({
  id: z.string().min(1, "Required"), name: z.string().min(1, "Required"), description: z.string(), icon: z.string(),
  price: z.coerce.number().int().min(0), rating: z.coerce.number().min(0).max(5).nullable(),
  bookings_count: z.coerce.number().int().min(0).nullable(), tint: z.string(), color: z.string(), active: z.boolean(), sort: z.coerce.number().int().nullable(),
});
type ServiceValues = z.infer<typeof serviceSchema>;
export function ServiceEditor({ row }: { row?: JsonRow }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const form = useForm<z.input<typeof serviceSchema>, unknown, ServiceValues>({ resolver: zodResolver(serviceSchema), defaultValues: {
    id: String(row?.id ?? ""), name: String(row?.name ?? ""), description: String(row?.description ?? ""), icon: String(row?.icon ?? ""),
    price: Number(row?.price ?? 0), rating: row?.rating == null ? null : Number(row.rating),
    bookings_count: row?.bookings_count == null ? null : Number(row.bookings_count), tint: String(row?.tint ?? ""), color: String(row?.color ?? ""),
    active: row ? Boolean(row.active) : true, sort: row?.sort == null ? null : Number(row.sort),
  } });
  async function submit(values: ServiceValues) {
    setBusy(true); setMessage("");
    const payload = new FormData(); Object.entries(values).forEach(([key, value]) => payload.set(key, value === null ? "" : String(value)));
    payload.set("intent", row ? "update" : "create");
    try { await saveService(payload); setMessage("Service saved."); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not save service."); }
    finally { setBusy(false); }
  }
  return <EditorDialog title={row ? "Edit service" : "Add service"} buttonLabel={row ? "Edit" : "+ Add service"} className={row ? "button secondary small" : "button"}>
    <form className="dialog-body" onSubmit={form.handleSubmit(submit)}><div className="form-grid">
      <div className="form-field"><label htmlFor="service-id">ID</label><input id="service-id" className="field" disabled={!!row} {...form.register("id")} />{form.formState.errors.id && <small className="error-text">{form.formState.errors.id.message}</small>}</div>
      <div className="form-field"><label htmlFor="service-name">Name</label><input id="service-name" className="field" {...form.register("name")} /></div>
      <div className="form-field"><label htmlFor="service-price">Price (₹)</label><input id="service-price" type="number" min="0" className="field" {...form.register("price")} /></div>
      {row && <div className="form-field"><label htmlFor="service-sort">Sort order</label><input id="service-sort" type="number" className="field" {...form.register("sort", { setValueAs: (value) => value === "" ? null : Number(value) })} /></div>}
      {!row && <p className="muted-cell">Display order is assigned automatically.</p>}
      <div className="form-field"><label htmlFor="service-rating">Rating</label><input id="service-rating" type="number" min="0" max="5" step="0.1" className="field" {...form.register("rating", { setValueAs: (value) => value === "" ? null : Number(value) })} /></div>
      <div className="form-field"><label htmlFor="service-bookings">Bookings count</label><input id="service-bookings" type="number" min="0" className="field" {...form.register("bookings_count", { setValueAs: (value) => value === "" ? null : Number(value) })} /></div>
      <div className="form-field"><label htmlFor="service-icon">Icon name</label><input id="service-icon" className="field" {...form.register("icon")} /></div>
      <div className="form-field"><label htmlFor="service-tint">Tint</label><input id="service-tint" className="field" {...form.register("tint")} /></div>
      <div className="form-field"><label htmlFor="service-color">Color</label><input id="service-color" className="field" {...form.register("color")} /></div>
      <label className="check-row"><input type="checkbox" {...form.register("active")} /> Active</label>
      <div className="form-field full"><label htmlFor="service-description">Description</label><textarea id="service-description" className="field" {...form.register("description")} /></div>
    </div>{message && <p className={message === "Service saved." ? "success-text" : "error-text"} role={message === "Service saved." ? "status" : "alert"}>{message}</p>}
      <div className="dialog-foot" style={{ padding: "18px 0 0", border: 0 }}><button className="button secondary" type="button" onClick={(event) => event.currentTarget.closest("dialog")?.close()}>Cancel</button><button className="button" disabled={busy}>{busy ? "Saving…" : "Save service"}</button></div>
    </form>
  </EditorDialog>;
}

const profileSchema = z.object({ full_name: z.string().max(200), phone: z.string().max(50), city: z.string().max(120) });
type ProfileValues = z.infer<typeof profileSchema>;
export function ProfileEditor({ row }: { row: JsonRow }) {
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const router = useRouter();
  const form = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), defaultValues: { full_name: String(row.full_name ?? ""), phone: String(row.phone ?? ""), city: String(row.city ?? "") } });
  async function submit(values: ProfileValues) {
    setBusy(true); setMessage(""); const payload = new FormData(); payload.set("id", String(row.id)); Object.entries(values).forEach(([key, value]) => payload.set(key, value));
    try { await updateProfile(payload); setMessage("Profile saved."); router.refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not update profile."); } finally { setBusy(false); }
  }
  return <EditorDialog title="Edit profile" buttonLabel="Edit profile"><form className="dialog-body" onSubmit={form.handleSubmit(submit)}>
    <div className="form-grid"><div className="form-field"><label>Name</label><input className="field" {...form.register("full_name")} /></div><div className="form-field"><label>Phone</label><input className="field" {...form.register("phone")} /></div><div className="form-field"><label>City</label><input className="field" {...form.register("city")} /></div></div>
    {message && <p className={message === "Profile saved." ? "success-text" : "error-text"} role={message === "Profile saved." ? "status" : "alert"}>{message}</p>}<div className="dialog-foot" style={{ padding: "18px 0 0", border: 0 }}><button className="button" disabled={busy}>{busy ? "Saving…" : "Save profile"}</button></div>
  </form></EditorDialog>;
}

const profileRoleSchema = z.object({ role: z.enum(["customer", "admin", "technician"]) });
type ProfileRoleValues = z.infer<typeof profileRoleSchema>;
export function ProfileRoleEditor({ row }: { row: JsonRow }) {
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const router = useRouter();
  const form = useForm<ProfileRoleValues>({ resolver: zodResolver(profileRoleSchema), defaultValues: { role: row.role === "admin" ? "admin" : row.role === "technician" ? "technician" : "customer" } });
  async function submit(values: ProfileRoleValues) {
    setBusy(true); setMessage(""); const payload = new FormData(); payload.set("id", String(row.id)); payload.set("role", values.role);
    try { await changeProfileRole(payload); setMessage("Profile role saved."); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not change profile role."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={form.handleSubmit(submit)} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "end", marginTop: 8 }}>
    <div className="form-field"><label>Profile role</label><select className="field" {...form.register("role")}><option value="customer">customer</option><option value="admin">admin</option><option value="technician">technician</option></select></div>
    <button className="button secondary small" disabled={busy}>{busy ? "Saving…" : "Save role"}</button>
    {message && <p className={message === "Profile role saved." ? "success-text" : "error-text"} role={message === "Profile role saved." ? "status" : "alert"} style={{ gridColumn: "1 / -1" }}>{message}</p>}
  </form>;
}

const createProfileUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  email: z.string().trim().email("Enter a valid email").max(320),
  phone: z.string().max(50), city: z.string().max(120),
  role: z.enum(["customer", "admin", "technician"]),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});
type CreateProfileUserValues = z.infer<typeof createProfileUserSchema>;
export function CreateProfileUserEditor() {
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const router = useRouter();
  const form = useForm<CreateProfileUserValues>({ resolver: zodResolver(createProfileUserSchema), defaultValues: { name: "", email: "", phone: "", city: "", role: "customer", password: "" } });
  async function submit(values: CreateProfileUserValues) {
    setBusy(true); setMessage(""); const payload = new FormData(); Object.entries(values).forEach(([key, value]) => payload.set(key, value));
    try {
      await createProfileUser(payload); setMessage("User created."); form.reset(); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not create user."); }
    finally { setBusy(false); }
  }
  return <EditorDialog title="Add user" buttonLabel="+ Add User" className="button"><form className="dialog-body" onSubmit={form.handleSubmit(submit)}><div className="form-grid">
    <div className="form-field"><label htmlFor="new-user-name">Name</label><input id="new-user-name" className="field" autoComplete="name" {...form.register("name")} />{form.formState.errors.name && <small className="error-text">{form.formState.errors.name.message}</small>}</div>
    <div className="form-field"><label htmlFor="new-user-email">Email</label><input id="new-user-email" type="email" className="field" autoComplete="email" {...form.register("email")} />{form.formState.errors.email && <small className="error-text">{form.formState.errors.email.message}</small>}</div>
    <div className="form-field"><label htmlFor="new-user-phone">Phone</label><input id="new-user-phone" className="field" autoComplete="tel" {...form.register("phone")} /></div>
    <div className="form-field"><label htmlFor="new-user-city">City</label><input id="new-user-city" className="field" autoComplete="address-level2" {...form.register("city")} /></div>
    <div className="form-field"><label htmlFor="new-user-role">Role</label><select id="new-user-role" className="field" {...form.register("role")}><option value="customer">customer</option><option value="admin">admin</option><option value="technician">technician</option></select></div>
    <div className="form-field"><label htmlFor="new-user-password">Initial password</label><input id="new-user-password" type="password" className="field" autoComplete="new-password" {...form.register("password")} />{form.formState.errors.password && <small className="error-text">{form.formState.errors.password.message}</small>}</div>
  </div><p className="muted-cell">The Auth account and its profile are created server-side. Email is stored by Supabase Auth; the profiles table has no email column.</p>
    {message && <p className={message === "User created." ? "success-text" : "error-text"} role={message === "User created." ? "status" : "alert"}>{message}</p>}
    <div className="dialog-foot" style={{ padding: "18px 0 0", border: 0 }}><button className="button secondary" type="button" onClick={(event) => event.currentTarget.closest("dialog")?.close()}>Cancel</button><button className="button" disabled={busy}>{busy ? "Creating…" : "Create user"}</button></div>
  </form></EditorDialog>;
}

const technicianSchema = z.object({
  name: z.string().min(1, "Required").max(200), phone: z.string().max(50), role_title: z.string().max(200), about: z.string().max(5000),
  rating: z.coerce.number().min(0).max(5).nullable(), reviews_count: z.coerce.number().int().min(0).nullable(),
  jobs_completed: z.coerce.number().int().min(0).nullable(), years_experience: z.coerce.number().int().min(0).nullable(),
  on_time_percent: z.coerce.number().int().min(0).max(100).nullable(), skills: z.string().max(2000), verified: z.boolean(),
  profile_id: z.union([z.literal(""), z.string().uuid()]),
});
type TechnicianValues = z.infer<typeof technicianSchema>;
export function TechnicianEditor({ row, profiles }: { row: JsonRow; profiles: { id: string; full_name: string | null; role: "customer" | "technician" }[] }) {
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const [photoPreview, setPhotoPreview] = useState("");
  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview); }, [photoPreview]);
  const router = useRouter();
  const form = useForm<z.input<typeof technicianSchema>, unknown, TechnicianValues>({ resolver: zodResolver(technicianSchema), defaultValues: {
    name: String(row.name ?? ""), phone: String(row.phone ?? ""), role_title: String(row.role_title ?? ""), about: String(row.about ?? ""), rating: row.rating == null ? null : Number(row.rating),
    reviews_count: row.reviews_count == null ? null : Number(row.reviews_count), jobs_completed: row.jobs_completed == null ? null : Number(row.jobs_completed),
    years_experience: row.years_experience == null ? null : Number(row.years_experience), on_time_percent: row.on_time_percent == null ? null : Number(row.on_time_percent),
    skills: Array.isArray(row.skills) ? row.skills.map(String).join(", ") : "", verified: Boolean(row.verified), profile_id: String(row.profile_id ?? ""),
  } });
  async function submit(values: TechnicianValues) {
    setBusy(true); setMessage(""); const payload = new FormData(); payload.set("id", String(row.id)); Object.entries(values).forEach(([key, value]) => payload.set(key, value === null ? "" : String(value)));
    if (values.verified) payload.set("verified", "on");
    const photo = (document.getElementById(`technician-photo-${String(row.id)}`) as HTMLInputElement | null)?.files?.[0];
    if (photo) payload.set("technician_photo", photo);
    const removePhoto = document.getElementById(`remove-technician-photo-${String(row.id)}`) as HTMLInputElement | null;
    if (removePhoto?.checked && !photo) payload.set("remove_avatar", "true");
    try { await saveTechnician(payload); setMessage("Technician saved."); const input = document.getElementById(`technician-photo-${String(row.id)}`) as HTMLInputElement | null; if (input) input.value = ""; setPhotoPreview(""); router.refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not update technician."); } finally { setBusy(false); }
  }
  return <EditorDialog title="Edit technician" buttonLabel="Edit technician"><form className="dialog-body" onSubmit={form.handleSubmit(submit)}><div className="form-grid">
    <div className="form-field"><label>Name</label><input className="field" {...form.register("name")} /></div><div className="form-field"><label>Phone number</label><input className="field" type="tel" autoComplete="tel" {...form.register("phone")} /></div><div className="form-field"><label>Role title</label><input className="field" {...form.register("role_title")} /></div>
    <div className="form-field full"><label htmlFor={`technician-photo-${String(row.id)}`}>Technician photo</label><input id={`technician-photo-${String(row.id)}`} className="field" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setPhotoPreview(event.target.files?.[0] ? URL.createObjectURL(event.target.files[0]) : "")} />{photoPreview || typeof row.avatar_url === "string" ? <Image unoptimized src={photoPreview || String(row.avatar_url)} alt="Technician profile preview" width={80} height={80} style={{ objectFit: "cover", borderRadius: "50%", marginTop: 8 }} /> : <span className="muted-cell">No photo uploaded.</span>}{typeof row.avatar_url === "string" && <label className="check-row"><input id={`remove-technician-photo-${String(row.id)}`} type="checkbox" /> Remove current photo</label>}</div>
    <div className="form-field"><label>Rating</label><input className="field" type="number" min="0" max="5" step="0.1" {...form.register("rating", { setValueAs: (value) => value === "" ? null : Number(value) })} /></div>
    <div className="form-field"><label>Linked profile</label><select className="field" {...form.register("profile_id")}><option value="">No linked profile</option>{row.profile_id != null && !profiles.some((profile) => profile.id === String(row.profile_id)) && <option value={String(row.profile_id)}>Current linked profile (restricted)</option>}{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name || profile.id} · {profile.role}</option>)}</select></div>
    <div className="form-field"><label>Reviews count</label><input className="field" type="number" min="0" {...form.register("reviews_count", { setValueAs: (value) => value === "" ? null : Number(value) })} /></div>
    <div className="form-field"><label>Jobs completed</label><input className="field" type="number" min="0" {...form.register("jobs_completed", { setValueAs: (value) => value === "" ? null : Number(value) })} /></div>
    <div className="form-field"><label>Years of experience</label><input className="field" type="number" min="0" {...form.register("years_experience", { setValueAs: (value) => value === "" ? null : Number(value) })} /></div>
    <div className="form-field"><label>On-time percent</label><input className="field" type="number" min="0" max="100" {...form.register("on_time_percent", { setValueAs: (value) => value === "" ? null : Number(value) })} /></div>
    <div className="form-field full"><label>Skills (comma-separated)</label><input className="field" {...form.register("skills")} /></div>
    <label className="check-row"><input type="checkbox" {...form.register("verified")} /> Verified</label>
    <div className="form-field full"><label>About</label><textarea className="field" {...form.register("about")} /></div>
  </div>{message && <p className={message === "Technician saved." ? "success-text" : "error-text"} role={message === "Technician saved." ? "status" : "alert"}>{message}</p>}<div className="dialog-foot" style={{ padding: "18px 0 0", border: 0 }}><button className="button" disabled={busy}>{busy ? "Saving…" : "Save technician"}</button></div></form></EditorDialog>;
}

const createTechnicianSchema = z.object({
  name: z.string().min(1, "Name is required").max(200), phone: z.string().max(50), profile_id: z.union([z.literal(""), z.string().uuid()]),
  role_title: z.string().max(200), about: z.string().max(5000), skills: z.string().max(2000),
  rating: z.coerce.number().min(0).max(5).nullable(), reviews_count: z.coerce.number().int().min(0).nullable(),
  jobs_completed: z.coerce.number().int().min(0).nullable(), years_experience: z.coerce.number().int().min(0).nullable(),
  on_time_percent: z.coerce.number().int().min(0).max(100).nullable(), verified: z.boolean(),
});
type CreateTechnicianInput = z.input<typeof createTechnicianSchema>;
type CreateTechnicianValues = z.output<typeof createTechnicianSchema>;
export function TechnicianCreateEditor({ profiles }: { profiles: { id: string; full_name: string | null; role: "customer" | "technician" }[] }) {
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const router = useRouter();
  const [photoPreview, setPhotoPreview] = useState("");
  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview); }, [photoPreview]);
  const form = useForm<CreateTechnicianInput, unknown, CreateTechnicianValues>({ resolver: zodResolver(createTechnicianSchema), defaultValues: { name: "", phone: "", profile_id: "", role_title: "", about: "", skills: "", rating: null, reviews_count: null, jobs_completed: null, years_experience: null, on_time_percent: null, verified: false } });
  async function submit(values: CreateTechnicianValues) {
    setBusy(true); setMessage(""); const payload = new FormData(); Object.entries(values).forEach(([key, value]) => payload.set(key, value === null ? "" : String(value)));
    const photo = (document.getElementById("new-technician-photo") as HTMLInputElement | null)?.files?.[0];
    if (photo) payload.set("technician_photo", photo);
    try { await createTechnician(payload); setMessage("Technician record created."); form.reset(); const input = document.getElementById("new-technician-photo") as HTMLInputElement | null; if (input) input.value = ""; setPhotoPreview(""); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not create technician."); }
    finally { setBusy(false); }
  }
  return <EditorDialog title="Create technician record" buttonLabel="+ Add technician" className="button"><form className="dialog-body" onSubmit={form.handleSubmit(submit)}><div className="form-grid">
    <div className="form-field"><label>Name</label><input className="field" {...form.register("name")} />{form.formState.errors.name && <small className="error-text">{form.formState.errors.name.message}</small>}</div>
    <div className="form-field"><label>Phone number</label><input className="field" type="tel" autoComplete="tel" {...form.register("phone")} /></div>
    <div className="form-field full"><label htmlFor="new-technician-photo">Technician photo</label><input id="new-technician-photo" className="field" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setPhotoPreview(event.target.files?.[0] ? URL.createObjectURL(event.target.files[0]) : "")} />{photoPreview ? <Image unoptimized src={photoPreview} alt="Technician photo preview" width={80} height={80} style={{ objectFit: "cover", borderRadius: "50%", marginTop: 8 }} /> : <span className="muted-cell">No photo uploaded.</span>}</div>
    <div className="form-field"><label>Link existing profile (optional)</label><select className="field" {...form.register("profile_id")}><option value="">No Auth profile (standalone technician)</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name || profile.id} · {profile.role}</option>)}</select></div>
    <div className="form-field full"><label>Role title</label><input className="field" {...form.register("role_title")} /></div>
    <div className="form-field"><label>Rating</label><input className="field" type="number" min="0" max="5" step="0.1" {...form.register("rating", { setValueAs: (value) => value === "" ? null : Number(value) })} /></div>
    <div className="form-field"><label>Reviews count</label><input className="field" type="number" min="0" {...form.register("reviews_count", { setValueAs: (value) => value === "" ? null : Number(value) })} /></div>
    <div className="form-field"><label>Jobs completed</label><input className="field" type="number" min="0" {...form.register("jobs_completed", { setValueAs: (value) => value === "" ? null : Number(value) })} /></div>
    <div className="form-field"><label>Years of experience</label><input className="field" type="number" min="0" {...form.register("years_experience", { setValueAs: (value) => value === "" ? null : Number(value) })} /></div>
    <div className="form-field"><label>On-time percent</label><input className="field" type="number" min="0" max="100" {...form.register("on_time_percent", { setValueAs: (value) => value === "" ? null : Number(value) })} /></div>
    <label className="check-row"><input type="checkbox" {...form.register("verified")} /> Verified</label>
    <div className="form-field full"><label>Skills (comma-separated)</label><input className="field" {...form.register("skills")} /></div>
    <div className="form-field full"><label>About</label><textarea className="field" {...form.register("about")} /></div>
  </div><p className="muted-cell">Selecting a customer profile changes its role to technician. No Auth account is created; leaving this blank creates a standalone technician record.</p>
    {message && <p className={message === "Technician record created." ? "success-text" : "error-text"} role={message === "Technician record created." ? "status" : "alert"}>{message}</p>}
    <div className="dialog-foot" style={{ padding: "18px 0 0", border: 0 }}><button className="button" disabled={busy}>{busy ? "Creating…" : "Create technician"}</button></div>
  </form></EditorDialog>;
}

const notificationSchema = z.object({ user_id: z.string().uuid("Choose a profile"), title: z.string().min(1).max(300), body: z.string().max(5000), icon: z.string().max(100) });
type NotificationValues = z.infer<typeof notificationSchema>;
export function NotificationEditor({ profiles }: { profiles: { id: string; full_name: string | null }[] }) {
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const router = useRouter();
  const form = useForm<NotificationValues>({ resolver: zodResolver(notificationSchema), defaultValues: { user_id: "", title: "", body: "", icon: "" } });
  async function submit(values: NotificationValues) {
    setBusy(true); setMessage(""); const payload = new FormData(); Object.entries(values).forEach(([key, value]) => payload.set(key, value));
    try { await createNotification(payload); setMessage("Notification record created."); router.refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not create notification."); } finally { setBusy(false); }
  }
  return <EditorDialog title="Create in-app notification" buttonLabel="+ New notification" className="button"><form className="dialog-body" onSubmit={form.handleSubmit(submit)}><div className="form-grid">
    <div className="form-field full"><label>Recipient profile</label><select className="field" {...form.register("user_id")}><option value="">Select a profile</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name || profile.id}</option>)}</select></div>
    <div className="form-field"><label>Title</label><input className="field" {...form.register("title")} /></div><div className="form-field"><label>Icon name (optional)</label><input className="field" {...form.register("icon")} /></div>
    <div className="form-field full"><label>Message</label><textarea className="field" {...form.register("body")} /></div>
  </div><p className="muted-cell">This creates an in-app notification record. The project has no push-send API.</p>{message && <p className={message === "Notification record created." ? "success-text" : "error-text"} role={message === "Notification record created." ? "status" : "alert"}>{message}</p>}<div className="dialog-foot" style={{ padding: "18px 0 0", border: 0 }}><button className="button" disabled={busy}>{busy ? "Creating…" : "Create record"}</button></div></form></EditorDialog>;
}

export function NotificationEditEditor({ row }: { row: JsonRow }) {
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const router = useRouter();
  const form = useForm({ defaultValues: { title: String(row.title ?? ""), body: String(row.body ?? ""), icon: String(row.icon ?? ""), unread: Boolean(row.unread) } });
  async function submit(values: { title: string; body: string; icon: string; unread: boolean }) {
    setBusy(true); setMessage(""); const payload = new FormData(); payload.set("id", String(row.id)); Object.entries(values).forEach(([key, value]) => payload.set(key, String(value)));
    try { await saveNotification(payload); setMessage("Notification saved."); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not save notification."); }
    finally { setBusy(false); }
  }
  return <EditorDialog title="Edit notification" buttonLabel="Edit"><form className="dialog-body" onSubmit={form.handleSubmit(submit)}><div className="form-grid">
    <div className="form-field"><label>Title</label><input className="field" {...form.register("title", { required: true })} /></div>
    <div className="form-field"><label>Icon</label><input className="field" {...form.register("icon")} /></div>
    <div className="form-field full"><label>Message</label><textarea className="field" {...form.register("body")} /></div>
    <label className="check-row"><input type="checkbox" {...form.register("unread")} /> Unread</label>
  </div>{message && <p className={message === "Notification saved." ? "success-text" : "error-text"} role="status">{message}</p>}<div className="dialog-foot" style={{ padding: "18px 0 0", border: 0 }}><button className="button secondary" type="button" onClick={(event) => event.currentTarget.closest("dialog")?.close()}>Cancel</button><button className="button" disabled={busy}>{busy ? "Saving…" : "Save notification"}</button></div></form></EditorDialog>;
}

const reviewSchema = z.object({ rating: z.coerce.number().int(), comment: z.string().max(5000), tags: z.string().max(2000) });
type ReviewValues = z.infer<typeof reviewSchema>;
export function ReviewEditor({ row }: { row: JsonRow }) {
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const router = useRouter();
  const form = useForm<z.input<typeof reviewSchema>, unknown, ReviewValues>({ resolver: zodResolver(reviewSchema), defaultValues: { rating: Number(row.rating), comment: String(row.comment ?? ""), tags: Array.isArray(row.tags) ? row.tags.map(String).join(", ") : "" } });
  async function submit(values: ReviewValues) {
    setBusy(true); setMessage(""); const payload = new FormData(); payload.set("id", String(row.id)); Object.entries(values).forEach(([key, value]) => payload.set(key, String(value)));
    try { await saveReview(payload); setMessage("Review saved."); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not save review."); }
    finally { setBusy(false); }
  }
  return <EditorDialog title="Edit review" buttonLabel="Edit"><form className="dialog-body" onSubmit={form.handleSubmit(submit)}><div className="form-grid">
    <div className="form-field"><label>Rating</label><input className="field" type="number" step="1" {...form.register("rating")} /></div>
    <div className="form-field full"><label>Comment</label><textarea className="field" {...form.register("comment")} /></div>
    <div className="form-field full"><label>Tags (comma-separated)</label><input className="field" {...form.register("tags")} /></div>
  </div>{message && <p className={message === "Review saved." ? "success-text" : "error-text"} role="status">{message}</p>}<div className="dialog-foot" style={{ padding: "18px 0 0", border: 0 }}><button className="button secondary" type="button" onClick={(event) => event.currentTarget.closest("dialog")?.close()}>Cancel</button><button className="button" disabled={busy}>{busy ? "Saving…" : "Save review"}</button></div></form></EditorDialog>;
}

const bookingSchema = z.object({
  scheduled_date: z.string().min(1), scheduled_time: z.string().min(1), technician_id: z.union([z.literal(""), z.string().uuid()]),
  notes: z.string(), service_fee: z.coerce.number().int().nullable(),
  parts_estimate: z.coerce.number().int().nullable(), discount: z.coerce.number().int().nullable(), total: z.coerce.number().int().nullable(),
  payment_status: z.enum(["pending", "paid", "refunded"]),
});
type BookingValues = z.infer<typeof bookingSchema>;
export function BookingEditor({ row, technicians }: { row: JsonRow; technicians: { id: string; name: string }[] }) {
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const router = useRouter();
  const form = useForm<z.input<typeof bookingSchema>, unknown, BookingValues>({ resolver: zodResolver(bookingSchema), defaultValues: {
    scheduled_date: String(row.scheduled_date ?? ""), scheduled_time: String(row.scheduled_time ?? ""), technician_id: String(row.technician_id ?? ""),
    notes: String(row.notes ?? ""),
    service_fee: row.service_fee == null ? null : Number(row.service_fee), parts_estimate: row.parts_estimate == null ? null : Number(row.parts_estimate),
    discount: row.discount == null ? null : Number(row.discount), total: row.total == null ? null : Number(row.total),
    payment_status: ["pending", "paid", "refunded"].includes(String(row.payment_status)) ? String(row.payment_status) as "pending" | "paid" | "refunded" : "pending",
  } });
  async function submit(values: BookingValues) {
    setBusy(true); setMessage(""); const payload = new FormData(); payload.set("id", String(row.id));
    Object.entries(values).forEach(([key, value]) => payload.set(key, value === null ? "" : String(value)));
    try { await saveBooking(payload); setMessage("Booking saved."); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not save booking."); }
    finally { setBusy(false); }
  }
  return <EditorDialog title="Edit booking" buttonLabel="Edit"><form className="dialog-body" onSubmit={form.handleSubmit(submit)}><div className="form-grid">
    <div className="form-field"><label>Scheduled date</label><input className="field" type="date" {...form.register("scheduled_date")} /></div>
    <div className="form-field"><label>Scheduled time</label><input className="field" {...form.register("scheduled_time")} /></div>
    <div className="form-field full"><label>Technician</label><select className="field" {...form.register("technician_id")}><option value="">Unassigned</option>{technicians.map((technician) => <option key={technician.id} value={technician.id}>{technician.name}</option>)}</select></div>
    <div className="form-field full"><label>Selected address</label><p className="muted-cell">{String((row.bookingAddress as JsonRow | null)?.line ?? row.address_line ?? "Address unavailable")}{(row.bookingAddress as JsonRow | null)?.city ? `, ${String((row.bookingAddress as JsonRow).city)}` : ""}{(row.bookingAddress as JsonRow | null)?.pincode ? ` ${String((row.bookingAddress as JsonRow).pincode)}` : ""}. Edit saved addresses in the Addresses section.</p></div>
    <div className="form-field full"><label>Notes</label><textarea className="field" {...form.register("notes")} /></div>
    <div className="form-field"><label>Payment status</label><select className="field" {...form.register("payment_status")}><option value="pending">Pending</option><option value="paid">Paid</option><option value="refunded">Refunded</option></select></div>
    {(["service_fee", "parts_estimate", "discount", "total"] as const).map((field) => <div className="form-field" key={field}><label>{field.replaceAll("_", " ")}</label><input className="field" type="number" step="1" {...form.register(field, { setValueAs: (value) => value === "" ? null : Number(value) })} /></div>)}
  </div><p className="muted-cell">Payment status is updated manually after payment verification. Booking progress remains controlled by its workflow.</p>{message && <p className={message === "Booking saved." ? "success-text" : "error-text"} role="status">{message}</p>}<div className="dialog-foot" style={{ padding: "18px 0 0", border: 0 }}><button className="button secondary" type="button" onClick={(event) => event.currentTarget.closest("dialog")?.close()}>Cancel</button><button className="button" disabled={busy}>{busy ? "Saving…" : "Save booking"}</button></div></form></EditorDialog>;
}

export function PaymentEditor({ row }: { row: JsonRow }) {
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const router = useRouter();
  const form = useForm<{ payment_status: "pending" | "paid" | "refunded" }>({ defaultValues: { payment_status: ["pending", "paid", "refunded"].includes(String(row.payment_status)) ? row.payment_status as "pending" | "paid" | "refunded" : "pending" } });
  async function submit(values: { payment_status: "pending" | "paid" | "refunded" }) {
    setBusy(true); setMessage(""); const payload = new FormData(); payload.set("id", String(row.id)); payload.set("payment_status", values.payment_status);
    try { await saveBookingPayment(payload); setMessage("Payment status saved."); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not update payment status."); }
    finally { setBusy(false); }
  }
  return <EditorDialog title="Update payment status" buttonLabel="Update payment" ><form className="dialog-body" onSubmit={form.handleSubmit(submit)}>
    <div className="form-field"><label>Payment status</label><select className="field" {...form.register("payment_status")}><option value="pending">Pending</option><option value="paid">Paid</option><option value="refunded">Refunded</option></select></div>
    {message && <p className={message === "Payment status saved." ? "success-text" : "error-text"} role="status">{message}</p>}
    <div className="dialog-foot" style={{ padding: "18px 0 0", border: 0 }}><button className="button" disabled={busy}>{busy ? "Saving…" : "Save payment status"}</button></div>
  </form></EditorDialog>;
}

const addressSchema = z.object({ user_id: z.string().uuid("Choose a profile"), label: z.string().min(1).max(100), line: z.string().min(1).max(2000), city: z.string().max(120), pincode: z.string().max(20), is_default: z.boolean() });
type AddressValues = z.infer<typeof addressSchema>;
export function AddressEditor({ row, profiles }: { row?: JsonRow; profiles: { id: string; full_name: string | null }[] }) {
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const router = useRouter();
  const form = useForm<AddressValues>({ resolver: zodResolver(addressSchema), defaultValues: {
    user_id: String(row?.user_id ?? ""), label: String(row?.label ?? ""), line: String(row?.line ?? ""), city: String(row?.city ?? ""), pincode: String(row?.pincode ?? ""), is_default: Boolean(row?.is_default),
  } });
  async function submit(values: AddressValues) {
    setBusy(true); setMessage(""); const payload = new FormData(); Object.entries(values).forEach(([key, value]) => payload.set(key, String(value)));
    try {
      if (row) { payload.set("id", String(row.id)); await saveAddress(payload); }
      else await createAddress(payload);
      setMessage(row ? "Address saved." : "Address created."); form.reset(); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save address."); }
    finally { setBusy(false); }
  }
  return <EditorDialog title={row ? "Edit address" : "Add address"} buttonLabel={row ? "Edit" : "+ Add address"} className={row ? "button secondary small" : "button"}>
    <form className="dialog-body" onSubmit={form.handleSubmit(submit)}><div className="form-grid">
      <div className="form-field full"><label>Owner profile</label><select className="field" {...form.register("user_id")}><option value="">Select a profile</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name || profile.id}</option>)}</select></div>
      <div className="form-field"><label>Label</label><input className="field" {...form.register("label")} /></div><div className="form-field"><label>City</label><input className="field" {...form.register("city")} /></div><div className="form-field"><label>Pincode</label><input className="field" inputMode="numeric" {...form.register("pincode")} /></div>
      <div className="form-field full"><label>Address line</label><textarea className="field" {...form.register("line")} /></div>
      <label className="check-row"><input type="checkbox" {...form.register("is_default")} /> Default address</label>
    </div>{message && <p className={message.includes("created") || message.includes("saved") ? "success-text" : "error-text"} role="status">{message}</p>}
    <div className="dialog-foot" style={{ padding: "18px 0 0", border: 0 }}><button className="button secondary" type="button" onClick={(event) => event.currentTarget.closest("dialog")?.close()}>Cancel</button><button className="button" disabled={busy}>{busy ? "Saving…" : row ? "Save address" : "Create address"}</button></div>
  </form></EditorDialog>;
}

export function ProfileSettingsEditor({ row }: { row: JsonRow }) { return <ProfileEditor row={row} />; }
