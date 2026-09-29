import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";

export default async function AccessDeniedPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { reason } = await searchParams;
  const message = reason === "profile-check"
    ? "Supabase signed you in, but the panel could not read your profile role. Check the profiles SELECT RLS policy for this authenticated admin."
    : reason === "not-admin"
      ? "This account is signed in, but its profiles.role value is not admin."
      : user ? "This signed-in account does not have administrator access." : "Sign in with an SCS administrator account to continue.";
  return <main className="login-page"><section className="login-card card">
    <div className="brand" style={{ color: "var(--ink)", padding: 0 }}><div className="brand-mark">S</div><span>SUNSHINE COMPUTER SOLUTION</span></div>
    <h1>Access denied</h1>
    <p className="subheading">{message}</p>
    <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
      {user ? <form action={signOut}><button className="button" type="submit">Sign out</button></form> : <Link className="button" href="/login">Go to sign in</Link>}
    </div>
  </section></main>;
}
