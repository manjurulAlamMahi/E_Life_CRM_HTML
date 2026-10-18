# Leads Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Leads module so a lead flows Add Lead → Conversation → Applied → Payment(s) → Confirmed, with negotiable package prices, a live status dropdown, and dedicated Applied and Confirmed list pages.

**Architecture:** This is a static HTML demo assembled by `build/build.js` from `build/pages/*.html` bodies plus shared chrome in `build/partials/`. **Never edit `Main/*.html` or the repo-root `*.html` by hand — they are generated.** All work happens in `build/`, followed by `node build/build.js`. Lead-lifecycle behaviour lives in one new file, `assets/js/crm-leads.js`, loaded only on the four Leads-module pages; `assets/js/crm-demo.js` keeps DataTables, select2, kanban and the shared `bdt()` currency helper.

**Tech Stack:** Node (build only, no dependencies), Bootstrap 5, jQuery, DataTables, select2, SweetAlert2, eva-icons/MDI. No package.json, no test framework, no backend.

## Global Constraints

- **Never hand-edit generated HTML.** Sources are `build/pages/`, `build/partials/`, `build/menu.js`, `build/build.js`. Output is the repo root (after Task 2).
- Currency is BDT, rendered with the Bengali Taka sign as the HTML entity `&#2547;` in markup, and via `window.bdt(n)` in JS. Indian digit grouping (`৳1,50,000`).
- USD is a secondary amount only. Every USD figure is stored with the rate used on that payment and displayed as `৳59,000 ($500 @ ৳118)`.
- `Agreed = Negotiated − Discount`, clamped at 0.
- `Remaining = Agreed − Paid`, clamped at 0 — **except Full Funded, which is always 0.**
- Confirmed requires `Remaining === 0`.
- Brand colours: primary `#024766`, accent `#53AA25`. Use existing Bootstrap subtle-badge classes; do not add new colours.
- Every table that should become a DataTable carries `class="crm-table"`. Non-sortable columns carry `class="no-sort"` on the `<th>`.
- Files are LF in `build/`; generated output is whatever git checks out. Comparisons must normalise line endings.
- Package prices are **reference defaults only**. Nothing may block a negotiated price above or below the standard price.

---

## File Structure

| File | Responsibility |
|---|---|
| `build/verify.js` | **New.** Structural verification of every generated page. The test harness for this plan. |
| `build/partials/apply-block.html` | **New.** Package + negotiated price + funding type. The single source; injected at `<!--@apply-block-->`. |
| `build/partials/status-modals.html` | **New.** Follow-up / Applied / Confirmed / Closed modals. Injected at `<!--@status-modals-->`; itself embeds the apply-block marker. |
| `build/build.js` | Page list, shell, sidebar generation. Gains `swal`/`leadsjs` flags, partial injection, and two new pages. |
| `build/menu.js` | Single nav definition. Gains Applied Leads + Confirmed Leads. |
| `build/partials/topbar.html` | Brand/logo links. `dashboard.html` → `index.html`. |
| `build/pages/leads.html` | Leads table, Add Lead modal, status-change modals. |
| `build/pages/conversations.html` | Conversation log; adopts the shared Apply modal. |
| `build/pages/applied-leads.html` | **New.** Applied list, tiles, payment ledger, Add Payment modal. |
| `build/pages/confirmed-leads.html` | **New.** Confirmed list and tiles. |
| `assets/js/crm-leads.js` | **New.** Lead lifecycle: money engine, Apply modal, status dropdown, payment ledger. |
| `assets/js/crm-demo.js` | Loses `initConversationFlow` (moves to crm-leads.js); keeps DataTables/select2/kanban/`bdt`. |

---

## Task 1: Verification harness

There is no test framework in this repo. This task builds one, so every later task has a real pass/fail gate.

**Files:**
- Create: `build/verify.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `node build/verify.js` — exits 0 when every generated page passes, exits 1 and prints failures otherwise. Later tasks run this as their test.

- [ ] **Step 1: Write the verifier**

Create `build/verify.js`:

```js
#!/usr/bin/env node
/**
 * Structural verification for the generated demo pages.
 * There is no browser here — these are the checks that can be made
 * from the DOM text alone, and they catch the failures that actually
 * happened in this project: missing chrome, dead internal links,
 * missing assets, duplicate ids, unbalanced divs.
 *
 *   node build/verify.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const failures = [];
const fail = (page, msg) => failures.push(page + ': ' + msg);

/* Pages to check: every .html in the repo root. login.html has no chrome. */
const pages = fs
  .readdirSync(ROOT)
  .filter((f) => f.endsWith('.html'))
  .sort();

/* Required IDs per page — grows as the plan adds interactive markup. */
const REQUIRED_IDS = require('./verify-manifest.js');

for (const page of pages) {
  const html = fs.readFileSync(path.join(ROOT, page), 'utf8').replace(/\r\n/g, '\n');
  const chromeless = page === 'login.html';

  /* 1. chrome present */
  if (!chromeless) {
    if (!html.includes('id="layout-wrapper"')) fail(page, 'missing #layout-wrapper');
    if (!html.includes('class="main-content"')) fail(page, 'missing .main-content');
    if (!html.includes('id="side-menu"')) fail(page, 'missing sidebar #side-menu');
    if ((html.match(/id="side-menu"/g) || []).length !== 2)
      fail(page, 'expected 2 sidebars (vertical + horizontal), found ' + (html.match(/id="side-menu"/g) || []).length);
    if (!html.includes('<footer')) fail(page, 'missing footer');
  }

  /* 2. balanced divs */
  const opens = (html.match(/<div\b/g) || []).length;
  const closes = (html.match(/<\/div>/g) || []).length;
  if (opens !== closes) fail(page, 'unbalanced <div>: ' + opens + ' open, ' + closes + ' close');

  /* 3. internal links resolve */
  const hrefs = [...html.matchAll(/href="([^"#:]+\.html)"/g)].map((m) => m[1]);
  for (const h of new Set(hrefs)) {
    if (!fs.existsSync(path.join(ROOT, h))) fail(page, 'dead link -> ' + h);
  }

  /* 4. asset paths resolve */
  const assets = [...html.matchAll(/(?:src|href)="(assets\/[^"]+)"/g)].map((m) => m[1]);
  for (const a of new Set(assets)) {
    if (!fs.existsSync(path.join(ROOT, a))) fail(page, 'missing asset -> ' + a);
  }

  /* 5. no duplicate ids */
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const seen = new Set();
  for (const id of ids) {
    if (seen.has(id)) fail(page, 'duplicate id -> ' + id);
    seen.add(id);
  }

  /* 6. required ids for this page */
  for (const id of REQUIRED_IDS[page] || []) {
    if (!html.includes('id="' + id + '"')) fail(page, 'missing required id -> ' + id);
  }
}

if (failures.length) {
  console.error('FAIL (' + failures.length + ')');
  for (const f of failures) console.error('  ' + f);
  process.exit(1);
}
console.log('PASS — ' + pages.length + ' pages verified');
```

- [ ] **Step 2: Write the (initially empty) manifest**

Create `build/verify-manifest.js`:

```js
/**
 * Required element IDs per generated page.
 * Each task in the Leads plan adds the ids it introduces, so a later
 * refactor that drops them fails verification instead of failing silently.
 */
'use strict';
module.exports = {};
```

- [ ] **Step 3: Run the verifier against the current tree**

Run: `node build/verify.js`

Expected: `PASS — 19 pages verified` (18 chrome pages + login.html).

If it reports failures, they are **pre-existing** defects. Record them, and do not fix them in this task — Task 2 is where the tree gets corrected. If the only failures are dead links to `applied-leads.html` / `confirmed-leads.html`, that is impossible at this point and means you have already started Task 3.

- [ ] **Step 4: Commit**

```bash
git add build/verify.js build/verify-manifest.js
git commit -m "test: add structural verifier for generated pages"
```

---

## Task 2: Re-sync the build system

`build/pages/*` is behind the committed pages: it has none of the conversation-modal work, still emits `dashboard.html` instead of `index.html`, and writes to `Main/Main/` rather than the repo root. Running the build today would revert real work. This task makes the build authoritative again and **must produce byte-identical output to what is committed now**.

This procedure has been dry-run: it reproduces all 18 pages exactly.

**Files:**
- Create: `build/extract-body.js`
- Modify: `build/build.js`, `build/menu.js`, `build/partials/topbar.html`
- Overwrite: all `build/pages/*.html`
- Delete: `Main/` (the stale duplicate output tree)

**Interfaces:**
- Consumes: `node build/verify.js` from Task 1.
- Produces: `node build/build.js` writes the 18 pages to the repo root. `build/pages/<file>.html` is the editable body of each page — every later task edits these, never the root HTML.

- [ ] **Step 1: Write the body extractor**

Create `build/extract-body.js`:

```js
#!/usr/bin/env node
/**
 * Extracts a page body from a generated page, inverting the shell in
 * build.js. Used once, to re-seed build/pages/ from the pages that had
 * drifted ahead of it.
 *
 *   node build/extract-body.js <generated.html> > build/pages/<page>.html
 */
'use strict';
const fs = require('fs');

const START = '                <!-- end page title -->\n';
const END = '\n\n            </div><!-- container-fluid -->';

function extract(file) {
  const html = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const i = html.indexOf(START);
  const j = html.lastIndexOf(END);
  if (i < 0 || j < 0) throw new Error('shell markers not found in ' + file);
  return html.slice(i + START.length, j).replace(/^\n/, '') + '\n';
}

module.exports = extract;
if (require.main === module) process.stdout.write(extract(process.argv[2]));
```

- [ ] **Step 2: Re-seed `build/pages/` from the live root pages**

```bash
cd "$(git rev-parse --show-toplevel)"
for f in *.html; do
  [ "$f" = "login.html" ] && continue
  node build/extract-body.js "$f" > "build/pages/$f"
done
rm -f build/pages/dashboard.html
```

`build/pages/index.html` now holds the dashboard body; `dashboard.html` is gone.

- [ ] **Step 3: Point the build at the repo root and rename the apex page**

Apply these five edits to `build/build.js`:

1. `const OUT = path.join(ROOT, 'Main');` → `const OUT = ROOT;`
2. In `PAGES`, replace the first row with:
   ```js
   { file: 'index.html',         title: 'Dashboard',          crumb: ['Dashboard'],                      apex: true },
   ```
3. In `pageTitle()`, `<a href="dashboard.html">CRM</a>` → `<a href="index.html">CRM</a>`
4. In `pageTitle()`, intermediate crumbs are plain text — replace
   ``` `<li class="breadcrumb-item"><a href="javascript: void(0);">${c}</a></li>` ```
   with
   ``` `<li class="breadcrumb-item">${c}</li>` ```
5. Add the `swal` flag to the two pages whose JS calls `Swal.fire`, and emit the script. In `PAGES`:
   ```js
   { file: 'leads.html',         title: 'Leads',              crumb: ['Lead Management', 'Leads'],       dt: true, swal: true },
   { file: 'conversations.html', title: 'Conversations',      crumb: ['Lead Management', 'Conversations'], swal: true },
   ```
   and in `scripts()`, replace
   ```
   <!-- App js -->
   <script src="assets/js/app.js"></script>

   <!-- CRM demo js -->
   ```
   with
   ```
   <!-- App js -->
   <script src="assets/js/app.js"></script>
   ${p.swal ? '\n<!-- sweetalert2 -->\n<script src="assets/libs/sweetalert2/sweetalert2.min.js"></script>\n' : ''}
   <!-- CRM demo js -->
   ```

In `build/menu.js`: `file: 'dashboard.html'` → `file: 'index.html'`.

In `build/partials/topbar.html`: both occurrences of `href="dashboard.html"` → `href="index.html"`.

- [ ] **Step 4: Prove the rebuild is byte-identical**

```bash
node build/build.js
git diff --stat -- '*.html'
```

Expected: `node build/build.js` prints `built 18/18 pages into Main/` (the log string is stale wording; the files land in the repo root), and **`git diff --stat` on the root HTML reports no changes at all.**

If any root page shows a diff, stop. The re-seed lost something. Inspect with `git diff -- <page>.html` and fix `build/pages/<page>.html` before continuing.

- [ ] **Step 5: Remove the stale duplicate tree and fix the log string**

```bash
git rm -r --quiet Main/
```

In `build/build.js`, change the final log line to reflect the real destination:

```js
console.log(`\nbuilt ${built}/${PAGES.length} pages into ${path.relative(process.cwd(), OUT) || '.'}/`);
```

- [ ] **Step 6: Rebuild and verify**

Run: `node build/build.js && node build/verify.js`

Expected: `built 18/18 pages into ./` then `PASS — 19 pages verified`, and `git diff --stat -- '*.html'` still shows no change to the generated pages.

- [ ] **Step 7: Update the build README**

In `build/README.md`, correct the two statements that are now wrong:

- Under "Layout", `Output goes to Main/*.html` → `Output goes to the repo root (*.html).`
- Add to the same paragraph: `build/verify.js checks every generated page; run it after every build.`

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "build: re-sync build sources with the live pages

build/pages/ was snapshotted before the conversation-modal work and the
dashboard.html -> index.html rename, so running the build would have
reverted both. Re-seeds every page body from the committed output,
retargets OUT at the repo root, and drops the stale Main/ duplicate.

Rebuild is byte-identical to the pages it replaces."
```

---

## Task 3: Navigation and page scaffolding

**Files:**
- Modify: `build/menu.js`, `build/build.js`
- Create: `build/pages/applied-leads.html`, `build/pages/confirmed-leads.html`

**Interfaces:**
- Consumes: the re-synced build from Task 2.
- Produces: `applied-leads.html` and `confirmed-leads.html` exist at the repo root with full chrome, reachable from both sidebars. Later tasks fill their bodies.

- [ ] **Step 1: Add the two menu entries**

In `build/menu.js`, insert after the `Leads` row:

```js
  { type: 'item', label: 'Applied Leads',   file: 'applied-leads.html',   eva: 'file-add-outline',      fa: 'fas fa-file-signature' },
  { type: 'item', label: 'Confirmed Leads', file: 'confirmed-leads.html', eva: 'checkmark-square-outline', fa: 'fas fa-clipboard-check' },
```

- [ ] **Step 2: Add the two pages to the build**

In `build/build.js` `PAGES`, insert after the `leads.html` row:

```js
  { file: 'applied-leads.html',   title: 'Applied Leads',   crumb: ['Lead Management', 'Applied Leads'],   dt: true, swal: true, leadsjs: true },
  { file: 'confirmed-leads.html', title: 'Confirmed Leads', crumb: ['Lead Management', 'Confirmed Leads'], dt: true, swal: true, leadsjs: true },
```

Add `leadsjs: true` to the existing `leads.html` and `conversations.html` rows as well.

In `scripts()`, emit the lead-module JS after `crm-demo.js` (it depends on `window.bdt`, which `crm-demo.js` defines at load time):

```
<!-- CRM demo js -->
<script src="assets/js/crm-demo.js"></script>
${p.leadsjs ? '\n<!-- CRM leads module js -->\n<script src="assets/js/crm-leads.js"></script>\n' : ''}
</body>
```

- [ ] **Step 3: Create placeholder bodies**

Create `build/pages/applied-leads.html`:

```html
                <div class="row">
                    <div class="col-12">
                        <div class="card">
                            <div class="card-body">
                                <p class="text-muted mb-0">Applied leads list — built in Task 9.</p>
                            </div>
                        </div>
                    </div>
                </div>
```

Create `build/pages/confirmed-leads.html` with the same markup, changing the text to `Confirmed leads list — built in Task 10.`

- [ ] **Step 4: Create the JS module stub**

Create `assets/js/crm-leads.js`:

```js
/**
 * E Life Healthcare CRM — Leads module behaviour.
 *
 * Owns the lead lifecycle for the static preview: the money engine,
 * the Apply modal, the row status dropdown, and the payment ledger.
 * Loaded only on leads, applied-leads, confirmed-leads and conversations.
 *
 * In the Laravel build this is replaced by Deal/Payment model methods
 * (plan.md R2) — nothing here is authoritative business logic.
 */
(function () {
  'use strict';

  window.CRMLeads = {};

  document.addEventListener('DOMContentLoaded', function () {
    /* wired up in later tasks */
  });
})();
```

- [ ] **Step 5: Build and verify**

Run: `node build/build.js && node build/verify.js`

Expected: `built 20/20 pages into ./` then `PASS — 21 pages verified`.

- [ ] **Step 6: Confirm the nav renders on every page**

Run: `grep -l "applied-leads.html" *.html | wc -l`

Expected: `20` — every generated page carries the sidebar link.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: scaffold Applied Leads and Confirmed Leads pages"
```

---

## Task 4: Add Lead modal

Removes the doctor and hospital fields — the Indian team assigns those later — and turns the treatment field into a real condition note.

**Files:**
- Modify: `build/pages/leads.html` (the `#addLeadModal` block)
- Modify: `build/verify-manifest.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `#al-condition` (textarea) and `#al-save` (the save button) exist in `#addLeadModal`.

- [ ] **Step 1: Add the required ids to the manifest**

In `build/verify-manifest.js`:

```js
module.exports = {
  'leads.html': ['addLeadModal', 'al-condition', 'al-save'],
};
```

- [ ] **Step 2: Run the verifier to watch it fail**

Run: `node build/verify.js`

Expected: FAIL, with `leads.html: missing required id -> al-condition` and `-> al-save`.

- [ ] **Step 3: Replace the treatment/doctor/hospital fields**

In `build/pages/leads.html`, find this block inside `#addLeadModal`:

```html
                                    <div class="col-md-6">
                                        <label class="form-label">Medical Requirement / Treatment</label>
                                        <input type="text" class="form-control" placeholder="e.g. Cardiac Surgery">
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Preferred Doctor</label>
                                        <select class="form-select"><option>Select doctor</option><option>Dr. Ilias Patowary</option><option>Dr. Farhad Hossain</option><option>Dr. Rezaul Karim</option></select>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Preferred Hospital</label>
                                        <select class="form-select"><option>Select hospital</option><option>Square Hospital</option><option>Evercare Hospital</option><option>United Hospital</option></select>
                                    </div>
```

Replace all three with:

```html
                                    <div class="col-12">
                                        <label class="form-label">Patient Issue / Condition</label>
                                        <textarea class="form-control" id="al-condition" rows="3" placeholder="e.g. Blocked artery, advised bypass. Diabetic, on insulin 6 years."></textarea>
                                        <div class="form-text fs-11"><i class="mdi mdi-information-outline"></i> The doctor and hospital are assigned later by the India team, based on this.</div>
                                    </div>
```

- [ ] **Step 4: Replace the modal footer**

Find the footer of `#addLeadModal` and replace its buttons with:

```html
                                <button class="btn btn-light" data-bs-dismiss="modal">Cancel</button>
                                <button class="btn btn-primary" id="al-save"><i class="mdi mdi-arrow-right-circle-outline me-1"></i>Save &amp; Start Conversation</button>
```

- [ ] **Step 5: Wire the redirect**

In `assets/js/crm-leads.js`, inside the `DOMContentLoaded` callback, add:

```js
    /* Add Lead saves and goes straight to the conversation, so the
       employee records the first call without hunting for the lead. */
    var addSave = document.getElementById('al-save');
    if (addSave) {
      addSave.addEventListener('click', function () {
        var id = 'ELH-L-2026-000413';
        var modalEl = addSave.closest('.modal');
        if (window.bootstrap && modalEl) bootstrap.Modal.getOrCreateInstance(modalEl).hide();
        window.setTimeout(function () {
          window.location.href = 'conversations.html?lead=' + encodeURIComponent(id);
        }, 250);
      });
    }
```

- [ ] **Step 6: Build and verify**

Run: `node build/build.js && node build/verify.js`

Expected: `PASS — 21 pages verified`.

- [ ] **Step 7: Confirm the fields are gone**

Run: `grep -c "Preferred Doctor\|Preferred Hospital" leads.html`

Expected: `0`.

Run: `grep -c "Doctor Referral" leads.html`

Expected: non-zero — `Doctor Referral` and `Hospital` remain valid **lead sources** and must not be removed.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(leads): drop doctor/hospital from Add Lead, add condition note

The India team assigns doctor and hospital after reviewing the case, so
capturing a preference at lead stage records a guess as a decision.
Replaced by a free-text Patient Issue / Condition note. Saving now goes
straight to the conversation page."
```

---

## Task 5: Package catalogue and the negotiated-price block

**Files:**
- Create: `build/partials/apply-block.html`
- Modify: `build/build.js` (inject the partial on flagged pages)
- Modify: `build/pages/conversations.html` (replace the inline `#lc-package-block` contents with the injection marker)
- Modify: `build/verify-manifest.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `build/partials/apply-block.html` — **the single source for this markup.** It carries these ids: `lc-package` (select, with `data-standard`), `lc-standard-note`, `lc-negotiated`, `lc-delta-note`, `lc-discount`, `lc-funding` (radio group name), `lc-sum-standard`, `lc-sum-negotiated`, `lc-sum-discount`, `lc-sum-agreed`. Task 6 wires these ids; Tasks 7, 9 and 10 include the partial rather than copying it.

> **This markup is authored once.** It appears on four pages, so it lives in `build/partials/`, not pasted into each page. Because the ids are unique per page, no page may include it twice — see Task 7 Step 4.

- [ ] **Step 1: Add required ids to the manifest**

```js
module.exports = {
  'leads.html': ['addLeadModal', 'al-condition', 'al-save'],
  'conversations.html': ['lc-package', 'lc-negotiated', 'lc-discount', 'lc-sum-agreed'],
};
```

- [ ] **Step 2: Run the verifier to watch it fail**

Run: `node build/verify.js`

Expected: FAIL with `conversations.html: missing required id -> lc-negotiated`.

- [ ] **Step 3: Write the partial**

Create `build/partials/apply-block.html` containing the markup below, and nothing else. The package `<option>` labels carry **no price** — the price lives in `data-standard` only.

```html
                                    <div class="row g-3">
                                        <div class="col-md-7">
                                            <label class="form-label">Package <span class="text-danger">*</span></label>
                                            <select class="form-select crm-select2" id="lc-package">
                                                <option value=""></option>
                                                <optgroup label="Cardiac">
                                                    <option value="PKG-CAR-01" data-standard="120000">Coronary Angiography</option>
                                                    <option value="PKG-CAR-02" data-standard="350000">Angioplasty — single stent</option>
                                                    <option value="PKG-CAR-03" data-standard="650000">CABG / Bypass Surgery</option>
                                                    <option value="PKG-CAR-04" data-standard="720000">Heart Valve Replacement</option>
                                                </optgroup>
                                                <optgroup label="Oncology">
                                                    <option value="PKG-ONC-01" data-standard="85000">Chemotherapy — per cycle</option>
                                                    <option value="PKG-ONC-02" data-standard="280000">Radiotherapy — full course</option>
                                                    <option value="PKG-ONC-03" data-standard="420000">Tumour Excision</option>
                                                    <option value="PKG-ONC-04" data-standard="1450000">Bone Marrow Transplant</option>
                                                </optgroup>
                                                <optgroup label="Orthopedic">
                                                    <option value="PKG-ORT-01" data-standard="420000">Total Knee Replacement</option>
                                                    <option value="PKG-ORT-02" data-standard="480000">Total Hip Replacement</option>
                                                    <option value="PKG-ORT-03" data-standard="160000">Arthroscopy</option>
                                                    <option value="PKG-ORT-04" data-standard="110000">Fracture Fixation</option>
                                                </optgroup>
                                                <optgroup label="Neurology">
                                                    <option value="PKG-NEU-01" data-standard="680000">Craniotomy</option>
                                                    <option value="PKG-NEU-02" data-standard="1200000">Deep Brain Stimulation</option>
                                                    <option value="PKG-NEU-03" data-standard="140000">Stroke Rehabilitation</option>
                                                </optgroup>
                                                <optgroup label="Spine">
                                                    <option value="PKG-SPN-01" data-standard="540000">Spinal Fusion</option>
                                                    <option value="PKG-SPN-02" data-standard="290000">Discectomy</option>
                                                    <option value="PKG-SPN-03" data-standard="760000">Scoliosis Correction</option>
                                                </optgroup>
                                                <optgroup label="Transplant">
                                                    <option value="PKG-TRP-01" data-standard="980000">Kidney Transplant</option>
                                                    <option value="PKG-TRP-02" data-standard="2200000">Liver Transplant</option>
                                                    <option value="PKG-TRP-03" data-standard="190000">Corneal Transplant</option>
                                                </optgroup>
                                                <optgroup label="Nephrology">
                                                    <option value="PKG-NEP-01" data-standard="55000">Dialysis — 10 sessions</option>
                                                    <option value="PKG-NEP-02" data-standard="180000">Kidney Stone / PCNL</option>
                                                </optgroup>
                                                <optgroup label="Gastroenterology">
                                                    <option value="PKG-GAS-01" data-standard="170000">Laparoscopic Cholecystectomy</option>
                                                    <option value="PKG-GAS-02" data-standard="145000">Hernia Repair</option>
                                                    <option value="PKG-GAS-03" data-standard="460000">Bariatric Sleeve</option>
                                                </optgroup>
                                                <optgroup label="Ophthalmology">
                                                    <option value="PKG-OPH-01" data-standard="95000">Cataract — both eyes</option>
                                                    <option value="PKG-OPH-02" data-standard="210000">Retinal Detachment Repair</option>
                                                </optgroup>
                                                <optgroup label="Pediatric">
                                                    <option value="PKG-PED-01" data-standard="590000">Paediatric Cardiac Surgery</option>
                                                    <option value="PKG-PED-02" data-standard="125000">Cleft Lip / Palate Repair</option>
                                                    <option value="PKG-PED-03" data-standard="240000">Neonatal ICU — 7 days</option>
                                                </optgroup>
                                                <optgroup label="ENT">
                                                    <option value="PKG-ENT-01" data-standard="850000">Cochlear Implant</option>
                                                    <option value="PKG-ENT-02" data-standard="135000">Endoscopic Sinus Surgery</option>
                                                </optgroup>
                                            </select>
                                            <div class="form-text fs-11" id="lc-standard-note">Prices are a starting point, not a fixed rate — set what was agreed.</div>
                                        </div>
                                        <div class="col-md-5">
                                            <label class="form-label">Negotiated price <span class="text-danger">*</span></label>
                                            <div class="input-group"><span class="input-group-text">&#2547;</span><input type="number" class="form-control" id="lc-negotiated" min="0" placeholder="0"></div>
                                            <div class="form-text fs-11" id="lc-delta-note">&nbsp;</div>
                                        </div>
                                        <div class="col-md-5">
                                            <label class="form-label">Discount</label>
                                            <div class="input-group"><span class="input-group-text">&#2547;</span><input type="number" class="form-control" id="lc-discount" min="0" value="0"></div>
                                        </div>
                                        <div class="col-md-7">
                                            <label class="form-label d-block">Funding type <span class="text-danger">*</span></label>
                                            <div class="btn-group" role="group">
                                                <input type="radio" class="btn-check" name="lc-funding" id="lc-funding-full" value="full">
                                                <label class="btn btn-outline-primary btn-sm" for="lc-funding-full">Full Funded</label>
                                                <input type="radio" class="btn-check" name="lc-funding" id="lc-funding-partial" value="partial" checked>
                                                <label class="btn btn-outline-primary btn-sm" for="lc-funding-partial">Partial Funded</label>
                                                <input type="radio" class="btn-check" name="lc-funding" id="lc-funding-paid" value="paid">
                                                <label class="btn btn-outline-primary btn-sm" for="lc-funding-paid">Paid</label>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="card bg-light-subtle border mt-3 mb-0"><div class="card-body py-3">
                                        <div class="row text-center">
                                            <div class="col"><div class="fs-11 text-uppercase text-muted">Standard</div><div class="fw-bold cur text-muted" id="lc-sum-standard">&#2547;0</div></div>
                                            <div class="col"><div class="fs-11 text-uppercase text-muted">Negotiated</div><div class="fw-bold cur" id="lc-sum-negotiated">&#2547;0</div></div>
                                            <div class="col"><div class="fs-11 text-uppercase text-muted">Discount</div><div class="fw-bold cur" id="lc-sum-discount">&#2547;0</div></div>
                                            <div class="col"><div class="fs-11 text-uppercase text-muted">Agreed</div><div class="fw-bold cur text-primary" id="lc-sum-agreed">&#2547;0</div></div>
                                        </div>
                                    </div></div>
```

- [ ] **Step 4: Wire the partial into the build**

The partial is injected wherever a page body contains the marker `<!--@apply-block-->`, so a page can place it inside whatever modal it needs.

In `build/build.js`, alongside the existing `const P = ...` helper, add:

```js
/* Shared blocks injected into page bodies at their marker comments.
   Authored once in build/partials/ — see Task 5 of the Leads plan. */
const INJECTIONS = {
  '<!--@apply-block-->': 'apply-block.html',
  '<!--@status-modals-->': 'status-modals.html',
};

/* Partials may themselves contain markers (status-modals.html embeds the
   apply block), so resolve to a fixed point rather than in one pass. */
function inject(content) {
  for (let depth = 0; depth < 5; depth++) {
    let changed = false;
    for (const [marker, file] of Object.entries(INJECTIONS)) {
      if (!content.includes(marker)) continue;
      if (content.indexOf(marker) !== content.lastIndexOf(marker)) {
        throw new Error(marker + ' appears more than once — ids would collide');
      }
      content = content.replace(marker, P(file));
      changed = true;
    }
    if (!changed) return content;
  }
  throw new Error('injection did not settle — check for a marker cycle');
}
```

`status-modals.html` does not exist until Task 7. That is fine: a marker is only looked up when a page actually contains it, and `P(file)` throws a clear ENOENT naming the missing file if one is ever referenced early.

In the assembly loop, apply it to the page body:

```js
  const content = inject(fs.readFileSync(contentPath, 'utf8').replace(/\s+$/, ''));
```

- [ ] **Step 5: Point conversations.html at the partial**

In `build/pages/conversations.html`, replace everything between `<h6 ...>Package Applied For</h6>` and the closing of the summary card — the old select, discount field and summary card — with a single line:

```html
                                    <!--@apply-block-->
```

- [ ] **Step 6: Build and verify**

Run: `node build/build.js && node build/verify.js`

Expected: `PASS — 21 pages verified`.

Confirm the injection actually happened:

Run: `grep -c 'data-standard=' conversations.html`
Expected: `33`. A `0` means the marker was not replaced — check its spelling against `INJECTIONS`.

- [ ] **Step 7: Confirm no price survives in an option label**

Run: `grep -o '<option value="PKG[^>]*>[^<]*' conversations.html | grep -c '৳\|&#2547;'`

Expected: `0` — package labels are names only.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(leads): 33-package catalogue with negotiable pricing

Package labels carry no price; the standard price is reference data on
data-standard. Negotiated price pre-fills from it and moves freely in
both directions. Adds the funding-type selector."
```

---

## Task 6: Money engine and Apply modal wiring

**Files:**
- Modify: `assets/js/crm-leads.js`
- Modify: `assets/js/crm-demo.js` (remove the superseded flow)

**Interfaces:**
- Consumes: the ids from Task 5.
- Produces: `window.CRMLeads.money` with `{ num, agreed, paymentTotal, remaining }`, and `window.CRMLeads.initApplyBlock(root)`. Tasks 7, 9 and 11 call these.

- [ ] **Step 1: Add the money engine**

In `assets/js/crm-leads.js`, above the `DOMContentLoaded` listener:

```js
  /* ---------- Money engine (spec §11) -------------------------------
   * The one place these four rules live. Remaining is always derived,
   * never typed, so it cannot drift out of sync with the ledger. */
  function num(v) {
    var n = parseFloat(v);
    return isFinite(n) && n > 0 ? n : 0;
  }

  function agreed(negotiated, discount) {
    return Math.max(num(negotiated) - num(discount), 0);
  }

  function paymentTotal(bdtPart, usdPart, rate) {
    return num(bdtPart) + num(usdPart) * num(rate);
  }

  /* Full Funded is the one case Remaining is not derived from payments:
     a sponsor covers the agreed amount, so the patient owes nothing. */
  function remaining(agreedAmount, paid, funding) {
    if (funding === 'full') return 0;
    return Math.max(num(agreedAmount) - num(paid), 0);
  }

  var money = { num: num, agreed: agreed, paymentTotal: paymentTotal, remaining: remaining };
  window.CRMLeads.money = money;
```

- [ ] **Step 2: Add the Apply block initialiser**

Still in `crm-leads.js`, above `DOMContentLoaded`:

```js
  var fmt = function (n) { return (window.bdt || String)(n); };

  /* Wires one Apply block. Called for each page that renders the markup
     from Task 5 — the block is authored once and reused, so this runs
     against whichever copy is on the page. */
  function initApplyBlock(root) {
    root = root || document;
    var pkg = root.querySelector('#lc-package');
    var negotiated = root.querySelector('#lc-negotiated');
    if (!pkg || !negotiated) return null;

    var discount = root.querySelector('#lc-discount');
    var standardNote = root.querySelector('#lc-standard-note');
    var deltaNote = root.querySelector('#lc-delta-note');

    function standard() {
      var opt = pkg.options[pkg.selectedIndex];
      return opt ? num(opt.getAttribute('data-standard')) : 0;
    }

    function funding() {
      var checked = root.querySelector('input[name="lc-funding"]:checked');
      return checked ? checked.value : 'partial';
    }

    function set(id, v) {
      var el = root.querySelector('#' + id);
      if (el) el.textContent = fmt(v);
    }

    function agreedAmount() {
      return agreed(negotiated.value, discount ? discount.value : 0);
    }

    function render() {
      var std = standard();
      set('lc-sum-standard', std);
      set('lc-sum-negotiated', num(negotiated.value));
      set('lc-sum-discount', discount ? num(discount.value) : 0);
      set('lc-sum-agreed', agreedAmount());

      if (deltaNote) {
        var d = num(negotiated.value) - std;
        if (!std || !num(negotiated.value) || d === 0) {
          deltaNote.innerHTML = '&nbsp;';
          deltaNote.className = 'form-text fs-11';
        } else if (d > 0) {
          deltaNote.textContent = '▲ ' + fmt(d) + ' above standard';
          deltaNote.className = 'form-text fs-11 text-success';
        } else {
          deltaNote.textContent = '▼ ' + fmt(-d) + ' below standard';
          deltaNote.className = 'form-text fs-11 text-warning';
        }
      }
      root.dispatchEvent(new CustomEvent('crm:apply-change', { bubbles: true }));
    }

    /* Picking a package seeds the negotiated price with the standard one.
       It is a starting point — the employee overwrites it freely. */
    function onPackage() {
      var std = standard();
      if (standardNote) {
        standardNote.innerHTML = std
          ? 'Standard price <span class="fw-semibold">' + fmt(std) + '</span> — a starting point, not a fixed rate.'
          : 'Prices are a starting point, not a fixed rate — set what was agreed.';
      }
      if (std) negotiated.value = std;
      render();
    }

    pkg.addEventListener('change', onPackage);
    if (window.jQuery && jQuery.fn.select2) jQuery(pkg).on('select2:select', onPackage);
    negotiated.addEventListener('input', render);
    if (discount) discount.addEventListener('input', render);
    root.querySelectorAll('input[name="lc-funding"]').forEach(function (r) {
      r.addEventListener('change', render);
    });

    render();
    return { agreed: agreedAmount, funding: funding, render: render };
  }

  window.CRMLeads.initApplyBlock = initApplyBlock;
```

- [ ] **Step 3: Call it on load**

Inside the `DOMContentLoaded` callback in `crm-leads.js`, before the Add Lead wiring:

```js
    window.CRMLeads.apply = initApplyBlock(document);
```

- [ ] **Step 4: Move the conversation-outcome logic into crm-leads.js**

`initConversationFlow` in `crm-demo.js` currently owns two things: the package maths (superseded by Step 2) **and** the outcome-driven visibility of `#lc-package-block` on `conversations.html`. Deleting it wholesale would leave that block permanently hidden — the reveal must move, not vanish.

Add to `crm-leads.js`, inside `DOMContentLoaded`:

```js
    /* ---------- Conversation outcome -------------------------------- *
     * On the Conversations page the outcome drives what the modal shows:
     * "Applied"/"Confirmed" reveals the Apply block, "Follow-up" the date
     * field. (On the Leads page these two outcomes are absent — the row
     * status dropdown owns that transition.) */
    var outcome = document.getElementById('lc-outcome');
    if (outcome) {
      var pkgBlock = document.getElementById('lc-package-block');
      var followupWrap = document.getElementById('lc-followup-wrap');
      var otherWrap = document.getElementById('lc-other-wrap');
      var saveBtn = document.getElementById('lc-save-btn');
      var NEEDS_PACKAGE = { applied: true, confirmed: true };

      var syncOutcome = function () {
        var v = outcome.value;
        var showPkg = !!NEEDS_PACKAGE[v];
        if (pkgBlock) pkgBlock.classList.toggle('d-none', !showPkg);
        if (followupWrap) followupWrap.classList.toggle('d-none', v !== 'followup' && v !== 'interested');
        if (otherWrap) otherWrap.classList.toggle('d-none', v !== 'other');
        if (saveBtn) {
          saveBtn.innerHTML = '<i class="mdi mdi-content-save-outline me-1"></i>' +
            (showPkg ? 'Save &amp; Record Package' : 'Save Conversation');
        }
      };

      outcome.addEventListener('change', syncOutcome);
      syncOutcome();
    }

    var convSave = document.getElementById('lc-save-btn');
    if (convSave) {
      convSave.addEventListener('click', function () {
        var modalEl = convSave.closest('.modal');
        if (window.bootstrap && modalEl) bootstrap.Modal.getOrCreateInstance(modalEl).hide();
        window.setTimeout(function () {
          var msg = 'Conversation logged.';
          if (window.Swal) Swal.fire({ icon: 'success', title: 'Saved', text: msg, confirmButtonColor: '#024766' });
          else window.alert(msg);
        }, 250);
      });
    }
```

Then, in `assets/js/crm-demo.js`, delete the call `initConversationFlow();`, the entire `function initConversationFlow() { ... }` definition, and the comment block above the call describing it. `bdt()` and `window.bdt` stay. Everything from `/* ---------- Kanban pipeline` onwards stays.

Confirm nothing references the removed function:

Run: `grep -c "initConversationFlow" assets/js/crm-demo.js assets/js/crm-leads.js`
Expected: `0` for both files.

- [ ] **Step 5: Verify the maths in a browser console**

Open `conversations.html` in a browser, open the console, and run:

```js
CRMLeads.money.agreed(450000, 15000)          // 435000
CRMLeads.money.agreed(100, 500)               // 0   (clamped)
CRMLeads.money.paymentTotal(100000, 500, 118) // 159000
CRMLeads.money.remaining(435000, 159000, 'partial') // 276000
CRMLeads.money.remaining(435000, 0, 'full')   // 0   (sponsor covers it)
CRMLeads.money.remaining(100, 500, 'partial') // 0   (clamped)
```

Expected: every line returns the value in the comment. If any differs, fix `crm-leads.js` before continuing.

- [ ] **Step 6: Verify the negotiation UI by hand**

In the Log Conversation modal: choose outcome **Applied for a package**, pick **CABG / Bypass Surgery**.

Expected: negotiated price fills with `650000`; summary shows Standard ৳6,50,000, Agreed ৳6,50,000; delta note blank.
Type `700000`. Expected: `▲ ৳50,000 above standard` in green, Agreed ৳7,00,000.
Type `600000`. Expected: `▼ ৳50,000 below standard` in amber, Agreed ৳6,00,000. **Neither is blocked or warned about.**

- [ ] **Step 7: Build, verify, commit**

```bash
node build/build.js && node build/verify.js
git add -A
git commit -m "feat(leads): money engine and Apply block wiring

Four rules in one place: agreed, paymentTotal, remaining (with the Full
Funded exception), all clamped at zero. Moves the conversation flow out
of crm-demo.js into the leads module."
```

---

## Task 7: Status dropdown

**Files:**
- Modify: `build/pages/leads.html` (Status cell of each row; four new modals)
- Modify: `assets/js/crm-leads.js`
- Modify: `build/verify-manifest.js`

**Interfaces:**
- Consumes: `CRMLeads.initApplyBlock`, `CRMLeads.money`.
- Produces: `.crm-status-select` rows; modals `#stFollowupModal`, `#stAppliedModal`, `#stConfirmedModal`, `#stClosedModal`.

- [ ] **Step 1: Add required ids to the manifest**

Add to `build/verify-manifest.js` under `'leads.html'`: `'stFollowupModal', 'stAppliedModal', 'stConfirmedModal', 'stClosedModal'`.

- [ ] **Step 2: Run the verifier to watch it fail**

Run: `node build/verify.js`
Expected: FAIL with `leads.html: missing required id -> stFollowupModal`.

- [ ] **Step 3: Replace the Status cell in every lead row**

For each `<tr>` in the leads table, replace the status `<td>` (currently e.g. `<td><span class="badge bg-warning-subtle text-warning">Follow-up</span></td>`) with the pattern below. `data-remaining` drives the Confirmed lock — it is `0` for a lead with nothing outstanding.

```html
                                        <td>
                                            <select class="form-select form-select-sm crm-status-select" data-lead-id="ELH-L-2026-000412" data-lead-name="Rahim Uddin" data-remaining="276000">
                                                <option value="new">New</option>
                                                <option value="followup" selected>Follow-up</option>
                                                <option value="applied">Applied</option>
                                                <option value="confirmed">Confirmed</option>
                                                <option value="closed">Closed</option>
                                            </select>
                                        </td>
```

Use this per-row data:

| Lead ID | Name | selected | data-remaining |
|---|---|---|---|
| ELH-L-2026-000412 | Rahim Uddin | `followup` | 276000 |
| ELH-L-2026-000411 | Karim Mia | `applied` | 150000 |
| ELH-L-2026-000410 | Sultana Begum | `followup` | 0 |
| ELH-L-2026-000409 | Abdul Malek | `new` | 0 |

Apply the same shape to every remaining row in the table, keeping each row's existing status as the `selected` option and giving leads that have not applied a `data-remaining` of `0`.

- [ ] **Step 4: Strip the package and payment blocks out of `#logConvModal`**

`leads.html` already carries an Apply block inside `#logConvModal` — `lc-package`, `lc-discount`, `lc-pkg-agreed`, `lc-pay-amount` and friends. Applying is now the status dropdown's job, so that copy is both redundant and an id collision waiting to happen: adding `#stAppliedModal` without removing it puts two `id="lc-package"` on one page, which the duplicate-id check in `build/verify.js` rejects.

In `build/pages/leads.html`, inside `#logConvModal`, delete both blocks entirely:

- `<div id="lc-package-block" class="d-none mt-3 pt-3 border-top"> … </div>`
- `<div id="lc-payment-block" class="d-none mt-3 pt-3 border-top"> … </div>`

Leave the rest of `#logConvModal` — channel, date, discussion, outcome, follow-up date, "Please specify" — untouched. It is now purely a conversation log.

Also remove `applied` and `confirmed` from the `#lc-outcome` select on this page, since those transitions belong to the status dropdown:

```html
                                        <select class="form-select" id="lc-outcome">
                                            <option value="" selected>Select outcome</option>
                                            <option value="interested">Interested</option>
                                            <option value="followup">Another meeting / follow-up needed</option>
                                            <option value="rejected">Rejected / Not interested</option>
                                            <option value="other">Other</option>
                                        </select>
```

Verify the collision is gone once Step 5 has added the new modal — `node build/verify.js` fails with `duplicate id -> lc-package` if any of this was missed.

- [ ] **Step 5: Author the four modals as a partial**

These modals are needed on `leads.html`, `applied-leads.html` and `confirmed-leads.html`, so they are authored **once** in `build/partials/status-modals.html` and injected at the `<!--@status-modals-->` marker by the mechanism added in Task 5 Step 4.

Create `build/partials/status-modals.html` with the markup below. Then add a single line to `build/pages/leads.html`, after `#addLeadModal`:

```html
                <!--@status-modals-->
```

The partial's content:

```html
                <div class="modal fade" id="stFollowupModal" tabindex="-1" aria-hidden="true">
                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content">
                            <div class="modal-header"><div><h5 class="modal-title mb-0">Schedule Follow-up</h5><span class="fs-12 text-muted st-lead-label"></span></div><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
                            <div class="modal-body">
                                <div class="row g-3">
                                    <div class="col-12"><label class="form-label">Next follow-up date <span class="text-danger">*</span></label><input type="date" class="form-control" id="st-followup-date"></div>
                                    <div class="col-12"><label class="form-label">Remark</label><textarea class="form-control" id="st-followup-remark" rows="3" placeholder="What was agreed on this call?"></textarea></div>
                                </div>
                                <div class="form-text fs-11 mt-2"><i class="mdi mdi-information-outline"></i> Saving sets Last Follow-up to today.</div>
                            </div>
                            <div class="modal-footer"><button class="btn btn-light" data-bs-dismiss="modal">Cancel</button><button class="btn btn-primary st-save" data-status="followup">Save</button></div>
                        </div>
                    </div>
                </div>

                <div class="modal fade" id="stConfirmedModal" tabindex="-1" aria-hidden="true">
                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content">
                            <div class="modal-header"><div><h5 class="modal-title mb-0">Confirm Lead</h5><span class="fs-12 text-muted st-lead-label"></span></div><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
                            <div class="modal-body">
                                <div class="alert alert-success d-flex align-items-center gap-2 py-2 fs-13 mb-3"><i class="mdi mdi-check-decagram"></i> Payment is complete. This lead can be confirmed.</div>
                                <label class="form-label">Confirmation note</label>
                                <textarea class="form-control" id="st-confirmed-note" rows="3" placeholder="Optional"></textarea>
                            </div>
                            <div class="modal-footer"><button class="btn btn-light" data-bs-dismiss="modal">Cancel</button><button class="btn btn-success st-save" data-status="confirmed">Confirm</button></div>
                        </div>
                    </div>
                </div>

                <div class="modal fade" id="stClosedModal" tabindex="-1" aria-hidden="true">
                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content">
                            <div class="modal-header"><div><h5 class="modal-title mb-0">Close Lead</h5><span class="fs-12 text-muted st-lead-label"></span></div><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
                            <div class="modal-body">
                                <div class="row g-3">
                                    <div class="col-12"><label class="form-label">Reason <span class="text-danger">*</span></label>
                                        <select class="form-select" id="st-closed-reason">
                                            <option value="">Select a reason</option>
                                            <option>Treatment complete</option>
                                            <option>Not interested</option>
                                            <option>Lost to competitor</option>
                                            <option>Duplicate</option>
                                            <option>Other</option>
                                        </select>
                                    </div>
                                    <div class="col-12"><label class="form-label">Remark</label><textarea class="form-control" id="st-closed-remark" rows="3"></textarea></div>
                                </div>
                            </div>
                            <div class="modal-footer"><button class="btn btn-light" data-bs-dismiss="modal">Cancel</button><button class="btn btn-danger st-save" data-status="closed">Close Lead</button></div>
                        </div>
                    </div>
                </div>
```

Add `#stAppliedModal` to the same partial: a `modal-lg` shell with the same header/footer pattern (`st-lead-label`, a `.st-save` button with `data-status="applied"` labelled `Save & Move to Applied`), whose `modal-body` contains exactly one line:

```html
                                <div id="lc-apply-block"><!--@apply-block--></div>
```

Do **not** paste the Apply markup here. The build resolves the nested marker (Task 5 Step 4), so the block has one source and the ids `initApplyBlock` looks up stay in sync automatically.

- [ ] **Step 6: Wire the dropdown**

In `crm-leads.js`, inside `DOMContentLoaded`:

```js
    /* ---------- Row status dropdown --------------------------------- *
     * The status only changes once the matching modal is saved, so a
     * mis-click costs nothing. Confirmed stays locked until the lead
     * has nothing outstanding. */
    var MODALS = {
      followup: 'stFollowupModal',
      applied: 'stAppliedModal',
      confirmed: 'stConfirmedModal',
      closed: 'stClosedModal'
    };

    document.querySelectorAll('.crm-status-select').forEach(function (sel) {
      sel.dataset.previous = sel.value;
      lockConfirmed(sel);

      sel.addEventListener('change', function () {
        var target = MODALS[sel.value];
        if (!target) { sel.dataset.previous = sel.value; return; }

        var modalEl = document.getElementById(target);
        if (!modalEl) { sel.dataset.previous = sel.value; return; }

        modalEl.querySelectorAll('.st-lead-label').forEach(function (l) {
          l.textContent = (sel.dataset.leadName || '') + ' · ' + (sel.dataset.leadId || '');
        });
        modalEl.dataset.sourceSelect = sel.dataset.leadId || '';

        /* revert until the modal is actually saved */
        var pending = sel.value;
        sel.value = sel.dataset.previous;

        var modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modalEl.querySelectorAll('.st-save').forEach(function (btn) {
          btn.onclick = function () {
            sel.value = pending;
            sel.dataset.previous = pending;
            lockConfirmed(sel);
            modal.hide();
            window.setTimeout(function () {
              var msg = 'Status updated to ' + pending + '.';
              if (window.Swal) Swal.fire({ icon: 'success', title: 'Saved', text: msg, confirmButtonColor: '#024766' });
              else window.alert(msg);
            }, 250);
          };
        });
        modal.show();
      });
    });

    function lockConfirmed(sel) {
      var rem = window.CRMLeads.money.num(sel.dataset.remaining);
      var opt = sel.querySelector('option[value="confirmed"]');
      if (!opt) return;
      opt.disabled = rem > 0;
      opt.textContent = rem > 0 ? 'Confirmed — ' + (window.bdt || String)(rem) + ' still due' : 'Confirmed';
      sel.title = rem > 0 ? (window.bdt || String)(rem) + ' still due — record the remaining payment first.' : '';
    }
```

- [ ] **Step 7: Build and verify**

Run: `node build/build.js && node build/verify.js`
Expected: `PASS — 21 pages verified`.

- [ ] **Step 8: Verify the lock and the revert by hand**

Open `leads.html`.

1. On the **Rahim Uddin** row (`data-remaining="276000"`), open the status dropdown. Expected: the Confirmed option reads `Confirmed — ৳2,76,000 still due` and **cannot be selected**.
2. On the **Sultana Begum** row (`data-remaining="0"`), Confirmed reads plain `Confirmed` and is selectable.
3. On any row, choose **Closed**, then dismiss the modal with Cancel or the X. Expected: **the dropdown snaps back to its previous value** — the status did not change.
4. Choose **Closed** again and press **Close Lead**. Expected: the dropdown now reads Closed and a success dialog appears.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(leads): live status dropdown with modal-gated changes

Replaces the static status badge. Each option opens its own modal and the
status only moves once that modal is saved. Confirmed is disabled while a
balance remains, naming the outstanding figure."
```

---

## Task 8: Leads table columns

**Files:**
- Modify: `build/pages/leads.html` (table `<thead>` and every `<tr>`)

**Interfaces:**
- Consumes: the status cell from Task 7.
- Produces: the 14-cell table. No new JS.

- [ ] **Step 1: Replace the table head**

```html
                                <thead class="table-light">
                                    <tr>
                                        <th>Patient ID</th>
                                        <th>Patient / Guardian</th>
                                        <th>Phone / WhatsApp</th>
                                        <th>Location &middot; Age</th>
                                        <th>Condition</th>
                                        <th>Source</th>
                                        <th>Inquiry Date</th>
                                        <th>Status</th>
                                        <th>Staff</th>
                                        <th>Package / Funding</th>
                                        <th class="text-end">Received / Due</th>
                                        <th>Follow-up</th>
                                        <th>Remarks</th>
                                        <th class="no-sort">Action</th>
                                    </tr>
                                </thead>
```

- [ ] **Step 2: Rewrite each row to match**

Exemplar for the first lead — apply the same cell structure to every row:

```html
                                    <tr>
                                        <td class="mono fs-12">ELH-L-2026-000412</td>
                                        <td><div class="fw-semibold">Ayesha Rahim</div><div class="fs-12 text-muted">G: Rahim Uddin</div></td>
                                        <td class="fs-13">+880 1711-234567 <a href="#!" class="text-success ms-1" title="WhatsApp"><i class="mdi mdi-whatsapp"></i></a></td>
                                        <td class="fs-13">Chattogram<div class="fs-11 text-muted">42 yrs</div></td>
                                        <td class="fs-13 text-truncate" style="max-width:180px" title="Blocked artery, advised bypass. Diabetic, on insulin 6 years.">Blocked artery, advised bypass. Diabetic, on insulin 6 years.</td>
                                        <td><span class="badge bg-info-subtle text-info">Facebook</span></td>
                                        <td class="fs-13">02 Aug 2026</td>
                                        <td><!-- status select from Task 7 --></td>
                                        <td class="fs-13">Tanvir Ahmed</td>
                                        <td class="fs-13">CABG / Bypass Surgery<div><span class="badge bg-warning-subtle text-warning">Partial Funded</span></div></td>
                                        <td class="text-end fs-13"><div class="cur text-success">&#2547;1,59,000</div><div class="fs-11 text-muted">incl. $500</div><div class="cur text-danger fw-bold">&#2547;2,76,000</div></td>
                                        <td class="fs-13">28 Aug 2026<div class="fs-11 text-danger">Next: 31 Aug 2026</div></td>
                                        <td class="fs-13 text-truncate" style="max-width:160px" title="Guardian asked to split payment across three instalments.">Guardian asked to split payment across three instalments.</td>
                                        <td>
                                            <div class="d-flex gap-1">
                                                <button type="button" class="btn btn-sm btn-icon btn-light" title="Log Conversation" data-bs-toggle="modal" data-bs-target="#logConvModal" data-lead-name="Rahim Uddin" data-lead-patient="Ayesha Rahim" data-lead-id="ELH-L-2026-000412"><i class="mdi mdi-comment-text-outline"></i></button>
                                                <button type="button" class="btn btn-sm btn-icon btn-light" title="Edit"><i class="mdi mdi-pencil-outline"></i></button>
                                            </div>
                                        </td>
                                    </tr>
```

Keep each row's existing identity data (ID, names, phone, district, source, staff). Give leads that have not applied an em-dash in Package / Funding and Received / Due.

Note the Patient / Guardian cell now leads with the **patient**, per the client's column order (Patient Name is column 2, Guardian Name column 3).

- [ ] **Step 3: Make the table scroll rather than overflow the page**

Ensure the table's wrapper is `<div class="table-responsive">`. If it is not, add it.

- [ ] **Step 4: Build and verify**

Run: `node build/build.js && node build/verify.js`
Expected: `PASS — 21 pages verified`. The div-balance check catches a dropped `</tr>` wrapper only indirectly, so also run:

`node -e "const h=require('fs').readFileSync('leads.html','utf8');const o=(h.match(/<tr\b/g)||[]).length,c=(h.match(/<\/tr>/g)||[]).length;console.log(o===c?'tr balanced ('+o+')':'TR MISMATCH '+o+'/'+c);process.exit(o===c?0:1)"`

Expected: `tr balanced (N)`.

- [ ] **Step 5: Confirm column count matches every row**

`node -e "const h=require('fs').readFileSync('leads.html','utf8');const th=(h.match(/<th[\s>]/g)||[]).length;const rows=h.split(/<tr\b/).slice(2);const bad=rows.map(r=>(r.match(/<td[\s>]/g)||[]).length).filter(n=>n&&n!==14);console.log('th:',th,'rows with wrong td count:',bad);process.exit(bad.length?1:0)"`

Expected: `th: 14 rows with wrong td count: []`.

- [ ] **Step 6: Open the page and confirm no horizontal page overflow**

Open `leads.html`. Expected: the table scrolls inside its own container; the page body itself does not scroll sideways.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(leads): rebuild the table on the client's 17 columns

17 fields in 14 cells by pairing related ones. Drops Treatment and
Priority from the default view."
```

---

## Task 9: Applied Leads page

**Files:**
- Modify: `build/pages/applied-leads.html`, `assets/js/crm-leads.js`, `build/verify-manifest.js`

**Interfaces:**
- Consumes: `CRMLeads.money`.
- Produces: `#addPaymentModal` with `#pay-bdt`, `#pay-usd`, `#pay-rate`, `#pay-total`, `#pay-remaining`, `#pay-save`.

- [ ] **Step 1: Add required ids to the manifest**

```js
  'applied-leads.html': ['addPaymentModal', 'pay-bdt', 'pay-usd', 'pay-rate', 'pay-total', 'pay-remaining', 'pay-save'],
```

- [ ] **Step 2: Run the verifier to watch it fail**

Run: `node build/verify.js`
Expected: FAIL with `applied-leads.html: missing required id -> addPaymentModal`.

- [ ] **Step 3: Write the page body**

Replace `build/pages/applied-leads.html` with four tiles (same `stat-tile` markup as the dashboard: Total Applied `12`, Negotiated Value `৳48,20,000`, Received `৳19,40,000`, Remaining `৳28,80,000`), then a `card` holding a `table-responsive` with `<table class="table crm-table">`.

Head:

```html
                                <thead class="table-light">
                                    <tr>
                                        <th class="no-sort"></th>
                                        <th>Lead ID</th>
                                        <th>Patient / Guardian</th>
                                        <th>Phone</th>
                                        <th>Package</th>
                                        <th class="text-end">Negotiated</th>
                                        <th class="text-end">Paid</th>
                                        <th class="text-end">Remaining</th>
                                        <th>Status</th>
                                        <th>Staff</th>
                                        <th>Applied On</th>
                                        <th class="no-sort">Action</th>
                                    </tr>
                                </thead>
```

Exemplar row plus its ledger row — seed six leads on this pattern, at least one of them fully paid (`data-remaining="0"`) so the Confirmed unlock is demonstrable:

```html
                                    <tr>
                                        <td><button class="btn btn-sm btn-icon btn-light crm-ledger-toggle" data-target="ledger-412" title="Payment history"><i class="mdi mdi-chevron-right"></i></button></td>
                                        <td class="mono fs-12">ELH-L-2026-000412</td>
                                        <td><div class="fw-semibold">Ayesha Rahim</div><div class="fs-12 text-muted">G: Rahim Uddin</div></td>
                                        <td class="fs-13">+880 1711-234567</td>
                                        <td class="fs-13">CABG / Bypass Surgery</td>
                                        <td class="text-end cur fs-13">&#2547;4,35,000</td>
                                        <td class="text-end cur fs-13 text-success">&#2547;1,59,000</td>
                                        <td class="text-end cur fs-13 text-danger fw-bold">&#2547;2,76,000</td>
                                        <td>
                                            <select class="form-select form-select-sm crm-status-select" data-lead-id="ELH-L-2026-000412" data-lead-name="Rahim Uddin" data-remaining="276000">
                                                <option value="applied" selected>Applied</option>
                                                <option value="confirmed">Confirmed</option>
                                                <option value="closed">Closed</option>
                                            </select>
                                        </td>
                                        <td class="fs-13">Tanvir Ahmed</td>
                                        <td class="fs-13">12 Aug 2026</td>
                                        <td><button class="btn btn-sm btn-primary crm-add-payment" data-bs-toggle="modal" data-bs-target="#addPaymentModal" data-lead-id="ELH-L-2026-000412" data-lead-name="Rahim Uddin" data-remaining="276000"><i class="mdi mdi-cash-plus me-1"></i>Payment</button></td>
                                    </tr>
                                    <tr class="d-none crm-ledger" id="ledger-412">
                                        <td colspan="12" class="bg-light-subtle">
                                            <div class="p-2">
                                                <div class="fs-12 text-uppercase text-muted mb-2">Payments &mdash; ELH-L-2026-000412</div>
                                                <table class="table table-sm mb-0">
                                                    <tbody>
                                                        <tr><td class="fs-13">12 Aug 2026</td><td class="fs-13">Advance</td><td class="fs-13">Cash</td><td class="text-end cur fs-13">&#2547;1,00,000</td><td class="mono fs-12 text-muted">MR-000231</td></tr>
                                                        <tr><td class="fs-13">20 Aug 2026</td><td class="fs-13">2nd instalment</td><td class="fs-13">bKash</td><td class="text-end cur fs-13">&#2547;59,000 <span class="fs-11 text-muted">($500 @ &#2547;118)</span></td><td class="mono fs-12 text-muted">MR-000255</td></tr>
                                                    </tbody>
                                                    <tfoot>
                                                        <tr><td colspan="3" class="text-end fs-13 fw-semibold">Paid</td><td class="text-end cur fs-13 fw-bold text-success">&#2547;1,59,000</td><td></td></tr>
                                                        <tr><td colspan="3" class="text-end fs-13 fw-semibold">Remaining</td><td class="text-end cur fs-13 fw-bold text-danger">&#2547;2,76,000</td><td></td></tr>
                                                    </tfoot>
                                                </table>
                                            </div>
                                        </td>
                                    </tr>
```

Applied rows need the Confirmed and Closed modals, so add the injection marker on its own line at the end of the page body — do not copy the modal markup:

```html
                <!--@status-modals-->
```

- [ ] **Step 4: Add the payment modal**

```html
                <div class="modal fade" id="addPaymentModal" tabindex="-1" aria-hidden="true">
                    <div class="modal-dialog modal-lg modal-dialog-centered">
                        <div class="modal-content">
                            <div class="modal-header"><div><h5 class="modal-title mb-0">Record Payment</h5><span class="fs-12 text-muted" id="pay-lead-label"></span></div><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
                            <div class="modal-body">
                                <div class="row g-3">
                                    <div class="col-md-4"><label class="form-label">Payment date</label><input type="date" class="form-control" id="pay-date"></div>
                                    <div class="col-md-4"><label class="form-label">Method <span class="text-danger">*</span></label><select class="form-select" id="pay-method"><option>Cash</option><option>Bank Transfer</option><option>Card</option><option>bKash</option><option>Nagad</option><option>Rocket</option><option>Other</option></select></div>
                                    <div class="col-md-4"><label class="form-label">Reference no.</label><input type="text" class="form-control" id="pay-ref" placeholder="If applicable"></div>

                                    <div class="col-12"><hr class="my-1"></div>
                                    <div class="col-md-4"><label class="form-label">Received (BDT)</label><div class="input-group"><span class="input-group-text">&#2547;</span><input type="number" class="form-control" id="pay-bdt" min="0" placeholder="0"></div></div>
                                    <div class="col-md-4"><label class="form-label">Received (USD)</label><div class="input-group"><span class="input-group-text">$</span><input type="number" class="form-control" id="pay-usd" min="0" placeholder="0"></div></div>
                                    <div class="col-md-4"><label class="form-label">Rate — 1 USD =</label><div class="input-group"><span class="input-group-text">&#2547;</span><input type="number" class="form-control" id="pay-rate" min="0" value="118"></div></div>
                                    <div class="col-12"><div class="fs-12 text-muted" id="pay-conv">&nbsp;</div></div>

                                    <div class="col-md-6"><label class="form-label">Payment proof</label><input type="file" class="form-control" id="pay-proof"></div>
                                    <div class="col-md-6"><label class="form-label">Note</label><input type="text" class="form-control" id="pay-note"></div>
                                </div>
                                <div class="card bg-light-subtle border mt-3 mb-0"><div class="card-body py-3">
                                    <div class="row text-center">
                                        <div class="col"><div class="fs-11 text-uppercase text-muted">This Payment</div><div class="fw-bold cur text-success" id="pay-total">&#2547;0</div></div>
                                        <div class="col"><div class="fs-11 text-uppercase text-muted">Remaining After</div><div class="fw-bold cur text-danger" id="pay-remaining">&#2547;0</div></div>
                                    </div>
                                </div></div>
                                <div class="alert alert-success d-none mt-3 mb-0 py-2 fs-13" id="pay-settled"><i class="mdi mdi-check-decagram me-1"></i>Fully paid — this lead can now be Confirmed.</div>
                            </div>
                            <div class="modal-footer"><button class="btn btn-light" data-bs-dismiss="modal">Cancel</button><button class="btn btn-primary" id="pay-save"><i class="mdi mdi-receipt-text-check-outline me-1"></i>Save &amp; Issue Receipt</button></div>
                        </div>
                    </div>
                </div>
```

- [ ] **Step 5: Wire the ledger toggle and the payment maths**

In `crm-leads.js`, inside `DOMContentLoaded`:

```js
    /* ---------- Payment ledger -------------------------------------- */
    document.querySelectorAll('.crm-ledger-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var row = document.getElementById(btn.dataset.target);
        if (!row) return;
        row.classList.toggle('d-none');
        var icon = btn.querySelector('i');
        if (icon) icon.className = row.classList.contains('d-none') ? 'mdi mdi-chevron-right' : 'mdi mdi-chevron-down';
      });
    });

    /* ---------- Record Payment -------------------------------------- */
    var payModal = document.getElementById('addPaymentModal');
    if (payModal) {
      var bdtIn = document.getElementById('pay-bdt');
      var usdIn = document.getElementById('pay-usd');
      var rateIn = document.getElementById('pay-rate');
      var conv = document.getElementById('pay-conv');
      var settled = document.getElementById('pay-settled');
      var due = 0;

      function renderPayment() {
        var m = window.CRMLeads.money;
        var usd = m.num(usdIn.value);
        var rate = m.num(rateIn.value);
        var total = m.paymentTotal(bdtIn.value, usd, rate);

        conv.innerHTML = usd && rate
          ? '$' + usd.toLocaleString('en-US') + ' converts to <span class="fw-semibold">' + window.bdt(usd * rate) + '</span> at this rate.'
          : '&nbsp;';

        /* A payment cannot exceed what is outstanding. "Remaining after"
           goes through the same engine as every other balance. */
        var applied = Math.min(total, due);
        document.getElementById('pay-total').textContent = window.bdt(applied);
        var after = m.remaining(due, applied, 'partial');
        document.getElementById('pay-remaining').textContent = window.bdt(after);
        settled.classList.toggle('d-none', after > 0);
        if (total > due && due > 0) {
          conv.innerHTML += ' <span class="text-warning">Exceeds the ' + window.bdt(due) + ' outstanding — only that much will be applied.</span>';
        }
      }

      [bdtIn, usdIn, rateIn].forEach(function (el) { el.addEventListener('input', renderPayment); });

      payModal.addEventListener('show.bs.modal', function (ev) {
        var btn = ev.relatedTarget;
        if (btn) {
          due = window.CRMLeads.money.num(btn.dataset.remaining);
          document.getElementById('pay-lead-label').textContent =
            (btn.dataset.leadName || '') + ' · ' + (btn.dataset.leadId || '') + ' · ' + window.bdt(due) + ' outstanding';
        }
        bdtIn.value = ''; usdIn.value = '';
        renderPayment();
      });

      document.getElementById('pay-save').addEventListener('click', function () {
        var after = document.getElementById('pay-remaining').textContent;
        bootstrap.Modal.getOrCreateInstance(payModal).hide();
        window.setTimeout(function () {
          var msg = 'Payment recorded, receipt issued. Remaining: ' + after + '.';
          if (window.Swal) Swal.fire({ icon: 'success', title: 'Saved', text: msg, confirmButtonColor: '#024766' });
          else window.alert(msg);
        }, 250);
      });
    }
```

- [ ] **Step 6: Build and verify**

Run: `node build/build.js && node build/verify.js`
Expected: `PASS — 21 pages verified`.

- [ ] **Step 7: Verify the payment maths by hand**

Open `applied-leads.html`, click **Payment** on the Rahim Uddin row (৳2,76,000 outstanding).

1. Enter BDT `100000`. Expected: This Payment ৳1,00,000; Remaining After ৳1,76,000.
2. Add USD `500` at rate `118`. Expected: conversion line reads `$500 converts to ৳59,000`; This Payment ৳1,59,000; Remaining After ৳1,17,000.
3. Change BDT to `500000`. Expected: This Payment caps at ৳2,76,000, Remaining After ৳0, the green **Fully paid** banner appears, and the amber "exceeds the outstanding" note shows.
4. Click the chevron on any row. Expected: the payment ledger expands and the chevron turns down.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(leads): Applied Leads page with per-lead payment ledger

Paid/Remaining per applied lead, an expandable payment history, and a
Record Payment modal taking BDT and USD with the rate captured on the
payment. Clears to a Fully paid state that unlocks Confirmed."
```

---

## Task 10: Confirmed Leads page

**Files:**
- Modify: `build/pages/confirmed-leads.html`

**Interfaces:**
- Consumes: the status dropdown from Task 7.
- Produces: nothing new.

- [ ] **Step 1: Write the page body**

Four `stat-tile` cards — Total Confirmed `47`, Total Collected `৳1,42,60,000`, Confirmed This Month `9`, Avg. Applied → Confirmed `18 days` — then a `card` with a `table-responsive` and `<table class="table crm-table">`.

Head:

```html
                                <thead class="table-light">
                                    <tr>
                                        <th>Lead ID</th>
                                        <th>Patient / Guardian</th>
                                        <th>Phone</th>
                                        <th>Package</th>
                                        <th class="text-end">Total Paid</th>
                                        <th>Confirmed On</th>
                                        <th>Confirmed By</th>
                                        <th class="no-sort">Receipts</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
```

Exemplar row — seed six:

```html
                                    <tr>
                                        <td class="mono fs-12">ELH-L-2026-000398</td>
                                        <td><div class="fw-semibold">Mim Akter</div><div class="fs-12 text-muted">G: Jahanara Khatun</div></td>
                                        <td class="fs-13">+880 1677-112233</td>
                                        <td class="fs-13">Kidney Transplant</td>
                                        <td class="text-end cur fs-13 text-success fw-bold">&#2547;9,80,000</td>
                                        <td class="fs-13">24 Aug 2026</td>
                                        <td class="fs-13">Tanvir Ahmed</td>
                                        <td><a href="receipts.html" class="btn btn-sm btn-icon btn-light" title="View receipts"><i class="mdi mdi-receipt-text-outline"></i></a></td>
                                        <td>
                                            <select class="form-select form-select-sm crm-status-select" data-lead-id="ELH-L-2026-000398" data-lead-name="Jahanara Khatun" data-remaining="0">
                                                <option value="confirmed" selected>Confirmed</option>
                                                <option value="applied">Back to Applied</option>
                                                <option value="closed">Closed — treatment complete</option>
                                            </select>
                                        </td>
                                    </tr>
```

The status dropdown needs somewhere to open, so add the injection marker on its own line at the end of the page body — do not copy the modal markup:

```html
                <!--@status-modals-->
```

- [ ] **Step 2: Build and verify**

Run: `node build/build.js && node build/verify.js`
Expected: `PASS — 21 pages verified`.

- [ ] **Step 3: Check the table by hand**

Open `confirmed-leads.html`. Expected: tiles render, the table sorts and searches, and the status dropdown opens a modal that reverts on cancel.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(leads): Confirmed Leads page"
```

---

## Task 11: Conversations adoption and final verification

**Files:**
- Modify: `build/pages/conversations.html`
- Modify: `build/README.md`

- [ ] **Step 1: Confirm the shared markup has exactly one source**

The Apply block and the status modals are authored in `build/partials/` and injected. Prove no page source has a pasted copy, and that every page that needs the block actually received it:

```bash
node -e "
const fs=require('fs');
const pages=fs.readdirSync('build/pages').filter(f=>f.endsWith('.html'));
const pasted=pages.filter(f=>fs.readFileSync('build/pages/'+f,'utf8').includes('data-standard='));
const want=['leads.html','conversations.html','applied-leads.html','confirmed-leads.html'];
const missing=want.filter(f=>!fs.readFileSync(f,'utf8').includes('data-standard='));
if(pasted.length) console.log('PASTED COPY in build/pages: '+pasted.join(', '));
if(missing.length) console.log('MARKER NOT RESOLVED in: '+missing.join(', '));
if(!pasted.length && !missing.length) console.log('apply block: one source, injected into '+want.length+' pages');
process.exit(pasted.length||missing.length?1:0);"
```

Expected: `apply block: one source, injected into 4 pages`.

A `PASTED COPY` result means someone inlined the markup instead of using the marker — delete it and restore the `<!--@apply-block-->` line. A `MARKER NOT RESOLVED` result means the marker is missing or misspelled in that page's source.

- [ ] **Step 2: Read the lead from the query string**

In `crm-leads.js`, inside `DOMContentLoaded`:

```js
    /* Add Lead hands off to this page with ?lead=<id>. */
    var leadParam = new URLSearchParams(window.location.search).get('lead');
    if (leadParam) {
      var label = document.getElementById('lc-lead-label');
      if (label) label.textContent = 'New lead · ' + leadParam;
      var convModal = document.getElementById('newConvModal');
      if (convModal && window.bootstrap) bootstrap.Modal.getOrCreateInstance(convModal).show();
    }
```

- [ ] **Step 3: Verify the handoff end to end**

1. Open `leads.html`, click **Add Lead**, fill the guardian and patient names, click **Save & Start Conversation**.
   Expected: the browser lands on `conversations.html?lead=ELH-L-2026-000413` with the Log Conversation modal already open and the header naming that lead.
2. In that modal choose outcome **Applied for a package**, pick a package, adjust the negotiated price up and then down.
   Expected: the Agreed figure tracks, the delta note flips between green and amber, and nothing blocks either direction.

- [ ] **Step 4: Full verification sweep**

```bash
node build/build.js
node build/verify.js
git diff --stat
```

Expected: `built 20/20`, `PASS — 21 pages verified`, and the only changed files are the ones this plan touched.

Then confirm no page hand-edits crept in — regenerate into a scratch dir and diff:

```bash
node -e "
const {execSync}=require('child_process');
const fs=require('fs');
const before=fs.readdirSync('.').filter(f=>f.endsWith('.html'))
  .map(f=>[f,fs.readFileSync(f,'utf8')]);
execSync('node build/build.js',{stdio:'ignore'});
const bad=before.filter(([f,s])=>fs.readFileSync(f,'utf8')!==s).map(([f])=>f);
console.log(bad.length?'NOT REPRODUCIBLE: '+bad.join(', '):'all pages reproducible from build/');
process.exit(bad.length?1:0);"
```

Expected: `all pages reproducible from build/`. A failure here means someone edited generated HTML directly.

- [ ] **Step 5: Update the build README**

Add to `build/README.md` under Layout:

```
    pages/applied-leads.html    Applied list + payment ledger
    pages/confirmed-leads.html  Confirmed list
```

and note that `assets/js/crm-leads.js` carries the lead-lifecycle behaviour, loaded via the `leadsjs` page flag.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(leads): wire conversation handoff, verify module end to end"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| §5 Add Lead — doctor/hospital removed, condition note, redirect | 4 |
| §6 Package, negotiated price, delta note, select2, 33 packages | 5, 6 |
| §6 Funding type behaviour | 5 (markup), 6 (maths) |
| §7 Status dropdown, modal gating, Confirmed lock | 7 |
| §8 Applied page, tiles, ledger, payment modal, BDT+USD | 9 |
| §9 Confirmed page | 10 |
| §10 Leads table columns | 8 |
| §11 Money rules | 6 (engine), 9 (payment application) |
| §4 Files / sidebar | 2, 3 |

No spec section is unassigned.

**Deviations from the spec, recorded here deliberately:**

1. Spec §4 says the sidebar means "two entries added to all 17 pages (scripted)". That was written before the build system was understood. Tasks 2–3 replace it with two entries in `build/menu.js` — the spec's file table is superseded by this plan's File Structure table.
2. Spec §7 says the Apply modal "is authored once and appears in both `leads.html` and `conversations.html`; the two copies must stay identical." This plan makes that literal rather than aspirational: the markup lives in `build/partials/apply-block.html` and is injected, so there are no copies to keep in sync. The same applies to the status modals across three pages.

**Known gap carried forward:** `packages.html` still shows a fixed-price catalogue of 6 packages and does not know about the 33 in Task 5, and `plan.md` still describes the old flow. Both are listed out of scope in spec §12 and remain stale until a later pass.
