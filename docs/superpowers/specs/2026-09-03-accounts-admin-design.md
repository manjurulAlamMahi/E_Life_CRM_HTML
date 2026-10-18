# Round 4 — Patients, Deals, Accounts and Administration

**Date:** 2026-09-03
**Builds on:** `2026-09-03-patients-deals-design.md`
**Status:** Approved, implementing in three passes.

---

## 0. Scope

Three independent projects, built and verified one after the other:

| Pass | Covers |
|---|---|
| 1 | Patients columns, patient-profile tab fix, Deals action, Package on/off, Workspace removal |
| 2 | Accounts — payment verification, receipt generation, dues with alerts |
| 3 | Users & Roles with a Spatie-style permission matrix |

---

## 1. Patients

### The roster changes

The client's note on Deals — *"when there been applied and deal happened they are now patient of ours"* — settles who a patient is. **A patient record exists for anyone with a deal**, not only for leads that reached Confirmed. The roster grows from 6 to 11.

This is what makes the new Situation column worth having: it can say Applied or Confirmed rather than reading "Confirmed" on every row.

### Columns

`Patient ID · Patient / Guardian · Phone · Condition · Lead Created · Package · Situation · Treatment · Action`

- **Doctor / Hospital removed** from the table; it stays on the profile's Overview tab, where it belongs.
- **Lead Created** — the date the enquiry came in.
- **Situation** — the lead's stage: `Applied`, `Confirmed`, or `Closed`.
- **Treatment** — the clinical state: `Awaiting`, `Active`, `Completed`. Named apart from Situation so the two are not read as the same thing.

### The profile tab underline

`card-header pb-0` combined with `card-header-tabs` leaves the card header's own bottom border running behind the tab strip, so the active tab appears struck through. The nav's bottom border is pinned to the header edge so the active tab breaks the line, as Bootstrap intends.

---

## 2. Deals

`Not yet a patient` is removed — everyone on this page is a patient.

| Person's state | Action |
|---|---|
| Owes anything | **Pay** — records against their open deal, in the currency chosen |
| Settled | **New Deal** — opens the package form and starts a fresh deal |

Both keep a profile link. No button is ever rendered disabled and useless.

The Pay modal reuses the round-2 rules: one currency per payment, no conversion, capped at the outstanding balance in that currency.

---

## 3. Packages

The `Active` badge becomes an **on/off switch** per row. Switching a package off keeps it on the deals that already use it but removes it from the Apply dropdown, so a package can be retired without orphaning anything. The switch state is `data-active` on the row.

---

## 4. Workspace — removed

- `tasks.html` and `documents.html` are removed from `build/build.js`, from `build/pages/`, and from the repo root.
- `reports.html` **moves to Administration**. It is management reporting, and the client's own questions depend on it.
- The `Workspace` sidebar title is removed.

Documents still attach to patients and still appear on the patient profile. Only the standalone page goes.

---

## 5. Accounts (pass 2)

### Payments

Money does not count until it is verified.

```
Patient says they paid  →  PENDING  →  Accounts verifies  →  receipt issued, due reduced
                                    →  Accounts rejects   →  reason recorded, due unchanged
```

- A **Pending Verification** queue sits above the full payment history.
- **Verify** issues the receipt and reduces that currency's balance. **Reject** requires a reason.
- A **Details** modal carries the patient, **the executive who took the payment**, method, reference, proof, currency, amount and the full timestamp trail. The executive was missing before and is what makes a disputed payment traceable.
- Below the queue, the complete payment history, filterable.

### Money Receipts

A receipt can be generated for **any verified transaction**. The page lists every transaction with its receipt state, filters across date range, patient, executive, method and currency, and each row prints or downloads. Transactions without a receipt yet carry a **Generate** action.

### Dues & Collections

- **Tiles:** `Collected This Month · Still Outstanding · This Month vs Last`.
- **Chart replaced.** The ageing-only view becomes collected-versus-outstanding month by month, which is the question the client actually asked.
- The dues list gains an **Executive** column and a **Remind** action that alerts that executive to chase the balance.

---

## 6. Users & Roles (pass 3)

### Users

Lists **everyone, admins included** — name, email, phone, role, designation, last login, status. Add User captures the details and assigns a role. Rows can be edited or deactivated.

### Roles & Permissions — new page

The Spatie model: roles hold permissions. A matrix with roles across the top and permissions down the side, grouped by module (Leads, Patients & Deals, Accounts, Administration), as checkboxes. Roles can be added; each role's permissions are editable.

Per-user permission overrides are **out of scope** — roles carry permissions, and that is the whole model here.

---

## 7. Verification changes

- The rule *"a patient exists only for a lead that reached Confirmed"* becomes **"a patient exists for everyone with a deal"**, and the patient count must equal the number of people on Deals.
- A patient's **Situation** must match that lead's status on Applied or Confirmed Leads.
- Every **verified** payment must appear in the payment history, and pending payments must **not** be counted in any collected total.
- Receipt amounts must equal the transaction they were generated from.
- Dues per patient must match that person's outstanding on Deals.
- Package on/off state must not contradict usage: a package that is off may still carry deals, but must not appear in the Apply dropdown.

---

## 8. Out of scope

`plan.md`, the root `README.md`, the dashboard's existing charts. Still a static demo with no persistence.

## 9. Not committed

Written to the working tree only. No git operations of any kind.
