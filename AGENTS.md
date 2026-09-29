AGENTS.md — SCS Admin Panel

Project

This repository contains the SCS (Sunshine Computer Solution) Admin Panel.

The Admin Panel is a separate Next.js web application for managing the existing SCS mobile application.

The mobile app uses Supabase. The Admin Panel must use the same Supabase project/database.

Core Rules

1. Inspect Before Changing

Before implementing a feature:

Inspect the existing project structure.

Inspect package.json.

Inspect existing configuration files.

Inspect Supabase integration.

Inspect existing database/schema references available in the project.

Inspect existing types and API/service functions.

Understand relationships before writing queries.

Never guess the contents of an existing file.

If an exact existing file is required but its contents are unavailable, ask for the file instead of guessing.

2. Do Not Invent Database Schema

The SCS mobile application already has a Supabase database.

Do NOT create duplicate tables or invent columns.

Before using a table:

Confirm its name.

Confirm its columns.

Confirm primary keys.

Confirm foreign keys/relationships.

Confirm existing status values.

Confirm whether the field actually exists.

If the required schema cannot be determined, stop and ask.

3. Preserve Existing Functionality

Do not unnecessarily modify:

Existing mobile application code.

Existing Supabase schema.

Existing authentication behavior.

Existing API/service logic.

Existing configuration.

Make the smallest appropriate change required for the task.

Technology Stack

Use:

Next.js

App Router

TypeScript

Tailwind CSS

shadcn/ui

Supabase

React Hook Form

Zod

TanStack Query where useful

Recharts for analytics

Lucide React

Use TypeScript strictly.

Avoid unnecessary any.

Architecture

Preferred structure:

app/
├── login/
├── dashboard/
├── users/
│   └── [id]/
├── technicians/
│   └── [id]/
├── bookings/
│   └── [id]/
├── services/
│   └── [id]/
├── payments/
│   └── [id]/
├── reviews/
├── notifications/
└── settings/

components/
├── ui/
├── layout/
├── dashboard/
├── users/
├── technicians/
├── bookings/
├── services/
└── shared/

lib/
├── supabase/
├── queries/
├── mutations/
└── utils/

hooks/
types/

Adapt this structure to the actual project instead of blindly creating every folder.

Authentication

Use Supabase Auth.

Initially support:

Email/password login.

Logout.

Protected admin routes.

Unauthenticated users must be redirected to:

/login

Admin authorization must be enforced server-side.

Do NOT rely only on hiding UI elements.

Use appropriate Supabase RLS and server-side checks.

Security

Security is a priority.

Never expose

SUPABASE_SERVICE_ROLE_KEY

to the browser.

Never put service-role credentials inside NEXT_PUBLIC_*.

Expected public variables:

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

Use server-only environment variables for privileged operations when genuinely required.

Never commit:

.env

.env.local

serviceAccountKey.json

private keys

tokens

passwords

Admin Features

Implement features based on the actual existing SCS database schema.

Dashboard

Show real database information where available:

Total users

Total technicians

Total bookings

Pending bookings

Completed bookings

Cancelled bookings

Revenue/payment information if available

Recent bookings

Recent users

Booking status distribution

Revenue charts if valid payment data exists

Never fabricate production statistics.

Users

Provide:

User list

Search

Pagination

Filters

User details

User addresses if available

User booking history

Account status if available

Only implement block, unblock, or delete if the existing schema and application logic support them.

Technicians

Provide:

Technician list

Search

Filters

Technician details

Services

Availability/status if available

Ratings

Booking history

Verification status if available

Do not invent technician fields.

Bookings

Provide:

All bookings

Search

Status filtering

Date filtering

Booking details

Customer details

Technician details

Service details

Address/location

Payment details

Booking status

Technician assignment/reassignment should only be implemented if supported by the existing schema.

Do not invent booking status values.

Services

If the existing database supports services:

List services

Add service

Edit service

View service

Price

Description

Image

Active/inactive state

Only use fields confirmed from the schema.

Payments

If payment data exists:

Transactions

Payment status

Amount

Booking reference

User

Date

Transaction details

Do not create fake payment records.

Reviews

If reviews/ratings exist:

Review list

User

Technician/service

Rating

Review text

Date

Moderation actions should only be added when supported by the existing backend.

Notifications

If the existing project has notification infrastructure:

Notification history

Create notification

Send notification

Target users/technicians

Status

Do not create a fake notification backend simply to make the UI appear functional.

UI/UX

Create a professional SaaS-style admin interface.

Use:

Sidebar

Top navigation

Responsive layout

Cards

Tables

Search

Filters

Pagination

Modals

Confirmation dialogs

Toast notifications

Skeleton loading

Empty states

Error states

Design should be:

Clean

Professional

Responsive

Easy to navigate

Consistent

Use SCS branding where available.

Avoid unnecessary animations and visual clutter.

Data Fetching

Keep database access organized.

Do not put large Supabase queries directly into every page component.

Use reusable query/mutation functions where appropriate.

TanStack Query can be used for:

caching

refetching

mutations

loading states

error states

Avoid unnecessary duplicate requests.

Forms

Use:

React Hook Form + Zod

Validate:

required fields

strings

numbers

emails

IDs

allowed values

Never trust client-side validation alone.

Error Handling

Every data-driven page should handle:

Loading

Show a meaningful loading/skeleton state.

Empty

Example:

No bookings found.

Error

Show a useful error message.

Do not silently swallow errors.

Do not show fake success messages.

Destructive Actions

For operations such as:

Delete

Block

Deactivate

Remove

Always use a confirmation dialog.

Coding Rules

Prefer const when reassignment is unnecessary.

Use meaningful variable names.

Avoid huge components.

Split reusable UI into components.

Avoid duplicate logic.

Do not add dependencies unless they provide clear value.

Testing

Before claiming a task is complete, actually run appropriate checks.

At minimum where applicable:

npm run lint
npm run build

If TypeScript checking is available, run it.

For implemented functionality, actually test the relevant flow.

Never claim:

"Tested successfully"

unless it was actually tested.

Git

Keep commits focused.

Do not commit secrets.

Before committing, inspect:

git status

and ensure secrets are not staged.

Existing Files

Do not rewrite files unnecessarily.

Before modifying an existing file:

Read it.

Understand its purpose.

Preserve existing behavior.

Make the smallest required change.

Never replace an entire file simply because it is easier.

Supabase Rules

The Admin Panel and SCS mobile app should use the same Supabase backend.

Prefer existing:

tables

relationships

types

authentication

storage

database functions

RLS policies

Do not duplicate existing backend functionality.

If RLS prevents an operation, investigate the authorization design instead of blindly disabling RLS.

Never disable security policies merely to make a feature work.

Development Workflow

For every task:

Step 1

Understand the requested feature.

Step 2

Inspect relevant existing files.

Step 3

Inspect related Supabase schema/references.

Step 4

Plan the smallest implementation.

Step 5

Implement.

Step 6

Run relevant checks.

Step 7

Fix actual errors.

Step 8

Report exactly what changed.

Important Agent Behavior

Do NOT:

Guess existing code.

Guess database fields.

Invent APIs.

Invent relationships.

Create fake production data.

Claim tests that were not run.

Expose secrets.

Disable security to bypass errors.

Rewrite unrelated files.

Change the mobile app unnecessarily.

Add unnecessary dependencies.

If information is missing and is essential to implementation:

Ask the user instead of guessing.

Completion Report

When completing a task, report:

What was implemented.

Files created.

Files modified.

Database changes, if any.

Environment variables required.

Commands used for verification.

Actual test results.

Any remaining limitations.