"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { savePaymentSettings } from "@/lib/mutations";

type PaymentSettings = { upi_id: string | null; upi_enabled: boolean; qr_code_url: string | null };

export function PaymentSettingsEditor({ settings }: { settings: PaymentSettings }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [upiId, setUpiId] = useState(settings.upi_id ?? "");
  const [upiEnabled, setUpiEnabled] = useState(settings.upi_enabled);
  const [qrUrl, setQrUrl] = useState(settings.qr_code_url ?? "");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage(""); setErrorMessage("");
    const formData = new FormData();
    formData.set("upi_id", upiId.trim());
    formData.set("upi_enabled", String(upiEnabled));
    const file = fileRef.current?.files?.[0];
    if (file) formData.set("qr_file", file);
    try {
      const saved = await savePaymentSettings(formData);
      setQrUrl(saved.qr_code_url ?? "");
      if (fileRef.current) fileRef.current.value = "";
      setMessage("Payment settings saved.");
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not save payment settings. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="card" style={{ maxWidth: 680 }}>
    <div className="card-title">Online UPI payment</div>
    <form className="card-body" onSubmit={submit} style={{ display: "grid", gap: 14 }}>
      <div className="form-field"><label htmlFor="payment-upi-id">UPI ID</label><input id="payment-upi-id" className="field" autoComplete="off" value={upiId} onChange={(event) => setUpiId(event.target.value)} placeholder="business@bank" /></div>
      <div className="form-field"><label htmlFor="payment-qr-file">UPI QR code</label><input ref={fileRef} id="payment-qr-file" className="field" type="file" accept="image/png,image/jpeg,image/webp" /><span className="muted-cell">Upload a PNG, JPEG, or WebP image smaller than 850 KB.</span></div>
      {qrUrl ? <div><div className="stat-label">Current QR code</div><Image src={qrUrl} alt="Current UPI payment QR code" width={180} height={180} unoptimized style={{ width: 180, height: 180, objectFit: "contain", marginTop: 8, borderRadius: 8, border: "1px solid var(--line)" }} /></div> : <p className="muted-cell">No QR code has been configured.</p>}
      <label className="check-row"><input type="checkbox" checked={upiEnabled} onChange={(event) => setUpiEnabled(event.target.checked)} /> Enable online UPI payment</label>
      {message && <p className="success-text" role="status">{message}</p>}
      {errorMessage && <p className="error-text" role="alert">{errorMessage}</p>}
      <div className="dialog-foot" style={{ padding: "12px 0 0", border: 0 }}><button className="button" disabled={busy}>{busy ? "Saving…" : "Save payment settings"}</button></div>
    </form>
  </section>;
}
