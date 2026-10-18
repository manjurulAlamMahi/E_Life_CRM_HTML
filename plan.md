# E Life Healthcare CRM — Master Plan

**Version:** 1.0
**Date:** 2026-08-31
**Source of truth:** *E Life Healthcare — CRM System, Complete Requirements & Development Blueprint* (24 sections)

This document is the whole map. Every one of the client's 24 requirement sections is accounted for in the Module Map and assigned to exactly one delivery phase. Nothing in the blueprint is dropped silently — anything deferred is listed in Phase 9 with a reason.

> **Notation:** `§N` always refers to a section of the *client's blueprint*, never to a section of this document. Sections of this plan are referred to by name.

> **Scope:** this is the map, not the implementation detail. Each phase gets its own detailed implementation plan, written immediately before that phase begins, once the preceding phase's outcome is known.

---

## 1. Locked Decisions

| Area | Decision | Reason |
|---|---|---|
| Framework | Laravel 12 (PHP 8.2+) | Client requirement |
| Pattern | **MVC with rich models** | Client requirement |
| Structure | `Backend/` and `Frontend/` split in controllers and views | Client requirement |
| Views | Blade, server-rendered | Client requirement |
| Interactivity | jQuery (AJAX) + Alpine.js | No build step; works on cPanel |
| CSS | Bootstrap 5 + AdminLTE 4 (MIT) | Sidebar/cards/forms ready-made |
| Tables | `yajra/laravel-datatables`, server-side | §14 search/filter/sort; memory-safe |
| Database | MySQL 8 | cPanel standard |
| Cache / Queue / Session | `database` driver | No Redis on shared hosting |
| Hosting | Shared hosting, cPanel | Client requirement |
| Server access | **FTP / File Manager only** | Assume worst case; see Deployment Runbook |
| Language | English UI, BDT (৳) currency | Bangladesh operation |
| Multi-branch | Schema-ready, single branch active | §20 lists it as future |
| Integrations | Deferred to Phase 9 | §16 needs client API accounts |
| Frontend scope | Public QR receipt verification only | Rest of §20's public features deferred |
| Seeding | Every table seeded; production and demo kept separate | Client requirement |
| Testing | Pest, focused on money + permissions | Financial correctness first |

### Rejected, and why

- **Vue 2** — reached end-of-life 31 Dec 2023 and receives no security patches. This system stores patient medical documents and payment records. Alpine.js covers every interactive need in the blueprint (live payment totals, modals, timeline toggles) at roughly 15KB with no build step. If Vue is later required, use Vue 3.
- **Filament or any admin scaffold** — client specified hand-built Blade.
- **Redis, Horizon, persistent queue workers** — unavailable on shared hosting.

---

## 2. Shared Hosting Constraints

These are not footnotes. They change how several features must be built.

| Constraint | Consequence | Design response |
|---|---|---|
| No persistent queue workers | `queue:work` cannot run as a daemon | cPanel cron each minute: `queue:work --stop-when-empty --max-time=55`, with an overlap lock |
| Cron granularity often 1–5 min | Reminders are not real-time | §4 follow-up reminders are date-based, not minute-based — acceptable |
| `max_execution_time` (~30–120s) | Large exports and imports time out | All §13 exports and §14 imports are **queued**, written to storage, delivered as a download link |
| `memory_limit` (~128–256MB) | Loading full tables kills the request | Server-side DataTables everywhere; `chunkById()` in all reports and exports |
| `upload_max_filesize` (~2–64MB) | §15 document uploads may be rejected | Validate against the host's real limit, show it in the UI, record it in `.env` |
| No `storage:link` over FTP | Public disk symlink cannot be created | **All uploads served through a controller with policy checks** — required by §15 anyway |
| No Composer on server | `vendor/` cannot be installed remotely | Built locally and uploaded |
| Docroot is `public_html` | Laravel expects `public/` | App lives outside the web root; `public/` contents go in `public_html` |
| No SSH | `artisan migrate` has no shell | Run via cPanel **Cron Jobs**, which work without SSH |

**Cron jobs remain available in cPanel without SSH.** This is the key escape hatch — any artisan command can be run by scheduling a one-off cron. The entire deployment approach depends on it.

---

## 3. Architecture — MVC

```
                         ┌──────────────────────────┐
  Browser (Bootstrap 5)  │  Blade views + AdminLTE  │   VIEW
                         │  jQuery AJAX · Alpine.js │
                         └────────────┬─────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              ▼                       ▼                       ▼
      Backend controllers      DataTables endpoints     Print/PDF endpoints    CONTROLLER
      (forms, actions)         (JSON, server-side)      (receipts, reports)    — thin
              │                       │                       │
              └───────────────────────┼───────────────────────┘
                                      ▼
                     ┌────────────────────────────────┐
                     │        Eloquent models         │       MODEL
                     │  business logic · scopes ·     │   — where the rules live
                     │  casts · policies · audits ·   │
                     │  boot hooks that enforce R1-R6 │
                     └───────────────┬────────────────┘
                                     ▼
                       MySQL 8  ·  database queue  ·  local storage
```

### Layering rules

- **Controllers stay thin.** They validate, authorize, call one model method, and return a view or JSON. A controller never performs money arithmetic.
- **Business logic lives in the Model layer.** The *M* in MVC is the business layer, not a table wrapper. `Deal::paid()`, `Deal::due()`, `Receipt::issue()`, `Lead::convertToPatient()`, `NumberSequence::next()` are model methods, wrapped in transactions, testable without an HTTP request.
- **Rules are enforced in model boot hooks, not only in the UI.** A finalised receipt rejects mutation at `saving()`, so no controller — present or future — can bypass it.
- **No business logic in Blade.** Views render prepared data.
- **Every list endpoint is a DataTables JSON method** on the same controller, carrying the same authorization as the page that displays it.

### Directory layout

```
app/
  Http/
    Controllers/
      Backend/        UserController  LeadController  PaymentController
                      ReceiptController  ReportController  SettingController …
      Frontend/       ReceiptVerifyController
      Helpers/        MoneyHelper.php  BdtHelper.php  DateHelper.php
                      StatusHelper.php  PermissionHelper.php
    Requests/         Backend/  Frontend/
    Middleware/
  Models/             User  Lead  Conversation  FollowUp  Guardian  Patient
                      Deal  Payment  Receipt  Source  Package  NumberSequence …
  Policies/
  Notifications/
  Exports/            queued Laravel Excel classes

resources/views/
  Backend/
    Layout/
      User/           index  list  create  edit  update  show
      Lead/           index  list  create  edit  update  show
      Conversation/   Follow-up/  Pipeline/  Guardian/  Patient/
      Package/        Deal/  Payment/  Receipt/  Due/
      Report/         Task/  Document/  Setting/  AuditLog/
      Dashboard/      index
    Partials/         sidebar  header  footer  flash  modal  datatable-scripts
    main.blade.php    ← master layout; includes the partials
  Frontend/
    Layout/
      Receipt/        verify        ← public QR verification page
    Partials/         header  footer
    main.blade.php

routes/               web.php  backend.php  frontend.php
database/
  migrations/
  seeders/            ProductionSeeder.php  DemoSeeder.php  + one per table
  factories/
tests/                Feature/  Unit/
```

### Naming conventions

| Item | Convention | Example |
|---|---|---|
| Backend controller | `Backend\{Model}Controller` | `Backend\LeadController` |
| Frontend controller | `Frontend\{Purpose}Controller` | `Frontend\ReceiptVerifyController` |
| Helper | `Helpers\{Name}Helper` | `Helpers\MoneyHelper` |
| View path | `Backend.Layout.{Module}.{action}` | `Backend.Layout.Lead.index` |
| Route name | `backend.{module}.{action}` | `backend.lead.index` |
| DataTables route | `backend.{module}.data` | `backend.lead.data` |
| Seeder | `{Table}Seeder` | `DistrictSeeder` |

Every module folder carries the same file set — `index`, `list`, `create`, `edit`, `update`, `show` — so any developer can find any screen without looking.

### Seeding rules

Per the requirement that every table has seed data, seeders are split into two groups that must never mix.

**`ProductionSeeder`** — real reference data, runs on the live server:
roles and permissions, the admin user, one branch, 64 Bangladesh districts, sources (Noman, Dr. Ilias Patowary, Facebook, Website, Hospital, Doctor Referral, Walk-in, Campaign, Other), pipeline stages, lost reasons, payment methods, service categories, document categories, number sequences, company settings.

**`DemoSeeder`** — fake transactional data, **never deployed to production**:
sample leads, conversations, follow-ups, guardians, patients, deals, payments and receipts, at enough volume to test DataTables performance and report accuracy.

Two safeguards, because fake payments reaching a live financial system is the expensive failure here:

1. `DemoSeeder` aborts immediately if `app()->environment('production')`.
2. Transactional tables (`leads`, `patients`, `deals`, `payments`, `receipts`) carry an `is_demo` flag, so one query proves the live database holds none. Master data has no such flag — it *is* production data.

**A phase is not done until every table it introduced has a seeder.** Each phase's seeders are listed below and form part of its acceptance.

| Phase | Production seeders | Demo seeders |
|---|---|---|
| 0 | roles, permissions, admin user, branches, settings, number_sequences | — |
| 1 | districts (64), sources, hospitals, doctors, document_categories | leads, conversations, follow_ups |
| 2 | pipeline_stages, lost_reasons | guardians, patients |
| 3 | service_categories, packages, payment_methods | deals, payments |
| 4 | — | receipts |
| 5 | — | commissions, refunds |
| 7 | — | tasks, documents, assignment_histories |

Master data the client must supply before the Phase 1 and Phase 3 seeders can be written: the real source/referral list, the real hospital and doctor list, and the real package price list.

---

## 4. Module Map — all 24 sections

| § | Requirement | Phase | Notes |
|---|---|---|---|
| 1 | User & Role Management | 0 | Four roles plus granular permissions |
| 2 | Lead Management | 1 | Auto Lead ID, full field set |
| 3 | Conversation Management | 1 | Unlimited history, chronological |
| 4 | Follow-up & Reminder Automation | 1 | Today / Overdue / Upcoming |
| 5 | Patient Database | 2 | Conversion without re-entry |
| 6 | Source / Referral Tracking | 1 master · 5 commission · 6 reports | Split |
| 7 | Sales Pipeline & Deal Management | 2 | Kanban, drag and drop |
| 8 | Package / Service Management | 3 | Price snapshot on deal |
| 9 | Money Receipt & Payment System | 3 payments · 4 receipts | Split |
| 10 | Online Payment Confirmation | 4 | Pending / Verified / Rejected / Refunded |
| 11 | Accounts & Due Management | 5 | Ageing, collections, refunds |
| 12 | Main Dashboard | 6 | Full widget set |
| 13 | Reports & Analytics | 6 | Queued exports |
| 14 | Search, Filter & Data Tools | 7 | Global search, duplicates, import |
| 15 | Document Management | 7 | Controller-served, role-gated |
| 16 | Communication Integration | 9 | Deferred — needs client API accounts |
| 17 | Task & Internal Management | 7 | Assignment history, internal notes |
| 18 | Security & Audit Trail | 0 wiring · 8 2FA and backup | Split |
| 19 | Settings / Master Data | 0 shell · 1 sources · 8 complete | Split |
| 20 | Recommended Extra Features | 4 QR · 8 responsive · 9 rest | Split |
| 21 | CRM Main Menu | 0 → 8 | Menu grows each phase |
| 22 | Core Workflow | 1 → 4 | Proven end to end by Phase 4 |
| 23 | Management Questions | 6 | Each question maps to a named report |
| 24 | Acceptance / Quality Checklist | 8 | Formal sign-off pass |

---

## 5. Data Model

Eight linked record types, per the blueprint's closing instruction: *"Build Lead, Patient, Conversation, Follow-up, Source/Referral, Deal, Payment and Receipt as linked records — not one flat table."*

```
sources ──┐                          branches (schema-ready, always id=1)
doctors ──┤                               │
hospitals ┤                               ▼
packages ─┘
              leads ─────────▶ conversations ─────▶ follow_ups
             (lead_no)          (timeline)          (today/overdue/upcoming)
                │
        convert │  ConvertLeadToPatient  (one transaction)
                ▼
guardians ──▶ patients ──▶ deals ──▶ payments ──▶ receipts
  (payer)    (patient_no)  (deal_no)    │        (immutable, sequenced)
                                        └──▶ documents (payment proof)
```

### Master data

| Table | Key columns |
|---|---|
| `branches` | name, code, address, phone, is_active |
| `users` | name, email, phone, designation, branch_id, is_active, last_login_at |
| `roles` / `permissions` | spatie/laravel-permission tables |
| `sources` | name, type (person / channel / campaign), contact_person, phone, commission_rate, is_commissionable, is_active |
| `districts` | name — seeded with the 64 Bangladesh districts |
| `hospitals` | name, district_id, address, phone, is_active |
| `doctors` | name, specialization, hospital_id, phone, is_active |
| `service_categories` | name, is_active |
| `packages` | service_category_id, name, code, price, doctor_id, hospital_id, validity_days, notes, is_active |
| `pipeline_stages` | name, slug, sort_order, color, is_won, is_lost |
| `lost_reasons` | name, is_active |
| `payment_methods` | name, type (cash / bank / card / mfs / other), requires_reference, is_online, is_active |
| `document_categories` | name |
| `number_sequences` | key, prefix, year, next_number, padding, branch_id |
| `settings` | key, value — company info, notification rules |

### Core records

**`guardians`** — the paying contact.
`name, phone, alt_phone, district_id, address, notes, branch_id`

**`leads`**
`lead_no, branch_id, guardian_name, guardian_phone, alt_phone, patient_name, patient_age, gender, district_id, treatment_requirement, preferred_doctor_id, preferred_hospital_id, lead_date, assigned_to, source_id, secondary_source_id, campaign, priority (hot/warm/cold), stage_id, expected_package_id, expected_value, expected_confirmation_date, lost_reason_id, lost_at, notes, guardian_id, patient_id, converted_at, created_by`

**`conversations`**
`lead_id, user_id, channel (phone/whatsapp/facebook/website/in_person/email/other), occurred_at, discussion, outcome, next_action`

**`follow_ups`**
`lead_id, conversation_id, assigned_to, scheduled_for, status (pending/completed/missed/rescheduled), completed_at, rescheduled_from_id, reschedule_reason, notes`

**`patients`**
`patient_no, branch_id, guardian_id, name, age, gender, district_id, source_id, assigned_to, lead_id, status (active/completed/inactive), created_by`

**`deals`**
`deal_no, branch_id, patient_id, lead_id, package_id, package_snapshot (json), package_price, discount, final_price, doctor_id, hospital_id, status (confirmed/completed/cancelled), confirmed_at, completed_at, created_by`

**`payments`**
`branch_id, deal_id, type (payment/refund/adjustment), amount, payment_method_id, transaction_ref, paid_at, received_by, verified_by, verified_at, status (pending/verified/rejected/refunded), rejection_reason, is_online, approved_by, approved_at, notes, created_by`

**`receipts`**
`receipt_no, uuid, branch_id, deal_id, payment_id, type (payment/refund/adjustment), issued_at, issued_by, snapshot (json), amount, cumulative_paid, total, due, finalized_at, reverses_receipt_id`

**`documents`** — polymorphic
`documentable_type, documentable_id, document_category_id, original_name, path, disk, mime, size, uploaded_by, access_level (all/manager/accounts/admin)`

**`tasks`**
`branch_id, title, description, assigned_to, assigned_by, related_type, related_id, due_at, priority, status, completed_at`

**`assignment_histories`** — polymorphic
`assignable_type, assignable_id, from_user_id, to_user_id, changed_by, reason`

**`commissions`**
`source_id, deal_id, base_amount, rate, amount, status (pending/approved/paid), approved_by, approved_at, paid_at`

**`audits`** — `owen-it/laravel-auditing` standard schema.

---

## 6. Engineering Rules

These six rules exist because breaking them produces bugs that do not crash. They produce wrong numbers that nobody notices until a patient disputes a receipt.

### R1 — Money is `DECIMAL(14,2)`, never float

All monetary columns are `decimal(14,2)`, cast with `'amount' => 'decimal:2'`. Formatting and arithmetic go through `App\Http\Controllers\Helpers\MoneyHelper`. No `float`, and no `round()` on raw floats, anywhere.

### R2 — Due is derived, never stored

`total`, `paid`, and `due` are computed from the `payments` rows by methods on the `Deal` model — `paid()`, `due()`, `ledger()`. There is no mutable `due` column that code can forget to update, and no second place where the same maths is written.

```
paid = Σ(verified payments) − Σ(verified refunds)
due  = deal.final_price − paid
```

If performance later demands a cached column, it is written **only** inside the same transaction as the payment, and a scheduled command re-verifies it nightly.

### R3 — Receipts are append-only

Per §9, *"Finalized receipts locked; corrections must create an audit trail."* Once `finalized_at` is set the row is immutable, enforced in the model's `saving` hook rather than only in the UI. A correction issues a **reversal receipt** referencing `reverses_receipt_id`. Nothing is ever edited or deleted.

### R4 — Receipts snapshot their context

Per §8, *"Historical receipts must retain original package/price information."* At issue time the receipt stores a JSON snapshot of package name, package price, discount, final price, patient name, guardian name and phone. Later edits to the package master never alter a printed receipt.

### R5 — Numbers come from a locking sequence

`NumberSequence::next('receipt')` opens a transaction, runs `SELECT ... FOR UPDATE` on the sequence row, increments, and returns. Never `count() + 1` or `max() + 1` — two accountants saving in the same second is exactly the case §24 requires to hold.

Formats: `ELH-L-2026-000123` (lead), `ELH-P-2026-000123` (patient), `ELH-D-2026-000123` (deal), `ELH-R-2026-000123` (receipt).

### R6 — Authorization is enforced at the model layer

- Sales Executives see only leads assigned to them, through a global scope rather than a `where` clause a future controller might forget.
- Per §18, *"Ordinary staff cannot delete financial records"* — enforced by a policy **and** a `deleting` hook on `payments` and `receipts`.
- Every DataTables JSON endpoint applies the same authorization as its page.

---

## 7. Delivery Phases

Estimates are indicative developer-days for one developer, excluding client review time.

### Phase 0 — Foundation · ~6–8 days
**Covers:** §1, §18 (audit wiring), §19 (shell), §21 (menu shell)

- Laravel 12 install; MySQL; `database` cache, queue and session drivers
- Full `Backend/` and `Frontend/` folder scaffold per the Directory layout, with `main.blade.php` and partials in both
- AdminLTE 4 Blade shell: sidebar, topbar, notification bell, breadcrumbs, flash messages
- Reusable Blade components: `stat-card`, `filter-bar`, `money-input`, `confirm-modal`, `timeline`
- Auth: login, password policy, forgot password, session handling
- `spatie/laravel-permission`: four roles (Admin, Manager, Sales Executive, Accounts) plus granular view/add/edit/delete/export permissions per module
- Users CRUD with role assignment; branch model seeded with one active branch
- `owen-it/laravel-auditing` wired into a base model
- DataTables base controller trait and shared JS initialiser
- `NotificationChannel` interface, so Phase 9 integrations are driver classes rather than a refactor
- **Deployment proven on the real cPanel host before any feature work** (Deployment Runbook)

**Done when:** an Admin can create a Sales Executive who logs in and sees only permitted menu items, and deploying to cPanel works end to end.

---

### Phase 1 — Lead Engine ⭐ *first client demo* · ~10–12 days
**Covers:** §2, §3, §4, §6 (master list), §21 (partial)

- Master data CRUD: sources, districts (seeded), hospitals, doctors
- Leads: full §2 field set, auto Lead ID, DataTables list with §14-grade filters — date, status, source, executive, district, priority
- Lead detail page: profile, conversation timeline, follow-up panel, notes, attachments
- Conversations: unlimited history, all seven channels, chronological timeline, outcome and next action
- Follow-ups created from each conversation; **Today / Overdue / Upcoming** dashboards; reschedule with mandatory reason; manager view of missed follow-ups by employee
- Scheduled command marks past-due pending follow-ups as `missed` and notifies the assignee
- Starter dashboard: new leads today, today's follow-ups, overdue count

**Done when:** a sales executive can run a full working day in the system — take a lead, log a call, set the next follow-up, and see it appear on the right day.

---

### Phase 2 — Pipeline & Patients · ~8–10 days
**Covers:** §5, §7

- Kanban board: seven stages, drag and drop via SortableJS, AJAX stage updates
- Stage-wise lead count and total expected value; expected confirmation date
- Predefined lost reasons; closing a lead requires one; reopening is permission-gated
- Guardians and patients CRUD
- **`Lead::convertToPatient()`** — one transaction: find or create the guardian by phone, create the patient with a new Patient ID, carry over source, assigned staff and documents, link `lead.patient_id`, stamp `converted_at`. Zero re-entry, per §5.

**Done when:** a confirmed lead becomes a patient with no data retyped, and the kanban reflects live pipeline value.

---

### Phase 3 — Packages, Deals & Payments · ~8–10 days
**Covers:** §8, §9 (payments), §11 (partial)

- Service categories and packages: price, doctor and hospital, validity, notes
- Deals: package selection, discount, final agreed price, **price snapshot** (R4)
- `Deal` model ledger methods `paid()`, `due()`, `ledger()` (R2), with full unit test coverage
- Payment methods master; record payment with a live Alpine-driven total / paid / due preview
- Payment list per deal and per patient; editing restricted to before finalisation

**Done when:** ৳300,000 total with a ৳50,000 payment shows ৳250,000 due — computed rather than stored, and still correct after a payment is voided.

---

### Phase 4 — Receipts & Online Payment Verification · ~8–10 days
**Covers:** §9 (receipts), §10, §20 (QR)

- `NumberSequence` model with a concurrency test (R5)
- `Receipt::issue()` producing an immutable, snapshotted receipt (R3, R4)
- Printable **Office Copy and Client Copy** — Blade print stylesheet plus DomPDF download
- QR code on each receipt linking to a public verification page at `/verify/{uuid}` — `Frontend\ReceiptVerifyController` rendering `Frontend.Layout.Receipt.verify`, showing receipt number, date, amount and validity, and **no patient medical data**
- Online payments: Pending → Verified / Rejected / Refunded; payment proof upload; verification restricted to Accounts and Admin; **verification automatically issues the receipt and updates the due** (§10)
- Reversal receipts for corrections

**Done when:** §22's core workflow runs end to end — lead → conversation → follow-up → confirm → patient → payment → receipt.

---

### Phase 5 — Accounts, Dues & Commission · ~7–8 days
**Covers:** §11, §6 (commission)

- Patient-wise and guardian-wise payment ledger
- Due ageing buckets: 0–30, 31–60, 61–90, 90+ days
- Daily, weekly and monthly collection reports
- Payment reminders queued from outstanding dues
- Refunds and adjustments: request → approval → audit trail, with Admin-only approval
- Referral commission: per-source rate, accrued per deal, approval workflow, payable status

**Done when:** the Accounts role can answer "who owes us what, and for how long" in one screen.

---

### Phase 6 — Dashboard & Reports · ~10–12 days
**Covers:** §12, §13, §23

- Full dashboard: new leads today, today's / overdue / upcoming follow-ups, confirmed deals, completed patients, lost leads, today's and monthly collection, total outstanding due, pipeline value, conversion rate, source performance, sales executive performance
- Chart.js widgets fed by dedicated aggregate endpoints
- Report suite — each of §23's seven management questions maps to a named report:
  1. Leads this month, by source
  2. Leads from Noman, with confirmed count and rate
  3. Leads from Dr. Ilias Patowary, with confirmed count and rate
  4. Leads by Facebook, Website, Hospital and other sources
  5. Total sales, collection and outstanding due
  6. Sales executive league table, and lost leads with reasons
  7. Conversion rate by source and by employee
- Conversion funnel, lost reason breakdown, campaign ROI
- **Queued** Excel, PDF and CSV exports, permission-gated, delivered as a download link

**Done when:** every question in §23 is answerable in the UI for any date range.

---

### Phase 7 — Search, Documents & Tasks · ~7–9 days
**Covers:** §14, §15, §17

- Global search across patient name, guardian phone, Lead ID, Patient ID, source and receipt number
- Duplicate detection on phone and patient details, surfaced at lead creation
- Bulk import and export via queued, chunked Laravel Excel with a row-level error report
- Document management: categories, polymorphic upload, **controller-served with policy checks** rather than a public URL, view and download permissions, upload history
- Tasks: assign and reassign with history, deadline, priority, daily task list per employee
- Manager comments and internal notes, hidden from any client-facing view

**Done when:** a receptionist can find any record from one search box, and a medical report cannot be opened by anyone without permission.

---

### Phase 8 — Hardening, Launch & Acceptance · ~7–9 days
**Covers:** §18, §19 (complete), §20 (responsive), §24

- Optional 2FA; session and device management; password policy enforcement
- Full audit log viewer with filters by user, model, action and date
- `spatie/laravel-backup` on cron to an **offsite** disk — Google Drive, Dropbox or S3
- Documented restore procedure, tested once before go-live
- Settings completion: receipt numbering, company information, notification rules
- Mobile responsiveness QA across every screen (§20, §24)
- Formal walk-through of the §24 acceptance checklist with the client
- Data migration from existing spreadsheets; user training; go-live

**Done when:** every line of §24 is demonstrated and signed off.

---

### Phase 9 — Deferred: Integrations & Extras
**Covers:** §16, §20 (remainder)

Blocked on client-provided accounts and approvals, not on development:

- WhatsApp Business API — templates for first contact, follow-up, payment reminder and confirmation. *Needs a verified Meta Business account, an API provider, and Meta-approved templates, typically one to three weeks.*
- Meta / Facebook Lead Ads webhook creating leads automatically. *Needs a Facebook app, page admin access, `leads_retrieval` permission, and a public HTTPS callback.*
- SMS gateway such as SSL Wireless or Bulk SMS BD. *Needs an account, sender ID approval and balance.*
- Email and click-to-call integration
- Automatic lead scoring, round-robin assignment, follow-up escalation
- Customer portal, public API, multi-branch activation

---

**Indicative total for Phases 0–8: roughly 71–88 developer-days.**

---

## 8. Deployment Runbook — cPanel, FTP only

Prove this works in Phase 0, before writing features. Discovering a PHP version problem in Phase 6 is expensive.

### Pre-flight checks

1. cPanel → **MultiPHP Manager** → confirm PHP **8.2 or newer** is selectable.
2. cPanel → **Select PHP Version** → **Extensions** → enable and confirm: `bcmath`, `ctype`, `curl`, `dom`, `fileinfo`, `filter`, `hash`, `mbstring`, `openssl`, `pcre`, `pdo_mysql`, `session`, `tokenizer`, `xml`, `zip`, `gd`.
3. Record the real values of `upload_max_filesize`, `post_max_size`, `max_execution_time` and `memory_limit`. Put them in `.env` so the UI can validate against them.
4. Confirm **Cron Jobs** is available. Everything below depends on it.
5. Confirm **AutoSSL / Let's Encrypt** is active — required for the QR verification page.

### Directory layout on the server

Application files must never sit inside the web root.

```
/home/USER/
  crm/                    ← full Laravel app (NOT web-accessible)
    app/  bootstrap/  config/  database/  resources/  routes/
    storage/  vendor/  .env  artisan
  public_html/            ← contents of Laravel's public/ folder
    index.php             ← paths edited to point at ../crm
    .htaccess  css/  js/  build/  favicon.ico
```

In `public_html/index.php`, change the two require paths:

```php
require __DIR__.'/../crm/vendor/autoload.php';
$app = require_once __DIR__.'/../crm/bootstrap/app.php';
```

### Each deploy

```
Local:
  1. composer install --no-dev --optimize-autoloader
  2. npm run build                    (if any assets are compiled)
  3. php artisan config:clear         (never upload a cached config)
  4. zip the app, excluding .git, node_modules, tests, storage/logs/*

Upload via File Manager or FTP:
  5. crm/          ← app + vendor
  6. public_html/  ← contents of public/

Post-deploy, as a one-off cron entry that is then deleted:
  7. php /home/USER/crm/artisan migrate --force
  8. php /home/USER/crm/artisan config:cache route:cache view:cache
  9. php /home/USER/crm/artisan db:seed --class=ProductionSeeder   (first deploy only)
```

`storage/` and `bootstrap/cache/` must be writable — 755, or 775 if the host requires it.

### Permanent cron jobs

```
* * * * *  php /home/USER/crm/artisan schedule:run >> /dev/null 2>&1
* * * * *  php /home/USER/crm/artisan queue:work --stop-when-empty --max-time=55 --tries=3 >> /dev/null 2>&1
```

The scheduler drives follow-up reminders, due reminders, missed-follow-up detection, nightly ledger verification and backups. The queue worker drives exports, imports and notifications. Both use `withoutOverlapping()` so a slow run never stacks.

If the host limits cron to every five minutes, follow-up reminders still land on the correct day. The blueprint requires day accuracy, not minute accuracy.

### File storage

There is no `storage:link`. Uploads are written to `storage/app/private/documents/` and served exclusively through `DocumentController@show`, which checks the policy before streaming. §15's role-based access rules require this regardless of hosting, so the constraint costs nothing.

### Backups

`spatie/laravel-backup` on a nightly cron, writing to an **offsite** disk. A backup stored on the same shared host does not survive the failure it exists to protect against.

---

## 9. Testing Strategy

Pest, focused where a bug costs money or leaks data rather than on scaffolding.

### Tested hard

**Money**
- Paid and due arithmetic across partial payments, overpayment, and zero-value deals
- Refunds and adjustments correctly reduce `paid`
- Voiding a payment recomputes `due` correctly
- `DECIMAL` precision holds across a long payment chain, with no drift

**Receipts**
- Receipt numbers stay unique under 50 concurrent issues
- A finalised receipt rejects every mutation attempt at the model layer
- A snapshot is unaffected by later edits to the package master
- A correction produces a reversal receipt rather than an edit

**Permissions**
- A Sales Executive cannot read, list or export another executive's leads
- A Sales Executive cannot delete a payment or a receipt (§18)
- Only Accounts and Admin can verify an online payment (§10)
- Only Admin can approve a refund or reopen a lost lead
- DataTables JSON endpoints enforce the same rules as their pages

**Conversion**
- `Lead::convertToPatient()` copies every field, creates the guardian only once when the phone already exists, and is idempotent
- A failure mid-conversion rolls back completely, leaving no orphan patient

### Smoke coverage only
Master-data CRUD, page rendering, navigation.

### Not automated
Visual styling, print layout and mobile rendering — verified manually in Phase 8.

---

## 10. Open Questions for the Client

Each needs an answer before the phase that depends on it. None block Phase 0 or Phase 1.

| # | Question | Blocks |
|---|---|---|
| 1 | **Referral commission (§6):** a flat percentage per source, or per package? Who approves it? Payable on deal confirmation, or on cash collection? | Phase 5 |
| 2 | **Refunds (§11):** who may approve, and is there a value threshold above which Admin approval is mandatory? | Phase 5 |
| 3 | **Receipt numbering (§19):** preferred format, and whether the series resets each year | Phase 4 |
| 4 | **"Completed" patient (§12):** what marks a patient completed — treatment finished, or full payment received? These produce different report numbers. | Phase 6 |
| 5 | **Lead visibility:** may a Sales Executive see unassigned leads in a shared pool, or only their own? | Phase 1 |
| 6 | **Existing data:** is there a spreadsheet of current leads and patients to migrate, and in what format? | Phase 8 |
| 7 | **Document retention (§15):** how long are patient medical documents kept, and is there a deletion policy? | Phase 7 |
| 8 | **Master data lists:** the real source/referral list, hospital and doctor list, and package price list — needed to write the production seeders | Phases 1, 3 |

**Working assumptions**, used unless the client says otherwise and flagged in the UI wherever they surface:

- Commission is a flat percentage per source, Admin-approved, accrued on confirmation but payable only on collection.
- A patient is **Completed** when a Manager marks the deal complete, independent of payment status. Outstanding due is reported separately.
- Sales Executives see only their own assigned leads.
- The receipt series resets annually: `ELH-R-2026-000001`.

---

## 11. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Host caps PHP below 8.2 | Laravel 12 will not run | Verify in the Phase 0 pre-flight, before any code |
| Shared host resource limits under load | Timeouts on reports and exports | Server-side DataTables, chunked queries, queued exports |
| No SSH makes deploys slow and error-prone | Deployment mistakes | Scripted local build, written runbook, rehearsed in Phase 0 |
| Scope growth across 24 sections | Timeline slip | Phase gates with client sign-off; §16 already deferred |
| Client API approvals delayed (Meta, WhatsApp) | Phase 9 stalls | Deferred by design; the core CRM ships without them |
| Patient medical data on shared hosting | Confidentiality exposure | Documents never publicly addressable, policy-checked streaming, offsite encrypted backups |
| Financial arithmetic errors | Billing disputes and lost trust | Rules R1–R5, with the heaviest test coverage in the project |

---

## 12. Next Step

Phase 0 begins with the cPanel pre-flight checks in the Deployment Runbook — PHP version and extensions confirmed on the real host, and one deployment rehearsed end to end. That gate exists because everything downstream assumes it passed.
