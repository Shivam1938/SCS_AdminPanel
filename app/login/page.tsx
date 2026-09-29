import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profile?.role === "admin") redirect("/admin");
    redirect("/access-denied");
  }
  return <main className="login-page"><section className="login-card card">
    <div className="brand" style={{ color: "var(--ink)", padding: 0 }}><div className="brand-mark">S</div><span>SUNSHINE COMPUTER SOLUTION</span></div>
    <h1>Admin sign in</h1><p className="subheading">Sign in with your SCS administrator account.</p>
    <LoginForm />
    <p className="muted-cell" style={{ marginTop: 20, lineHeight: 1.5 }}>Access is checked against your authenticated profile on the server.</p>
  </section></main>;
}
