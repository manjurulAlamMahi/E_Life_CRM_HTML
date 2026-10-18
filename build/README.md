# Template Build — E Life Healthcare CRM

Static HTML client preview, assembled from the Aquiry template's own chrome.

```
node build/build.js        # regenerates every page at the repo root
```

## Why a build step

The previous attempt hand-wrote each page and **omitted the template's topbar and
sidebar entirely** — every page jumped straight from `#layout-wrapper` to
`.main-content`. The template's CSS positions `.main-content` assuming a 264px
sidebar and a 65px fixed topbar exist in the DOM, so the content floated with
nothing around it. That is what "broken" looked like. A 729-line override
stylesheet with 57 `!important` rules was then fighting the symptoms.

This build takes the chrome from the real template file, verbatim, and injects
only the page body. The chrome cannot drift out of sync because it exists once.

## Layout

```
build/
  build.js              assembler — page list, shell, sidebar generation
  menu.js               single navigation definition (plan.md §21)
  partials/
    topbar.html         brand, quick-add, search, notifications, profile
    footer.html
    sidebar-vertical.html    ) extracted from the template for reference;
    sidebar-horizontal.html  ) the live ones are generated from menu.js
    scripts.html
    settings-panel.html      unused — template demo content, see below
    apply-block.html         package + a money column per currency + documents
    status-modals.html       follow-up / interested / applied / confirmed /
                             not-interested
    quick-view.html          read-only detail modal for a leads row
  pages/
    <page>.html         page body only, injected between the chrome
```

## Shared blocks

`apply-block.html` and `status-modals.html` are injected wherever a page body
carries the matching marker comment — `<!--@apply-block-->` or
`<!--@status-modals-->`. Markers nest: `status-modals.html` embeds the
apply-block marker inside its Applied modal, and the injector resolves to a
fixed point. Each marker may appear at most once per page, because the blocks
carry element ids. An unresolved or misspelled marker fails the build rather
than shipping the literal comment.

This is why the Apply block exists once but appears on four pages. Never paste
it into a page body.

## Packages

There is **one** concept, not two. The medical catalogue and the old separate
"funding type" are both gone; a lead applies under a package, and the package
itself says whether it carries a partial dollar amount:

```html
<option value="PKG-PARTIAL"
        data-accepts-usd="true"
        data-price-bdt="250000"
        data-price-usd="2500">Partial-Funded Package</option>
```

Three are seeded — Full Funded (taka only), Partial Funded and Paid (taka plus a partial dollar) —
but nothing hardcodes those names. `packages.html` has an **Add Package** form
asking for the name, a default taka price, whether the package has a partial
dollar, and its default dollar amount. That checkbox is the single thing that
decides whether the Apply block shows the Partial Dollar box.

Selecting a package seeds the price fields from its defaults, but **only while
the employee has not typed their own figure**. Once they have, changing package
offers a reset link rather than silently overwriting a price just agreed on the
phone.

A plain `<select>` is used deliberately: three options need no select2, and
select2 inside a modal is what made this control unusable (see below).

## The select2-in-a-modal trap

`crm-demo.js` initialises `.crm-select2` with no `dropdownParent`. select2 then
appends its dropdown to `<body>`, and a Bootstrap modal's focus trap swallows
every click in it — the control looks dead. `crm-leads.js` re-initialises any
`.crm-select2` that lives inside a `.modal` with `dropdownParent` set to that
modal. Add new select2 fields inside modals with that in mind.

## Leads module

`assets/js/crm-leads.js` carries the lead lifecycle — the money engine, the
Apply block wiring, the row status dropdown and the payment ledger. It loads
only on pages flagged `leadsjs` in `build.js`. `node build/test-money.js`
asserts the money rules against the real module.

**Patient money is taka only.** There are no discounts:

```
Agreed = Negotiated
Due    = Agreed − Paid
Completed  ⇔  Due ৳ = 0
```

**The partial dollar is separate and internal.** Every package except
Full-Funded carries a partial dollar amount set at Apply. It is not a patient
payment: its payments are logged only on Dollar Payments (`crm-dollar.js`),
Patient Profile shows its status only, and it never appears on invoices,
receipts, taka balances or the Completed rule. Who pays it is not recorded.
(The engine still accepts a dollar due for compatibility; every page passes 0.)

**Completed is derived, Confirmed is chosen.** Completed is never in the status
menu; it is a badge that appears when the taka balance reaches zero. Only then does
the menu let anyone pick Confirmed, which is what moves a lead to Confirmed
Leads. Nothing on that page can carry a due.

**Status changing lives in the row action menu**, not in a table column, so the
Status column is a read-only badge. Quick View (`build/partials/quick-view.html`)
holds everything the slimmed table no longer shows; each row carries its own
`.qv-payload` block, copied into the shared modal on open.

> **Carry into the Laravel build:** the Add Lead form disables the Assigned
> Sales Executive field and pre-fills it with the current user. A `disabled`
> field submits nothing — this must become `readonly`, or be re-enabled on
> submit, or the assignment arrives empty.

**Lead statuses are exactly the client spec's 4** — Follow Up, Interested, Not
Interested, Unreachable — driving the filter, the tabs, the row menu and
`STATUS_LABELS`/`badgeClass`/`MODALS` in `crm-leads.js`. Applied and Confirmed
are not statuses in this list: applying exits a lead from Leads (its "work in
this module is complete," per spec) onto Applied Leads / Confirmed Leads,
which keep their own row menus (`stAppliedModal`, `stConfirmedModal`) unchanged.
`stUnreachableModal` follows the same reason+remark shape as
`stNotInterestedModal`, in `build/partials/status-modals.html`.

**Edit Lead** (`#editLeadModal`) and the **printable Lead Registration form**
shown right after Add Lead saves (`#leadPrintModal`, print rules in
`crm-brand.css` scoped to `#leadPrintModal.show`) are both static-preview-only:
no backend exists to persist an edit or a fresh lead, so Edit prefills only
what the row already shows (guardian, patient, phone, source) and Save is a
toast, same as every other action in this module.

`invoice.html` sits between applying and confirming. It is reached from the
Apply modal on save and from an Invoice action on applied and confirmed rows,
and is deliberately **absent from `menu.js`** — an invoice only exists in the
context of one lead, so a sidebar entry would lead nowhere. Its print rules live
in `crm-brand.css`, scoped to `.invoice-sheet`.

**Every invoice renders through one function**, `CRMInvoice.render` in
`crm-demo.js` — the Invoice page, Patient Profile and the Payment module all
call it, so an invoice looks the same wherever it is printed. It is handed to
the patient's family, so it carries only the logo, company details (mirroring
Settings), bill-to, package, package amount, paid, balance and payment history:
never staff names, lead/deal IDs, dollar figures, or list-vs-negotiated pricing.
Never hand-write another invoice layout.

`sources.html` (flag `leadsjs`, for the Quick View wiring only — none of the
lead/apply-block code on that page finds a matching element, so it no-ops)
gives each resource row an eye button opening the shared `quickViewModal` with
a hand-authored `.qv-payload`: core resource details the report table doesn't
carry (contact, phone, commission) plus the full lead-count breakdown,
including **Applied** as its own column/figure, distinct from Confirmed.

**Expense Module** (`crm-expenses.js`) keeps one list of taka expenses in
three kinds. `expenses.html` has two tabs: **Fixed** — items such as rent,
internet and salaries are set up once and an entry is generated on the 1st of
every month (staff only correct the amount or date; a deleted month is not
regenerated) — and **Other**, one-off costs by category.
`expense-patient.html` lists every applied and confirmed patient (lead ID,
guardian, phone, source, status, total expense). Each row has **Update
Ticket / Visa / Source Expense** buttons that record one cost with its own
date, and an eye button listing all of that patient's costs. The source
comes from the lead, so a Source cost *is* the source expense (there is no
separate source page). Lead rows on Applied / Confirmed link to
`expense-patient.html?lead=<id>`, which opens that patient's costs. Totals,
week/month grouping and the Source (leads brought, applied, paid in range and
lifetime), Patient (ticket / visa per patient), Fixed and Other sections live on
`expense-report.html`, which filters by any From/To date range and counts
entries by their (editable, back-datable) expense date.

**Ticket Module** (`tickets.html`, `crm-tickets.js`) is step 03, after the
visa is approved. Patients are listed by ticket status: **Not Purchased**,
**Upcoming Flight** (flight date ahead), **Flight Passed** (date gone by,
not marked reached — the sidebar badge) and **Cancelled**; Upcoming vs
Passed is worked out from the flight date against today. Rows can Purchase,
Reschedule / Edit (a reason is required and kept in the ticket's history),
Cancel (reason required), Re-book, and Mark Reached (→ Treatment
Ongoing; same step and `crm_reached` record as Treatment Countdown). The eye and printer buttons open the ticket on a paper sheet
(`CRMSheet` in `crm-demo.js`, the lead-form layout); the return date shows
"—" because the return ticket is recorded on Treatment. Visa › Approved's
Add Ticket opens `tickets.html?lead=<id>&action=purchase`, and every Visa
row has the same Print sheet for its visa details.

On **Treatment**, Successful / Failed asks for the **result date** and,
separately, a boxed **Return Ticket — flight home** (date, flight, PNR),
which is the ticket end; rows also have Add / Edit Return Ticket on its own.

**Treatment days** are counted from the ticket start (departure) to the
ticket end (return), up to today while the patient is still away.
`CRMTravel` in `crm-demo.js` does the counting for every page: Visa & Travel
and Treatment read their own row dates (`data-dep-date` / `data-ret-date`,
`data-ticket-start` / `data-ticket-end`); Countdown › Reached, Patient
Profile (`data-travel-lead`), Quick View and the Patient Expense cost window
look the lead up in `CRMTravel.tickets`, which carries the same sample dates.

**Visa & Ticket Processing** (`visa-processing.html`) is an explicit stub — a
new sidebar group after Lead Management, listing the same leads/figures as
Confirmed Leads with a "Not Started" badge and a disabled action. It exists to
show the module boundary the client spec draws ("cannot proceed to Visa
Processing until applied") without building the real workflow.

Output goes to the repo root (*.html). Do not edit the generated root `*.html`
files by hand — they are overwritten. Edit `build/pages/` or `build/partials/`
and rebuild. `build/verify.js` checks every generated page; run it after every
build.

`build/verify-money.js` (called by `verify.js`) reconciles the demo money **per
currency**: every row's `Paid + Due = Agreed` in taka and again in dollars, the
rendered dues against the `data-due-bdt` / `data-due-usd` the action menu reads,
every tile against the sum of its column, every ledger against its row, that a
taka-only package carries no dollar figures, that the Completed badge and the
balances agree *in both directions*, that nothing on Confirmed Leads owes
anything, and — the important one — **the same lead ID showing the same figures
and the same package on every page it appears on**. That last check exists
because an earlier pass shipped contradictory figures for the same patient
across pages, caught only by a human reading two tables side by side.

It also reconciles Patients & Deals: each person's lifetime totals against the
deals behind them, the Settled/Dues badge against the balances, **each person's
current deal against their row on Applied or Confirmed Leads**, Deals'
outstanding against Applied Leads' outstanding, that a patient record exists only
for a lead that reached Confirmed, and that package usage counts add up with
*Most used* actually being the maximum.

Two traps worth knowing if you extend it:

- `leads.html` keeps its money inside the Quick View payload, and `deals.html`
  keeps each person's history in an expansion row — both contain their own `<tr>`
  elements. Splitting those pages on `<tr` truncates each row before its money
  table and every check then passes on nothing. Split on `<tr data-status=` and
  `<tr data-state=` instead.
- `endCells()` matches `class="text-end"` **exactly**, because the lead pages use
  `text-end cur fs-13` inside ledgers and a loose match would mix payment lines
  into the row figures. The deal-history sub-tables style their cells directly,
  so they use `endCellsLoose()`.

## Patients & Deals

`assets/js/crm-deals.js` (flag `dealsjs`) owns this module, kept separate from
`crm-leads.js` so neither file grows into everything. It handles the Deals state
tabs, the per-person expansion, the Patients filter bar, and the package
edit/remove behaviour.

- **Patients** shows no money — a patient's balances live on Deals. Its View
  button opens `patient-profile.html?patient=<id>`, a tabbed history page
  (Overview, Deals, Payments, Conversations, Follow-ups, Documents) that, like
  `invoice.html`, carries one fully worked example and says so when opened for
  anyone else.
- **Deals** is one row per person with lifetime totals, expanding to their
  individual deals. `Settled` and `Dues` are derived, never typed: a person is
  Dues if any deal owes in either currency.
- Applied and Confirmed Leads are current-cycle worklists; **Deals is the
  lifetime ledger**, so it also holds older closed deals that have long left
  those pages.
- **Packages** moved to Administration. Removing a package that deals point at
  is refused — it would orphan them. The Active column is an on/off switch:
  switching a package off keeps it on existing deals but takes it out of the
  Apply dropdown, so it can be retired without orphaning anything.
- **A patient is anyone with a deal**, not only a lead that reached Confirmed.
  Applying and striking a deal is what creates the record. The Situation column
  carries the lead's stage and must agree with Applied / Confirmed Leads.

## Accounts

`assets/js/crm-accounts.js` (flag `accountsjs`) owns Payments, Money Receipts
and Dues.

**Nothing counts as money until it is verified.** A patient claims a payment; it
sits in the Pending Verification queue, counted in no tile and against no
balance. Verifying issues the receipt and reduces the taka balance;
rejecting records a reason and changes nothing. Every payment still records
**the executive who took it** (kept on the row as `data-exec` / `data-executive`
and used by the filters) — the staff column itself is no longer shown in tables.

Money Receipts lists every verified transaction; those without a receipt can
have one generated, those with one can be reprinted. Pending payments are absent
by design — there is nothing to receipt until the money is confirmed.

Dues shows collected-this-month against outstanding, month by month, with a
Remind action on each row.

## Administration

`assets/js/crm-admin.js` (flag `adminjs`) owns Users and Roles & Permissions.

The permission model is Spatie's: **a role holds permissions, and a user's role
is the only thing granting them anything.** There are no per-user overrides. The
Admin column of the matrix is locked rather than merely pre-ticked — an
administrator who could revoke their own access to Roles would lock everyone out
of it.

`reports.html` moved here from the deleted Workspace section, along with
Packages. `tasks.html` and `documents.html` are gone; documents still attach to
patients and appear on the patient profile.

`login.html` is authored directly at the repo root because it has no chrome.

## Maps to the Laravel structure

This mirrors the Blade layout in `plan.md`, so the port is mechanical:

| Here | Becomes |
|---|---|
| `partials/topbar.html` | `Backend/Partials/header.blade.php` |
| generated sidebar | `Backend/Partials/sidebar.blade.php` |
| `partials/footer.html` | `Backend/Partials/footer.blade.php` |
| `build.js` shell | `Backend/main.blade.php` |
| `pages/leads.html` | `Backend/Layout/Lead/index.blade.php` |
| `menu.js` | sidebar partial driven by permissions |

## Colour

The brand palette is applied **at the source**, not as overrides:

```
node build/recolor.js Main/assets/css/bootstrap.min.css Main/assets/css/app.min.css
```

`recolor.js` reproduces Bootstrap 5.3's own `tint-color()` / `shade-color()`
maths, so every derived shade (hover, active, subtle, emphasis, focus ring)
stays internally consistent, and it flips contrast text from `#000` to `#fff`
where the new colour is dark enough to need it.

| Role | Template | Ours |
|---|---|---|
| primary | `#a47bc8` | `#024766` |
| success | `#4ec5ad` | `#53AA25` |

96 replacements across both files, no stock palette values left. **This has
already been run** — the CSS in `Main/assets/css/` is the recoloured copy. Only
re-run it against a fresh copy from `Template/`, never twice over the same file.

`Main/assets/css/crm-brand.css` holds only additions the template does not ship
(brand lockup, kanban board, receipt paper, timeline) plus a documented set of
WCAG AA contrast corrections. No layout is overridden.

## Deliberately removed

The template's floating settings panel (`partials/settings-panel.html`) is not
included. It carried a layout switcher that lets a viewer land on a broken-looking
configuration mid-demo, plus e-commerce demo content ("Buy Now", shopping cart)
that does not belong in a healthcare CRM. `app.js` has no hard dependency on it.

## Verification

Checked with headless Chromium before hand-off:

- 18/18 pages: topbar present, sidebar 264px, `.main-content` offset correctly,
  logo box exactly 65px (both logos not rendering at once), no horizontal
  overflow, no console errors, no failed requests, all charts rendered
- all internal links resolve, all asset paths resolve
- `<div>` open/close balanced
- all sampled status text passes WCAG AA contrast
