# MMVerse · Skin & Laser Clinic OS

A React + TypeScript clinic demo with a simulated entry screen, a shared application shell, and a connected operational Dashboard. Existing local demo records are migrated without clearing browser storage.

## Run

```sh
npm install
npm run dev
```

Open **http://localhost:5173/**. Choose **Enter Demo** without credentials, or enter a valid email and a password of at least six characters to simulate sign-in. The seeded clinic day is **23 October 2026**, in **Asia/Kolkata**. Use the Dashboard date control to inspect other days.

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

## Completed in this phase

- Minimal branded sign-in/demo entry, password visibility, validation, remember-me, and locally persisted Clinic Owner, Doctor, Receptionist and Laser Technician preferences. Passwords are neither persisted nor transmitted.
- Grouped navigation with persistent collapse preference, active routes, collapsed tooltips, clinic display, global patient/module search, selectable notifications, quick create, role switcher, profile menu, sign-out, and five-item mobile navigation with a More drawer.
- Eight owner Dashboard KPIs calculated from shared records, with query-based filtered navigation. Role-specific dashboards omit unrelated actions and financial details.
- Searchable treatment queue with status and treatment filters, patient/course drawers, check-in, consent-reviewed session start, completion, confirmed cancellation and rescheduling. Conflict detection checks overlapping patient, clinician, technician, room and machine reservations.
- Quick-create patient, appointment, simulated skin scan, reviewed treatment plan, session and simulated payment forms. Invoice payments reconcile outstanding and collected values. Session completion updates linked appointments and course progress.
- Upcoming appointments, due follow-ups, overdue patients, simulated equipment availability, expiring packages and recent activity. Revenue and distribution charts derive from actual demo records and respond to date controls.
- Working module pages for all 20 routes, preserving patient profiles, local record workflows, inventory updates, billing actions, settings, exports and reset confirmation.
- Lazy-loaded pages, loading skeletons, empty and validation states, keyboard-accessible modal focus management, toast feedback, and responsive agenda rows without wide queue tables.

## Organization

- `src/App.tsx`: route and session coordination
- `src/auth.ts`: demo role preferences and presentation rules
- `src/layouts/Shell.tsx`: shared desktop/mobile shell and panels
- `src/pages/`: entry, Dashboard, patients, appointments, record modules, reports and settings
- `src/features/`: treatment queue, quick-create forms, patient and course drawers
- `src/components.tsx`: reusable UI and dialog keyboard behavior
- `src/data.ts`: typed records, seeds, versioned migration and persistence
- `src/store.tsx`: shared clinic state and activity feedback
- `src/services.ts`: date handling, financial calculations, conflict detection and linked session completion
- `src/styles.css`, `src/workspace.css`: retained master styles and this phase’s responsive layouts

## Demo boundaries and verification

All records are fictional. Authentication and role rules are browser-local presentation behavior, not production security. Equipment availability, scans, integrations and payments are simulated. No money is transferred, no messages are sent, no devices are connected, and no diagnosis or prescription is generated. Later-phase modules retain shared record workflows rather than comprehensive specialty screens, document signing, a full accounting ledger or a production audit system. Please use fictional information only.

Vitest and Testing Library cover login validation, password visibility, role adaptation and persistence, all module routes, KPI/date navigation, check-in, consent-reviewed session start, rescheduling, all six quick-create forms, booking conflicts, patient search, notifications, sign-out, invoice reconciliation, course progression and data migration. Responsive CSS covers 320px through desktop sizes. Current Chromium browser checks and screenshots cover the six requested viewport widths; see artifacts/audit/RESULTS.md for the latest verification.

## Patients module

`/patients` now provides the patient directory, with normalized name/ID/mobile search, status/treatment/doctor/next-visit filters, sorting, pagination, reset and mobile patient cards. Next sitting, active-course counts and outstanding balances are derived from the shared records.

`/patients/:patientId` is the Patient 360 workspace used by the directory, search, queue, appointments and course links. Its ten sections cover Overview, Clinical History, Skin Analysis, Treatment Courses, Sessions, Photos, Appointments, Consents & Documents, Packages & Payments and Activity. The identity and course context stay visible in the sticky section navigation. A missing ID produces a helpful recovery page.

The reusable registration/edit form includes a stable generated ID, DOB-derived age, contact and emergency details, referral and doctor assignment, communication preference and consent status. Duplicate mobile/email matches require explicit review before creating a separate patient; opening a match reuses the existing patient. Editing preserves IDs and linked record names. Archiving retains all care and financial history and requires confirmation.

Patient quick actions prefill and lock the same patient ID for appointments, consultations, scans, plans, sittings, follow-ups and payments. A completed sitting updates the linked existing session, appointment and course instead of creating another patient. Profile changes and photos persist in the browser. Photo records require consent, accept JPG/PNG/WebP files under 500 KB, provide storage error feedback and require confirmation before deletion. No real signature is collected, no image analysis is performed, and no data is sent to a backend.

Additional patient tests cover registration validation and cancellation, duplicate review, demographic edits, combined filters, pagination, all profile sections, all seven action prefills, linked clinical/financial updates, reviewed alerts, archival and photo consent/deletion. Patient layouts and workflows have since been verified in Chromium; see artifacts/audit/RESULTS.md.
## Dedicated Skin Analysis module

The existing shell now routes `/skin-analysis` to a searchable, date/status/patient-filtered scan library, with mobile scan cards. `/skin-analysis/new` provides a four-step capture flow; `/skin-analysis/:scanId` opens the source report; `/skin-analysis/:scanId/review` records clinician observations, recommendations, status and review history; `/skin-analysis/:scanId/edit` updates the same saved draft. `/skin-analysis/compare` compares baseline and follow-up captures of the same patient and area in date order. Patient 360 scan links and quick-create use these same canonical records.

The capture flow reuses patient registration (including duplicate warnings), supports fictional PDF/JPG/PNG/WebP uploads with original-file previews, view labels and removal, device metadata, optional supplied measurements, consent and patient-scoped course links. Each upload is limited to 650 KB; a capture allows eight attachments and 2 MB total for browser storage. Drafts may be incomplete; review submission requires linked patient, device/date metadata, source files and consent. Simulate device import explicitly creates labelled demonstration assets and values; it never connects or syncs a real device. New uploads never generate measurements.

Seeded original images are illustrative SVG face maps, explicitly labelled as demonstration captures rather than patient photographs. Each supplied index is labelled demonstration data. Missing measurements remain absent. Comparisons use common available measures only, preserve original image aspect ratios, show neutral numerical differences and offer mobile tabs/swipe. Clinician progress notes save source scan IDs and a metric snapshot to the shared patient's Clinical Documents and activity timeline. Doctor and Clinic Owner can record reviews; technicians can prepare captures. These remain demo UI preferences, not access-control security.

Additional automated checks cover canonical scan updates, migration, metric availability, same-patient/area/date comparison constraints, upload validation/removal, consent, draft saving, clinician review/history, library search/status/date filters, report/profile navigation, progress-note persistence and technician read-only review. Browser visual verification was unavailable because no browser surface is connected; responsive layouts are implemented but pixel-level 320 px checks remain unverified.

## Consultation, catalogue, proposals and courses

The shared shell now has dedicated `Consultations`, `Treatment Catalogue` and `Treatment Plans` screens. Consultations open at `/consultations/:consultationId` (or `/consultations/new`) and retain the same patient ID, clinician-entered concerns/history/examination/assessment/reactions, demo images and proposed decision. Drafts can be resumed; submission validates the clinical record and creates an Awaiting Review state. Explicit clinician review records the reviewing doctor and note. No assessment, recommendation or treatment decision is generated.

The catalogue seeds ten configurable treatments and supports search, category/status filters, full detail drawers and create/edit forms. Duration, interval, count, prices, validity, demo machine compatibility, required documentation and consent can be configured. Inactivation requires confirmation and preserves historical clinical and price snapshots. These defaults are fictional clinic configuration, not universal medical guidance.

`/treatment-plans/new` builds a proposal from the same patient's consultation. The plan stores a snapshot of clinician decisions and price configuration. Individual totals equal session price times approved count. Package totals equal reference package price divided by reference package sessions, times the approved count, rounded to INR. Draft, Awaiting Approval, Approved, Declined and Converted to Course states have explicit transitions. Approval requires a reviewed source consultation, active treatment, valid configuration and clinician confirmation; declined proposals can be revised. Conversion is idempotent and creates exactly one course and one pending demo invoice. No payment is collected automatically.

`/treatment-plans/courses/:courseId` presents configuration, progress, recommended dates, validity, live invoice balance, remaining treatment value and a horizontal/vertical journey timeline with related records. Pause/resume, cancellation and completion require a clinician reason. Cancellation retains completed care and invoices while cancelling uncompleted visits/session records. Outstanding balances remain until an explicit linked payment; no refund is created automatically. Final review and course-linked follow-up actions are working. Course booking and follow-up quick forms retain the course ID.

The existing `records['Treatment Plans']` remains the canonical course collection used by patient profiles, scans, schedules, billing and analytics. New approval proposals live in `records['Plan Proposals']` so drafts never count as active courses. Versioned enrichment preserves existing course IDs, appointments and patient records. Session completion advances the same course once, updates its next recommended date and exposes live payment balance; cancelled/rescheduled visits and inactive courses do not consume sessions. Catalogue edits do not change saved estimates. All persistence remains browser-local demo storage.

Additional unit and UI tests cover draft resume, validation, review and approval/decline transitions, cross-patient source rejection, both pricing modes, immutable quote configuration, single-course conversion, invoice balances, inactive-course guards, catalogue editing, course confirmation flows and navigation among consultation, patient, plan and course screens. Browser visual checks require a connected browser; DOM tests do not establish pixel-level responsive results.

After the last sitting, completed session progress is retained independently from clinician completion confirmation, final review and payment state. The course detail supports explicit completion confirmation without clearing an unpaid balance. The assigned doctor and technician from the approved plan prefill course bookings.

## Sittings & Sessions

`/sittings-sessions` is the dedicated session queue, with Today, Upcoming, In Progress, Awaiting Review, Completed, Cancelled and No-show views. Search and date, status, treatment, machine and technician filters operate on the canonical shared records. Patient/course links, dashboard actions and patient quick actions open the same session at `/sittings-sessions/:sessionId`; the former record-list URL `?record=...` also redirects there.

The four-step recording workspace covers preparation/consent, device documentation, procedure observations/images, and clinician review/next steps. It retains patient alerts, history, previous reactions, active course/package context and previous-sitting comparisons. Drafts, uploads and audit events persist locally. Original images are displayed with their aspect ratios intact. Only fictional JPG/PNG/WebP images are accepted, up to 650 KB each, eight files and 2 MB per session.

Machine settings start empty. Existing equipment records contain no verified manufacturer parameter schemas, so a Doctor or Clinic Owner must use **Configure fields & units** to enter the source, labels, units and required fields from clinic-verified documentation. This does not create hardware specifications, operating ranges, recommended settings or a device connection. Parameter changes invalidate prior approval; configuration changes require fresh review. Historical records without structured settings explicitly say they are unavailable. Never substitute demo values for clinical decisions.

Lifecycle: Scheduled → Checked In → In Preparation → In Progress → Awaiting Review → Completed. Preparation, consent and configured clinic checks gate starting; procedure documentation and reaction assessment gate review; a Doctor/Clinic Owner review and explicit confirmation gate completion. Recorded adverse reactions create a linked clinician-review follow-up and retain the escalation history. Cancel/no-show/reschedule actions retain an audit trail and never deduct a sitting. Receptionists can manage operational actions while clinical documentation is read-only. These remain demo interface rules, not production authorization.

Completion writes one deterministic ledger entry per appointment, with another guard against consuming the same course sitting twice. It increments the shared course, updates package-unit snapshots and the patient activity timeline, and creates/updates relevant follow-ups. Repeated completion is a no-op. Payments and invoice amounts are unchanged: no automatic completion charge or duplicate collection is created. Next-sitting booking checks resource conflicts, keeps the same patient/course, prevents duplicate bookings and copies no settings. Recommended dates are clinician-entered; the approved course interval is shown only as reference.

Verification includes service tests for lifecycle/consent/configuration guards, single deductions, duplicate completion protection, adverse-reaction escalation, follow-ups, package balances, cancellation/no-show/rescheduling and next-sitting booking. UI tests exercise the complete recording flow, previous-parameter comparison, queue filters, draft reload, upload errors, device configuration, confirmations and patient/course navigation. Headless Chrome layout checks for this module cover 320, 390, 768, 1024 and 1440 px with no horizontal viewport overflow; this supersedes the earlier phase's unavailable-browser note for the new session screens.

## Appointment Calendar & Follow-up Centre

`/appointments` now provides Day, Week, Month and 14-day Agenda views, period navigation, an operating-day Today button, date selection, patient search and doctor/technician/room/machine/status filters. On mobile, the selected date always uses agenda cards with a seven-day date strip. Booking details open in a drawer with patient, course, sitting, duration, resources, booking source, notes and history; existing `?record=...` links remain supported alongside `?appointment=...`.

The shared three-step booking form is used by the calendar, quick create, patient/course actions and follow-up scheduling. It supports ordinary bookings, walk-ins, follow-up visits, editing/rescheduling and waiting-list allocation. Availability is checked before review and again on save, with conflicting resource names, appointment IDs and occupied times. Available alternative times require an explicit selection. Maintenance/unavailable equipment and machines absent from the treatment's configured compatibility list are rejected. Waiting-list entries reserve no resources and cannot open a clinical session until allocated.

Edits retain the appointment ID and synchronize the linked session's date, time, doctor, technician, room and machine. Rescheduling invalidates preparation/approval checks; changing a machine clears its previous parameters. Clinical work that has started is edited through Sittings & Sessions. Cancellation and no-show actions require a recorded reason and confirmation, retain history, and consume no package unit or payment. The same availability rules also guard session-linked next-sitting bookings and dashboard rescheduling.

`/follow-ups` provides Due Today, Due Soon (seven days), Overdue, Missed Appointment, Post-treatment Review, Reaction Requiring Review, Package Nearing Expiry (fourteen days), Course Completion and Inactive Patient categories. Generated work uses stable IDs in the same canonical Follow-ups collection, preserving contact history and explicit date overrides. Missed-appointment work resolves when its source no longer requires attendance review. Dashboard metrics and patient overdue status use the same records; outstanding course-final-review work can therefore add an overdue patient compared with the earlier fixture totals.

Each follow-up workspace shows the last completed sitting, interval-based suggested date, clinician-entered recommended date, actual booking, assigned employee, contact preference/consent, outcome, history and next action. Clinicians can record a date override. Call actions open an optional phone dialler and require an actual documented outcome. WhatsApp actions provide an editable, persistable, copyable draft only; routine text omits IDs, treatment and medical details. No message is sent and delivery is never assumed. Contacted, declined, escalated and resolved outcomes retain a timestamped employee/note history. Reaction reviews require clinician resolution, and declining contact does not clear the review requirement. Routine drafts remain paused for paused courses or unresolved reactions.

Dates use calendar-date strings with Asia/Kolkata display. The demo operating day remains **23 October 2026** to match the shared fixture and session lifecycle. Reference-date filters simulate due-date views without changing the operating day or prescribing a treatment interval.

Verification covers create/edit, overlap boundaries and every shared resource, compatibility/maintenance restrictions, available alternatives, waiting-list allocation, cancelled/no-show/rescheduled identity and package invariants, interval suggestions/overrides, derived categories, contact outcomes, private drafts, clinician escalation and next-appointment links. Headless Chrome also exercises booking → reschedule → cancel, waiting-list allocation, linked appointment navigation, draft persistence and doctor review, with mobile booking forms checked at 320 px. Calendar and follow-up layouts are checked at 320, 390, 768, 1024 and 1440 px.

## Equipment, maintenance, rooms and inventory

Dedicated operations screens reuse the existing shell, tokens and browser-local shared store:

- `/machines-equipment`: searchable/filterable directory, create/edit, clinic treatment compatibility and confirmed availability changes. `/machines-equipment/:machineId` provides Overview, Schedule, Session History, Usage, Maintenance and Documents. Legacy dashboard `?record=...` links resolve to the same asset.
- `/maintenance`: assigned tasks, priorities, due dates, service documentation and explicit clearance. In-progress / awaiting-clearance tasks block new bookings. Active tasks cannot be cancelled, moved to another asset or reset to Scheduled to bypass clearance. Restoring availability requires every active task to be cleared. Existing bookings remain visible for operational review.
- `/rooms-resources`: four seeded exclusive booking rooms, seating capacity, home equipment, availability, today's assignments and room conflict review. Renaming a room retains appointment/session references. Unavailable rooms are rejected by shared booking validation.
- `/inventory`: twelve fictional batches with SKU, expiry, stock/minimum, units, INR purchase/selling prices and supplier. Search, category/stock/expiry filters, sorting, product forms, stock in/out, session usage and permanent movement history operate on the same records. Dashboard notifications include low-stock and expiry alerts.

Five fictional asset records include manually maintained service dates and availability. Utilisation is derived from actual appointment durations against an explicitly configured planning capacity, excluding cancelled/rescheduled/no-show/waiting-list visits. Downtime uses recorded service start/clearance windows. Session parameter values and shot counts appear only when documented; machine runtime and telemetry remain unavailable. No real hardware connectivity is implied. Asset documents accept fictional PDFs or PNG/JPEG/WebP images, with local file-size limits and original-aspect preview.

Every accepted stock adjustment requires a positive quantity, reason and confirmation, updates the batch and appends a retained movement. Negative stock is rejected. Expired batches cannot be consumed during a session. The session procedure step also provides **Record consumable usage**, linked to the same patient/session and its audit timeline. Confirmed usage deducts immediately; draft saves and session completion do not deduct it again. Free-text consumable notes do not silently change stock. Retried movement IDs are idempotent. Session completion's package deduction remains separate from consumable stock.

Operations enrichment preserves canonical patient/course/appointment/device IDs and custom product records, with no production authentication or external integrations. Alerts and booking dates use the established demo operating day, **23 October 2026**, and IST display. Changes persist in the existing `mmverse-v1` browser-local record.

Verification adds 14 operations unit/UI tests for clearance, booking blocks, room conflicts, stock validation/history, migration, compatibility and session usage. The complete 122-test suite passes. Headless Chrome exercised maintenance blocking, documented restoration, stock in/out, session-linked usage and retained movements. All five new screen layouts were checked at 320, 390, 768, 1024 and 1440 px with no horizontal page overflow. QA screenshots and flow evidence are in `artifacts/operations`.

## Packages, invoices and payments

The finance workspace uses the existing shared patient/course records and a structured browser-local invoice/payment ledger:

- `/packages-billing`: billing overview with date/status filters, issued invoice values, actual net collections, receivables, package sales before tax, overdue counts, draft projections and recent transactions.
- `/packages` and `/packages/:packageId`: configurable package catalogue, details and patient purchase balances. Matching offers can be selected when an approved plan is converted. Treatment, area and session count must match the clinical approval. Purchase price, validity and terms are retained; later catalogue edits do not change a purchase.
- `/invoices`, `/invoices/new`, `/invoices/:invoiceId` and `/invoices/:invoiceId/edit`: itemised drafts, explicit issue/void confirmation, immutable issued records, patient/course links, receipt/refund history and an A4 print view using the browser's Print action.
- `/payments`: filtered, retained receipts/refunds, account deposits and transaction details. Quick create, patient profiles and invoice details use the same payment form. Patient-context actions preserve the locked patient and prefill an eligible linked invoice.

Invoice lines support consultation, procedure, package, product and deposit charges, quantities, unit prices and INR discounts. Invoice-level discounts reduce applicable tax bases proportionally. Taxes are editable clinic configurations, applied explicitly per line and retained as invoice snapshots; no universal GST applicability/rate is assumed. Product charges do not silently change stock. Issuing an invoice creates a receivable, not a payment.

Receipts support Cash, UPI, Card, Bank Transfer and Other, partial/full amounts, dates and fictional references. The confirmation summary shows the patient, allocation, amount and effect on balance. Positive amounts, invoice ownership, dates, references, balance limits and duplicate requests/references are validated. On-account deposits remain visible as unallocated patient credit and do not silently settle invoices. Refunds refer to an original receipt, cannot exceed its unrefunded value and remain separate immutable ledger entries. Applied receipts must be refunded before an invoice can be voided. No money is sent, processed or transferred, and invoices are not emailed externally.

`features/finance/ledger.ts` supplies the common calculations used by Billing, Dashboard collections/revenue trend, Reports, patient balances and course balances. Date filters distinguish invoice issue dates from receipt/refund dates and calculate balances as of the period end. Status filters restrict collections to the matching invoice cohort; All includes unallocated deposits. Draft projections remain separate from issued amounts and actual collections. Legacy invoice/payment IDs and the existing fixture's INR 42,000 collections / INR 24,000 outstanding are preserved.

Only qualifying session completion consumes a sitting and updates the course/package session ledger. Payments/refunds do not change consumed sessions; completing or retrying a session does not add another payment or charge. Patient package cards show purchased, consumed, remaining, price, applied net payments, outstanding, expiry and active/expiring/exhausted/expired status from the same course and invoices.

Finance verification adds 16 unit/UI tests covering calculation/discount/tax snapshots, drafts versus issue, partial/full settlement, refunds, deposits, duplicates, date totals, package conversion and session consistency. Headless Chrome additionally exercised draft creation → issue → partial/full receipt → refund, checked linked balances and unchanged sitting counts, verified date filtering and generated a one-page A4 print result. All finance routes, patient balance cards and the payment form were checked for horizontal overflow from 320 through 1440 px. Screenshots and workflow evidence are in `artifacts/finance`.

## Enquiries CRM and traceable analytics

`/leads-enquiries` now provides a dedicated nine-stage pipeline: New Enquiry, Contacted, Consultation Booked, Consultation Completed, Treatment Proposed, Package Purchased, Follow-up Required, Won and Lost. Desktop supports a horizontally scrollable board inside the workspace and a list toggle; tablet/mobile use structured list cards. Search normalizes mobile numbers. Source, employee, stage and next-contact filters update cards, counts and estimated pipeline value. The drawer supports create/edit, recorded stage changes, confirmed close/reopen, manually logged contact outcomes, next follow-up dates, patient links and an audit timeline. CRM stage changes do not fabricate clinical appointments, payments or purchases.

Convert to Patient prefills the enquiry's name/mobile/email, validates new-patient DOB/age, doctor, communication preference and consent fields, and links the canonical patient ID back to the enquiry. Matching mobile/email records must be reused; changing conversion fields cannot bypass an existing match on the original lead. Archived matches require restoration through Patients. Repeated conversion returns the same patient, and existing clinical/contact records are not overwritten. Linked patients can book a real shared appointment from the drawer; the saved appointment identity is retained on the lead. Contact logging never sends a message or places a call.

`/reports-analytics` replaces the former single chart with Clinical Operations, Financial Performance, Resource Utilisation and Patient Retention workspaces. Date presets, explicit ranges (up to ten years), prior equal-period comparisons, source-record drill-down, chart legend/bar interaction and visible-data CSV downloads operate on the shared store. Recharts plots contain only aggregated operational records. Each chart exposes accessible value rows, units, dates and an honest no-activity state. There is no external analytics service or telemetry source.

The calculation rules live in `features/analytics/selectors.ts`:

- Completed sessions use sitting dates. Cancellation/no-show counts use appointment dates; no-show rate excludes cancelled, rescheduled and waiting-list records from its denominator. Course completion uses courses started in the range, current confirmed completion status and the clinical last-completed business date (audit timestamp only as fallback). Recommended follow-up dates define the follow-up cohort; overdue patients are unique open patients in that cohort at period end. These are current records grouped by dates, not a historical status-replay engine.
- Financial calculations reuse the invoice/payment ledger. Issued amounts follow invoice issue dates; net collections follow receipt/refund dates and include unallocated deposits. Treatment/package charge breakdowns are after discounts and before tax. Outstanding is the invoice-issue cohort balance at period end. Draft projections remain separate from issued charges and collected cash. CRM estimated value is never included as actual financial revenue.
- Machine/room planning utilisation uses eligible booking durations over configured minutes per selected calendar day. Cancelled, rescheduled, no-show and waiting-list bookings are excluded. Unknown durations add no invented minutes; overlapping bookings are not clamped away. Machine capacity is the existing per-machine configuration; room capacity is an editable, persistent planning setting (480 minutes/day in the fictional seed). Recorded maintenance downtime clips closed service windows to IST boundaries and merges overlapping windows on the same asset. Open windows are identified separately and contribute no assumed hours.
- Completed visits deduplicate appointment-linked session records. Repeat visitors require at least two completed visits within the selected period. Inactivity is a period-end snapshot using Follow-up Centre rules, excluding patients registered after that date. Package renewals are explicitly labelled as a repeat-issued-course-purchase proxy for the same patient/treatment/area after prior completion or expiry. Follow-up conversion requires an actual eligible linked appointment. Enquiry conversion requires an actual patient link and recorded conversion date, regardless of a staff-entered Won stage.

CSV downloads include the visible category's KPI values/definitions, plotted series, displayed breakdowns and currently visible source rows, with the visible comparison figures when enabled. Source inspectors can export their records separately. Downloads use client-side UTF-8 CSV, quoted fields, retained numeric negatives and protection against spreadsheet formula text; no server upload or external delivery occurs.

Verification adds 27 CRM/analytics unit/UI tests covering validation, duplicate protection, patient reuse/registration, contact and stage persistence, clinical denominators, finance reconciliation/refunds, business-date course completion, booking capacity, merged downtime, retention/renewal rules, date-driven series, chart/source navigation and CSV serialization/download. Headless Chrome additionally exercised enquiry creation → contact → stage change → patient conversion, existing-patient reuse, a real CSV download, chart-bar source inspection and empty-range filters. All four report tabs, the lead board/list, drawer and conversion form were checked at 320, 390, 768, 1024 and 1440 px without horizontal page overflow. Evidence is retained in `artifacts/crm-analytics`.

## Administration and global interactions

`/staff-roles`, `/clinic-settings` and `/integrations` use the existing shell and local clinic store. Staff creation/editing, availability and the four-role presentation guide are implemented. Active staff are reused by booking and clinical selectors; availability validation blocks new assignments to unavailable staff. Simulated roles change navigation and actions and provide no production authentication or security boundary.

Clinic settings have 13 separate sections with validation, dirty-state prompts, save/cancel and confirmed factory-default drafts. Treatments, machine schemas, rooms, duration defaults, package validity, editable reminder/consent templates, INR presentation, tax configuration and notification preferences use their operational records. Changing defaults preserves approved course intervals and historical session documentation. Templates are fictional examples, not signed consent or automatically prescribed protocols.

Global search supports Ctrl/Command+K, categorized patient/ID/mobile, course, appointment and machine results, source-record links, clearing and empty states. Notifications derive from follow-ups, appointments, course expiry, maintenance and stock records; read/dismiss preferences persist, and changes to the underlying alert can surface a fresh unread item. Quick create opens the shared patient, appointment, scan, plan, sitting, follow-up and payment forms with current patient/course/invoice context when available.

Integration cards explicitly distinguish Demo Simulation, Not Connected and Future Integration. Their tests and imports are local simulations; no external device, messenger, payment gateway or calendar is connected. Reset requires explicit confirmation and replaces only the MMVerse clinic record (`mmverse-v1`), retaining the current demo session and unrelated browser data.

Administration verification: all **186 tests** pass across the application; lint, typecheck and production build pass. Browser checks cover all 13 settings sections, staff/integrations and global panels at 1440, 1024, 768, 390 and 320 px: **90 layout checks**, no horizontal viewport overflow and no page errors. Screenshots and browser flow results are in `artifacts/admin/`.


## Quality and design audit

The existing application now uses shared colour, contrast, status, header, touch-target and modal primitives. The audit also corrected course-expiry data, immediate persistence, staff selectors and booking-step validation while retaining the operational routes. Browser verification covers 32 main/detail routes at six widths plus tabs, forms and global panels: 582 layout/state checks. See [audit results](artifacts/audit/RESULTS.md) and the recorded A-D browser flows. Final regression results are in `artifacts/audit/tests-final.json`.
