# Leads Module — Round 2

**Date:** 2026-09-03
**Supersedes:** large parts of `2026-09-03-leads-module-flow-fix-design.md` (see §10)
**Scope:** Lead Management only.
**Status:** Approved, implementing.

---

## 1. What changed and why

Client review of the round-1 build asked for four structural changes and one bug fix:

1. The package catalogue and funding type are **one concept, not two**.
2. Dollar amounts are a **separate balance**, not a converted part of the BDT total.
3. **Completed** is derived from payment, and **Confirmed** is a deliberate step after it.
4. The leads table shows too much; status changing belongs in Actions.
5. The package dropdown does not work.

### The dropdown bug

`crm-demo.js` initialises `jQuery('.crm-select2').select2({...})` with **no `dropdownParent`**, and every `#lc-package` lives inside a Bootstrap modal. select2 appends its dropdown to `<body>`; the modal's focus trap then swallows clicks and keystrokes in it, so the control looks dead.

Two fixes, both applied:

- The package selector no longer needs select2 — three options is a plain control.
- `dropdownParent` is set to the closest `.modal` for **every** `.crm-select2`, so no other select2 in a modal has the same fault.

---

## 2. Packages

The 33-item medical catalogue and the funding-type radios are both **removed**. One concept remains — the package — and each package carries a flag saying whether it accepts dollars.

| Package | Accepts USD | Default BDT | Default USD |
|---|---|---|---|
| Full Funded Patients | No | ৳4,00,000 | — |
| Partial Funded Patients | Yes | ৳2,50,000 | $2,500 |
| Paid Patients | Yes | ৳3,00,000 | $4,000 |

Nothing hardcodes these three names. `packages.html` gains an **Add Package** form: name, default BDT price, **Accepts USD payments?**, and a default USD price revealed when that is ticked. The three rows above are seed data.

Selecting a package seeds the price fields from its defaults, and **seeding never overwrites a figure the employee has typed** — the round-1 dirty-flag guard is kept, because the reason for it has not changed.

---

## 3. Money — two balances, never converted

The exchange rate is **deleted from the system**. There is no rate field, no conversion, and no missing-rate guard, because nothing converts.

```
BDT   Package Price → Negotiated → Discount → AGREED ৳ → Paid ৳ → Due ৳
USD   Package Price → Negotiated → Discount → AGREED $ → Paid $ → Due $
```

The USD row exists only when the selected package accepts dollars.

### Rules

1. `Agreed = Negotiated − Discount`, per currency, clamped at 0.
2. `Due = Agreed − Paid`, per currency, clamped at 0.
3. A payment is recorded **in one currency** and reduces that currency's balance only.
4. Due is always derived, never typed.
5. For a BDT-only package the USD figures are absent, not zero-valued inputs — an employee must not be able to type a dollar amount the package does not accept.
6. **`Completed` ⇔ `Due ৳ = 0 AND Due $ = 0`.**

---

## 4. Completed and Confirmed

```
Applied ──(৳ due = 0 AND $ due = 0)──▶ Completed ──[ Confirm ]──▶ Confirmed Leads
             automatic, a badge                     manual action
```

- **Completed is never a dropdown option.** It is derived and rendered as a green badge — on the Applied Leads row while the lead is still there, and on the Confirmed Leads row afterwards, since a confirmed lead is by definition completed.
- **Confirmed stays manual** and is disabled until the lead is Completed. Its tooltip names both outstanding figures: *"৳1,50,000 and $2,000 still due."*
- Round 1's acknowledgement checkbox is **removed** — a lead can no longer be confirmed with a balance.
- Because nothing on Confirmed Leads can owe anything, its **Due column is removed**; it shows Total Paid in both currencies.

### Status list

```
New · Follow-up · Pending Follow-up · Interested
── Closed ──
Applied · Confirmed · Not Interested
```

Unchanged from round 1 except that Confirmed is gated on Completed rather than warned.

---

## 5. Leads table — 14 columns to 8

**Kept:** Lead ID · Patient / Guardian · Phone · Source · Status · Assigned To · Next Follow-up · Actions

**Moved into Quick View:** Location, Age, Condition, Inquiry date, Package, Money, Remarks.

- **Status becomes a read-only badge.** Changing it moves into Actions, as asked.
- **Import is removed** from the toolbar.
- The status filter tabs from round 1 stay — they are what makes a slimmer table navigable.

**Actions:** Quick View · Log Conversation · Change Status · Edit.

---

## 6. Quick View

One modal per row holding everything the table no longer shows: identity, contact, location and age, condition, source, inquiry date, assigned staff, current status, package with both currency ledgers, follow-up dates, remarks, and uploaded documents. Read-only; editing stays in Edit.

---

## 7. Add Lead

**Assigned Sales Executive** pre-fills with the logged-in employee and is disabled. A checkbox — *"Assigning on behalf of someone else"* — enables the select.

> **Carry into the Laravel build:** a `disabled` field submits nothing. This must become `readonly`, or be re-enabled on submit, or the assignment arrives empty. Recorded in `build/README.md`.

---

## 8. Documents after Applied

The Apply step gains two multi-file inputs after the money block:

- **Medical Documents** — reports, prescriptions, test results
- **Other Documents** — NID, passport, consent forms

Both are re-openable from an Applied Leads row action, so a missing file can be added later without re-applying.

---

## 9. Sidebar

In the client's order:

```
Leads · Conversations · Applied Leads · Follow-ups · Confirmed Leads · Sales Pipeline · Sources / Referrals
```

---

## 10. What round 1 work this obsoletes

| Built in round 1 | Fate |
|---|---|
| 33-package catalogue, three price tiers (`data-price-*`) | Deleted |
| Funding-type radios | Deleted — the package carries it |
| `paymentTotal(bdt, usd, rate)`, per-payment rate, missing-rate guard | Deleted |
| `tierPrice()`, `usesUsd()`, `TIERS` | Deleted |
| Warned-confirm banner, `#st-confirmed-ack` | Deleted |
| Due column on Confirmed Leads | Deleted |
| Status dropdown in the leads table | Moved into Actions |
| `verify-money.js`, `test-money.js` | Rewritten for dual balances |

The round-1 spec stands only where this document does not contradict it — the status taxonomy, the filter tabs, the invoice page and the seeding dirty-flag guard all survive.

---

## 11. Verification

`build/test-money.js` is rewritten around the dual-balance rules: agreed per currency, due per currency, and `isCompleted` requiring both at zero. The deleted functions must be **absent**, not merely unused, so a stale caller fails loudly.

`build/verify-money.js` is rewritten to reconcile two currencies:

| Assertion | Where |
|---|---|
| `Paid ৳ + Due ৳ = Agreed ৳` and the same in USD | `applied-leads.html` |
| Rendered dues match `data-due-bdt` / `data-due-usd` | all lead pages |
| Tiles equal the sum of their column, per currency | applied, confirmed |
| A row badged Completed has both dues at zero, and no un-badged row does | applied |
| Confirmed Leads contains **no** row with any outstanding balance | confirmed |
| Same lead ID shows the same figures and package on every page | cross-page |
| A BDT-only package's row carries no USD figures | applied, confirmed, invoice |

---

## 12. Out of scope

`patients.html`, `payments.html`, `dues.html`, `receipts.html`, `reports.html`, the dashboard, `plan.md` and the root `README.md` stay as they are and are stale. This remains a static demo with no persistence.

## 13. Not committed

Written to the working tree only. No git operations of any kind.
