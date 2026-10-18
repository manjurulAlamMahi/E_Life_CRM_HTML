/**
 * E Life Healthcare CRM — Expense module.
 *
 * One list of expenses in taka, of three kinds:
 *   fixed    — generated on the 1st of every month from a fixed item (rent,
 *              internet, salaries...); staff only correct the amount or date
 *   other    — one-off company costs, by category
 *   patient  — one cost of a patient's journey: a ticket, a visa or a payment
 *              to the source that brought the lead, each with its own date.
 *              The source comes from the lead, so a source cost is the
 *              source expense — there is no separate source ledger.
 * Entries are dated by when the cost was paid (editable, may be earlier than
 * today). Totals and breakdowns are only shown on Expense Report. Static
 * preview — sample entries are dated relative to today; changes live only
 * until the page is reloaded.
 */
(function () {
  'use strict';

  var DAY = 86400000;
  /* Managed on Settings → Expense Categories (CRMSettings); the fallback
     only matters if crm-demo.js failed to load. */
  var categories = window.CRMSettings ? CRMSettings.list('expenseCategories')
    : ['Office Rent', 'Salaries', 'Marketing & Ads', 'Utilities', 'Travel & Transport', 'Office Supplies', 'Software & Internet', 'Miscellaneous'];
  /* Applied and confirmed leads — the only ones a ticket, visa or source is
     paid for. [lead ID, patient, status, source, guardian, phone] — same as
     Applied / Confirmed Leads. */
  var LEADS = [
    ['ELH-L-2026-000412', 'Ayesha Rahim', 'Applied', 'Noman', 'Rahim Uddin', '+880 1711-234567'],
    ['ELH-L-2026-000411', 'Karim Mia', 'Applied', 'Website', 'Karim Mia', '+880 1812-445566'],
    ['ELH-L-2026-000410', 'Nadia Sultana', 'Applied', 'Facebook', 'Sultana Begum', '+880 1911-778899'],
    ['ELH-L-2026-000408', 'Mim Akter', 'Applied', 'Hospital', 'Jahanara Khatun', '+880 1677-112233'],
    ['ELH-L-2026-000405', 'Jamal Uddin', 'Applied', 'Dr. Ilias Patowary', 'Jamal Uddin', '+880 1745-330011'],
    ['ELH-L-2026-000406', 'Sharmin Akter', 'Confirmed', 'Facebook', 'Abul Kalam', '+880 1521-889900'],
    ['ELH-L-2026-000398', 'Rokeya Begum', 'Confirmed', 'Noman', 'Anwar Hossain', '+880 1633-447788'],
    ['ELH-L-2026-000395', 'Sajid Hasan', 'Confirmed', 'Website', 'Mizanur Rahman', '+880 1877-220044'],
    ['ELH-L-2026-000391', 'Halima Khatun', 'Confirmed', 'Doctor Referral', 'Halima Khatun', '+880 1955-661122'],
    ['ELH-L-2026-000386', 'Tanjila Akter', 'Confirmed', 'Facebook', 'Rafiqul Islam', '+880 1712-903344'],
    ['ELH-L-2026-000380', 'Nurul Islam', 'Confirmed', 'Dr. Ilias Patowary', 'Nurul Islam', '+880 1818-556677']
  ];
  /* Leads each source has brought, how many applied for a package and how
     many confirmed — the same figures as Source List (sources.html). */
  var SOURCE_STATS = {
    'Facebook': [64, 28, 22], 'Dr. Ilias Patowary': [48, 24, 19], 'Noman': [39, 15, 11], 'Website': [27, 11, 9],
    'Hospital': [22, 8, 6], 'Walk-in': [18, 6, 4], 'Doctor Referral': [14, 5, 3]
  };
  /* A patient cost is one of these, each recorded on its own date. */
  var PTYPES = { ticket: ['Ticket', 'mdi-airplane', 'bg-primary-subtle text-primary'], visa: ['Visa', 'mdi-passport', 'bg-info-subtle text-info'], source: ['Source', 'mdi-share-variant-outline', 'bg-warning-subtle text-warning'] };
  var USER = 'Mahi Alam';
  var nextId = 1;

  function today() { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function parse(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2] || 1); }
  function pretty(s) { return parse(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
  function monthName(key) { return parse(key).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }); }
  function bdt(n) { return '৳' + Math.round(n).toLocaleString('en-IN'); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function daysAgo(n) { return iso(new Date(today().getTime() - n * DAY)); }
  /* 'YYYY-MM' for a date, and the month `n` months before the current one. */
  function monthKey(d) { return iso(d).slice(0, 7); }
  function monthsAgo(n) { var t = today(); return monthKey(new Date(t.getFullYear(), t.getMonth() - n, 1)); }
  /* Weeks run Monday to Sunday. */
  function weekStart(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() - (d.getDay() + 6) % 7); }
  function lead(id) { return LEADS.filter(function (l) { return l[0] === id; })[0]; }

  /* ---------- sample data ---------- */

  /* Fixed items: [name, category, monthly amount, method]. All run from
     five months back so the report has history. */
  var fixedItems = [
    ['Office rent', 'Office Rent', 65000, 'Bank Transfer'],
    ['Staff salaries', 'Salaries', 210000, 'Bank Transfer'],
    ['Office internet', 'Software & Internet', 3200, 'Bank Transfer'],
    ['Electricity bill', 'Utilities', 8400, 'bKash'],
    ['CRM hosting', 'Software & Internet', 9000, 'Card']
  ].map(function (f) {
    return { id: nextId++, name: f[0], cat: f[1], amount: f[2], method: f[3], active: true, since: monthsAgo(5), skip: {} };
  });

  /* Other expenses: [days ago, category, description, method, amount, ref] */
  var OTHER_SEED = [
    [0, 'Travel & Transport', 'CNG fare - hospital document pickup', 'Cash', 900, ''],
    [2, 'Marketing & Ads', 'Facebook ads - campaign', 'Card', 45000, 'INV-FB-118'],
    [4, 'Office Supplies', 'Printer paper and toner', 'Cash', 6200, ''],
    [6, 'Travel & Transport', 'Airport pickup for patient party', 'Cash', 3500, ''],
    [12, 'Marketing & Ads', 'Leaflet printing', 'Cash', 12500, ''],
    [24, 'Miscellaneous', 'Tea, snacks and cleaning', 'Cash', 4300, ''],
    [33, 'Utilities', 'Water and gas bill', 'Cash', 2600, ''],
    [38, 'Marketing & Ads', 'Google ads', 'Card', 30000, 'INV-GA-77'],
    [56, 'Travel & Transport', 'Visa office visits', 'Cash', 5400, ''],
    [95, 'Office Supplies', 'Furniture repair', 'Cash', 11000, ''],
    [140, 'Marketing & Ads', 'Banner and signboard', 'Cash', 28000, '']
  ];
  /* Patient costs: [days ago, lead ID, type, amount, method, note] */
  var PATIENT_SEED = [
    [0, 'ELH-L-2026-000406', 'visa', 14000, 'Cash', 'Medical + attendant visa'],
    [2, 'ELH-L-2026-000406', 'ticket', 68000, 'Card', 'Dhaka - Chennai return, patient + attendant'],
    [4, 'ELH-L-2026-000398', 'ticket', 42000, 'Card', 'Dhaka - Kolkata return'],
    [9, 'ELH-L-2026-000398', 'visa', 9500, 'Cash', 'Medical visa processing fee'],
    [15, 'ELH-L-2026-000398', 'source', 10000, 'bKash', 'Referral commission'],
    [5, 'ELH-L-2026-000412', 'visa', 9500, 'Cash', 'Medical visa processing fee'],
    [8, 'ELH-L-2026-000412', 'source', 12500, 'bKash', 'Referral commission'],
    [11, 'ELH-L-2026-000405', 'source', 15000, 'Bank Transfer', 'Referral commission'],
    [13, 'ELH-L-2026-000395', 'ticket', 36000, 'Card', 'Dhaka - Chennai return'],
    [20, 'ELH-L-2026-000391', 'ticket', 71000, 'Card', 'Dhaka - Delhi return, patient + attendant'],
    [27, 'ELH-L-2026-000391', 'visa', 14000, 'Cash', 'Medical + attendant visa'],
    [34, 'ELH-L-2026-000391', 'source', 15000, 'Bank Transfer', 'Referral commission'],
    [36, 'ELH-L-2026-000380', 'ticket', 52000, 'Card', 'Dhaka - Bangkok return'],
    [44, 'ELH-L-2026-000380', 'visa', 9500, 'Cash', 'Medical visa processing fee'],
    [61, 'ELH-L-2026-000380', 'source', 18000, 'Bank Transfer', 'Referral commission'],
    [52, 'ELH-L-2026-000408', 'source', 8000, 'Cash', 'Hospital desk fee'],
    [58, 'ELH-L-2026-000386', 'visa', 9500, 'Cash', 'Medical visa processing fee']
  ];

  var expenses = OTHER_SEED.map(function (s) {
    return { id: nextId++, kind: 'other', date: daysAgo(s[0]), cat: s[1], desc: s[2], method: s[3], amount: s[4], ref: s[5], by: USER };
  }).concat(PATIENT_SEED.map(function (s) {
    var l = lead(s[1]);
    return { id: nextId++, kind: 'patient', date: daysAgo(s[0]), leadId: l[0], patient: l[1], src: l[3], ptype: s[2], amount: s[3], method: s[4], desc: s[5], by: USER };
  }));

  /* Creates the month's entry for every active fixed item that does not have
     one yet. Never for future months, never before the item existed, and
     not again for a month whose entry was deleted on purpose. */
  function generate(key) {
    if (key > monthKey(today())) return;
    fixedItems.forEach(function (f) {
      if (!f.active || key < f.since || f.skip[key]) return;
      if (expenses.some(function (e) { return e.kind === 'fixed' && e.itemId === f.id && e.month === key; })) return;
      expenses.push({ id: nextId++, kind: 'fixed', itemId: f.id, month: key, date: key + '-01', cat: f.cat, desc: f.name, method: f.method, amount: f.amount, ref: '', by: 'Auto' });
    });
  }
  for (var m = 5; m >= 0; m--) generate(monthsAgo(m));
  /* The seeded electricity bills differ month to month, as they would. */
  expenses.forEach(function (e) {
    if (e.kind === 'fixed' && e.desc === 'Electricity bill') e.amount += [0, 900, -600, 1400, 300, -200][parseInt(e.month.slice(5), 10) % 6];
  });

  /* ---------- shared helpers ---------- */

  /* An element that is not on the current page resolves to a detached stub
     so shared code needs no per-page branches. */
  var STUB = document.createElement('input');
  function $(id) { return document.getElementById(id) || STUB; }
  function has(id) { return !!document.getElementById(id); }
  function sum(list, key) { return list.reduce(function (a, e) { return a + (e[key || 'amount'] || 0); }, 0); }
  function byDateDesc(a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id; }
  function modalFor(id) { return has(id) ? bootstrap.Modal.getOrCreateInstance($(id)) : { show: function () {}, hide: function () {} }; }
  function options(list, blank) { return (blank ? '<option value="">' + esc(blank) + '</option>' : '') + list.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join(''); }
  function saved(text) { if (window.Swal) Swal.fire({ icon: 'success', title: 'Saved', text: text, confirmButtonColor: '#024766' }); }
  function dash() { return '<span class="text-muted">&mdash;</span>'; }
  function actions() {
    return '<td class="text-nowrap"><button type="button" class="btn btn-sm btn-icon btn-light" data-act="edit" title="Edit"><i class="mdi mdi-pencil-outline"></i></button> ' +
      '<button type="button" class="btn btn-sm btn-icon btn-light text-danger" data-act="delete" title="Delete"><i class="mdi mdi-trash-can-outline"></i></button></td>';
  }
  function confirmDelete(title, html, go) {
    if (!window.Swal) { go(); return; }
    Swal.fire({ icon: 'warning', title: title, html: html, showCancelButton: true, confirmButtonText: 'Yes, delete', confirmButtonColor: '#dc3545' })
      .then(function (r) { if (r.isConfirmed) go(); });
  }
  /* From / To date filter; an empty box means open-ended. */
  function inDates(e, fromId, toId) {
    var f = $(fromId).value, t = $(toId).value;
    return !(f && e.date < f) && !(t && e.date > t);
  }

  /* Edit and delete on a ledger table; `label` describes an entry for the
     delete warning, `onDelete` runs before it is removed. */
  function wireRows(tbody, openForm, label, render, onDelete) {
    tbody.addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-act]');
      if (!btn) return;
      var id = Number(btn.closest('tr').dataset.id);
      var e = expenses.filter(function (x) { return x.id === id; })[0];
      if (!e) return;
      if (btn.dataset.act === 'edit') { openForm(e); return; }
      confirmDelete('Delete this expense?',
        label(e) + '<br>' + bdt(e.amount) + ' &middot; ' + esc(pretty(e.date)) + '<br><span class="text-muted fs-13">This removes the entry from all totals.</span>',
        function () { if (onDelete) onDelete(e); expenses = expenses.filter(function (x) { return x.id !== id; }); render(); });
    });
  }

  function invalid(id, bad) { $(id).classList.toggle('is-invalid', bad); return bad; }

  document.addEventListener('DOMContentLoaded', function () {
    if (has('fx-table')) initExpenses();
    if (has('px-table')) initPatient();
    if (has('rp-table')) initReport();
  });

  /* ---------- Expenses: Fixed + Other ---------- */
  function initExpenses() {
    var fxBody = $('fx-table').querySelector('tbody');
    var fiBody = $('fi-table').querySelector('tbody');
    var exBody = $('ex-table').querySelector('tbody');
    var editing = null, editingKind = 'other', editingItem = null;
    var modal = modalFor('expenseModal'), itemModal = modalFor('fixedItemModal');
    var t = today();

    $('fx-month').value = monthKey(t);
    $('fx-month').max = monthKey(t);
    $('ex-from').value = iso(new Date(t.getFullYear(), t.getMonth(), 1));
    $('ex-to').value = iso(t);

    function fillCats() {
      var cur = $('ex-cat-filter').value;
      $('ex-cat-filter').innerHTML = options(categories, 'All categories');
      $('ex-cat-filter').value = categories.indexOf(cur) > -1 ? cur : '';
      ['ex-f-cat', 'fi-f-cat'].forEach(function (id) {
        var v = $(id).value;
        $(id).innerHTML = options(categories);
        if (v) $(id).value = v;
      });
    }

    function renderFixed() {
      var key = $('fx-month').value || monthKey(t);
      generate(key);
      $('fx-month-label').textContent = monthName(key);
      var list = expenses.filter(function (e) { return e.kind === 'fixed' && e.month === key; }).sort(function (a, b) { return b.amount - a.amount; });
      fxBody.innerHTML = list.map(function (e) {
        var item = fixedItems.filter(function (f) { return f.id === e.itemId; })[0];
        var changed = item && item.amount !== e.amount;
        return '<tr data-id="' + e.id + '"><td class="fw-semibold fs-13">' + esc(e.desc) + (e.ref ? '<div class="fs-11 text-muted mono fw-normal">' + esc(e.ref) + '</div>' : '') + '</td>' +
          '<td><span class="badge bg-primary-subtle text-primary">' + esc(e.cat) + '</span></td>' +
          '<td class="fs-13 text-nowrap">' + esc(pretty(e.date)) + '</td>' +
          '<td class="fs-13">' + esc(e.method) + '</td>' +
          '<td class="text-end cur fs-13 fw-semibold">' + bdt(e.amount) + (changed ? '<div class="fs-11 text-muted fw-normal">usual ' + bdt(item.amount) + '</div>' : '') + '</td>' + actions() + '</tr>';
      }).join('');
      $('fx-empty').classList.toggle('d-none', list.length !== 0);
      $('fx-foot').textContent = bdt(sum(list));
    }

    function renderItems() {
      fiBody.innerHTML = fixedItems.map(function (f) {
        return '<tr data-item="' + f.id + '"><td class="fw-semibold fs-13">' + esc(f.name) + '</td>' +
          '<td><span class="badge bg-primary-subtle text-primary">' + esc(f.cat) + '</span></td>' +
          '<td class="text-end cur fs-13 fw-semibold">' + bdt(f.amount) + '</td>' +
          '<td>' + (f.active ? '<span class="badge bg-success-subtle text-success">Active</span>' : '<span class="badge bg-secondary-subtle text-secondary">Paused</span>') + '</td>' +
          '<td class="text-nowrap"><button type="button" class="btn btn-sm btn-icon btn-light" data-act="edit" title="Edit"><i class="mdi mdi-pencil-outline"></i></button> ' +
          '<button type="button" class="btn btn-sm btn-icon btn-light text-danger" data-act="delete" title="Remove"><i class="mdi mdi-trash-can-outline"></i></button></td></tr>';
      }).join('');
      $('fi-empty').classList.toggle('d-none', fixedItems.length !== 0);
    }

    function renderOther() {
      var cat = $('ex-cat-filter').value, q = $('ex-search').value.trim().toLowerCase();
      var list = expenses.filter(function (e) {
        if (e.kind !== 'other' || !inDates(e, 'ex-from', 'ex-to')) return false;
        if (cat && e.cat !== cat) return false;
        if (q && (e.desc + ' ' + e.ref + ' ' + e.cat).toLowerCase().indexOf(q) === -1) return false;
        return true;
      }).sort(byDateDesc);
      exBody.innerHTML = list.map(function (e) {
        return '<tr data-id="' + e.id + '"><td class="fs-13 text-nowrap">' + esc(pretty(e.date)) + '</td>' +
          '<td><span class="badge bg-secondary-subtle text-secondary">' + esc(e.cat) + '</span></td>' +
          '<td class="fs-13">' + esc(e.desc) + (e.ref ? '<div class="fs-11 text-muted mono">' + esc(e.ref) + '</div>' : '') + '</td>' +
          '<td class="fs-13">' + esc(e.method) + '</td>' +
          '<td class="text-end cur fs-13 fw-semibold">' + bdt(e.amount) + '</td>' + actions() + '</tr>';
      }).join('');
      $('ex-empty').classList.toggle('d-none', list.length !== 0);
      $('ex-foot').textContent = bdt(sum(list));
    }

    function renderAll() { renderFixed(); renderItems(); renderOther(); }

    /* Expense entry form — used for other expenses and for correcting a
       generated fixed entry. */
    function openForm(e, kind) {
      editing = e || null;
      editingKind = e ? e.kind : (kind || 'other');
      $('ex-modal-title').textContent = e ? (e.kind === 'fixed' ? 'Edit Fixed Expense — ' + monthName(e.month) : 'Edit Expense') : 'Add Expense';
      $('ex-f-date').value = e ? e.date : iso(today());
      $('ex-f-date').max = iso(today());
      $('ex-f-amount').value = e ? e.amount : '';
      $('ex-f-cat').value = e ? e.cat : categories[0];
      $('ex-f-desc').value = e ? e.desc : '';
      $('ex-f-method').value = e ? e.method : 'Cash';
      $('ex-f-ref').value = e ? e.ref : '';
      ['ex-f-date', 'ex-f-amount', 'ex-f-desc'].forEach(function (id) { $(id).classList.remove('is-invalid'); });
      modal.show();
    }
    $('ex-add').addEventListener('click', function () { openForm(null, 'other'); });

    $('ex-save').addEventListener('click', function () {
      var amt = Number($('ex-f-amount').value);
      var bad = [invalid('ex-f-date', !$('ex-f-date').value), invalid('ex-f-desc', !$('ex-f-desc').value.trim()), invalid('ex-f-amount', !(amt > 0))];
      if (bad.indexOf(true) > -1) return;
      var data = { date: $('ex-f-date').value, cat: $('ex-f-cat').value, desc: $('ex-f-desc').value.trim(), method: $('ex-f-method').value, amount: amt, ref: $('ex-f-ref').value.trim() };
      if (editing) Object.keys(data).forEach(function (k) { editing[k] = data[k]; });
      else { data.id = nextId++; data.kind = editingKind; data.by = USER; expenses.push(data); }
      modal.hide();
      renderAll();
      saved(bdt(amt) + ' saved under ' + data.cat + ' on ' + pretty(data.date) + '.');
    });

    $('ex-new-cat').addEventListener('click', function () {
      if (!window.Swal) return;
      /* the expense modal is open; Swal must sit above it */
      Swal.fire({
        target: $('expenseModal'),
        title: 'New category', input: 'text', inputPlaceholder: 'e.g. Legal & Licences',
        showCancelButton: true, confirmButtonText: 'Add category', confirmButtonColor: '#024766',
        inputValidator: function (v) {
          v = (v || '').trim();
          if (!v) return 'Please enter a category name.';
          if (categories.some(function (c) { return c.toLowerCase() === v.toLowerCase(); })) return 'That category already exists.';
        }
      }).then(function (r) {
        if (!r.isConfirmed) return;
        categories.push(r.value.trim());
        if (window.CRMSettings) {
          var st = CRMSettings.get();
          st.lists.expenseCategories = categories.slice();
          CRMSettings.save(st);
        }
        fillCats();
        $('ex-f-cat').value = r.value.trim();
      });
    });

    /* A deleted fixed entry stays deleted for that month. */
    wireRows(fxBody, openForm, function (e) { return '<b>' + esc(e.desc) + '</b><br>' + esc(monthName(e.month)); }, renderAll, function (e) {
      var f = fixedItems.filter(function (x) { return x.id === e.itemId; })[0];
      if (f) f.skip[e.month] = true;
    });
    wireRows(exBody, openForm, function (e) { return '<b>' + esc(e.desc) + '</b><br>' + esc(e.cat); }, renderAll);

    /* Fixed item form */
    function openItem(f) {
      editingItem = f || null;
      $('fi-modal-title').textContent = f ? 'Edit Fixed Item' : 'Add Fixed Item';
      $('fi-f-name').value = f ? f.name : '';
      $('fi-f-cat').value = f ? f.cat : categories[0];
      $('fi-f-amount').value = f ? f.amount : '';
      $('fi-f-method').value = f ? f.method : 'Bank Transfer';
      $('fi-f-active').checked = f ? f.active : true;
      ['fi-f-name', 'fi-f-amount'].forEach(function (id) { $(id).classList.remove('is-invalid'); });
      itemModal.show();
    }
    $('fi-add').addEventListener('click', function () { openItem(null); });
    $('fi-save').addEventListener('click', function () {
      var amt = Number($('fi-f-amount').value);
      var bad = [invalid('fi-f-name', !$('fi-f-name').value.trim()), invalid('fi-f-amount', !(amt > 0))];
      if (bad.indexOf(true) > -1) return;
      var data = { name: $('fi-f-name').value.trim(), cat: $('fi-f-cat').value, amount: amt, method: $('fi-f-method').value, active: $('fi-f-active').checked };
      if (editingItem) Object.keys(data).forEach(function (k) { editingItem[k] = data[k]; });
      else { data.id = nextId++; data.since = monthKey(today()); data.skip = {}; fixedItems.push(data); }
      itemModal.hide();
      generate(monthKey(today()));
      renderAll();
      saved(data.name + ' — ' + bdt(amt) + ' every month' + (data.active ? '.' : ' (paused).'));
    });
    fiBody.addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-act]');
      if (!btn) return;
      var id = Number(btn.closest('tr').dataset.item);
      var f = fixedItems.filter(function (x) { return x.id === id; })[0];
      if (!f) return;
      if (btn.dataset.act === 'edit') { openItem(f); return; }
      confirmDelete('Remove this fixed item?',
        '<b>' + esc(f.name) + '</b> &middot; ' + bdt(f.amount) + ' a month<br><span class="text-muted fs-13">It will no longer be generated. Entries already recorded for past months are kept.</span>',
        function () { fixedItems = fixedItems.filter(function (x) { return x.id !== id; }); renderAll(); });
    });

    $('fx-month').addEventListener('change', renderFixed);
    ['ex-from', 'ex-to', 'ex-cat-filter'].forEach(function (id) { $(id).addEventListener('change', renderOther); });
    $('ex-search').addEventListener('input', renderOther);

    fillCats();
    renderAll();

    /* Dashboard quick action: expenses.html?action=add-expense opens the
       Other tab with the form; #other just opens the tab. */
    var action = new URLSearchParams(location.search).get('action');
    if (action === 'add-expense' || location.hash === '#other') {
      bootstrap.Tab.getOrCreateInstance($('ex-tab-other-link')).show();
      if (action === 'add-expense') openForm(null, 'other');
    }
  }

  /* ---------- Patient Expense ---------- */
  function initPatient() {
    var tbody = $('px-table').querySelector('tbody');
    var editing = null, formLead = null, formType = 'ticket', viewing = null, returnTo = null;
    var modal = modalFor('patientExpenseModal'), viewModal = modalFor('patientCostsModal');
    var sources = LEADS.map(function (l) { return l[3]; }).filter(function (s, i, a) { return a.indexOf(s) === i; }).sort();
    $('px-filter').innerHTML = options(sources, 'All sources');

    /* A patient's costs, limited to the expense-date filter. */
    function costsOf(id, all) {
      return expenses.filter(function (e) { return e.kind === 'patient' && e.leadId === id && (all || inDates(e, 'px-from', 'px-to')); }).sort(byDateDesc);
    }
    function patients() {
      var src = $('px-filter').value, st = $('px-status').value, q = $('px-search').value.trim().toLowerCase();
      return LEADS.filter(function (l) {
        if (src && l[3] !== src) return false;
        if (st && l[2] !== st) return false;
        if (q && l.join(' ').toLowerCase().indexOf(q) === -1) return false;
        return true;
      });
    }
    function btn(act, icon, title, cls) {
      return '<button type="button" class="btn btn-sm btn-icon btn-light' + (cls ? ' ' + cls : '') + '" data-act="' + act + '" title="' + title + '"><i class="mdi ' + icon + '"></i></button>';
    }

    function render() {
      var list = patients(), costs = [];
      tbody.innerHTML = list.map(function (l) {
        var c = costsOf(l[0]);
        costs = costs.concat(c);
        return '<tr data-lead="' + l[0] + '"><td><div class="fw-semibold fs-13">' + esc(l[1]) + '</div><div class="fs-11 text-muted mono">' + l[0] + '</div></td>' +
          '<td class="fs-13">' + esc(l[4]) + '</td><td class="fs-13 text-nowrap">' + esc(l[5]) + '</td>' +
          '<td><span class="badge bg-warning-subtle text-warning">' + esc(l[3]) + '</span></td>' +
          '<td><span class="badge ' + (l[2] === 'Confirmed' ? 'bg-success-subtle text-success' : 'bg-primary-subtle text-primary') + '">' + l[2] + '</span></td>' +
          '<td class="text-end cur fs-13 fw-semibold">' + (c.length ? bdt(sum(c)) : dash()) + '</td>' +
          '<td class="text-nowrap">' + btn('view', 'mdi-eye-outline', 'View costs') + ' ' +
            btn('ticket', PTYPES.ticket[1], 'Update Ticket Expense', 'text-primary') + ' ' +
            btn('visa', PTYPES.visa[1], 'Update Visa Expense', 'text-info') + ' ' +
            btn('source', PTYPES.source[1], 'Update Source Expense', 'text-warning') + '</td></tr>';
      }).join('');
      $('px-empty').classList.toggle('d-none', list.length !== 0);
      $('px-foot').textContent = bdt(sum(costs));
      Object.keys(PTYPES).forEach(function (k) { $('px-sum-' + k).textContent = bdt(sum(costs.filter(function (e) { return e.ptype === k; }))); });
      $('px-sum-total').textContent = bdt(sum(costs));
      var f = $('px-from').value, t = $('px-to').value;
      $('px-sum-label').textContent = 'Total · ' + (f || t ? (f ? pretty(f) : 'start') + ' – ' + (t ? pretty(t) : 'today') : 'lifetime');
      if (viewing) renderView();
    }

    /* Eye button: every cost of one patient (all dates), with edit/delete. */
    function renderView() {
      var l = lead(viewing), c = costsOf(viewing, true);
      $('pv-title').textContent = l[1] + ' — Costs';
      var trip = window.CRMTravel && CRMTravel.forLead(l[0]);
      $('pv-sub').innerHTML = '<span class="mono">' + l[0] + '</span> &middot; ' + esc(l[5]) + ' &middot; Source: ' + esc(l[3]) + ' &middot; ' + l[2] +
        (trip ? '<div class="mt-1"><i class="mdi mdi-calendar-clock me-1"></i>' + esc(CRMTravel.text(trip.start, trip.end)) + '</div>' : '');
      $('pv-totals').innerHTML = Object.keys(PTYPES).map(function (k) {
        return '<div class="col-6 col-md-3"><div class="border rounded py-2"><div class="fs-12 text-muted"><i class="mdi ' + PTYPES[k][1] + ' me-1"></i>' + PTYPES[k][0] + '</div><div class="fw-bold cur">' + bdt(sum(c.filter(function (e) { return e.ptype === k; }))) + '</div></div></div>';
      }).join('') + '<div class="col-6 col-md-3"><div class="border rounded py-2 bg-light"><div class="fs-12 text-muted">Total</div><div class="fw-bold cur">' + bdt(sum(c)) + '</div></div></div>';
      $('pv-table').querySelector('tbody').innerHTML = c.map(function (e) {
        var p = PTYPES[e.ptype];
        return '<tr data-id="' + e.id + '"><td class="fs-13 text-nowrap">' + esc(pretty(e.date)) + '</td>' +
          '<td><span class="badge ' + p[2] + '"><i class="mdi ' + p[1] + ' me-1"></i>' + p[0] + '</span></td>' +
          '<td class="fs-13">' + (esc(e.desc) || dash()) + '</td><td class="fs-13">' + esc(e.method) + '</td>' +
          '<td class="text-end cur fs-13 fw-semibold">' + bdt(e.amount) + '</td>' + actions() + '</tr>';
      }).join('');
      $('pv-empty').classList.toggle('d-none', c.length !== 0);
    }
    function openView(id) { viewing = id; renderView(); viewModal.show(); }
    /* The form opened from the costs window replaces it, and the window
       comes back when the form closes (saved or cancelled). */
    $('patientCostsModal').addEventListener('hidden.bs.modal', function () { viewing = null; });
    $('patientExpenseModal').addEventListener('hidden.bs.modal', function () {
      if (!returnTo) return;
      var id = returnTo;
      returnTo = null;
      openView(id);
    });

    /* Update Ticket / Visa / Source Expense: one cost, its own date. */
    function openForm(e, leadId, type) {
      editing = e || null;
      formLead = lead(e ? e.leadId : leadId);
      formType = e ? e.ptype : type;
      var p = PTYPES[formType], prior = costsOf(formLead[0], true).filter(function (x) { return x.ptype === formType && x !== e; });
      $('px-modal-title').innerHTML = '<i class="mdi ' + p[1] + ' me-1"></i>' + (e ? 'Edit ' : 'Update ') + p[0] + ' Expense';
      $('px-modal-sub').innerHTML = esc(formLead[1]) + ' &middot; <span class="mono">' + formLead[0] + '</span>';
      $('px-f-info').innerHTML = (formType === 'source' ? 'Paid to source: <b>' + esc(formLead[3]) + '</b><br>' : '') +
        (prior.length ? 'Already recorded for this patient: <b class="cur">' + bdt(sum(prior)) + '</b> in ' + prior.length + (prior.length === 1 ? ' entry' : ' entries') + '.' : 'No ' + p[0].toLowerCase() + ' cost recorded for this patient yet.');
      $('px-f-date').value = e ? e.date : iso(today());
      $('px-f-date').max = iso(today());
      $('px-f-amount').value = e ? e.amount : '';
      $('px-f-desc').value = e ? e.desc : '';
      $('px-f-method').value = e ? e.method : 'Cash';
      ['px-f-amount', 'px-f-date'].forEach(function (id) { $(id).classList.remove('is-invalid'); });
      if (viewing) {
        returnTo = viewing;
        $('patientCostsModal').addEventListener('hidden.bs.modal', function () { modal.show(); }, { once: true });
        viewModal.hide();
      } else modal.show();
    }

    $('px-save').addEventListener('click', function () {
      var amt = Number($('px-f-amount').value);
      var bad = [invalid('px-f-amount', !(amt > 0)), invalid('px-f-date', !$('px-f-date').value)];
      if (bad.indexOf(true) > -1) return;
      var data = { date: $('px-f-date').value, amount: amt, desc: $('px-f-desc').value.trim(), method: $('px-f-method').value };
      if (editing) Object.keys(data).forEach(function (k) { editing[k] = data[k]; });
      else {
        data.id = nextId++; data.kind = 'patient'; data.ptype = formType; data.by = USER;
        data.leadId = formLead[0]; data.patient = formLead[1]; data.src = formLead[3];
        expenses.push(data);
      }
      modal.hide();
      render();
      if (!returnTo) saved(PTYPES[formType][0] + ' expense of ' + bdt(amt) + ' saved for ' + formLead[1] + (formType === 'source' ? ' (paid to ' + formLead[3] + ')' : '') + ' on ' + pretty(data.date) + '.');
    });

    tbody.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-act]');
      if (!b) return;
      var id = b.closest('tr').dataset.lead;
      if (b.dataset.act === 'view') openView(id);
      else openForm(null, id, b.dataset.act);
    });
    [].forEach.call(document.querySelectorAll('[data-pv-add]'), function (b) {
      b.addEventListener('click', function () { openForm(null, viewing, b.dataset.pvAdd); });
    });
    $('pv-table').querySelector('tbody').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-act]');
      if (!b) return;
      var id = Number(b.closest('tr').dataset.id), e = expenses.filter(function (x) { return x.id === id; })[0];
      if (!e) return;
      if (b.dataset.act === 'edit') { openForm(e); return; }
      /* Swal sits above the open costs window */
      if (!window.Swal) { expenses = expenses.filter(function (x) { return x.id !== id; }); render(); return; }
      Swal.fire({ target: $('patientCostsModal'), icon: 'warning', title: 'Delete this ' + PTYPES[e.ptype][0].toLowerCase() + ' cost?', html: bdt(e.amount) + ' &middot; ' + esc(pretty(e.date)), showCancelButton: true, confirmButtonText: 'Yes, delete', confirmButtonColor: '#dc3545' })
        .then(function (r) { if (r.isConfirmed) { expenses = expenses.filter(function (x) { return x.id !== id; }); render(); } });
    });

    ['px-from', 'px-to', 'px-filter', 'px-status'].forEach(function (id) { $(id).addEventListener('change', render); });
    $('px-search').addEventListener('input', render);
    $('px-reset').addEventListener('click', function () {
      ['px-from', 'px-to', 'px-filter', 'px-status', 'px-search'].forEach(function (id) { $(id).value = ''; });
      render();
    });
    render();

    /* From a lead row: expense-patient.html?lead=ELH-L-... opens that
       patient's costs. */
    var fromLead = new URLSearchParams(location.search).get('lead');
    if (fromLead && lead(fromLead)) openView(fromLead);
  }

  /* ---------- Expense Report ---------- */
  function initReport() {
    var view = 'month';
    var COLS = [['fixed', 'Fixed'], ['other', 'Other'], ['ticket', 'Ticket'], ['visa', 'Visa'], ['source', 'Source']];

    function setPreset() {
      var t = today(), p = $('rp-preset').value, from, to = t;
      if (p === 'custom') return;
      if (p === 'week') from = weekStart(t);
      else if (p === 'lastweek') { from = new Date(weekStart(t).getTime() - 7 * DAY); to = new Date(weekStart(t).getTime() - DAY); }
      else if (p === 'month') from = new Date(t.getFullYear(), t.getMonth(), 1);
      else if (p === 'lastmonth') { from = new Date(t.getFullYear(), t.getMonth() - 1, 1); to = new Date(t.getFullYear(), t.getMonth(), 0); }
      else if (p === '3m') from = new Date(t.getFullYear(), t.getMonth() - 2, 1);
      else if (p === '6m') from = new Date(t.getFullYear(), t.getMonth() - 5, 1);
      else if (p === 'year') from = new Date(t.getFullYear(), 0, 1);
      else if (p === 'all') from = expenses.reduce(function (m, e) { var d = parse(e.date); return d < m ? d : m; }, t);
      $('rp-from').value = iso(from);
      $('rp-to').value = iso(to);
    }

    /* Splits one list into the report columns. */
    function split(list) {
      var r = { total: sum(list), n: list.length };
      r.fixed = sum(list.filter(function (e) { return e.kind === 'fixed'; }));
      r.other = sum(list.filter(function (e) { return e.kind === 'other'; }));
      Object.keys(PTYPES).forEach(function (k) { r[k] = sum(list.filter(function (e) { return e.kind === 'patient' && e.ptype === k; })); });
      return r;
    }

    /* Week or month buckets covering [from, to], newest first; the first and
       last are clipped to the range so nothing outside it is counted. */
    function buckets(from, to) {
      var out = [], start = view === 'week' ? weekStart(from) : new Date(from.getFullYear(), from.getMonth(), 1);
      while (start <= to && out.length < 400) {
        var next = view === 'week' ? new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7) : new Date(start.getFullYear(), start.getMonth() + 1, 1);
        var a = start < from ? from : start, b = new Date(next.getTime() - DAY);
        if (b > to) b = to;
        var label = view === 'week'
          ? a.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' – ' + b.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
          : start.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
        var partial = view === 'month' && (a > start || b < new Date(next.getTime() - DAY));
        out.push({ from: iso(a), to: iso(b), label: label, partial: partial });
        start = next;
      }
      return out.reverse();
    }

    /* A report table; a heading starting with '>' is right-aligned. */
    function table(heads, rows, foot, empty) {
      if (!rows.length && empty) return '<p class="text-muted fs-13 text-center py-4 mb-0">' + empty + '</p>';
      return '<div class="table-responsive"><table class="table align-middle mb-0"><thead class="table-light"><tr>' +
        heads.map(function (h) { return h.charAt(0) === '>' ? '<th class="text-end">' + h.slice(1) + '</th>' : '<th>' + h + '</th>'; }).join('') +
        '</tr></thead><tbody>' + rows.join('') + '</tbody><tfoot><tr class="table-light">' + foot + '</tr></tfoot></table></div>';
    }
    function cell(n, strong) { return '<td class="text-end cur fs-13' + (strong ? ' fw-semibold' : '') + '">' + (n ? bdt(n) : dash()) + '</td>'; }

    function render() {
      var f = $('rp-from').value, t = $('rp-to').value;
      if (!f || !t || f > t) {
        $('rp-range-label').innerHTML = '<span class="text-danger">Pick a From date on or before the To date.</span>';
        return;
      }
      var list = expenses.filter(function (e) { return e.date >= f && e.date <= t; });
      var all = split(list);
      $('rp-range-label').textContent = 'Showing ' + pretty(f) + ' to ' + pretty(t) + ' · ' + list.length + ' entries, counted by expense date';
      $('rp-total').textContent = bdt(all.total);
      $('rp-fixed').textContent = bdt(all.fixed);
      $('rp-other').textContent = bdt(all.other);
      $('rp-ticket').textContent = bdt(all.ticket);
      $('rp-visa').textContent = bdt(all.visa);
      $('rp-source').textContent = bdt(all.source);

      /* Week / month table */
      $('rp-title').textContent = view === 'week' ? 'Expense by Week' : 'Expense by Month';
      var rows = buckets(parse(f), parse(t)).map(function (b) {
        var r = split(list.filter(function (e) { return e.date >= b.from && e.date <= b.to; }));
        r.b = b;
        return r;
      });
      $('rp-table').innerHTML = '<div class="table-responsive"><table class="table align-middle mb-0"><thead class="table-light"><tr><th>' + (view === 'week' ? 'Week' : 'Month') + '</th>' +
        COLS.map(function (c) { return '<th class="text-end">' + c[1] + '</th>'; }).join('') + '<th class="text-end">Total</th></tr></thead><tbody>' +
        rows.map(function (r) {
          return '<tr><td class="fw-semibold text-nowrap">' + esc(r.b.label) +
            (r.b.partial ? '<div class="fs-11 text-muted fw-normal">' + esc(pretty(r.b.from)) + ' – ' + esc(pretty(r.b.to)) + '</div>' : '') + '</td>' +
            COLS.map(function (c) { return cell(r[c[0]]); }).join('') + cell(r.total, true) + '</tr>';
        }).join('') +
        '</tbody><tfoot><tr class="table-light"><td class="fw-semibold">Total</td>' +
        COLS.map(function (c) { return '<td class="text-end cur fw-semibold">' + bdt(all[c[0]]) + '</td>'; }).join('') +
        '<td class="text-end cur fw-bold">' + bdt(all.total) + '</td></tr></tfoot></table></div>';

      /* By source: leads brought and applied (Source List figures), what the
         source was paid in the range and over its lifetime. */
      var paid = function (l, name) { return l.filter(function (e) { return e.kind === 'patient' && e.ptype === 'source' && e.src === name; }); };
      var srcs = Object.keys(SOURCE_STATS).map(function (name) {
        var st = SOURCE_STATS[name];
        return { name: name, leads: st[0], applied: st[1], range: sum(paid(list, name)), life: sum(paid(expenses, name)) };
      }).sort(function (a, b) { return b.range - a.range || b.life - a.life; });
      var tot = srcs.reduce(function (m, r) { m.leads += r.leads; m.applied += r.applied; m.range += r.range; m.life += r.life; return m; }, { leads: 0, applied: 0, range: 0, life: 0 });
      $('rp-sources').innerHTML = table(['Source', '>Leads Brought', '>Applied', '>Total Paid', '>Paid Lifetime'],
        srcs.map(function (r) {
          return '<tr><td class="fw-semibold fs-13">' + esc(r.name) + '</td><td class="text-end fs-13">' + r.leads + '</td>' +
            '<td class="text-end fs-13">' + r.applied + ' <span class="fs-11 text-muted">(' + Math.round(r.applied / r.leads * 100) + '%)</span></td>' +
            cell(r.range, true) + cell(r.life) + '</tr>';
        }),
        '<td class="fw-semibold">Total</td><td class="text-end fw-semibold">' + tot.leads + '</td><td class="text-end fw-semibold">' + tot.applied + '</td>' +
        '<td class="text-end cur fw-bold">' + bdt(tot.range) + '</td><td class="text-end cur fw-semibold">' + bdt(tot.life) + '</td>');

      /* Patient expense: ticket and visa per patient in the range (what the
         source was paid is in the table above). */
      var pat = {};
      list.forEach(function (e) {
        if (e.kind !== 'patient' || e.ptype === 'source') return;
        var p = pat[e.leadId] = pat[e.leadId] || { l: lead(e.leadId), ticket: 0, visa: 0 };
        p[e.ptype] += e.amount;
      });
      var pats = Object.keys(pat).map(function (k) { return pat[k]; }).sort(function (a, b) { return (b.ticket + b.visa) - (a.ticket + a.visa); });
      $('rp-patients').innerHTML = table(['Lead / Patient', '>Ticket Amount', '>Visa Amount', '>Total (Ticket + Visa)'],
        pats.map(function (p) {
          return '<tr><td><div class="fw-semibold fs-13">' + esc(p.l[1]) + '</div><div class="fs-11 text-muted mono">' + p.l[0] + '</div></td>' +
            cell(p.ticket) + cell(p.visa) + cell(p.ticket + p.visa, true) + '</tr>';
        }),
        '<td class="fw-semibold">Total</td><td class="text-end cur fw-semibold">' + bdt(all.ticket) + '</td><td class="text-end cur fw-semibold">' + bdt(all.visa) + '</td><td class="text-end cur fw-bold">' + bdt(all.ticket + all.visa) + '</td>',
        'No ticket or visa costs in this range.');

      /* Fixed expense: each fixed item's total in the range. */
      var fx = {};
      list.forEach(function (e) {
        if (e.kind !== 'fixed') return;
        var r = fx[e.desc] = fx[e.desc] || { name: e.desc, cat: e.cat, n: 0, amount: 0 };
        r.n++; r.amount += e.amount;
      });
      var fxs = Object.keys(fx).map(function (k) { return fx[k]; }).sort(function (a, b) { return b.amount - a.amount; });
      $('rp-fixed-list').innerHTML = table(['Item', 'Category', '>Months', '>Amount'],
        fxs.map(function (r) {
          return '<tr><td class="fw-semibold fs-13">' + esc(r.name) + '</td><td><span class="badge bg-primary-subtle text-primary">' + esc(r.cat) + '</span></td>' +
            '<td class="text-end fs-13">' + r.n + '</td>' + cell(r.amount, true) + '</tr>';
        }),
        '<td class="fw-semibold" colspan="3">Total</td><td class="text-end cur fw-bold">' + bdt(all.fixed) + '</td>',
        'No fixed expenses in this range.');

      /* Other expense: every entry in the range. */
      var oth = list.filter(function (e) { return e.kind === 'other'; }).sort(byDateDesc);
      $('rp-other-list').innerHTML = table(['Date', 'Category', 'Description', '>Amount'],
        oth.map(function (e) {
          return '<tr><td class="fs-13 text-nowrap">' + esc(pretty(e.date)) + '</td><td><span class="badge bg-secondary-subtle text-secondary">' + esc(e.cat) + '</span></td>' +
            '<td class="fs-13">' + esc(e.desc) + '</td>' + cell(e.amount, true) + '</tr>';
        }),
        '<td class="fw-semibold" colspan="3">Total</td><td class="text-end cur fw-bold">' + bdt(all.other) + '</td>',
        'No other expenses in this range.');
    }

    $('rp-preset').addEventListener('change', function () { setPreset(); render(); });
    ['rp-from', 'rp-to'].forEach(function (id) {
      $(id).addEventListener('change', function () { $('rp-preset').value = 'custom'; render(); });
    });
    $('rp-view').addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-view]');
      if (!btn) return;
      view = btn.dataset.view;
      [].forEach.call($('rp-view').querySelectorAll('[data-view]'), function (b) { b.classList.toggle('active', b === btn); });
      render();
    });
    setPreset();
    render();
  }
})();
