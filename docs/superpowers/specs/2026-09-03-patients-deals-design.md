# Patients & Deals — Design

**Date:** 2026-09-03
**Scope:** Patients, Deals, and moving Packages out of this module.
**Builds on:** `2026-09-03-leads-module-round-2-design.md` (dual-balance money, three packages).
**Status:** Approved, implementing.

---

## 1. Why

Client review of Patients & Deals:

1. The alert on Patients is noise.
2. Patients is a **history** record — a View button should open everything known about the person. The table itself should carry only what is needed, and **not** Paid/Due, which belong elsewhere.
3. Patients needs filters.
4. Packages does not belong under Patients & Deals.
5. Packages must show which package is used most, and support add / edit / remove.
6. Deals should list everyone who ever had a deal, split into **Dues** and **Settled**, with lifetime history.

### What is broken today

`deals.html` contradicts the leads module outright. It shows Mim Akter owing ৳2,50,000 on a deal it calls "Confirmed", while the leads module has her fully settled; it uses package names (`Cardiac Surgery — Standard`, `Oncology — Premium`) that no longer exist; and it is single-currency, from before the taka/dollar split. It is a rebuild, not an edit.

---

## 2. Patients

### Removed

- The `alert-success` explaining lead→patient conversion.
- The `Total`, `Paid` and `Due` columns. Money lives on Deals.

### Columns

`Patient ID · Patient / Guardian · Phone · Condition · Doctor / Hospital · Package · Status · Action`

Doctor and Hospital stay here even though they were removed from Add Lead. At lead stage they were a guess; by the time someone is a patient, the treating team is assigned and is a fact worth recording.

### Filters

A filter bar replacing the single status dropdown: search, status, package, assigned staff, date range.

### Tiles

`Total Patients · Active Treatment · Completed · New This Month`. The old "With Outstanding Due" tile goes — due is not a patients concern any more.

### Who is a patient

A patient record exists for a lead that reached **Confirmed**. Leads that have applied but not yet confirmed are not patients; they appear on Deals, because they have a deal.

---

## 3. `patient-profile.html` — new

The View button opens a page, not a modal. "Every history thing" is more than a modal should hold, and a page can be linked, reopened and printed.

Tabs:

| Tab | Holds |
|---|---|
| Overview | Identity, guardian, contact, condition, source, assigned staff, status, treating doctor and hospital |
| Deals | Every deal, each with agreed / paid / due in both currencies |
| Payments | Every payment ever taken, with receipt number and currency |
| Conversations | The full conversation log |
| Follow-ups | Every follow-up, kept or missed |
| Documents | Medical and other documents |

Reached as `patient-profile.html?patient=<id>`. Like `invoice.html`, the demo carries **one fully worked profile** (Sharmin Akter, who has two deals and so the richest history); arriving for a different patient shows a note saying so rather than rendering someone else's history under the wrong name.

Not in the sidebar — it only exists in the context of one patient.

---

## 4. Packages → Administration

```
Patients & Deals        Administration
  Patients                Packages        ← moved
  Deals                   Users & Roles
                          Settings
                          Audit Logs
```

A package is configuration an admin maintains, and since round 2 it drives the lead money rather than the patient record.

### Most used

A **Usage** column counts the deals carrying each package, the table sorts by it, and the top package is badged **Most used**. Tiles: `Total Packages · Most Used · Deals Using Packages · Dual-currency Packages`.

### Add / Edit / Remove

- **Add** — the round-2 form: name, default taka price, *accepts dollar payments*, default dollar price when ticked.
- **Edit** — the same form, pre-filled.
- **Remove** — asks for confirmation, and **refuses while the package is in use**, naming the count. Deleting a package out from under live deals would orphan them.

---

## 5. Deals — rebuilt

One row per person, expandable to their individual deals.

```
DEALS                              [ All 11 | Dues 3 | Settled 8 ]

  Patient          Deals   Lifetime Paid        Outstanding        State
 ───────────────────────────────────────────────────────────────────────
▾ Ayesha Rahim       2     ৳4,00,000 / $5,000   ৳1,50,000/$1,500   Dues
     ELH-D-2026-000094  Partial Funded  Aug 2026  ৳1,50,000 / $1,500 due
     ELH-D-2025-000061  Paid Patients   Feb 2025  settled
▸ Sharmin Akter      2     ৳7,00,000 / $4,000          —           Settled
```

### Rules

1. **Everyone who ever reached a deal appears** — the leads currently Applied and the leads Confirmed. A deal exists from the moment a lead applies.
2. **Dues vs Settled is derived, never typed.** A person is `Dues` if *any* of their deals still owes in *either* currency; otherwise `Settled`.
3. **Lifetime totals are the sum of that person's deals**, per currency.
4. **Lifetime history is the expansion.** Older, closed deals live here even though they left the Applied and Confirmed worklists long ago: those two pages are current-cycle worklists, Deals is the lifetime ledger.
5. Tabs `All / Dues / Settled`, counts derived from the rows.
6. Dual currency throughout, per the round-2 money rules. Nothing is converted.

### Tiles

`People with Deals · Total Deals · Lifetime Collected (৳ / $) · Outstanding (৳ / $)`

---

## 6. Data

Every current deal is the same figures as that lead's row on Applied or Confirmed Leads. Two people carry an extra historical deal to demonstrate lifetime history.

| Person | Deals | Lifetime paid | Outstanding | State |
|---|---|---|---|---|
| Ayesha Rahim | 2 | ৳4,00,000 / $5,000 | ৳1,50,000 / $1,500 | Dues |
| Karim Mia | 1 | ৳2,50,000 | ৳1,50,000 | Dues |
| Nadia Sultana | 1 | ৳3,00,000 / $1,500 | — / $2,500 | Dues |
| Mim Akter | 1 | ৳2,50,000 / $2,500 | — | Settled |
| Jamal Uddin | 1 | ৳4,00,000 | — | Settled |
| Sharmin Akter | 2 | ৳7,00,000 / $4,000 | — | Settled |
| Rokeya Begum | 1 | ৳4,00,000 | — | Settled |
| Sajid Hasan | 1 | ৳2,50,000 / $2,500 | — | Settled |
| Halima Khatun | 1 | ৳4,00,000 | — | Settled |
| Tanjila Akter | 1 | ৳2,50,000 / $2,500 | — | Settled |
| Nurul Islam | 1 | ৳3,00,000 / $4,000 | — | Settled |

11 people, 13 deals. Outstanding totals ৳3,00,000 / $4,000 — the same figures the Applied Leads tile carries, because they are the same money.

Package usage across the 13 deals: Full Funded 5, Partial Funded 4, Paid 4. **Full Funded Patients is the most used.**

---

## 7. Code layout

Patients & Deals behaviour goes in a new `assets/js/crm-deals.js`, loaded via a `dealsjs` flag in `build.js`, rather than growing `crm-leads.js` further. It owns the deals tabs, the per-person expansion, the package usage table and the package remove guard. The generic row-expansion class (`crm-ledger-toggle`) is reused as-is.

---

## 8. Verification

`build/verify-money.js` is extended:

| Assertion | Where |
|---|---|
| A person's lifetime totals equal the sum of their deals, per currency | deals |
| Each person's **current** deal matches their row on Applied or Confirmed Leads | cross-page |
| The Settled / Dues badge agrees with that person's outstanding balances | deals |
| Tab counts equal the rows they filter | deals |
| Tiles equal the sum of their column, per currency | deals |
| Outstanding on Deals equals Outstanding on Applied Leads | cross-page |
| Package usage counts sum to the number of deals, and *Most used* is the maximum | packages |
| Patients lists only leads that reached Confirmed | cross-page |

---

## 9. Out of scope

`payments.html`, `dues.html`, `receipts.html`, `reports.html`, the dashboard, `plan.md`, the root `README.md`. Still a static demo with no persistence.

## 10. Not committed

Written to the working tree only. No git operations of any kind.
