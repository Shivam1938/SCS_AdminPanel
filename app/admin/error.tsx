"use client";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section className="card" style={{ padding: 24 }}><h1 style={{ marginTop: 0 }}>Could not load this section</h1>
    <p className="subheading">{error.message}</p><p className="notice" style={{ marginTop: 16 }}>Check the reported database error against the supplied schema and existing RLS policies. The panel does not bypass RLS.</p>
    <button className="button" onClick={reset}>Try again</button>
  </section>;
}
