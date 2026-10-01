import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { BusinessDetailsEditor } from "@/components/admin/business-details-editor";

const CONTENT_KEYS = [
  ["about_us", "About Us"],
  ["help_support", "Help & Support"],
  ["contact_us", "Contact Us"],
  ["service_policy", "Service Policy"],
  ["cancellation_policy", "Cancellation Policy"],
  ["terms_conditions", "Terms & Conditions"],
  ["privacy_policy", "Privacy Policy"],
] as const;

export default async function BusinessDetailsPage() {
  await requireAdmin();
  const admin = createAdminClient();

  const [contentResult, contactResult] = await Promise.all([
    admin.from("app_content").select("content_key, title, content, updated_at").in("content_key", CONTENT_KEYS.map(([key]) => key)).order("content_key"),
    admin.from("contact_settings").select("id, phone, whatsapp, email, support_email, address, working_hours, website").eq("id", 1).maybeSingle(),
  ]);

  if (contentResult.error) throw new Error(`Could not load app content: ${contentResult.error.message}`);
  if (contactResult.error) throw new Error(`Could not load contact details: ${contactResult.error.message}`);

  const content = CONTENT_KEYS.map(([key, label]) => {
    const row = contentResult.data?.find((item) => item.content_key === key);
    return { content_key: key, label, title: row?.title ?? label, content: row?.content ?? "" };
  });

  const contact = contactResult.data ?? {
    id: 1,
    phone: null,
    whatsapp: null,
    email: null,
    support_email: null,
    address: null,
    working_hours: null,
    website: null,
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Business details</h1>
          <p className="subheading">Manage business contact details and the information pages shown in the SCS app.</p>
        </div>
      </div>
      <BusinessDetailsEditor content={content} contact={contact} />
    </>
  );
}
