# SCS Admin Panel

The SCS Admin Panel is a standalone Next.js App Router application for administering the Sunshine Computer Solution mobile app and its Supabase project. It includes a small Supabase migration for Home banner settings and the SCS default service area.

## One-time Supabase migration

Run `supabase/migrations/20261001_home_banner_and_city.sql` once in the Supabase SQL Editor. It creates `app_settings` for the Home banner and changes the default city for newly inserted `profiles` and `addresses` rows to Greater Noida. Existing city values are not overwritten.

The Expo app must also read `app_settings.home_banner_url` to display the custom banner; this admin ZIP does not contain the separate Expo app source.

## Start the panel

From this directory:

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`. The admin workspace is at `/admin`. `/dashboard` redirects to the workspace. Unauthenticated users are sent to `/login`.

## Supabase configuration

Create `SCS_Admin_Panel/.env.local` with the URL and anon key for the **same Supabase project as the Expo app**:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
```

The **Add User** and **Delete User** actions also need the Supabase service-role key:

```dotenv
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Keep that key server-only: do not prefix it with `NEXT_PUBLIC_`, place it in client code, commit it, or paste it into project documentation. The Auth actions verify the signed-in admin before using a server-only Supabase client. Other database operations use the signed-in admin's session and the existing RLS policies.

Admin access is determined by the authenticated user's UUID matching `profiles.id` and `profiles.role` being `admin`. Create or promote the first admin manually in Supabase. The panel does not promote the signed-in admin's own profile role, and it prevents that admin from deleting their current account.

## Admin features

- **Dashboard:** live counts and recent records from Supabase, booking status distribution, and booking totals grouped by the stored payment status. No sample production statistics are used.
- **Users & profiles:** list/search/filter profiles, view profile details, addresses and booking history, edit `full_name`, `phone`, and `city`, change another profile's role (`customer`, `admin`, or `technician`), create an Auth user and profile, and delete an Auth user. Auth email is not stored in `profiles`.
- **Technicians:** add standalone technician records or link a profile, view booking history, edit the existing technician fields, and delete a technician record. A technician record is separate from the profile role; linking a customer profile assigns `profiles.role = technician`.
- **Services:** add, view, edit, and delete services, including service image upload/replace/remove. Images are stored in the existing public `service-assets` bucket; PNG/JPEG/WebP files up to 2 MB are accepted.
- **Bookings:** view booking/customer/service/technician details, edit scheduling, address, notes, technician assignment, and booking amounts; cancel bookings in the states supported by the current action; or delete a booking. Status, payment method, and payment status are not changed by the editor because their complete allowed values are not established here.
- **Payments:** read-only view of the existing payment fields on `bookings`. There is no separate payment ledger table in the supplied schema.
- **Reviews:** view, edit rating/comment/tags, and delete review records.
- **Notifications:** create in-app notification records, view/edit them, mark them read, or delete them. This does not send push notifications; the schema/project has no push delivery API.
- **Addresses:** add, view, edit, and delete saved addresses linked to UUID profiles.
- **Settings:** manage the Home banner image and the signed-in admin profile. Online UPI configuration has been removed from Settings because the current app flow does not use it.
- **Business details:** manage contact details plus About Us, Help & Support, Contact Us, Service Policy, Cancellation Policy, Terms & Conditions, and Privacy Policy. These records are read directly by the Expo app from `contact_settings` and `app_content`.

Tables and UUID links follow the supplied schema. In particular, the legacy `users.id` is an integer and is not treated as related to UUID profile IDs. Services use text IDs; technician, booking, review, notification, address, and profile identifiers use the supplied UUID fields.

## Security and deletion behavior

Protected pages and every mutation check admin access server-side. The panel does not disable RLS or manually delete related records. A delete can be rejected by existing foreign-key constraints or RLS; the panel reports the database error rather than guessing cascade behavior. User deletion uses Supabase Auth Admin server-side, and cannot target the currently signed-in admin.

If a database operation fails with an RLS or missing-column error, check the message against the live schema and the existing policies. Do not make the service-role key public or weaken RLS as a workaround.

## Checks

Run from `SCS_Admin_Panel`:

```powershell
npm run lint
npx tsc --noEmit
npm run build
```

The Expo app is separate and remains at the repository root.
