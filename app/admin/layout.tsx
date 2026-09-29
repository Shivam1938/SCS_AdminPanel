import { Sidebar } from "@/components/admin/sidebar";
import { requireAdmin } from "@/lib/auth";
import { signOut } from "@/app/login/actions";

export const dynamic = "force-dynamic";
export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { user } = await requireAdmin();
  const displayName = user.email ?? "Administrator";
  return <div className="shell">
    <Sidebar />
    <div className="main">
      <header className="topbar"><div className="top-title">Sunshine Computer Solution <span style={{ color: "#a8b5b7" }}>/</span> Administration</div>
        <form action={signOut} className="top-user"><span className="avatar">{displayName.slice(0, 1).toUpperCase()}</span><span>{displayName}</span><button className="button secondary small" type="submit">Log out</button></form>
      </header>
      <main className="content">{children}</main>
    </div>
  </div>;
}
