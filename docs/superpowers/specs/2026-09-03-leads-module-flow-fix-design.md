# Leads Module — Five-Step Flow Fix

**Date:** 2026-09-03
**Supersedes:** parts of `2026-09-02-leads-module-redesign-design.md` (that spec stands except where contradicted below)
**Scope:** Leads module only. Other modules explicitly out of scope.
**Status:** Approved, ready for implementation planning.

---

## 1. Why this pass exists

The module built from the 2026-09-02 spec is complete and passing, but the client
has since described the process flow in their own words, and that description
**contradicts three rules the module currently enforces**. This pass reconciles the
code to the client's flow.

It is not a redesign. Most of the module is untouched.

### The contradictions being fixed

| # | Shipped rule (Sept 2) | Client's flow (Sept 3) | Resolution |
|---|---|---|---|
| 1 | Full Funded means a sponsor pays; the patient owes nothing and `Remaining` is forced to ৳0. | "For Full Funded Patients, the patient has to pay the amount in BDT. They can either pay the full amount or make a payment at that time." | **Client wins.** The sponsor model is deleted. Full Funded patients pay, in BDT only. |
| 2 | `Confirmed` is disabled in the UI until `Remaining = 0`. | "The employee will also be able to see how much amount is still due for each confirmed lead, if there is any remaining amount." | **Client wins.** Confirmed may carry a balance. The hard block becomes a warning plus an explicit acknowledgement. |
| 3 | Statuses are New / Follow-up / Applied / Confirmed / Closed. | Follow-up, Pending Follow-up, Interested, and Closed splitting into Confirmed-or-Applied and Not Interested. | **Merged.** Two statuses added, `Closed` becomes a group heading, `Applied` and `Confirmed` stay distinct values because they drive two separate pages. |

### What is simply missing

- **Step 4 has no implementation at all.** There is no invoice anywhere in the
  module. `receipts.html` is a register of receipts issued *after* payment, which
  is a different document.
- **Two of the three funding tiers are undemonstrated.** Every badged row in the
  demo is Partial Funded; `applied-leads.html` shows no funding badge at all.

---

## 2. The flow this delivers

```
Step 1        Step 2                    Step 3            Step 4              Step 5
Create   →    Conversation & Status  →  Package     →     Invoice &      →    Confirmed
Lead          (5 working statuses)      (3 tiers)         Payment             (with dues)
```

- An employee creates a lead and is taken straight to the conversation.
- Conversation outcomes drive the status: Follow-up, Pending Follow-up,
  Interested, or Closed.
- Choosing **Applied** opens package selection with a three-tier price.
- Saving Applied lands the employee on the **invoice**, where it can be printed
  and a payment recorded.
- A verified payment lets the lead be **Confirmed** — with any balance carried
  forward and tracked on the Confirmed page.

---

## 3. Decisions locked before design

| Question | Decision |
|---|---|
| Full Funded money | Patient pays the agreed amount, **BDT only**. No sponsor. No forced zero. |
| Paid vs. Partial Funded | Mechanically the same **except the reference price**. Paid has its own, higher, tier. |
| Price tiers | **All three** funding types carry a reference price per package, not just Paid. |
| Confirm gate | **Never hard-blocked.** A balance produces a warning naming the figure and a required acknowledgement. |
| Status list | **One grouped dropdown**; `Closed` is an `<optgroup>` heading over Applied / Confirmed / Not Interested. |
| "Separate tab" for Interested | **Filter tabs on `leads.html`**, not a new page. Applied and Confirmed keep their pages (they carry money columns the leads table lacks). |

---

## 4. Money rules (revises §11 of the Sept 2 spec)

```
Agreed        = Negotiated − Discount              clamped >= 0
Payment total = BDT part + (USD part × rate on that payment)
Paid          = Σ payment totals
Remaining     = Agreed − Paid                      clamped >= 0
```

1. **These four rules hold for all three funding types.** There is no longer any
   case where `Remaining` is not derived from the ledger. The `funding` parameter
   is removed from `remaining()` entirely rather than left unused, so no caller
   can pass a value that silently does nothing.
2. Funding type controls exactly one thing: **which currency fields are open.**
   - **Full Funded** — BDT field only; the USD amount and rate are hidden.
   - **Partial Funded / Paid** — BDT + USD + per-payment rate.
3. The rate is captured **per payment**, so a later rate change never rewrites an
   earlier receipt. USD amounts are stored as entered and displayed as
   `৳59,000 ($500 @ ৳118)` wherever the payment appears.
4. The existing guard stays: **a USD amount with no rate blocks Save.** It must
   never bank a total smaller than what was typed.
5. `Remaining` is always derived, never typed.
6. `Confirmed` no longer requires `Remaining = 0` (see §6).

### Terminology

| Client's column | Used here | Definition |
|---|---|---|
| Amount Received | Paid | `Σ payment totals` |
| Due Amount | Remaining | `Agreed − Paid` |

---

## 5. Package price tiers (Step 3)

Each package in `build/partials/apply-block.html` carries three reference prices
instead of one `data-standard`:

```html
<option value="PKG-CAR-02"
        data-price-full="140000"
        data-price-partial="350000"
        data-price-paid="420000">Angioplasty — single stent</option>
```

### Rules

1. Selecting a package, or switching funding type, **seeds the negotiated price
   from the matching tier**.
2. **Seeding never overwrites a figure the employee has typed.** The negotiated
   field carries a dirty flag. Once it is dirty, switching funding type does not
   change the amount; instead a link appears:
   `Re-seed from Paid tier (৳4,20,000)?` — clicking it reseeds and clears the flag.
   This is the difference between a helpful default and destroying a number
   somebody just negotiated on the phone.
3. The tier price is **reference only**, never submitted as the agreed figure.
4. The negotiated price is freely editable **in both directions** — above and
   below the tier price. This is the client's core requirement and is unchanged.
5. The delta note reports against the **active tier**, not a fixed standard:
   `▲ ৳30,000 above the Paid tier` / `▼ ৳15,000 below the Partial Funded tier`.
   It reports; it does not police, warn, or block.
6. `Discount` is a separate deduction on top: `Agreed = Negotiated − Discount`.

### Tier figures

The existing 33-package catalogue's `data-standard` value **becomes the Partial
Funded tier**, so no figure currently in the demo is invalidated. The other two
tiers are seeded at:

- **Full Funded** = `standard × 0.40`, rounded to the nearest ৳5,000
- **Paid** = `standard × 1.20`, rounded to the nearest ৳5,000

> **These ratios are placeholders.** They produce a plausible, internally
> consistent catalogue so the three-tier mechanism can be demonstrated and
> approved. The real tier prices must come from the client's price list before
> this is anything more than the correct shape. This is called out again in §13.

---

## 6. Statuses (Step 2)

Replaces the five-option dropdown on `leads.html`.

```
Status  [ Follow-up                    ▾ ]

    New
    Follow-up             → date required + remark
    Pending Follow-up     → remark only, no date
    Interested            → remark + optional next contact
  ── Closed ────────────────────────────────
    Applied               → package + tier + negotiated price → invoice
    Confirmed             → warned if a balance remains
    Not Interested        → reason + remark
```

`Closed` is an `<optgroup>` label — a heading, not a selectable value. `Applied`
and `Confirmed` keep their own values because `applied-leads.html` and
`confirmed-leads.html` are driven by them.

### Follow-up vs. Pending Follow-up

The distinction is the date, and it is the whole distinction:

- **Follow-up** — the lead named a time to be contacted again. Next follow-up
  date is **required**.
- **Pending Follow-up** — the employee made contact, the lead committed to
  nothing and will come back to them. **No date field**, because inventing one
  would record a commitment that was never made.

Both use `#stFollowupModal` with its title, helper copy and date field toggled by
which status opened it.

### Confirmed with a balance

`lockConfirmed()` stops disabling the option. It keeps only the label and tooltip
that name the outstanding figure. When a lead with `data-remaining > 0` is driven
to Confirmed, `#stConfirmedModal` swaps its green banner for:

```
!  ৳2,76,000 is still outstanding on this lead.
   [ ] I understand this lead will be confirmed with a balance due.

                              [ Cancel ]   [ Confirm ]
```

**Confirm stays disabled until the box is ticked.** At `Remaining = 0` the modal
is unchanged from today — green banner, no checkbox, Confirm enabled.

### Not Interested

`#stClosedModal` becomes `#stNotInterestedModal`. Its reason list drops
`Treatment complete` (that is not a not-interested reason and belongs to a lead
that was confirmed and finished) and keeps: `Too expensive`, `Chose another
provider`, `Treating locally`, `No longer needed`, `Unreachable`, `Duplicate`,
`Other`. A remark is optional; the reason is required.

---

## 7. Filter tabs on `leads.html` (Step 2)

A tab strip above the table:

```
┌───────┬───────────┬───────────────────┬────────────┬────────────────┐
│ All 6 │ Follow-up │ Pending Follow-up │ Interested │ Not Interested │
│═══════│     2     │         1         │     1      │       1        │
└───────┴───────────┴───────────────────┴────────────┴────────────────┘
```

- Counts are **derived from the rows at load**, never hardcoded, so they cannot
  drift from the table beneath them.
- Filtering is implemented as a **DataTables custom search function**, not
  `display:none` on `<tr>`. Hiding rows directly would leave DataTables' paging,
  "showing N of M" count and sorting all describing rows that are not visible.
- Each row carries `data-status` on the `<tr>`; the status dropdown updates it on
  save, so a lead moved to another status leaves the current tab immediately and
  the counts re-render.
- `Applied` and `Confirmed` are deliberately **not** tabs here — they have their
  own pages.

---

## 8. `invoice.html` — new page (Step 4)

### Reached from

- **The Apply modal**, on save → `invoice.html?lead=<id>`. This is literally the
  client's "the employee will be taken to the invoice and payment section".
  The apply block appears on both `leads.html` (as `#stAppliedModal`) and
  `conversations.html`; **both navigate to the invoice on save**, because the
  client's Step 3 → Step 4 hand-off does not depend on which screen the employee
  happened to apply from.
- An **Invoice** action on every `applied-leads.html` and `confirmed-leads.html`
  row, so a lost invoice can be reprinted.

### Not in the sidebar

`invoice.html` is always opened in the context of one lead. A menu entry would
lead to a blank invoice for nobody, so it is registered in `build/build.js`
`PAGES` but not in `build/menu.js`. `build.js` handles this already — a page
absent from the menu simply renders with no active sidebar item.

### Content

```
┌─ invoice.html?lead=ELH-L-2026-000412 ───────────────┐
│  E LIFE HEALTHCARE            INVOICE INV-000118    │
│  Dhaka, Bangladesh            Issued 03 Sep 2026    │
│                                                     │
│  Bill to    Rahim Uddin (guardian)                  │
│             Patient: Tanvir Ahmed                   │
│             +880 1711-xxxxxx · Cumilla              │
│                                                     │
│  Angioplasty — single stent      [Partial Funded]   │
│  Negotiated                          ৳ 4,50,000     │
│  Discount                            ৳   15,000     │
│  ─────────────────────────────────────────────────  │
│  AGREED                              ৳ 4,35,000     │
│                                                     │
│  Payments received                                  │
│   12 Aug 2026  Advance   Cash   ৳1,00,000  MR-000231│
│   20 Aug 2026  2nd inst. bKash  ৳59,000    MR-000255│
│                          ($500 @ ৳118)              │
│  ─────────────────────────────────────────────────  │
│  Paid                                ৳ 1,59,000     │
│  BALANCE DUE                         ৳ 2,76,000     │
│                                                     │
│      [ Print ]  [ + Record Payment ]  [ Back ]      │
└─────────────────────────────────────────────────────┘
```

- The company header reads from the same values `settings.html` describes.
- The funding tier is shown as a badge — an invoice for a Full Funded patient and
  one for a Paid patient are different documents and should not look identical.
- **Record Payment** opens the same `#addPaymentModal` used on
  `applied-leads.html`, with the same USD-rate guard.

### Print

A `@media print` block hides the sidebars, topbar, footer, breadcrumb and every
button, sets a white background and lets the invoice card run full width. The
rules live in `assets/css/crm-brand.css` under a `.invoice-sheet` scope so they
cannot affect any other page's printing.

---

## 9. `applied-leads.html` changes

- **Funding column added.** The page currently shows no funding badge at all,
  which makes the three tiers invisible on the one page where they matter most.
- **Invoice action added** alongside `+ Payment` and `History`.
- **`#addPaymentModal` gates the USD leg on funding type.** For a Full Funded
  row the USD amount and rate are hidden, not merely ignored — an employee must
  not be able to type a USD figure that the tier does not accept. The modal
  learns the tier from a `data-funding` attribute on the `+ Payment` button,
  read in the same `show.bs.modal` handler that already reads `data-remaining`.
  Hiding the fields must also **clear** them, so a value typed for a Partial
  Funded row cannot survive into a Full Funded one — the modal is a single
  shared DOM node reused by every row.
- Tiles are unchanged: Total Applied · Total Negotiated · Total Received ·
  Total Remaining.

---

## 10. `confirmed-leads.html` changes (Step 5)

- **Tiles** become: `Total Confirmed` · `Total Collected` ·
  **`Total Outstanding`** · `Confirmed This Month`.
  The average-days tile is dropped; outstanding money is what the client asked to
  see, and four tiles is the established layout.
- **A `Due` column is added**, red and bold where non-zero, blank-dashed at zero.
- Rows carrying a balance get a subtle warning tint so they are findable without
  reading every figure.
- **Invoice action added.**
- Status transitions from here are unchanged: → `Not Interested`, or → `Applied`
  if a payment is reversed.

---

## 11. Demo data

The demo is the deliverable for this pass — it is what the client clicks through.
It must therefore *show* the three things this spec changes:

1. **All three funding tiers appear** on `leads.html`, `applied-leads.html` and
   `confirmed-leads.html`. At minimum: one Full Funded row carrying a BDT-only
   balance, one Partial Funded row with a USD payment in its ledger, one Paid row.
2. **At least two confirmed leads carry a due**, and at least two are fully
   settled — otherwise §10's Due column and Total Outstanding tile render as a
   column of dashes and the feature the client asked for is invisible.
3. **Every status has at least one row**, so no filter tab in §7 opens empty.
   The new taxonomy has seven statuses and `leads.html` currently holds six
   rows, so the table grows. **As built it holds eleven rows**: one per status,
   four Applied (the four leads that also appear on `applied-leads.html`, so the
   cross-page check in §12 has something to compare), and two Follow-ups so at
   least one tab shows a count above 1 and proves the filter is really filtering
   rather than always matching a single row.

All figures must reconcile: `Paid + Remaining = Agreed` per row, every tile
equal to the sum of its column, every payment ledger summing to its row's Paid.

---

## 12. Verification

The previous pass's review caught a **Critical** defect — hand-authored money on
the leads table contradicting `deals.html` and `dues.html` for the same patients.
This pass changes the money rule *and* adds two funding tiers across five pages,
so that class of drift is now more likely, not less.

`build/verify.js` gains a **money reconciliation check** that parses the rendered
tables. The pages do not all render the same figures, so the assertions are
scoped to what each one actually shows:

| Assertion | Where it runs |
|---|---|
| `Paid + Remaining = Agreed` per row | `applied-leads.html` (the only page rendering all three) |
| Rendered due equals the row's `data-remaining` attribute | all three lead pages |
| Every tile equals the sum of the column it summarises | `applied-leads.html`, `confirmed-leads.html` |
| Every payment ledger sums to its parent row's Paid | `applied-leads.html` |
| **A lead ID appearing on more than one page shows the same Paid, Due and funding tier on each** | across `leads.html`, `applied-leads.html`, `confirmed-leads.html`, `invoice.html` |
| A Full Funded row carries no USD payment | `applied-leads.html` |

The last row is the important one. The Critical defect the previous review caught
was exactly this — the same patient carrying different figures on different
pages — and it was caught by a human reading two tables side by side. Asserting
it mechanically is what stops it recurring while three tiers and eight rows are
being hand-authored.

`build/test-money.js` is updated:

- the case `remaining(435000, 0, 'full') === 0` is **deleted** — it asserts the
  rule this spec removes;
- new cases prove all three tiers derive `Remaining` identically;
- new cases cover tier seeding and the dirty-flag guard from §5.2.

Existing checks are unchanged, and all pages must still reproduce byte-for-byte
from `build/`.

---

## 13. Assumptions and open items

1. **Tier prices are placeholders** (§5). The `× 0.40` / `× 1.20` ratios exist to
   demonstrate the mechanism. The client's real three-tier price list must replace
   them. This does not block implementation — the shape is what is being approved.
2. **Invoice numbering** uses a demo sequence `INV-0000NN` parallel to the
   existing `MR-0000NN` receipt series. Real numbering rules belong to
   `settings.html`, which is out of scope.
3. **"Payment completed and confirmed"** (client's Step 4) is read as *a payment
   has been recorded and verified* — not *the balance has reached zero*. §6's
   warned-confirm follows from that reading, and §10's Due column only makes
   sense under it.

---

## 14. Files

| File | Change |
|---|---|
| `assets/js/crm-leads.js` | Money engine (§4), tier seeding (§5), statuses (§6), tabs (§7), warned confirm (§6) |
| `build/partials/apply-block.html` | Three-tier prices on 33 packages; funding → currency wiring |
| `build/partials/status-modals.html` | Pending Follow-up + Interested modals; warned confirm; Not Interested |
| `build/pages/leads.html` | Status options, filter tabs, funding badges, demo rows |
| `build/pages/applied-leads.html` | Funding column, Invoice action, USD gating, demo rows |
| `build/pages/confirmed-leads.html` | Due column, retiled, Invoice action, demo rows |
| `build/pages/conversations.html` | Outcome list aligned to the new statuses |
| `build/pages/invoice.html` | **New** (§8) |
| `build/build.js` | `invoice.html` in `PAGES` with `swal` + `leadsjs` |
| `build/verify-manifest.js` | Required ids for the new and changed markup |
| `build/verify-money.js` | **New** — the money reconciliation itself (§12) |
| `build/verify.js` | Calls it as check 7 |
| `build/test-money.js` | Revised cases (§12) |
| `assets/css/crm-brand.css` | `.invoice-sheet` print rules |
| `build/README.md` | Document the tier attributes and the invoice page |

`build/menu.js` is **not** changed — no new sidebar entry (§8).

---

## 15. Out of scope

Deliberately untouched, and stale until a later pass:

- `patients.html`, `payments.html`, `dues.html`, `receipts.html`, `reports.html`,
  `index.html` dashboard, `packages.html`, `pipeline.html`, `followups.html`
- `plan.md`, root `README.md`
- Merging the new invoice with `receipts.html`. An invoice is a demand for
  payment; a receipt is proof of one. They are different documents and stay
  separate.
- Real persistence. This remains a static HTML demo — all behaviour is page-level
  JavaScript for click-through review.

---

## 16. Not committed

Per the standing instruction on this branch, this document is written to the
working tree and **not** committed. No git operations of any kind are performed
in this pass.
