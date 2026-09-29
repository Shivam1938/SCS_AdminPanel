import Link from "next/link";
import { DashboardCharts } from "@/components/admin/charts";
import { getDashboardData } from "@/lib/data";

const dateTime = (value: unknown) => value ? new Date(String(value)).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";
const display = (value: unknown) => value === null || value === undefined || value === "" ? "—" : String(value);

export default async function DashboardPage() {
  const data = await getDashboardData();
  return <>
    <div className="page-heading"><div><h1>Dashboard</h1><p className="subheading">Live overview from your SCS Supabase database.</p></div>
      <span className="badge">Live data</span></div>
    <div className="stat-grid">{data.totals.map((stat) => <section className="card stat" key={stat.label}>
      <div className="stat-label">{stat.label}</div><div className="stat-value">{stat.value.toLocaleString("en-IN")}</div>
      <div className="stat-foot">Current database count</div></section>)}</div>
    <DashboardCharts statuses={data.statusCounts} paymentTotals={data.paymentTotals} />
    <div className="dashboard-grid">
      <section className="card"><div className="card-title" style={{ display: "flex", justifyContent: "space-between" }}>Recent bookings<Link className="icon-button" href="/admin/bookings">View all →</Link></div>
        {data.recentBookings.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Booking</th><th>Service</th><th>Customer</th><th>Status</th><th>Created</th></tr></thead><tbody>
          {data.recentBookings.map((row) => <tr key={String(row.id)}><td className="strong-cell">{display(row.code)}</td><td>{display((row.services as {name?: string} | null)?.name)}</td><td>{display((row.customer as {full_name?: string} | null)?.full_name)}</td><td><span className="badge">{display(row.status)}</span></td><td className="muted-cell">{dateTime(row.created_at)}</td></tr>)}
        </tbody></table></div> : <div className="empty">No bookings found.</div>}</section>
      <section className="card"><div className="card-title" style={{ display: "flex", justifyContent: "space-between" }}>Recent profiles<Link className="icon-button" href="/admin/users">View all →</Link></div>
        {data.recentUsers.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Name</th><th>City</th><th>Joined</th></tr></thead><tbody>
          {data.recentUsers.map((row) => <tr key={String(row.id)}><td className="strong-cell">{display(row.full_name)}</td><td>{display(row.city)}</td><td className="muted-cell">{dateTime(row.created_at)}</td></tr>)}
        </tbody></table></div> : <div className="empty">No profiles found.</div>}</section>
    </div>
  </>;
}
