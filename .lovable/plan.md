# Patient Portal — Baashen Medical Complex

## Approach

The project already has a rich backend (patients, appointments, doctors, invoices, lab_reports, prescriptions, radiology_reports, patient_visits, patient_medications, patient_allergies, notifications, profiles, user_roles). We will **reuse the existing schema**, add only what's missing, and layer a new patient-facing portal on top — kept separate from the public marketing site.

Because the full spec is ~13 screens, we ship in three phases in this same conversation. Each phase is verifiable on its own.

---

## Phase 1 — Auth + Portal Shell + Dashboard (this turn)

### 1. Auth
- Enable Email/Password + Google + Apple (managed) via `configure_social_auth` (`providers: ["google","apple"]`).
- Extend the existing `profiles` table with patient-facing columns: `national_id`, `phone`, `date_of_birth`, `gender`, `preferred_language`, `emergency_contact_name`, `emergency_contact_phone`, `insurance_provider`, `insurance_policy_no`, `avatar_url`, `dark_mode`, `notification_prefs jsonb`.
- Auto-create profile on signup via `handle_new_user()` trigger on `auth.users`.
- Link profile → patients: add `patients.profile_id uuid references profiles.id unique` so a signed-in user maps to their patient record; server functions look up the patient by `profile_id`.
- Add helper `get_my_patient_id()` (SECURITY DEFINER) to resolve current patient.

### 2. Routes
```text
/auth                              (public — login/signup, glassmorphism card)
/auth/reset-password               (public — recovery form, mandatory)
/_authenticated/portal             (layout — sidebar + topbar; managed gate already handles redirect)
/_authenticated/portal/            (Dashboard: Welcome, Health Summary, Quick Appointments, Active Doctors, AI Summary card, Notifications preview)
```

Portal routes are separated from the marketing site so `/` stays public.

### 3. UI System
- New tokens in `src/styles.css` for the portal palette (Primary `#0F6CBD`, Secondary `#34C8FF`, Accent `#00B8D9`, Background `#F8FBFF`).
- Glassmorphism card + soft-shadow + 24px radius utilities added as CSS `@utility`.
- Cairo (AR) / Work Sans (EN) already loaded; reuse.
- Shared components: `PortalShell` (sidebar + topbar + content), `GlassCard`, `StatTile`, `AppointmentCard`, `DoctorCard`, `SectionHeader`, `SearchBar`, `AIChatBubble` (Floating FAB — UI only in Phase 1, wired in Phase 3).

### 4. Server functions (Phase 1)
- `getMyProfile`, `updateMyProfile`
- `getDashboardSummary` → returns `{ profile, next_appointment, upcoming_count, active_medications_count, unread_notifications, recent_lab_stats, active_doctors[] }`

All under `src/lib/portal/*.functions.ts` with `.middleware([requireSupabaseAuth])`.

### 5. Verification
- `tsgo` clean, `bun run build:dev` succeeds.
- Playwright: navigate `/auth` → sign up → land on `/portal` → see dashboard.

---

## Phase 2 — Records, Appointments, Doctors, Labs (next turn)

- `/portal/book-appointment` — calendar + doctor cards + slot picker (reads `availability`, writes `appointments`).
- `/portal/doctors` + `/portal/doctors/$id` — grid + doctor profile.
- `/portal/appointments` — my upcoming/past appointments.
- `/portal/medical-records` — timeline (visits, prescriptions, allergies, medications, surgeries, vaccinations).
- `/portal/laboratory` — charts (Recharts) + normal ranges + PDF download link from `lab_reports.file_url`.
- `/portal/radiology` — same pattern from `radiology_reports`.
- `/portal/prescriptions` — from `prescriptions` + `patient_medications`.

---

## Phase 3 — Insurance, Invoices, Payments, Notifications, Profile, AI Assistant (final turn)

- `/portal/insurance` — from profile insurance fields + `patients.insurance_*` if present.
- `/portal/invoices` + `/portal/payments` — from `invoices`. Payment buttons UI-only (Apple Pay / Google Pay / Visa / Mastercard) — real payment integration will require enabling Stripe/Paddle in a separate ask.
- `/portal/notifications` — from `notifications`.
- `/portal/profile` + `/portal/settings` — edit profile, language toggle, dark mode, notification prefs.
- AI Assistant FAB wired to Lovable AI Gateway (`google/gemini-2.5-flash`) with streaming; system prompt grounded in the current patient's summary; conversation stored in a new `ai_conversations` + `ai_messages` pair.

---

## Technical notes (for reference)

- Portal design tokens live in `src/styles.css` scoped under `.portal-root` so they don't override the marketing site.
- `PortalShell` uses shadcn `Sidebar` with `collapsible="icon"` and highlights active route via `useRouterState`.
- Loader pattern: `context.queryClient.ensureQueryData(dashboardQueryOptions)` + `useSuspenseQuery` in the component; every portal route has `errorComponent` and `notFoundComponent`.
- Payment buttons in Phase 3 are visual only until Stripe/Paddle is enabled — we will ask before charging real money.
- Apple sign-in uses the managed OAuth path; the user does not need Apple Developer credentials for it to appear in the UI. If it fails at runtime we'll flag BYO Apple credentials.

## Out of scope for now

- Real payment processing (needs `enable_stripe_payments` / `enable_paddle_payments` + Pro plan — will offer after Phase 3).
- Face ID / Fingerprint / Passkeys (buttons will be visual only — real WebAuthn can be added later).
- Native mobile app.
- Editing marketing site pages (this is additive only).

Approve to start Phase 1.
