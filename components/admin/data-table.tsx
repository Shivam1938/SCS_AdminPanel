"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { JsonRow, SectionKey } from "@/lib/data";
import { cancelBooking, deleteAddress, deleteBooking, deleteNotification, deleteProfileUser, deleteReview, deleteService, deleteTechnician, markNotificationRead } from "@/lib/mutations";
import { AddressEditor, BookingEditor, CreateProfileUserEditor, NotificationEditEditor, NotificationEditor, ProfileEditor, ProfileRoleEditor, ReviewEditor, ServiceEditor, TechnicianCreateEditor, TechnicianEditor } from "@/components/admin/editors";

const configs: Record<SectionKey, { columns: [string, string][]; filter?: string; search: string[] }> = {
  users: { columns: [["full_name", "Profile"], ["phone", "Phone"], ["city", "City"], ["role", "Role"], ["created_at", "Joined"]], filter: "role", search: ["full_name", "phone", "city", "role", "id"] },
  technicians: { columns: [["name", "Technician"], ["role_title", "Specialty"], ["verified", "Verified"], ["rating", "Rating"], ["jobs_completed", "Jobs"], ["years_experience", "Experience"]], filter: "verified", search: ["name", "role_title", "skills"] },
  services: { columns: [["name", "Service"], ["id", "ID"], ["price", "Price"], ["active", "Active"], ["rating", "Rating"], ["bookings_count", "Bookings"], ["sort", "Sort"]], filter: "active", search: ["name", "id", "description"] },
  bookings: { columns: [["code", "Booking"], ["customer", "Customer"], ["services", "Service"], ["technicians", "Technician"], ["scheduled_date", "Scheduled"], ["status", "Status"], ["payment_status", "Payment"], ["total", "Total"]], filter: "status", search: ["code", "customer", "services", "technicians", "status", "payment_status", "address_line"] },
  payments: { columns: [["code", "Booking"], ["customer", "Customer"], ["payment_method", "Method"], ["payment_status", "Status"], ["service_fee", "Service fee"], ["parts_estimate", "Parts estimate"], ["discount", "Discount"], ["total", "Total"]], filter: "payment_status", search: ["code", "customer", "payment_method", "payment_status"] },
  reviews: { columns: [["customer", "Customer"], ["technician", "Technician"], ["booking", "Booking"], ["service", "Service"], ["rating", "Rating"], ["comment", "Comment"], ["tags", "Tags"], ["created_at", "Created"]], search: ["customer", "technician", "booking", "service", "rating", "comment", "tags"] },
  notifications: { columns: [["title", "Title"], ["recipient", "Recipient"], ["body", "Message"], ["unread", "Unread"], ["created_at", "Created"]], filter: "unread", search: ["title", "recipient", "body"] },
  addresses: { columns: [["owner", "User"], ["label", "Label"], ["line", "Address"], ["city", "City"], ["is_default", "Default"]], filter: "is_default", search: ["owner", "label", "line", "city", "user_id"] },
};
const titleCase = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const nested = (row: JsonRow, key: string): unknown => {
  const raw = row[key];
  if (key === "customer" || key === "recipient" || key === "owner") return (raw as JsonRow | null)?.full_name;
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
function details(row: JsonRow) {
  return Object.entries(row).filter(([key]) => !["services", "technicians", "customer", "recipient", "owner", "booking", "canChangeRole", "canDelete", "addresses", "bookings"].includes(key)).map(([key, value]) => [titleCase(key), show(value, key)] as const);
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

function TableRows({ section, row, config, safeAction, pendingId, profiles, technicianProfiles, technicians }: {
  section: SectionKey; row: JsonRow; config: typeof configs[SectionKey];
  safeAction: (action: (formData: FormData) => Promise<void>, id: string, prompt: string) => Promise<void>;
  pendingId: string; profiles: { id: string; full_name: string | null }[];
  technicianProfiles: { id: string; full_name: string | null; role: "customer" | "technician" }[]; technicians: { id: string; name: string }[];
}) {
  const fields = details(row);
  const related = ["users", "technicians", "bookings"].includes(section) ? row.bookings as JsonRow[] | undefined : undefined;
  const addresses = section === "users" ? row.addresses as JsonRow[] | undefined : undefined;
  return <>
    <tr>{config.columns.map(([key]) => { const value = nested(row, key); return <td key={key} className={key === "full_name" || key === "name" || key === "code" ? "strong-cell" : ""}>
      {key === "status" || key === "payment_status" || key === "role" ? <span className={`badge ${String(value).toLowerCase() === "cancelled" ? "red" : String(value).toLowerCase() === "completed" ? "" : "warn"}`}>{show(value, key)}</span> : show(value, key)}
    </td>; })}<td><details><summary className="icon-button">View</summary><div className="card" style={{ minWidth: 270, maxWidth: 520, padding: 12, whiteSpace: "normal", display: "grid", gap: 7, marginTop: 6 }}>
      {fields.map(([label, value]) => <div key={label} className="muted-cell"><strong style={{ color: "var(--ink)" }}>{label}:</strong> {value}</div>)}
      {addresses?.length ? <div><strong>Addresses</strong>{addresses.map((address) => <p className="muted-cell" key={String(address.id)}>{String(address.label)}: {String(address.line)}{address.city ? `, ${String(address.city)}` : ""}</p>)}</div> : null}
      {related?.length ? <div><strong>{section === "technicians" ? "Booking history" : "Booking history"}</strong>{related.map((booking) => <p className="muted-cell" key={String(booking.id)}>{String(booking.code ?? booking.id)} · {String(booking.status)} · {String(booking.scheduled_date)}</p>)}</div> : null}
      {section === "users" && <ProfileEditor row={row} />}
      {section === "users" && row.canChangeRole === false && <p className="muted-cell">Your own role cannot be changed in the Admin Panel.</p>}
      {section === "users" && row.canChangeRole === true && <ProfileRoleEditor row={row} />}
      {section === "technicians" && <TechnicianEditor row={row} profiles={technicianProfiles} />}
      {section === "services" && <ServiceEditor row={row} />}
      {section === "bookings" && <BookingEditor row={row} technicians={technicians} />}
      {section === "reviews" && <ReviewEditor row={row} />}
      {section === "notifications" && <NotificationEditEditor row={row} />}
      {section === "addresses" && <AddressEditor row={row} profiles={profiles} />}
    </div></details></td>
    {section !== "payments" && <td><div className="inline-actions">
      {section === "users" && row.canDelete === true && <button className="button danger small" disabled={pendingId === String(row.id)} onClick={() => void safeAction(deleteProfileUser, String(row.id), "Permanently delete this Auth user? The operation may be rejected if existing database references prevent deletion.")}>{pendingId === String(row.id) ? "Deleting…" : "Delete"}</button>}
      {section === "users" && row.canDelete === false && <span className="muted-cell">Current account</span>}
      {section === "technicians" && <button className="button danger small" disabled={pendingId === String(row.id)} onClick={() => void safeAction(deleteTechnician, String(row.id), "Delete this technician record? Existing bookings or policies may prevent deletion.")}>{pendingId === String(row.id) ? "Deleting…" : "Delete"}</button>}
      {section === "services" && <button className="button danger small" disabled={pendingId === String(row.id)} onClick={() => void safeAction(deleteService, String(row.id), "Delete this service? Existing bookings or policies may prevent deletion.")}>{pendingId === String(row.id) ? "Deleting…" : "Delete"}</button>}
      {section === "bookings" && ["finding_technician", "technician_assigned"].includes(String(row.status)) && <button className="button danger small" disabled={pendingId === String(row.id)} onClick={() => void safeAction(cancelBooking, String(row.id), "Cancel this booking? This changes its existing status to cancelled.")}>{pendingId === String(row.id) ? "Updating…" : "Cancel"}</button>}
      {section === "bookings" && <button className="button danger small" disabled={pendingId === String(row.id)} onClick={() => void safeAction(deleteBooking, String(row.id), "Permanently delete this booking? Existing reviews or policies may prevent deletion.")}>{pendingId === String(row.id) ? "Deleting…" : "Delete"}</button>}
      {section === "reviews" && <button className="button danger small" disabled={pendingId === String(row.id)} onClick={() => void safeAction(deleteReview, String(row.id), "Delete this review?")}>{pendingId === String(row.id) ? "Deleting…" : "Delete"}</button>}
      {section === "notifications" && row.unread === true && <button className="button secondary small" disabled={pendingId === String(row.id)} onClick={() => void safeAction(markNotificationRead, String(row.id), "Mark this notification as read?")}>{pendingId === String(row.id) ? "Updating…" : "Mark read"}</button>}
      {section === "notifications" && <button className="button danger small" disabled={pendingId === String(row.id)} onClick={() => void safeAction(deleteNotification, String(row.id), "Delete this notification record?")}>{pendingId === String(row.id) ? "Deleting…" : "Delete"}</button>}
      {section === "addresses" && <button className="button danger small" disabled={pendingId === String(row.id)} onClick={() => void safeAction(deleteAddress, String(row.id), "Delete this saved address?")}>{pendingId === String(row.id) ? "Deleting…" : "Delete"}</button>}
    </div></td>}
  </tr></>;
}
