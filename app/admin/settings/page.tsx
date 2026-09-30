import { ProfileSettingsEditor } from "@/components/admin/editors";
import { PaymentSettingsEditor } from "@/components/admin/payment-settings-editor";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function SettingsPage() {
  const { supabase, user } = await requireAdmin();
  const [profileResult, paymentResult] = await Promise.all([
    supabase.from("profiles").select("id, full_name, phone, city, role, created_at").eq("id", user.id).maybeSingle(),
    createAdminClient().from("payment_settings").select("id, upi_id, upi_enabled, qr_code_url, updated_at").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (profileResult.error) throw new Error("Could not load admin profile. Refresh and try again.");
  if (paymentResult.error) throw new Error("Could not load online payment settings. Refresh and try again.");
  const profile = profileResult.data;
  const paymentSettings = paymentResult.data ?? { upi_id: null, upi_enabled: false, qr_code_url: null };
  return <><div className="page-heading"><div><h1>Settings</h1><p className="subheading">Your administrator account details.</p></div></div>
    <PaymentSettingsEditor settings={paymentSettings} />
    {!profile ? <div className="error-box">No profile exists for this Auth user. Ask an administrator to provision the profile before changing settings.</div> : <section className="card" style={{ maxWidth: 680 }}>
      <div className="card-title">Admin profile</div><div className="card-body" style={{ display: "grid", gap: 14 }}>
        <div><div className="stat-label">Auth email</div><div style={{ marginTop: 5, fontWeight: 650 }}>{user.email ?? "Unavailable"}</div></div>
        <div><div className="stat-label">Profile role</div><div style={{ marginTop: 5 }}><span className="badge">{profile.role}</span></div></div>
        <div><div className="stat-label">Profile UUID</div><div style={{ marginTop: 5, fontFamily: "monospace", fontSize: 12 }}>{profile.id}</div></div>
        <ProfileSettingsEditor row={profile} />
      </div></section>}
  </>;
}
