"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function DashboardCharts({ statuses, paymentTotals }: {
  statuses: { status: string; count: number }[];
  paymentTotals: { status: string; total: number }[];
}) {
  const money = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
  return <div className="dashboard-grid">
    <section className="card"><div className="card-title">Booking status distribution</div><div className="card-body" style={{ height: 265 }}>
      {statuses.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={statuses} margin={{ top: 8, right: 8, bottom: 18, left: -18 }}>
        <CartesianGrid vertical={false} stroke="#edf0f1" /><XAxis dataKey="status" tick={{ fontSize: 10 }} angle={-12} textAnchor="end" interval={0} /><YAxis allowDecimals={false} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="count" fill="#0c8991" radius={[5, 5, 0, 0]} />
      </BarChart></ResponsiveContainer> : <div className="empty">No booking status data found.</div>}
    </div></section>
    <section className="card"><div className="card-title">Booking totals by payment status</div><div className="card-body" style={{ height: 265 }}>
      {paymentTotals.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={paymentTotals} margin={{ top: 8, right: 8, bottom: 18, left: -5 }}>
        <CartesianGrid vertical={false} stroke="#edf0f1" /><XAxis dataKey="status" tick={{ fontSize: 10 }} angle={-12} textAnchor="end" interval={0} /><YAxis tickFormatter={(value: number) => `₹${value}`} tick={{ fontSize: 10 }} /><Tooltip formatter={(value) => money(Number(value))} /><Bar dataKey="total" name="Recorded booking total" fill="#f27032" radius={[5, 5, 0, 0]} />
      </BarChart></ResponsiveContainer> : <div className="empty">No payment totals are available.</div>}
    </div><p className="muted-cell" style={{ padding: "0 20px 16px", margin: 0 }}>Amounts use the existing booking total and payment_status fields; no payment state is inferred.</p></section>
  </div>;
}
