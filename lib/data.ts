import "server-only";
import { requireAdmin } from "@/lib/auth";

export type SectionKey = "users" | "technicians" | "services" | "bookings" | "reviews" | "notifications" | "payments" | "addresses";
export type JsonRow = Record<string, unknown>;

export async function getNotificationProfiles() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.from("profiles").select("id, full_name").order("full_name", { ascending: true }).limit(1000);
  if (error) throw new Error(`Could not load notification recipients: ${error.message}`);
  return (data ?? []) as { id: string; full_name: string | null }[];
}

export async function getTechnicianProfileOptions() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.from("profiles").select("id, full_name, role")
    .in("role", ["customer", "technician"]).order("full_name", { ascending: true }).limit(1000);
  if (error) throw new Error(`Could not load linkable profiles: ${error.message}`);
  return (data ?? []) as { id: string; full_name: string | null; role: "customer" | "technician" }[];
}

export async function getTechnicianOptions() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.from("technicians").select("id, name").order("name", { ascending: true }).limit(1000);
  if (error) throw new Error(`Could not load technicians: ${error.message}`);
  return (data ?? []) as { id: string; name: string }[];
}

const tables: Record<SectionKey, string> = {
  users: "profiles", technicians: "technicians", services: "services", bookings: "bookings",
  reviews: "reviews", notifications: "notifications", payments: "bookings", addresses: "addresses",
};

export async function getRows(section: SectionKey) {
  const { supabase, user } = await requireAdmin();
  const table = tables[section];
  const rows: JsonRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    let query = supabase.from(table).select("*");
    if (section === "services") query = query.order("sort", { ascending: true }).order("id", { ascending: true });
    else if (section === "technicians") query = query.order("name", { ascending: true }).order("id", { ascending: true });
    else if (section === "addresses") query = query.order("id", { ascending: true });
    else query = query.order("created_at", { ascending: false }).order("id", { ascending: true });
    const { data, error } = await query.range(offset, offset + 999);
    if (error) throw new Error(`Could not load ${section}: ${error.message}`);
    rows.push(...((data ?? []) as JsonRow[]));
    if (!data || data.length < 1000) break;
  }
  if (section === "users") {
    const ids = rows.map((row) => String(row.id));
    if (!ids.length) return rows;
    const [addresses, bookings] = await Promise.all([
      supabase.from("addresses").select("id, user_id, label, line, city, is_default").in("user_id", ids),
      supabase.from("bookings").select("id, code, user_id, status, scheduled_date, total, created_at").in("user_id", ids).order("created_at", { ascending: false }).limit(500),
    ]);
    if (addresses.error || bookings.error) throw new Error(`Could not load profile details: ${addresses.error?.message ?? bookings.error?.message}`);
    return rows.map((row) => ({ ...row, canChangeRole: row.id !== user.id, canDelete: row.id !== user.id, addresses: addresses.data?.filter((item) => item.user_id === row.id) ?? [], bookings: bookings.data?.filter((item) => item.user_id === row.id) ?? [] }));
  }
  if (section === "addresses") {
    const userIds = [...new Set(rows.map((row) => String(row.user_id)))];
    const { data, error } = userIds.length
      ? await supabase.from("profiles").select("id, full_name, phone, city").in("id", userIds)
      : { data: [], error: null };
    if (error) throw new Error(`Could not load address owners: ${error.message}`);
    return rows.map((row) => ({ ...row, owner: data?.find((profile) => profile.id === row.user_id) ?? null }));
  }
  if (section === "technicians") {
    const ids = rows.map((row) => String(row.id));
    if (!ids.length) return rows;
    const bookings = await supabase.from("bookings").select("id, code, technician_id, status, scheduled_date, total, created_at").in("technician_id", ids).order("created_at", { ascending: false }).limit(500);
    if (bookings.error) throw new Error(`Could not load technician booking history: ${bookings.error.message}`);
    return rows.map((row) => ({ ...row, bookings: bookings.data?.filter((item) => item.technician_id === row.id) ?? [] }));
  }
  if (section === "reviews") {
    const userIds = [...new Set(rows.map((row) => String(row.user_id)))];
    const bookingIds = [...new Set(rows.map((row) => String(row.booking_id)))];
    const technicianIds = [...new Set(rows.map((row) => row.technician_id ? String(row.technician_id) : "").filter(Boolean))];
    const [profiles, bookings, technicians] = await Promise.all([
      userIds.length ? supabase.from("profiles").select("id, full_name, phone, city").in("id", userIds) : Promise.resolve({ data: [], error: null }),
      bookingIds.length ? supabase.from("bookings").select("id, code, service_id, scheduled_date, status").in("id", bookingIds) : Promise.resolve({ data: [], error: null }),
      technicianIds.length ? supabase.from("technicians").select("id, name").in("id", technicianIds) : Promise.resolve({ data: [], error: null }),
    ]);
    const failure = profiles.error ?? bookings.error ?? technicians.error;
    if (failure) throw new Error(`Could not load review details: ${failure.message}`);
    const serviceIds = [...new Set((bookings.data ?? []).map((item) => item.service_id).filter(Boolean))];
    const services = serviceIds.length ? await supabase.from("services").select("id, name").in("id", serviceIds) : { data: [], error: null };
    if (services.error) throw new Error(`Could not load review services: ${services.error.message}`);
    return rows.map((row) => ({ ...row,
      customer: profiles.data?.find((item) => item.id === row.user_id) ?? null,
      booking: bookings.data?.find((item) => item.id === row.booking_id) ?? null,
      service: services.data?.find((item) => item.id === bookings.data?.find((booking) => booking.id === row.booking_id)?.service_id) ?? null,
      technician: technicians.data?.find((item) => item.id === row.technician_id) ?? null,
    }));
  }
  if (section === "bookings" || section === "payments") {
    const ids = [...new Set(rows.map((row) => String(row.user_id)))];
    if (!ids.length) return rows;
    const serviceIds = section === "bookings" ? [...new Set(rows.map((row) => String(row.service_id)).filter(Boolean))] : [];
    const technicianIds = section === "bookings" ? [...new Set(rows.map((row) => String(row.technician_id ?? "")).filter(Boolean))] : [];
    const [profiles, services, technicians] = await Promise.all([
      supabase.from("profiles").select("id, full_name, phone, city").in("id", ids),
      serviceIds.length ? supabase.from("services").select("id, name, icon").in("id", serviceIds) : Promise.resolve({ data: [], error: null }),
      technicianIds.length ? supabase.from("technicians").select("id, name, role_title").in("id", technicianIds) : Promise.resolve({ data: [], error: null }),
    ]);
    const failure = profiles.error ?? services.error ?? technicians.error;
    if (failure) throw new Error(`Could not load booking details: ${failure.message}`);
    return rows.map((row) => ({ ...row, customer: profiles.data?.find((item) => item.id === row.user_id) ?? null,
      services: services.data?.find((item) => item.id === row.service_id) ?? null,
      technicians: technicians.data?.find((item) => item.id === row.technician_id) ?? null,
    }));
  }
  return rows;
}

export async function getDashboardData() {
  const { supabase } = await requireAdmin();
  const [users, technicians, bookings, pending, completed, cancelled, recentBookings, recentUsers, services, allBookingMoney] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("technicians").select("id", { count: "exact", head: true }),
    supabase.from("bookings").select("id", { count: "exact", head: true }),
    supabase.from("bookings").select("id", { count: "exact", head: true }).in("status", ["finding_technician", "technician_assigned", "on_the_way", "in_progress"]),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "completed"),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "cancelled"),
    supabase.from("bookings").select("id, code, user_id, service_id, technician_id, status, scheduled_date, scheduled_time, created_at, total").order("created_at", { ascending: false }).limit(6),
    supabase.from("profiles").select("id, full_name, phone, city, role, created_at").order("created_at", { ascending: false }).limit(6),
    supabase.from("services").select("id", { count: "exact", head: true }),
    (async () => {
      const rows: { status: string; payment_status: string; total: number | null }[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase.from("bookings").select("status, payment_status, total").order("id", { ascending: true }).range(offset, offset + 999);
        if (error) return { data: null, error };
        rows.push(...(data ?? []));
        if (!data || data.length < 1000) return { data: rows, error: null };
      }
    })(),
  ]);
  const results = [users, technicians, bookings, pending, completed, cancelled, recentBookings, recentUsers, services, allBookingMoney];
  const failure = results.find((result) => result.error);
  if (failure?.error) throw new Error(`Could not load dashboard data: ${failure.error.message}`);
  const statusCounts = new Map<string, number>();
  for (const row of allBookingMoney.data ?? []) statusCounts.set(row.status, (statusCounts.get(row.status) ?? 0) + 1);
  const paymentTotals = new Map<string, number>();
  for (const row of allBookingMoney.data ?? []) paymentTotals.set(row.payment_status, (paymentTotals.get(row.payment_status) ?? 0) + (row.total ?? 0));
  const recentIds = (recentBookings.data ?? []).map((row) => row.user_id);
  const serviceIds = [...new Set((recentBookings.data ?? []).map((row) => row.service_id))];
  const technicianIds = [...new Set((recentBookings.data ?? []).map((row) => row.technician_id).filter(Boolean))];
  const [recentCustomers, recentServices, recentTechnicians] = await Promise.all([
    recentIds.length ? supabase.from("profiles").select("id, full_name").in("id", recentIds) : Promise.resolve({ data: [], error: null }),
    serviceIds.length ? supabase.from("services").select("id, name").in("id", serviceIds) : Promise.resolve({ data: [], error: null }),
    technicianIds.length ? supabase.from("technicians").select("id, name").in("id", technicianIds) : Promise.resolve({ data: [], error: null }),
  ]);
  const recentFailure = recentCustomers.error ?? recentServices.error ?? recentTechnicians.error;
  if (recentFailure) throw new Error(`Could not load recent booking details: ${recentFailure.message}`);
  const recentBookingsWithCustomers = (recentBookings.data ?? []).map((row) => ({ ...row,
    customer: recentCustomers.data?.find((customer) => customer.id === row.user_id) ?? null,
    services: recentServices.data?.find((service) => service.id === row.service_id) ?? null,
    technicians: recentTechnicians.data?.find((technician) => technician.id === row.technician_id) ?? null,
  }));
  return {
    totals: [
      { label: "Users / profiles", value: users.count ?? 0 }, { label: "Technicians", value: technicians.count ?? 0 },
      { label: "Services", value: services.count ?? 0 }, { label: "Bookings", value: bookings.count ?? 0 },
      { label: "Pending bookings", value: pending.count ?? 0 }, { label: "Completed", value: completed.count ?? 0 },
      { label: "Cancelled", value: cancelled.count ?? 0 },
    ],
    recentBookings: recentBookingsWithCustomers as JsonRow[],
    recentUsers: (recentUsers.data ?? []) as JsonRow[],
    statusCounts: [...statusCounts.entries()].map(([status, count]) => ({ status, count })),
    paymentTotals: [...paymentTotals.entries()].map(([status, total]) => ({ status, total })),
  };
}
