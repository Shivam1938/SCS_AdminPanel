import { ProfileSettingsEditor } from "@/components/admin/editors";
import { HomeBannerEditor } from "@/components/admin/payment-settings-editor";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function SettingsPage() {
  const { supabase, user } = await requireAdmin();
  const [profileResult, bannerResult] = await Promise.all([
    supabase.from("profiles").select("id, full_name, phone, city, role, created_at").eq("id", user.id).maybeSingle(),
    createAdminClient().from("app_settings").select("home_banner_url").eq("id", "global").maybeSingle(),
  ]);
  if (profileResult.error) throw new Error("Could not load admin profile. Refresh and try again.");
  if (bannerResult.error) throw new Error("Could not load home banner settings. Refresh and try again.");

  const profile = profileResult.data;
  const bannerUrl = bannerResult.data?.home_banner_url ?? null;

  return <>
    <div className="page-heading">
      <div>
        <h1>Settings</h1>
        <p className="subheading">Administrator account and application settings.</p>
      </div>
    </div>

    <HomeBannerEditor bannerUrl={bannerUrl} />

    {!profile ? (
      <div className="error-box">No profile exists for this Auth user. Ask an administrator to provision the profile before changing settings.</div>
    ) : (
      <section className="card" style={{ maxWidth: 680, marginTop: 16 }}>
        <div className="card-title">Admin profile</div>
        <div className="card-body" style={{ display: "grid", gap: 14 }}>
          <div><div className="stat-label">Auth email</div><div style={{ marginTop: 5, fontWeight: 650 }}>{user.email ?? "Unavailable"}</div></div>
          <div><div className="stat-label">Profile role</div><div style={{ marginTop: 5 }}><span className="badge">{profile.role}</span></div></div>
          <div><div className="stat-label">Profile UUID</div><div style={{ marginTop: 5, fontFamily: "monospace", fontSize: 12 }}>{profile.id}</div></div>
          <ProfileSettingsEditor row={profile} />
        </div>
      </section>
    )}
  </>;
}
