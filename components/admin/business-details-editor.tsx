"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveBusinessContent, saveContactSettings } from "@/lib/mutations";

type ContentItem = { content_key: string; label: string; title: string; content: string };
type Contact = {
  id: number;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  support_email: string | null;
  address: string | null;
  working_hours: string | null;
  website: string | null;
};

export function BusinessDetailsEditor({ content, contact }: { content: ContentItem[]; contact: Contact }) {
  const router = useRouter();
  const [contentState, setContentState] = useState(content);
  const [contactState, setContactState] = useState({
    phone: contact.phone ?? "",
    whatsapp: contact.whatsapp ?? "",
    email: contact.email ?? "",
    support_email: contact.support_email ?? "",
    address: contact.address ?? "",
    working_hours: contact.working_hours ?? "",
    website: contact.website ?? "",
  });
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [busy, setBusy] = useState("");

  function updateContent(index: number, field: "title" | "content", value: string) {
    setContentState((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  }

  async function saveContent(index: number) {
    setBusy(`content-${index}`); setMessage(""); setErrorMessage("");
    const item = contentState[index];
    const formData = new FormData();
    formData.set("content_key", item.content_key);
    formData.set("title", item.title.trim());
    formData.set("content", item.content.trim());
    try {
      await saveBusinessContent(formData);
      setMessage(`${item.label} saved.`);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : `Could not save ${item.label}.`);
    } finally { setBusy(""); }
  }

  async function saveContact() {
    setBusy("contact"); setMessage(""); setErrorMessage("");
    const formData = new FormData();
    Object.entries(contactState).forEach(([key, value]) => formData.set(key, value));
    try {
      await saveContactSettings(formData);
      setMessage("Business contact details saved.");
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not save business contact details.");
    } finally { setBusy(""); }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section className="card">
        <div className="card-title">Contact & business information</div>
        <div className="card-body" style={{ display: "grid", gap: 14 }}>
          <div className="form-grid">
            {[
              ["phone", "Phone"],
              ["whatsapp", "WhatsApp"],
              ["email", "Business email"],
              ["support_email", "Support email"],
              ["website", "Website"],
              ["working_hours", "Working hours"],
            ].map(([key, label]) => (
              <div className="form-field" key={key}>
                <label htmlFor={`contact-${key}`}>{label}</label>
                <input id={`contact-${key}`} className="field" value={contactState[key as keyof typeof contactState]} onChange={(event) => setContactState((state) => ({ ...state, [key]: event.target.value }))} />
              </div>
            ))}
            <div className="form-field full">
              <label htmlFor="contact-address">Business address</label>
              <textarea id="contact-address" className="field" value={contactState.address} onChange={(event) => setContactState((state) => ({ ...state, address: event.target.value }))} />
            </div>
          </div>
          <p className="muted-cell">These values are read directly by the SCS app Contact Us page. Phone, WhatsApp and email actions remain available there.</p>
          {message && <p className="success-text" role="status">{message}</p>}
          {errorMessage && <p className="error-text" role="alert">{errorMessage}</p>}
          <div className="dialog-foot" style={{ padding: "12px 0 0", border: 0, justifyContent: "flex-start" }}>
            <button className="button" type="button" disabled={busy !== ""} onClick={() => void saveContact()}>{busy === "contact" ? "Saving…" : "Save contact details"}</button>
          </div>
        </div>
      </section>

      {contentState.map((item, index) => (
        <section className="card" key={item.content_key}>
          <div className="card-title">{item.label}</div>
          <div className="card-body" style={{ display: "grid", gap: 14 }}>
            <div className="form-field">
              <label htmlFor={`content-title-${item.content_key}`}>Page title</label>
              <input id={`content-title-${item.content_key}`} className="field" value={item.title} onChange={(event) => updateContent(index, "title", event.target.value)} />
            </div>
            <div className="form-field">
              <label htmlFor={`content-body-${item.content_key}`}>Page content</label>
              <textarea id={`content-body-${item.content_key}`} className="field" rows={9} value={item.content} onChange={(event) => updateContent(index, "content", event.target.value)} />
              <span className="muted-cell">Separate sections with a blank line. For FAQ-style pages, put the question on the first line and the answer on the next line.</span>
            </div>
            <button className="button" type="button" disabled={busy !== ""} onClick={() => void saveContent(index)}>{busy === `content-${index}` ? "Saving…" : `Save ${item.label}`}</button>
          </div>
        </section>
      ))}
    </div>
  );
}
