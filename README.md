# E Life Healthcare CRM — Sidebar Guide

This document explains **every item in the left sidebar** of the demo: what it is for, why it exists, what an employee does there, what kind of information it holds, and how it connects to the rest of the system.

It is written for reviewing this template/demo — nothing here describes a future feature. It only explains what you can already click through in the pages you have.

> If a section below mentions another section, that is not two separate systems — it is the same information looked at from a different screen. A lead becomes a patient, a patient's deal generates payments, and a payment generates a receipt. The sidebar just gives every stage of that one story its own dedicated screen.

---

## How the pages fit together (read this first)

The business runs on one storyline:

```
Lead  →  Conversation  →  Package Applied  →  Payment  →  Money Receipt  →  Patient / Deal
```

A **Lead** is a family enquiring about treatment. Every phone call, WhatsApp message or office visit with that family is a **Conversation**. During a conversation, the employee records what happened — and that outcome decides what happens next:

- If the outcome is **Interested** or **Another meeting / follow-up needed**, a **Follow-up** reminder is set.
- If the outcome is **Applied**, the employee picks the **Package** the family applied for, right there in the same window.
- If money is collected at that point, the employee records the **Payment** immediately after picking the package — still without leaving that window.
- Recording a payment produces a **Money Receipt** automatically.
- Once a deal is confirmed, the lead becomes a **Patient**, and every payment against their treatment is tracked as a **Deal**.

That is the flow you can click through today from **Leads → (conversation icon) → Log Conversation**, or from **Conversations** directly: choosing an outcome reveals the package step, and turning on "payment received now" reveals the payment step, all inside one modal. This is the direct answer to "too many pages, too many clicks" — the conversation now drives the package and payment steps instead of sending the employee to three different screens.

---

## Dashboard

**What it's for:** The first screen after login — a summary of the whole business for today and this month.

**Why it's in the CRM:** Management and staff need a one-glance answer to "how are we doing right now" without opening five different modules.

**What an employee uses it for:** Checking today's new leads, today's and overdue follow-ups, this month's collection, outstanding dues, and which sources and executives are performing best.

**What lives here:** Aggregated numbers and charts only — counts and totals pulled from Leads, Payments and Deals. Nothing is entered or edited on this page.

**How it connects:** Every number on the dashboard is a summary of data that actually lives in Leads, Payments, Dues and Reports. Clicking a dashboard card or chart is meant to jump straight to the detailed list behind it.

---

## Lead Management

### Leads

**What it's for:** The master list of every enquiry the business has ever received — the starting point of the whole pipeline.

**Why it's in the CRM:** Before anyone is a patient, they are a lead. Nothing about a treatment case exists until it is captured here first — guardian and patient names, phone number, district, the treatment they need, and who referred them.

**What an employee uses it for:** Adding a new enquiry (**Add Lead**), searching/filtering the list by status, source, executive or priority, and opening the conversation log for a specific lead to record a call and decide the next step.

**What data lives here:** Lead ID, guardian and patient details, contact numbers, district, treatment requirement, preferred doctor/hospital, source of the enquiry, priority (Hot/Warm/Cold), assigned sales executive, and current status (New, Contacted, Interested, Follow-up, Negotiation, Confirmed, Completed, Lost).

**How it connects:** Every conversation, follow-up, package and payment is attached to a Lead ID. A confirmed lead is what eventually becomes a Patient record — the same person, not a re-typed one.

### Conversations

**What it's for:** The complete, timestamped history of every contact with a lead — every call, WhatsApp message, office visit or email, in order.

**Why it's in the CRM:** A sales team talking to hundreds of families needs a shared memory. Without this, "what did we already tell them?" depends on one employee's memory instead of a record everyone can check.

**What an employee uses it for:** Logging a new conversation (channel, what was discussed, and the outcome), and reviewing the full timeline for a lead before calling them again. This is also where the employee records that a lead **applied for a package** and, if money changed hands, **records the payment** — all in the same window, without navigating to Packages or Payments separately.

**What data lives here:** Channel (phone, WhatsApp, Facebook, website, in-person, email, other), date/time, discussion notes, outcome, and the next action.

**How it connects:** Every conversation belongs to one lead. Its outcome can trigger a Follow-up, a Package selection, or a Payment — this page is the control point for the whole flow described above.

### Follow-ups

**What it's for:** A worklist of every promised next contact — organised as Today, Overdue, and Upcoming.

**Why it's in the CRM:** Leads are lost when nobody calls back on time. This page exists specifically so a missed promise becomes visible instead of forgotten.

**What an employee uses it for:** Checking what needs to be done today, marking a follow-up as completed after the call, or rescheduling it with a reason.

**What data lives here:** The lead it belongs to, who it's assigned to, the scheduled date, and its status (pending, completed, missed, rescheduled).

**How it connects:** Every follow-up traces back to a specific Conversation and Lead. The red badge next to "Follow-ups" in the sidebar is the overdue count.

### Sales Pipeline

**What it's for:** A visual, drag-and-drop board (Kanban) showing every open lead by stage — New, Contacted, Interested, Negotiation, Confirmed, and so on.

**Why it's in the CRM:** A list of 400 leads doesn't show where the bottleneck is. A pipeline board does — at a glance, management can see how many leads (and how much expected revenue) are stuck at each stage.

**What an employee uses it for:** Dragging a lead's card to a new stage as it progresses, and seeing the total expected value sitting in each stage.

**What data lives here:** The same leads as the Leads page, grouped by stage, with their expected value.

**How it connects:** This is another view of the Leads list — moving a card here changes that lead's status, the same status shown on the Leads page.

### Sources / Referrals

**What it's for:** The list of where leads come from — Facebook, Website, Hospital referrals, Doctor referrals, walk-ins, campaigns, and named referral partners like "Noman" or "Dr. Ilias Patowary."

**Why it's in the CRM:** The client's own management questions include "how many leads came from this referral, and how many of those converted?" That question cannot be answered unless every lead records where it came from.

**What an employee uses it for:** Maintaining the list of valid sources, and (for referral partners who earn commission) tracking how many leads and confirmed deals came from them.

**What data lives here:** Source name, type, contact details, and — for commissionable sources — a commission rate.

**How it connects:** Every lead is tagged with a source. This page is where that list of sources is managed, and where source performance is reviewed.

---

## Patients & Deals

### Patients

**What it's for:** The record of every person who has actually confirmed treatment — as opposed to Leads, which includes everyone who only enquired.

**Why it's in the CRM:** Once someone commits to treatment, the business needs a patient-centred record: their guardian, their treatment history, their documents and their full payment history in one place — not scattered across old lead notes.

**What an employee uses it for:** Looking up a patient's full profile, treatment status, and payment history.

**What data lives here:** Patient ID, guardian link, age, gender, district, assigned staff, and status (active, completed, inactive).

**How it connects:** A patient is created from a confirmed Lead without re-typing anything — name, phone, source and documents all carry over automatically. From here you can see the Deal(s), Payments and Documents tied to that person.

### Packages

**What it's for:** The catalogue of treatment packages the business sells — their price, the assigned doctor and hospital, and how long the price is valid for.

**Why it's in the CRM:** Once a lead says "I want to apply," the employee needs a ready list of exactly what can be offered and at what price — instead of quoting a price from memory that might be wrong or inconsistent between employees.

**What an employee uses it for:** Browsing available packages, and (from the Conversations flow) selecting the package a patient applied for, which then carries its price into the deal.

**What data lives here:** Package name, service category, price, doctor, hospital, validity period, and active/inactive status.

**How it connects:** When a package is selected during a conversation, its price and details are copied ("snapshotted") into that patient's Deal. If the package's price changes later, already-issued receipts and deals are not affected — they keep the price that was agreed at the time.

### Deals

**What it's for:** The commercial agreement behind a patient's treatment — which package, at what agreed price, with which doctor and hospital.

**Why it's in the CRM:** A patient can have more than one deal over time (different treatments, different visits). This page is where the agreed price and the running total of what's paid and what's due for that specific agreement lives.

**What an employee uses it for:** Reviewing what was agreed, its status (confirmed, completed, cancelled), and how much has been paid against it so far.

**What data lives here:** Deal number, linked patient, package snapshot, agreed price, and status. (No discounts are given.)

**How it connects:** A deal is created once a lead's package application is confirmed. Every payment recorded afterwards reduces that deal's outstanding due — the due amount is always calculated live from payments, never typed in by hand, so it cannot drift out of sync.

---

## Accounts

### Payments

**What it's for:** Every amount of money received (or refunded), and — separately — the queue of online payments (bKash, Nagad, bank transfer) waiting to be verified before they count as real income.

**Why it's in the CRM:** Money handled outside a shared, auditable list is exactly how disputes and losses happen in a healthcare billing business. This page is the single place all money in and out is recorded, regardless of who collected it.

**What an employee uses it for:** Recording a payment (cash, card, bank, mobile wallet), verifying or rejecting an online payment submitted with proof, and reviewing all payments received.

**What data lives here:** Amount, method, reference number, who received it, verification status, and the receipt it generated.

**How it connects:** A payment is always attached to a Deal. Verifying a payment automatically issues its Money Receipt and recalculates that patient's outstanding due — the employee never has to do that step separately. This is also reachable directly from the Conversations flow, so a payment collected during a call never requires a separate visit to this page.

### Money Receipts

**What it's for:** The register of every receipt ever issued, and the printable Office Copy / Client Copy of each one.

**Why it's in the CRM:** A receipt is a legal proof of payment. Once issued and finalised, it must never be silently edited — only reversed with a new, linked correction receipt, so there is always a clean paper trail.

**What an employee uses it for:** Looking up, printing or downloading a receipt, and — for Accounts/Admin roles — issuing a reversal if a correction is genuinely needed.

**What data lives here:** Receipt number (from a locking sequence, so two people saving at the same instant can never get the same number), the amount, the patient and package details **as they stood at the moment of issue**, and payment history for that deal.

**How it connects:** A receipt is generated the moment a payment is verified — either from the Payments page or directly from a conversation. It always reflects the deal it belongs to.

### Due & Collections

**What it's for:** Who owes the business money, how much, and for how long it has been outstanding (0–30 / 31–60 / 61–90 / 90+ days).

**Why it's in the CRM:** Outstanding balances that are not tracked by age quietly turn into bad debt. This page exists so Accounts can chase the oldest, largest dues first instead of guessing.

**What an employee uses it for:** Reviewing the due ledger, following up on overdue balances, and seeing monthly collection trends.

**What data lives here:** Total outstanding per patient/deal, ageing buckets, and collection totals.

**How it connects:** Due is not a number anyone types in — it is always today's Deal total minus verified Payments. This page is simply that same calculation, sorted by how overdue it is.

---

## Workspace

### Tasks

**What it's for:** A general to-do list for internal work that isn't a sales follow-up — administrative work, document chasing, coordination between departments.

**Why it's in the CRM:** Not everything a staff member needs to do is a lead follow-up. Tasks gives managers a way to assign and track any piece of work with a deadline and an owner.

**What an employee uses it for:** Viewing tasks assigned to them, marking them complete, and (for managers) assigning new ones.

**What data lives here:** Title, description, assignee, due date, priority, and status.

**How it connects:** A task can optionally be linked to a lead, patient or deal, but it doesn't have to be — it can also be a standalone internal to-do.

### Documents

**What it's for:** Every file attached to a lead or patient — medical reports, prescriptions, national ID copies, payment proofs, consent forms.

**Why it's in the CRM:** Medical documents are sensitive. This page exists to keep every file organised by category and, importantly, permission-gated — a document is never reachable by guessing a link; it always goes through an access check first.

**What an employee uses it for:** Uploading a file against a lead/patient, and viewing or downloading files they have permission to see.

**What data lives here:** File name, category, which record it's linked to, size, required access level, and who uploaded it.

**How it connects:** Documents are attached to Leads, Patients or Payments (as proof). The access level shown per document (e.g. "Manager+", "Accounts") controls who can open it.

### Reports

**What it's for:** The answers to management's recurring questions — leads this month by source, conversion rate by executive, total collection vs. outstanding due, lost-reason breakdown, and more.

**Why it's in the CRM:** Raw tables answer "what is in the system." Reports answer "what does that mean for the business" — trends, comparisons and totals that would otherwise require manually combining several pages.

**What an employee uses it for:** Pulling a specific report for a date range.

**What data lives here:** Nothing new — every report is a calculated view over Leads, Conversations, Deals and Payments.

**How it connects:** Reports don't hold their own data; they summarise everything else in the system, which is why they always live at the end of the sidebar's working sections.

---

## Administration

### Users & Roles

**What it's for:** Managing staff accounts and what each role is allowed to see and do.

**Why it's in the CRM:** A hospital-adjacent business handling patient data and money cannot let every employee see or touch everything. Roles (Admin, Manager, Sales Executive, Accounts) exist to enforce that: a Sales Executive should not see another executive's leads, and only Accounts/Admin should verify a payment or delete a financial record.

**What an employee uses it for:** Admins create accounts and assign roles; every other employee sees only the menu items and data their role allows.

**What data lives here:** Name, email, phone, designation, role, and active/inactive status.

**How it connects:** Every action logged in the Audit Log is tied to the user who performed it, and every Lead/Payment permission check is enforced based on the role set here.

### Settings

**What it's for:** One place to configure the CRM. The sidebar's Settings menu holds **General** (this page) plus Packages, Sources, Users and Roles & Permissions.

**Why it's in the CRM:** The company details on an invoice, how IDs are numbered, and the choices in every dropdown (payment methods, not-interested reasons, expense categories…) change over time. They need to be edited once, here, not hardcoded on every page.

**What an employee uses it for:** Admins update:
- **Company Profile:** name, address, phone, email and logo.
- **ID Format:** how Lead, Patient, Employee, Invoice and Receipt numbers are written (e.g. `Lead26-0417`). With *Yearly* on, numbering restarts each year, so 2027's first lead is `Lead27-0001`.
- **Database Backup:** schedule, destination and "Back Up Now".
- **Dropdown Options:** add, rename, reorder or remove the options offered in forms. Removing one only hides it from new entries; old records keep their value.

**What data lives here:** Key/value configuration: company info, ID formats and counters, backup schedule, and the option lists.

**How it connects:** The company profile and logo print on every invoice, money receipt and lead registration form. The ID formats number new leads, invoices and receipts. Every form dropdown is filled from the option lists.

### Audit Logs

**What it's for:** A permanent, unchangeable record of who did what, when — every create, update, delete, verification and approval across the system.

**Why it's in the CRM:** Financial and medical records need accountability. If a payment amount or a patient record is ever questioned, this page shows exactly who changed what, and when, down to the IP address.

**What an employee uses it for:** Admins and managers review this when investigating a discrepancy; it is read-only for everyone.

**What data lives here:** Timestamp, user, action type, the record affected, and the before/after change.

**How it connects:** Every other module writes to this log automatically — it's the one place nothing needs to be manually added, because the system records it as work happens elsewhere.

---

## A note on this being a demo

This is a static HTML/CSS/JavaScript template for design and flow review — there is no real database or server behind it yet. Numbers, names and receipts you see are sample data to make the flow understandable, not live records. The interactive parts (like choosing "Applied" in Log Conversation and seeing the package/payment steps appear) are built with front-end JavaScript so the flow can be demonstrated and approved before the full functional (Laravel) version is built, as described in `plan.md`.
