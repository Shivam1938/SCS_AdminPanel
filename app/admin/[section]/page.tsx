import { notFound } from "next/navigation";
import { DataTable } from "@/components/admin/data-table";
import { getNotificationProfiles, getRows, getTechnicianOptions, getTechnicianProfileOptions, type JsonRow, type SectionKey } from "@/lib/data";

const sections = new Set<SectionKey>(["users", "technicians", "services", "bookings", "reviews", "notifications", "payments", "addresses"]);
export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!sections.has(section as SectionKey)) notFound();
  const key = section as SectionKey;
  const [rows, profiles, technicianProfiles, technicians] = await Promise.all([
    getRows(key), key === "notifications" || key === "addresses" ? getNotificationProfiles() : Promise.resolve([]),
    key === "technicians" ? getTechnicianProfileOptions() : Promise.resolve([]),
    key === "bookings" ? getTechnicianOptions() : Promise.resolve([]),
  ]);
  const typedRows = rows as JsonRow[];
  const rowsWithRecipients = key === "notifications" ? typedRows.map((row) => ({ ...row, recipient: profiles.find((profile) => profile.id === row.user_id) ?? null })) : typedRows;
  return <DataTable section={key} rows={rowsWithRecipients} profiles={profiles} technicianProfiles={technicianProfiles} technicians={technicians} />;
}
