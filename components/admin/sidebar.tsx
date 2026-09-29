"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Bell, BriefcaseBusiness, ClipboardList, CreditCard, LayoutDashboard, MapPin, Settings, Star, Users, Wrench } from "lucide-react";

const items = [
  { href: "/admin", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/admin/users", label: "Users & profiles", Icon: Users },
  { href: "/admin/addresses", label: "Addresses", Icon: MapPin },
  { href: "/admin/technicians", label: "Technicians", Icon: Wrench },
  { href: "/admin/bookings", label: "Bookings", Icon: ClipboardList },
  { href: "/admin/services", label: "Services", Icon: BriefcaseBusiness },
  { href: "/admin/payments", label: "Payments", Icon: CreditCard },
  { href: "/admin/reviews", label: "Reviews", Icon: Star },
  { href: "/admin/notifications", label: "Notifications", Icon: Bell },
  { href: "/admin/settings", label: "Settings", Icon: Settings },
];

export function Sidebar() {
  const currentPath = usePathname();
  return <aside className="sidebar">
    <Link className="brand" href="/admin"><span className="brand-mark">S</span><span className="brand-name">SCS ADMIN</span></Link>
    <div className="nav-label">Workspace</div>
    <nav>{items.map(({ href, label, Icon }) => <Link key={href} href={href} className={`nav-link ${currentPath === href ? "active" : ""}`} title={label}>
      <Icon className="nav-icon" strokeWidth={1.8} /><span>{label}</span>
    </Link>)}</nav>
    <div className="sidebar-bottom"><Activity size={15} style={{ display: "inline", marginRight: 7 }} />Connected to SCS data</div>
  </aside>;
}
