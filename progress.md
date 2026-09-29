# SCS Admin Panel — Progress

**Status:** Implemented; lint, TypeScript, and production build pass. Live Supabase CRUD smoke tests have not been run.

## What is implemented

### Authentication and authorization

- Email/password sign-in and sign-out use Supabase Auth.
- `/admin` and its sections are protected on the server. The current Auth UUID must match `profiles.id`, and the profile role must be `admin`.
- Server actions repeat the admin check; client-side visibility is not the authorization boundary.
- Ordinary reads and writes use the signed-in user's Supabase session and existing RLS.
- Creating or deleting Auth users uses a `server-only` Supabase Admin client, only after checking the caller is an admin. The service-role key is read from `SUPABASE_SERVICE_ROLE_KEY` and is never a `NEXT_PUBLIC_` variable.
- The signed-in admin cannot change their own role or delete their own account. The panel does not configure the first admin; that profile must be promoted manually in Supabase.

### Admin sections

- **Dashboard:** queries live profile, technician, service, and booking counts; recent profiles/bookings; booking status counts; and booking totals grouped by the stored payment status.
- **Users & profiles:** search, role filtering, pagination, details, address/booking history, profile editing, role changes, Auth account/profile creation, and Auth account deletion. Email is an Auth field and is not written to `profiles`.
- **Technicians:** create standalone technician records or link an existing customer/technician profile; inspect details and booking history; edit the existing technician fields; and delete a technician record. Technician role remains on `profiles.role`, not in `technicians`.
- **Services:** create, view, edit, and delete records using the supplied service fields, including rating, booking count, tint, color, active state, and sort order.
- **Bookings:** inspect linked profile/service/technician data; edit date, time, technician assignment, address, notes, and amount fields; cancel in the statuses already handled by the app; and delete a booking.
- **Payments:** read-only view of payment data stored on `bookings`; no standalone payments table was supplied.
- **Reviews:** view, edit rating/comment/tags, and delete.
- **Notifications:** create in-app notification rows; view/edit, mark read, and delete existing rows. There is no push delivery integration in the schema/project.
- **Addresses:** dedicated add/view/edit/delete screen for saved addresses, with owner profiles looked up using their UUIDs.
- **Settings:** view the current admin's Auth email and profile role/UUID, and edit allowed profile fields without changing the role.

### Expo schema alignment

- Profile upsert sends only `id` and `full_name`; the database default supplies the role for a newly created customer profile, and updates omit `role` to preserve existing assignments.
- Removed the invalid profile email and push-token writes, and stopped reading nonexistent `notifications.booking_id`.
- Address, booking, and review inserts send the authenticated user's UUID in their schema-required `user_id` field.
- Alerts no longer attempt to open a booking because notifications have no booking reference in the supplied schema.

## Schema and safety boundaries

- No database tables, columns, functions, policies, or migrations were added or modified by this implementation.
- `profiles.id` and UUID `user_id` references are not joined to the unrelated integer `users.id`.
- Service IDs remain text; technician, booking, profile, review, notification, and address identifiers use the supplied UUID fields.
- Booking edit leaves `status`, `payment_method`, and `payment_status` unchanged because a complete set of accepted values was not confirmed. The cancellation action uses only its existing supported values.
- Deletes do not manually cascade across tables. Existing foreign-key behavior or RLS can reject a delete; the UI presents the returned error.
- User Auth deletion needs `SUPABASE_SERVICE_ROLE_KEY` in the local server environment. Keep the key private and out of documentation and source control.

## Verification performed

Run from `SCS_Admin_Panel`:

```powershell
npm run lint
npx tsc --noEmit
npm run build
```

All three commands passed after the CRUD updates. The build compiled and generated the App Router pages. `git diff --check` also passed. A live create/edit/delete session against Supabase was not performed, so RLS behavior, foreign-key deletion behavior, and the configured service-role environment still need an operator smoke test.

## Start locally

From this directory:

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`. Configure the public Supabase URL/anon key and the server-only service-role variable as described in [README.md](README.md).
