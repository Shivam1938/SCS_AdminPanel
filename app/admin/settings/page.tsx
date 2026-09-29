import { ProfileSettingsEditor } from "@/components/admin/editors";
import { requireAdmin } from "@/lib/auth";

export default async function SettingsPage() {
  const { supabase, user } = await requireAdmin();
  const { data: profile, error } = await supabase.from("profiles").select("id, full_name, phone, city, role, created_at").eq("id", user.id).maybeSingle();
  if (error) throw new Error(`Could not load admin profile: ${error.message}`);
  return <><div className="page-heading"><div><h1>Settings</h1><p className="subheading">Your administrator account details.</p></div></div>
    {!profile ? <div className="error-box">No profile exists for this Auth user. Ask an administrator to provision the profile before changing settings.</div> : <section className="card" style={{ maxWidth: 680 }}>
      <div className="card-title">Admin profile</div><div className="card-body" style={{ display: "grid", gap: 14 }}>
        <div><div className="stat-label">Auth email</div><div style={{ marginTop: 5, fontWeight: 650 }}>{user.email ?? "Unavailable"}</div></div>
        <div><div className="stat-label">Profile role</div><div style={{ marginTop: 5 }}><span className="badge">{profile.role}</span></div></div>
        <div><div className="stat-label">Profile UUID</div><div style={{ marginTop: 5, fontFamily: "monospace", fontSize: 12 }}>{profile.id}</div></div>
        <ProfileSettingsEditor row={profile} />
      </div></section>}
  </>;
}
