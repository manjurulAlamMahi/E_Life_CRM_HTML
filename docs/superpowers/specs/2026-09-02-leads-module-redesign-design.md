# Leads Module Redesign — Design

**Date:** 2026-09-02
**Scope:** Leads module only. Other modules are explicitly out of scope for this pass.
**Status:** Approved, ready for implementation planning.

---

## 1. Why

Client review of the demo raised three problems with the Leads module:

1. **Doctor and Hospital do not belong on a lead.** The business sends patients to India for treatment; the Indian team assigns the doctor and hospital later, based on the patient's condition. Capturing a "preferred doctor" at lead stage records a guess as if it were a decision.
2. **Package prices are treated as fixed.** They are negotiable in both directions. The employee must be able to settle on a price above or below the standard one.
3. **Status is a dead badge.** Staff need to move a lead through its lifecycle from the list itself, and need dedicated views of Applied and Confirmed leads with the money attached.

## 2. The workflow this delivers

```
Add Lead  →  Conversation  →  Applied  →  Payment(s)  →  Confirmed
```

- An employee adds a lead and is taken straight to the Conversation page.
- Conversations are logged as notes until the family agrees.
- On agreement the lead moves to **Applied**: package chosen, price negotiated, funding type set.
- Payments are recorded against the applied lead, one entry per payment, until nothing remains.
- Only when the remaining balance reaches zero can the lead become **Confirmed**.

## 3. Decisions locked before design

| Question | Decision |
|---|---|
| Package vs. funding type | **Two separate fields.** Package is a named item; Funding Type is Full Funded / Partial Funded / Paid. |
| Package price | **Standard price is a reference default, always editable, in both directions.** Not a floor, not a ceiling. |
| BDT and USD | **A payment may carry a BDT part and a USD part.** The employee enters the USD rate on that payment; the system converts and keeps one Paid total and one Remaining figure in BDT. The original USD amount is stored and printed. |
| Applied / Confirmed lists | **Separate sidebar pages**, each with purpose-built columns. |
| Confirmed gate | **Blocked in the UI until Remaining = 0.** |

## 4. Files

| File | Change |
|---|---|
| `leads.html` | Add Lead modal; table columns; status dropdown |
| `conversations.html` | Package / negotiated-price block |
| `applied-leads.html` | **New** |
| `confirmed-leads.html` | **New** |
| all 17 pages | Two sidebar entries under Lead Management (scripted; the sidebar block is duplicated twice per file) |

---

## 5. Add Lead

**Removed**

- `Preferred Doctor` (`leads.html:781-782`)
- `Preferred Hospital` (`leads.html:785-786`)

**Changed**

- `Medical Requirement / Treatment` becomes **`Patient Issue / Condition`** — a full-width `textarea` (3 rows) instead of a single-line input, so the employee can record a real clinical note rather than a two-word label.
  Placeholder: *"e.g. Blocked artery, advised bypass. Diabetic, on insulin 6 years."*

**Retained**

`Hospital` and `Doctor Referral` remain valid **Lead Source** options (`leads.html:790`). These describe where the enquiry came from, not treatment assignment, and are unaffected by the removals above.

**Footer**

A single primary action: **`Save & Start Conversation ▸`**, navigating to `conversations.html?lead=<new lead id>`.

No "Save & Add Another". The requirement is that the employee goes to the conversation immediately; a second button invites them not to.

---

## 6. Package and negotiated price

Replaces `conversations.html:646-673`, where prices are welded into option labels (`data-price`) and discount is the only lever on the price.

### Layout

```
Package *          [ Cardiac Surgery — Standard      ▾ ]
                     Standard price ৳4,00,000  (reference only)

Negotiated price * [ ৳ ][ 4,50,000 ]
                     ▲ ৳50,000 above standard

Discount           [ ৳ ][ 15,000 ]

┌────────────────────────────────────────────────────────┐
│ Standard      Negotiated     Discount     AGREED       │
│ ৳4,00,000     ৳4,50,000      ৳15,000      ৳4,35,000    │
└────────────────────────────────────────────────────────┘
```

### Rules

1. **Standard price is reference text, not a constraint.** It is displayed as muted helper text under the package field and is never submitted as the agreed figure.
2. **Negotiated price pre-fills from the standard price and is freely editable.** Both `40,000 → 35,000` and `40,000 → 45,000` are valid.
3. **The delta note reports, it does not police.** Above standard renders `▲ ৳X above standard`, below renders `▼ ৳X below standard`. Neither blocks submission nor raises a warning.
4. **Discount is a separate deduction on top of the negotiated price.**
   `Agreed = Negotiated − Discount`
5. Negotiated price is **required**; discount defaults to 0.
6. Discount may not exceed the negotiated price. Agreed is clamped at 0.

### Package selector

33 packages make a plain `<select>` unusable. The field becomes a **select2 dropdown, searchable, grouped by category** (`<optgroup>`). select2 is already loaded on the page (`assets/libs/select2/js/select2.min.js`) — no new dependency.

The demo is seeded with a 33-package catalogue across the existing categories (Cardiac, Oncology, Orthopedic, Neurology, Pediatric, and others as needed).

### Funding type

Retained in this block as **Full Funded / Partial Funded / Paid** — column 12 of the client's list.

| Funding | Effect |
|---|---|
| Full Funded | Money block collapses. Paid from patient = ৳0, and Remaining is **forced to ৳0** — a sponsor covers the agreed amount, so the patient owes nothing. Note: *"Sponsor covers the full ৳X."* |
| Partial Funded | Both BDT and USD entry open. `Remaining = Agreed − Paid`. |
| Paid | Paid defaults to the full agreed amount, editable. |

Full Funded is the one case where Remaining is not derived from the payment ledger. Because Remaining is ৳0 from the moment the lead is Applied, a Full Funded lead can be moved to Confirmed immediately — there is nothing to collect.

---

## 7. Status dropdown

Replaces the static badge at `leads.html:628`. Rendered in the Patient Status cell.

```
┌──────────────────┐
│ Follow-up     ▾  │
└──────────────────┘
   ├ Follow-up      → next follow-up date + remark
   ├ Applied        → package + negotiated price + funding type
   ├ Confirmed      (disabled while a balance remains)
   └ Closed         → reason + remark
```

### Rules

- Each option opens its own modal. **The status changes only when that modal is saved** — a mis-click costs nothing.
- The **Applied** modal is the same package / negotiated-price block defined in section 6, reused verbatim. It is authored once and appears in both `leads.html` and `conversations.html`; the two copies must stay identical.
- Selecting **Follow-up** sets `Last Follow-up = today` and `Next Follow-up = the chosen date`.
- **Confirmed is disabled whenever Remaining > 0**, with a tooltip naming the outstanding figure: *"৳2,76,000 still due — record the remaining payment first."* It unlocks automatically when the final payment brings Remaining to ৳0.
- **Closed** requires a reason: Treatment complete / Not interested / Lost / Duplicate / Other, plus a remark.

---

## 8. `applied-leads.html` (new)

**Tiles:** Total Applied · Total Negotiated Value · Total Received · Total Remaining

**Columns**

| Column | Notes |
|---|---|
| Lead ID | mono |
| Patient / Guardian | patient bold, guardian muted below |
| Phone | with WhatsApp link |
| Package | name only |
| Negotiated | agreed amount |
| Paid | green |
| Remaining | red, bold |
| Status | dropdown, per section 7 |
| Staff | assigned employee |
| Applied On | date |
| Action | `+ Payment`, `History` |

**Row expansion — payment ledger**

```
Payments — ELH-L-2026-000412
 12 Aug 2026   Advance     Cash    ৳1,00,000                MR-000231
 20 Aug 2026   2nd inst.   bKash   ৳59,000 ($500 @ ৳118)    MR-000255
                                   ─────────
                           Paid    ৳1,59,000
                           Remain  ৳2,76,000
```

**`+ Payment` modal**

Fields: date · method · reference · BDT amount · USD amount · USD rate · proof upload · note.

- The rate is captured **per payment**, so a later rate change never rewrites an earlier receipt.
- `Payment total (BDT) = BDT amount + (USD amount × rate)`
- Paid and Remaining recalculate live as the employee types.
- A payment may not exceed the Remaining balance; the field is clamped and the excess flagged.
- When Remaining reaches ৳0, a green banner appears — *"Fully paid — this lead can now be Confirmed"* — and the Confirmed option in the status dropdown unlocks.

---

## 9. `confirmed-leads.html` (new)

**Tiles:** Total Confirmed · Total Collected · Confirmed This Month · Avg. days Applied → Confirmed

**Columns:** Lead ID · Patient / Guardian · Phone · Package · Total Paid · Confirmed On · Confirmed By · Receipts · Status

**Status transitions from here**

- → **Closed** when treatment is complete.
- → **Applied** if a payment is reversed or refunded, which reopens a balance.

---

## 10. Leads table columns

The client's 17 fields, plus the new condition note, rendered as 14 cells by pairing fields that belong together (the template already does this with "Guardian / Patient"). A **Columns** toggle hides any of them; the table scrolls horizontally on small screens.

| Cell | Client fields |
|---|---|
| Patient ID | 1 |
| Patient / Guardian | 2 + 3 |
| Phone / WhatsApp | 4 |
| Location · Age | 5 + 6 |
| Condition | Patient Issue / Condition (truncated, full on hover) |
| Source | 7 |
| Inquiry Date | 8 |
| **Status** | 9 — the dropdown |
| Staff | 10 |
| Package / Funding | 11 + 12 |
| Received / Due | 13 + 14, with an `incl. $500` sub-line where USD was taken |
| Follow-up | 15 + 16 — last muted, next red when overdue |
| Remarks | 17 (truncated, full on hover) |
| Action | conversation, edit |

`Treatment` and `Priority` (Hot/Warm/Cold) are **not** in the client's list. They are removed from the default view but kept in the record and available through the Columns toggle, rather than deleted outright.

---

## 11. Money rules

These hold everywhere in the module.

1. `Agreed = Negotiated − Discount`, clamped at 0.
2. `Payment total (BDT) = BDT part + (USD part × rate on that payment)`.
3. `Paid = Σ payment totals`.
4. `Remaining = Agreed − Paid`, clamped at 0 and never negative — **except Full Funded, where Remaining is ৳0 by definition** (section 6).
5. Remaining is **always derived, never typed**, so it cannot drift out of sync with the payment ledger.
6. USD amounts are stored as entered alongside their rate, and displayed as `৳59,000 ($500 @ ৳118)` wherever the payment appears.
7. `Confirmed` requires `Remaining = 0`.

### Terminology

The client's column names and the internal names for the same two figures:

| Client's column | Used in this spec | Definition |
|---|---|---|
| Amount Received | Paid | `Σ payment totals` |
| Due Amount | Remaining | `Agreed − Paid` |

Both names refer to one value each. The UI uses the client's wording; the rules above use the internal wording.

---

## 12. Out of scope for this pass

Deliberately untouched, and stale until a later pass:

- `patients.html`, `payments.html`, `dues.html`, `receipts.html`, `reports.html`, `index.html` dashboard, `packages.html`
- `plan.md` and `README.md`
- The five dashboard overview groups (Patient / Package / Payment / Staff / Lead Performance)
- Adding "Camp" as a lead source

This is a static HTML demo. No backend, no persistence — interactions are wired in page-level JavaScript for click-through review.
