"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { JsonRow, SectionKey } from "@/lib/data";
import { advanceBookingStatus, cancelBooking, deleteAddress, deleteBooking, deleteBookingPhoto, deleteNotification, deleteProfileUser, deleteReview, deleteService, deleteTechnician, markNotificationRead } from "@/lib/mutations";
import { AddressEditor, BookingEditor, CreateProfileUserEditor, NotificationEditEditor, NotificationEditor, PaymentEditor, ProfileRoleEditor, ReviewEditor, ServiceEditor, TechnicianCreateEditor, TechnicianEditor } from "@/components/admin/editors";

const configs: Record<SectionKey, { columns: [string, string][]; filter?: string; search: string[] }> = {
  users: { columns: [["full_name", "Profile"], ["phone", "Phone"], ["city", "City"], ["role", "Role"], ["created_at", "Joined"]], filter: "role", search: ["full_name", "phone", "city", "addressCity", "role", "id"] },
  technicians: { columns: [["name", "Technician"], ["role_title", "Specialty"], ["verified", "Verified"], ["rating", "Rating"], ["jobs_completed", "Jobs"], ["years_experience", "Experience"]], filter: "verified", search: ["name", "role_title", "skills"] },
  services: { columns: [["name", "Service"], ["id", "ID"], ["price", "Price"], ["active", "Active"], ["rating", "Rating"], ["bookings_count", "Bookings"], ["sort", "Sort"]], filter: "active", search: ["name", "id", "description"] },
  bookings: { columns: [["code", "Booking"], ["customer", "Customer"], ["services", "Service"], ["technicians", "Technician"], ["scheduled_date", "Scheduled"], ["status", "Status"], ["payment_status", "Payment"], ["total", "Total"]], filter: "status", search: ["code", "customer", "services", "technicians", "status", "payment_status", "address_line"] },
  payments: { columns: [["code", "Booking"], ["customer", "Customer"], ["payment_method", "Method"], ["payment_status", "Status"], ["service_fee", "Service fee"], ["parts_estimate", "Parts estimate"], ["discount", "Discount"], ["total", "Total"]], filter: "payment_status", search: ["code", "customer", "payment_method", "payment_status"] },
  reviews: { columns: [["customer", "Customer"], ["technician", "Technician"], ["booking", "Booking"], ["service", "Service"], ["rating", "Rating"], ["comment", "Comment"], ["tags", "Tags"], ["created_at", "Created"]], search: ["customer", "technician", "booking", "service", "rating", "comment", "tags"] },
  notifications: { columns: [["title", "Title"], ["recipient", "Recipient"], ["body", "Message"], ["unread", "Unread"], ["created_at", "Created"]], filter: "unread", search: ["title", "recipient", "body"] },
  addresses: { columns: [["owner", "User"], ["label", "Label"], ["line", "Address"], ["city", "City"], ["pincode", "Pincode"], ["is_default", "Default"]], filter: "is_default", search: ["owner", "label", "line", "city", "pincode", "user_id"] },
};
const titleCase = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const nested = (row: JsonRow, key: string): unknown => {
  const raw = row[key];
  if (key === "city" && "addressCity" in row) return row.addressCity ?? raw;
  if (key === "customer" || key === "recipient" || key === "owner") return (raw as JsonRow | null)?.full_name;
  if (key === "technician") {
    const name = (raw as JsonRow | null)?.name;
    return name ?? (row.technician_id ? "Technician record unavailable" : "Technician not assigned");
  }
  if (key === "services") return (raw as JsonRow | null)?.name ?? (Array.isArray(raw) ? (raw[0] as JsonRow | undefined)?.name : undefined);
  if (key === "technicians") return (raw as JsonRow | null)?.name ?? (Array.isArray(raw) ? (raw[0] as JsonRow | undefined)?.name : undefined);
  if (key === "booking") return (raw as JsonRow | null)?.code;
  if (key === "service") return (raw as JsonRow | null)?.name;
  return raw;
};
function show(value: unknown, key: string) {
  if (value === undefined || value === null || value === "") return "—";
  if (key === "created_at") return new Date(String(value)).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  if (key === "price" || key === "total" || key.includes("fee") || key.includes("estimate") || key === "discount") return `₹${Number(value).toLocaleString("en-IN")}`;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map(String).join(", ");
  if (typeof value === "object") return "—";
  return String(value);
}
function DetailsDialog({ children }: { children: React.ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return <><button className="button secondary small" type="button" onClick={() => dialog.current?.showModal()}>View details</button>
    <dialog ref={dialog} className="dialog detail-dialog"><div className="dialog-head"><strong>Record details</strong><button className="button secondary small" type="button" onClick={() => dialog.current?.close()}>Close</button></div>
      <div className="dialog-body detail-content">{children}</div></dialog></>;
}
function details(row: JsonRow, section: SectionKey) {
  if (section === "users") {
    const addressCity = typeof row.addressCity === "string" ? row.addressCity.trim() : "";
    const fields = Object.entries(row)
      .filter(([key]) => !["city", "addressCity", "primaryAddress", "services", "technicians", "customer", "recipient", "owner", "booking", "canChangeRole", "canDelete", "addresses", "bookings", "avatar_url"].includes(key))
      .map(([key, value]) => [titleCase(key), show(value, key)] as const);
    return [
      ...fields,
      ["City", addressCity || "—"] as const,
    ];
  }
  if (section === "payments") {
    const customer = row.customer as JsonRow | null;
    const service = row.services as JsonRow | null;
    const technician = row.technicians as JsonRow | null;
    const scheduledDate = row.scheduled_date
      ? new Date(`${String(row.scheduled_date)}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
      : null;
    const paidAt = row.payment_paid_at
      ? new Date(String(row.payment_paid_at)).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
      : row.payment_status === "pending" ? "Not paid yet" : "Unavailable for this payment";
    return [
      ["Booking ID", show(row.code, "code")],
      ["Customer name", show(customer?.full_name, "full_name")],
      ["Customer phone", show(row.phone ?? customer?.phone, "phone")],
      ["Service name", show(service?.name, "service")],
      ["Assigned technician", show(technician?.name ?? "Technician not assigned", "technician")],
      ["Scheduled date", show(scheduledDate, "scheduled_date")],
      ["Scheduled time", show(row.scheduled_time, "scheduled_time")],
      ["Payment method", show(row.payment_method, "payment_method")],
      ["Payment status", show(row.payment_status, "payment_status")],
      ["Service fee", show(row.service_fee, "service_fee")],
      ["Parts estimate", show(row.parts_estimate, "parts_estimate")],
      ["Discount", show(row.discount, "discount")],
      ["Total", show(row.total, "total")],
      ["Payment date", paidAt],
    ] as const;
  }
  if (section === "bookings") {
    const address = row.bookingAddress as JsonRow | null;
    const scheduledDate = row.scheduled_date
      ? new Date(`${String(row.scheduled_date)}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
      : null;
    return [
      ["Booking code", show(row.code, "code")],
      ["Booking ID", show(row.id, "id")],
      ["Booking date", show(row.created_at, "created_at")],
      ["Customer name", show((row.customer as JsonRow | null)?.full_name, "full_name")],
      ["Current profile phone", show((row.customer as JsonRow | null)?.phone, "phone")],
      ["Booking-time phone", show(row.phone, "phone")],
      ["Selected service", show((row.services as JsonRow | null)?.name, "service")],
      ["Scheduled date", show(scheduledDate, "scheduled_date")],
      ["Scheduled time", show(row.scheduled_time, "scheduled_time")],
      ["Full address", show(address?.line || row.address_line, "address_line")],
      ["City", show(address?.city, "city")],
      ["Pincode", show(address?.pincode, "pincode")],
      ["Notes", show(row.notes, "notes")],
      ["Payment method", show(row.payment_method, "payment_method")],
      ["Payment status", show(row.payment_status, "payment_status")],
      ["Payment date", row.payment_paid_at
        ? new Date(String(row.payment_paid_at)).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
        : row.payment_status === "pending" ? "Not paid yet" : "Unavailable for this payment"],
      ["Service fee", show(row.service_fee, "service_fee")],
      ["Parts estimate", show(row.parts_estimate, "parts_estimate")],
      ["Discount", show(row.discount, "discount")],
      ["Total", show(row.total, "total")],
      ["Current booking status", show(row.status, "status")],
      ["Assigned technician", show((row.technicians as JsonRow | null)?.name, "technician")],
    ] as const;
  }
  return Object.entries(row).filter(([key]) => !["services", "technicians", "technician", "technicianAssignmentMatches", "customer", "recipient", "owner", "booking", "canChangeRole", "canDelete", "addresses", "bookings", "avatar_url"].includes(key)).map(([key, value]) => [titleCase(key), show(value, key)] as const);
}

export function DataTable({ section, rows, profiles = [], technicianProfiles = [], technicians = [] }: {
  section: SectionKey; rows: JsonRow[]; profiles?: { id: string; full_name: string | null }[];
  technicianProfiles?: { id: string; full_name: string | null; role: "customer" | "technician" }[];
  technicians?: { id: string; name: string }[];
}) {
  const router = useRouter(); const [toast, setToast] = useState<{ text: string; error: boolean } | null>(null); const [pendingId, setPendingId] = useState("");
  const config = configs[section]; const [search, setSearch] = useState(""); const [filter, setFilter] = useState("all"); const [paymentFilter, setPaymentFilter] = useState("all"); const [page, setPage] = useState(0); const pageSize = 10;
  const options = useMemo(() => section === "users" ? ["customer", "admin", "technician"] : [...new Set(rows.map((row) => String(row[config.filter ?? ""] ?? "")))].filter(Boolean).sort(), [rows, config.filter, section]);
  const paymentOptions = useMemo(() => [...new Set(rows.map((row) => String(row.payment_status ?? "")))].filter(Boolean).sort(), [rows]);
  const filtered = useMemo(() => rows.filter((row) => {
    const matchesSearch = !search.trim() || config.search.some((key) => JSON.stringify(row[key] ?? "").toLowerCase().includes(search.trim().toLowerCase()));
    const matchesFilter = filter === "all" || String(row[config.filter ?? ""]) === filter;
    const matchesPayment = section !== "bookings" || paymentFilter === "all" || String(row.payment_status) === paymentFilter;
    return matchesSearch && matchesFilter && matchesPayment;
  }), [rows, search, filter, paymentFilter, config, section]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize)); const pageRows = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const heading = { users: "Users & profiles", technicians: "Technicians", services: "Services", bookings: "Bookings", payments: "Payments", reviews: "Reviews", notifications: "Notifications", addresses: "Addresses" }[section];
  const description = {
    users: "Auth-linked users are listed from profiles. UUID relations use profiles.id; the integer users table is not joined.",
    technicians: "Technician records, profile fields, verification, and booking history.", services: "Catalog fields come from the existing services table.",
    bookings: "Bookings use the service and technician query pattern present in the mobile app.", payments: "Payment information is stored on bookings; no separate payment table exists.",
    reviews: "Review customer, booking, and technician references are looked up by their UUID values.",
    notifications: "Existing in-app notification records. Creating a record does not send a push notification.",
    addresses: "Saved address records linked to profile UUIDs.",
  }[section];
  const safeAction = async (action: (formData: FormData) => Promise<void>, id: string, prompt: string) => {
    if (!window.confirm(prompt)) return;
    setPendingId(id); setToast(null); const formData = new FormData(); formData.set("id", id);
    try { await action(formData); setToast({ text: "Changes saved.", error: false }); router.refresh(); window.setTimeout(() => setToast(null), 4000); }
    catch (error) { setToast({ text: error instanceof Error ? error.message : "The action failed.", error: true }); }
    finally { setPendingId(""); }
  };
  return <>
    <div className="page-heading"><div><h1>{heading}</h1><p className="subheading">{description}</p></div>
      {section === "users" && <CreateProfileUserEditor />}{section === "addresses" && <AddressEditor profiles={profiles} />}{section === "services" && <ServiceEditor />}{section === "technicians" && <TechnicianCreateEditor profiles={technicianProfiles} />}{section === "notifications" && <NotificationEditor profiles={profiles} />}</div>
    {section === "payments" && <div className="notice">These are booking payment fields, not a separate transaction ledger. Payment status values are shown as stored.</div>}
    {section === "notifications" && <div className="notice">Notification creation adds a row to the existing notifications table. No push delivery API was found in the project.</div>}
    <div className="toolbar"><label className="search"><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} placeholder={`Search ${heading.toLowerCase()}…`} aria-label={`Search ${heading}`} /></label>
      {config.filter && <select className="field" value={filter} onChange={(event) => { setFilter(event.target.value); setPage(0); }} aria-label={`Filter by ${config.filter}`}><option value="all">{section === "users" ? "All Roles" : `All ${titleCase(config.filter)}`}</option>{options.map((option) => <option key={option} value={option}>{option === "true" ? "Yes" : option === "false" ? "No" : option}</option>)}</select>}
      {section === "bookings" && <select className="field" value={paymentFilter} onChange={(event) => { setPaymentFilter(event.target.value); setPage(0); }} aria-label="Filter by payment status"><option value="all">All payment statuses</option>{paymentOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select>}
      <span className="muted-cell">{filtered.length.toLocaleString("en-IN")} records</span></div>
    <section className="card"><div className="table-wrap"><table className="data-table"><thead><tr>{config.columns.map(([, label]) => <th key={label}>{label}</th>)}<th>Details</th>{section !== "payments" && <th>Actions</th>}</tr></thead>
      <tbody>{pageRows.map((row) => <TableRows key={String(row.id)} section={section} row={row} config={config} safeAction={safeAction} pendingId={pendingId} profiles={profiles} technicianProfiles={technicianProfiles} technicians={technicians} />)}</tbody></table>
      {!pageRows.length && <div className="empty">{rows.length ? "No records match these filters." : `No ${heading.toLowerCase()} found.`}</div>}
    </div><footer className="pagination"><span>{filtered.length ? `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, filtered.length)} of ${filtered.length}` : "0 records"}</span><div className="inline-actions"><button className="button secondary small" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Previous</button><button className="button secondary small" disabled={page + 1 >= pageCount} onClick={() => setPage((value) => value + 1)}>Next</button></div></footer></section>
    {toast && <div className={`toast ${toast.error ? "toast-error" : ""}`} role={toast.error ? "alert" : "status"}>{toast.text}</div>}
  </>;
}

function BookingPhotos({ row }: { row: JsonRow }) {
  const router = useRouter();
  const [busyPath, setBusyPath] = useState("");
  const [error, setError] = useState("");
  const urls = (row.bookingPhotoUrls as string[] | undefined) ?? [];
  const paths = (row.photos as unknown[] | undefined)?.filter((value): value is string => typeof value === "string") ?? [];

  async function removePhoto(path: string) {
    if (!window.confirm("Permanently delete this booking photo? This removes it from storage and the booking.")) return;
    setBusyPath(path); setError("");
    const formData = new FormData();
    formData.set("id", String(row.id));
    formData.set("photo_path", path);
    try {
      await deleteBookingPhoto(formData);
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not delete this booking photo.");
    } finally { setBusyPath(""); }
  }

  return <div>
    <strong>Uploaded booking photos</strong>
    {urls.length ? (
      <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
        {urls.map((src, index) => {
          const path = paths[index];
          return <div key={`${src}-${index}`} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <a href={src} target="_blank" rel="noreferrer" aria-label={`Open booking photo ${index + 1}`}>
              <Image src={src} alt={`Booking photo ${index + 1}`} width={96} height={96} unoptimized style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 8 }} />
            </a>
            {path && <button className="button danger small" type="button" disabled={busyPath === path} onClick={() => void removePhoto(path)}>{busyPath === path ? "Deleting…" : "Delete photo"}</button>}
          </div>;
        })}
      </div>
    ) : <p className="muted-cell">{Number(row.bookingPhotoCount ?? 0) === 0 ? "No photos were uploaded for this booking." : "Photos could not be loaded. Refresh and try again."}</p>}
    {error && <p className="error-text" role="alert" style={{ marginTop: 8 }}>{error}</p>}
    {Number(row.bookingPhotoCount ?? 0) > urls.length && urls.length > 0 ? <p className="muted-cell">Some photos are unavailable. Refresh and try again.</p> : null}
  </div>;
}

function TableRows({ section, row, config, safeAction, pendingId, profiles, technicianProfiles, technicians }: {
  section: SectionKey; row: JsonRow; config: typeof configs[SectionKey];
  safeAction: (action: (formData: FormData) => Promise<void>, id: string, prompt: string) => Promise<void>;
  pendingId: string; profiles: { id: string; full_name: string | null }[];
  technicianProfiles: { id: string; full_name: string | null; role: "customer" | "technician" }[]; technicians: { id: string; name: string }[];
}) {
  const fields = details(row, section);
  const related = ["users", "technicians", "bookings"].includes(section) ? row.bookings as JsonRow[] | undefined : undefined;
  const addresses = section === "users" ? row.addresses as JsonRow[] | undefined : undefined;
  return <>
    <tr>{config.columns.map(([key]) => { const value = nested(row, key); return <td key={key} className={key === "full_name" || key === "name" || key === "code" ? "strong-cell" : ""}>
      {key === "status" || key === "payment_status" || key === "role" ? <span className={`badge ${String(value).toLowerCase() === "cancelled" ? "red" : String(value).toLowerCase() === "completed" ? "" : "warn"}`}>{show(value, key)}</span> : show(value, key)}
    </td>; })}<td><DetailsDialog><div style={{ display: "grid", gap: 12 }}>
      {section === "users" && <div><strong>Profile photo</strong><div style={{ marginTop: 8, width: 88, height: 88, borderRadius: "50%", overflow: "hidden", display: "grid", placeItems: "center", background: "#e4f3f2", color: "var(--deep)", fontWeight: 800 }}>{typeof row.avatar_url === "string" && row.avatar_url ? <Image src={row.avatar_url} alt={`${String(row.full_name || "User")} profile photo`} width={88} height={88} unoptimized style={{ width: 88, height: 88, objectFit: "cover" }} /> : String(row.full_name || "U").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</div></div>}
      {fields.map(([label, value]) => <div key={label} className="muted-cell"><strong style={{ color: "var(--ink)" }}>{label}:</strong> {value}</div>)}
      {section === "bookings" && <BookingPhotos row={row} /> }
      {section === "users" ? addresses?.length ? <div><strong>Saved addresses</strong>{addresses.map((address) => <p className="muted-cell" key={String(address.id)}>{String(address.label)}{address.is_default ? " · Default" : ""}: {String(address.line)}{address.city ? `, ${String(address.city)}` : ""}{address.pincode ? ` ${String(address.pincode)}` : ""}</p>)}</div> : <p className="muted-cell">No saved addresses.</p> : null}
      {related?.length ? <div><strong>{section === "technicians" ? "Booking history" : "Booking history"}</strong>{related.map((booking) => <p className="muted-cell" key={String(booking.id)}>{String(booking.code ?? booking.id)} · {String(booking.status)} · {String(booking.scheduled_date)}</p>)}</div> : null}
      {section === "users" && row.canChangeRole === false && <p className="muted-cell">Your own role cannot be changed in the Admin Panel.</p>}
      {section === "users" && row.canChangeRole === true && <ProfileRoleEditor row={row} />}
      {section === "technicians" && <TechnicianEditor row={row} profiles={technicianProfiles} />}
      {section === "services" && <ServiceEditor row={row} />}
      {section === "bookings" && <BookingEditor row={row} technicians={technicians} />}
      {section === "payments" && <PaymentEditor row={row} />}
      {section === "reviews" && <ReviewEditor row={row} />}
      {section === "notifications" && <NotificationEditEditor row={row} />}
      {section === "addresses" && <AddressEditor row={row} profiles={profiles} />}
    </div></DetailsDialog></td>
    {section !== "payments" && <td><div className="inline-actions">
      {section === "users" && row.canDelete === true && <button className="button danger small" disabled={pendingId === String(row.id)} onClick={() => void safeAction(deleteProfileUser, String(row.id), "Permanently delete this Auth user? The operation may be rejected if existing database references prevent deletion.")}>{pendingId === String(row.id) ? "Deleting…" : "Delete"}</button>}
      {section === "users" && row.canDelete === false && <span className="muted-cell">Current account</span>}
      {section === "technicians" && <button className="button danger small" disabled={pendingId === String(row.id)} onClick={() => void safeAction(deleteTechnician, String(row.id), "Delete this technician record? Existing bookings or policies may prevent deletion.")}>{pendingId === String(row.id) ? "Deleting…" : "Delete"}</button>}
      {section === "services" && <button className="button danger small" disabled={pendingId === String(row.id)} onClick={() => void safeAction(deleteService, String(row.id), "Delete this service? Existing bookings or policies may prevent deletion.")}>{pendingId === String(row.id) ? "Deleting…" : "Delete"}</button>}
      {section === "bookings" && ["finding_technician", "technician_assigned"].includes(String(row.status)) && <button className="button danger small" disabled={pendingId === String(row.id)} onClick={() => void safeAction(cancelBooking, String(row.id), "Cancel this booking? This changes its existing status to cancelled.")}>{pendingId === String(row.id) ? "Updating…" : "Cancel"}</button>}
      {section === "bookings" && ["technician_assigned", "on_the_way", "in_progress"].includes(String(row.status)) && <button className="button secondary small" disabled={pendingId === String(row.id)} onClick={() => void safeAction((formData) => { formData.set("expected_status", String(row.status)); return advanceBookingStatus(formData); }, String(row.id), `Advance this booking from ${String(row.status).replaceAll("_", " ")} to the next stage?`)}>{pendingId === String(row.id) ? "Updating…" : row.status === "technician_assigned" ? "Mark on the way" : row.status === "on_the_way" ? "Start service" : "Complete service"}</button>}
      {section === "bookings" && <button className="button danger small" disabled={pendingId === String(row.id)} onClick={() => void safeAction(deleteBooking, String(row.id), "Permanently delete this booking? Existing reviews or policies may prevent deletion.")}>{pendingId === String(row.id) ? "Deleting…" : "Delete"}</button>}
      {section === "reviews" && <button className="button danger small" disabled={pendingId === String(row.id)} onClick={() => void safeAction(deleteReview, String(row.id), "Delete this review?")}>{pendingId === String(row.id) ? "Deleting…" : "Delete"}</button>}
      {section === "notifications" && row.unread === true && <button className="button secondary small" disabled={pendingId === String(row.id)} onClick={() => void safeAction(markNotificationRead, String(row.id), "Mark this notification as read?")}>{pendingId === String(row.id) ? "Updating…" : "Mark read"}</button>}
      {section === "notifications" && <button className="button danger small" disabled={pendingId === String(row.id)} onClick={() => void safeAction(deleteNotification, String(row.id), "Delete this notification record?")}>{pendingId === String(row.id) ? "Deleting…" : "Delete"}</button>}
      {section === "addresses" && <button className="button danger small" disabled={pendingId === String(row.id)} onClick={() => void safeAction(deleteAddress, String(row.id), "Delete this saved address?")}>{pendingId === String(row.id) ? "Deleting…" : "Delete"}</button>}
    </div></td>}
  </tr></>;
}
