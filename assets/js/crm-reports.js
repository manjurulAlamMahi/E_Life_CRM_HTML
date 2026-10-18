/**
 * E Life Healthcare CRM — Report Module.
 *
 *   report-builder.html  pick the period, filters, columns and layout
 *   report-result.html   the generated table + Download as Excel
 *
 * Generate passes every choice in the URL:
 *   type, range (month|lastmonth|custom), from, to, basis (index),
 *   layout (index), cols (keys; absent = all), f0..fN (ticked option
 *   indexes per filter group; absent = all ticked)
 * so the result can be bookmarked and "Change selection" restores the
 * builder exactly. In Laravel the same fields go to a report endpoint that
 * returns the rows, and the Excel download comes from the server.
 *
 * Filters start fully ticked — what is ticked is what is included. A group
 * that is partly ticked keeps only rows whose value is ticked, so a row the
 * group does not apply to (a New lead has no journey stage) is left out.
 * The notes under such groups say so.
 *
 * Static preview: the result rows are sample data, built to respect the
 * chosen dates and filters so the client sees a believable report.
 */
(function () {
  'use strict';

  var SOURCES = ['Noman', 'Dr. Ilias Patowary', 'Facebook', 'Website', 'Hospital', 'Doctor Referral', 'Walk-in', 'Campaign', 'Other'];
  var PACKAGES = ['Full-Funded Package', 'Partial-Funded Package', 'Paid Package'];
  var S = window.CRMSettings;
  var list = function (name, fallback) { return S ? S.list(name) : fallback; };
  var COUNTRIES = list('visaCountries', ['India', 'Thailand', 'Singapore', 'Malaysia']);
  var METHODS = list('paymentMethods', ['Cash', 'Bank Transfer', 'bKash', 'Nagad', 'Rocket', 'Card']);
  var CATEGORIES = list('expenseCategories', ['Office Rent', 'Salaries', 'Marketing & Ads', 'Utilities', 'Travel & Transport', 'Office Supplies', 'Software & Internet', 'Miscellaneous']);
  var PRIORITIES = list('leadPriorities', ['Normal', 'High', 'Critical', 'Special']);
  var VISA_TYPES = list('visaTypes', ['Medical Visa', 'Medical Attendant Visa', 'Tourist Visa']);

  var LEAD_STATUSES = ['New', 'Follow-up', 'Interested', 'Not Interested', 'Applied', 'Confirmed'];
  var JOURNEY = ['Visa pending', 'Visa approved', 'Ticket pending', 'Ticket purchased', 'In treatment', 'Treatment done'];
  var EXPENSE_TYPES = ['Fixed expense', 'Other expense', 'Patient — Ticket', 'Patient — Visa', 'Patient — Source payment'];
  var VISA_STATUSES = ['Eligible', 'Processing', 'Approved', 'Rejected'];
  var TICKET_STATUSES = ['Not Purchased', 'Upcoming Flight', 'Flight Passed', 'Cancelled'];
  /* Treatment status: the 90-day countdown from the applied date (not reached
     yet), then the treatment itself once the patient has reached. */
  var COUNTDOWN = ['3 months left', '2 months left', '1 month left', 'Overdue'];
  var TREATMENT = ['Ongoing', 'Successful', 'Failed'];

  /* Money columns are summed in the footer and in summary layouts. */
  var MONEY = { invoice_total: 1, paid: 1, due: 1, dollar: 1, amount: 1, visa_cost: 1, ticket_cost: 1, source_cost: 1, total_cost: 1 };

  /* basis:   [label, date column it fills, what it means]
     layouts: [label, field to group by] — null = every row, 'month' = by month
     filters: { label, col, options, note?, sections? } — col is the row field
              the group narrows; sections splits the chips under sub-headings
     columns: [key, label] in groups; all start ticked */
  var REPORTS = {
    lead: {
      title: 'Lead & Patient Report', icon: 'mdi-account-group', rgb: 'var(--bs-primary-rgb)',
      sub: 'Every lead and patient in the period — where they came from, where they are in the journey, what they paid and what they cost.',
      basis: [
        ['Lead created date', 'created', 'The day the lead was added to the CRM. Use this for "how many new leads did we get".'],
        ['Last conversation date', 'last_conv', 'The latest call, WhatsApp or visit logged with the lead. Use this for "who did we talk to".'],
        ['Applied date', 'applied_date', 'The day the lead applied for a package. Only Applied and Confirmed leads have one.'],
        ['Confirmed date', 'confirmed_date', 'The day the booking was confirmed. Only Confirmed leads have one.']
      ],
      layouts: [['Every lead (detailed)', null], ['Summary by source', 'source'], ['Summary by current status', 'status'], ['Summary by sales executive', 'executive'], ['Summary by month', 'month']],
      filters: [
        { label: 'Lead current status', col: 'status', options: LEAD_STATUSES },
        { label: 'Journey stage', col: 'journey', options: JOURNEY,
          note: 'Starts only after a lead applies for a package (Applied or Confirmed). Unticking any stage leaves out New, Follow-up, Interested and Not Interested leads.' },
        { label: 'Payment', col: 'payment', options: ['Fully paid', 'Has due', 'No payment yet'],
          note: 'Only applied leads have payments. Unticking any option leaves out leads that have not applied.' },
        { label: 'Source', col: 'source', options: SOURCES },
        { label: 'Priority', col: 'priority', options: PRIORITIES }
      ],
      columns: [
        { group: 'Identity', cols: [['lead_id', 'Lead ID'], ['patient_id', 'Patient ID'], ['patient', 'Patient name'], ['guardian', 'Guardian name'], ['age', 'Age'], ['gender', 'Gender']] },
        { group: 'Contact', cols: [['phone', 'Phone'], ['whatsapp', 'WhatsApp'], ['address', 'Address'], ['district', 'District']] },
        { group: 'Lead', cols: [['source', 'Source'], ['executive', 'Sales executive'], ['priority', 'Priority'], ['status', 'Current status'], ['created', 'Created date'], ['last_conv', 'Last conversation'], ['next_fu', 'Next follow-up'], ['applied_date', 'Applied date'], ['confirmed_date', 'Confirmed date'], ['ni_reason', 'Not-interested reason']] },
        { group: 'Journey', cols: [['condition', 'Condition'], ['package', 'Package'], ['journey', 'Journey stage'], ['visa_status', 'Visa status'], ['ticket_status', 'Ticket status'], ['treatment_status', 'Treatment status']] },
        { group: 'Payment', cols: [['invoice_total', 'Invoice total (৳)'], ['paid', 'Paid (৳)'], ['due', 'Due (৳)'], ['last_payment', 'Last payment date'], ['dollar', 'Dollar amount ($)']] },
        { group: 'Cost on patient', cols: [['ticket_cost', 'Ticket cost (৳)'], ['visa_cost', 'Visa cost (৳)'], ['source_cost', 'Source payment (৳)'], ['total_cost', 'Total cost (৳)']] }
      ]
    },
    expense: {
      title: 'Expense Report', icon: 'mdi-cash-minus', rgb: '220, 120, 30',
      sub: 'Fixed, other and patient expenses in the period — per patient, per source, or per kind of cost.',
      basis: [
        ['Expense date', 'date', 'The day the money was actually paid (it can be earlier than the day it was typed in). Use this for "what did we spend this month".'],
        ['Entry date', 'entered_on', 'The day the expense was typed into the CRM. Use this to check what staff entered in a period.']
      ],
      layouts: [['Every entry (detailed)', null], ['Summary by expense type', 'type'], ['Summary by patient', 'patient'], ['Summary by source', 'source'], ['Summary by category', 'category'], ['Summary by month', 'month']],
      filters: [
        { label: 'Expense type', col: 'type', options: EXPENSE_TYPES,
          note: 'Fixed = monthly running costs (rent, salaries, internet). Other = one-off company costs. Patient = a cost of one patient\'s journey: their ticket, their visa, or the payment to the source that brought them.' },
        { label: 'Category', col: 'category', options: CATEGORIES,
          note: 'Applies to fixed and other expenses only. Unticking any category leaves out patient expenses.' },
        { label: 'Source', col: 'source', options: SOURCES,
          note: 'Applies to patient expenses only — the source of that patient\'s lead. Unticking any source leaves out fixed and other expenses.' },
        { label: 'Payment method', col: 'method', options: METHODS }
      ],
      columns: [
        { group: 'Entry', cols: [['date', 'Expense date'], ['type', 'Expense type'], ['category', 'Category'], ['item', 'Item / description'], ['ref', 'Reference'], ['entered_by', 'Entered by'], ['entered_on', 'Entry date']] },
        { group: 'Patient & source', cols: [['lead_id', 'Lead ID'], ['patient', 'Patient name'], ['source', 'Source'], ['phone', 'Phone']] },
        { group: 'Money', cols: [['method', 'Payment method'], ['amount', 'Amount (৳)']] }
      ]
    },
    'visa-ticket': {
      title: 'Visa & Ticket Report', icon: 'mdi-airplane-takeoff', rgb: 'var(--bs-info-rgb)',
      sub: 'From visa filing to the flight — who is waiting on a visa, who has a ticket, and how long each patient has been away.',
      basis: [
        ['Visa applied date', 'visa_applied', 'The day the visa application was filed.'],
        ['Visa decision date', 'visa_decision', 'The day the visa was approved or rejected.'],
        ['Ticket start date', 'ticket_start', 'The departure date on the ticket — the day the patient flies out.'],
        ['Ticket end date', 'ticket_end', 'The return date on the ticket — the day the patient flies back.']
      ],
      layouts: [['Every patient (detailed)', null], ['Summary by visa status', 'visa_status'], ['Summary by ticket status', 'ticket_status'], ['Summary by month', 'month']],
      filters: [
        { label: 'Visa status', col: 'visa_status', options: VISA_STATUSES },
        { label: 'Ticket status', col: 'ticket_status', options: TICKET_STATUSES,
          note: 'Only patients with an approved visa have a ticket status. Unticking any option leaves out patients whose visa is not approved yet.' },
        { label: 'Source', col: 'source', options: SOURCES }
      ],
      columns: [
        { group: 'Patient', cols: [['lead_id', 'Lead ID'], ['patient', 'Patient name'], ['guardian', 'Guardian name'], ['phone', 'Phone'], ['passport', 'Passport no.'], ['source', 'Source']] },
        { group: 'Visa', cols: [['country', 'Country'], ['visa_type', 'Visa type'], ['visa_status', 'Visa status'], ['visa_applied', 'Applied date'], ['visa_decision', 'Decision date'], ['reject_reason', 'Rejection reason'], ['visa_cost', 'Visa cost (৳)']] },
        { group: 'Ticket', cols: [['ticket_status', 'Ticket status'], ['airline', 'Airline'], ['flight_no', 'Flight no.'], ['ticket_start', 'Ticket start date'], ['ticket_end', 'Ticket end date'], ['days_away', 'Treatment days'], ['reschedules', 'Times rescheduled'], ['cancel_reason', 'Cancel reason'], ['ticket_cost', 'Ticket cost (৳)']] }
      ]
    },
    treatment: {
      title: 'Treatment Report', icon: 'mdi-heart-pulse', rgb: 'var(--bs-success-rgb)',
      sub: 'Every patient from the 90-day countdown to the end of treatment — how long they have left to travel, and how the treatment went.',
      basis: [
        ['Applied date', 'applied_date', 'The day the lead applied for a package — the 90-day countdown starts here.'],
        ['Ticket start date', 'start', 'The departure date — the day treatment days start counting.'],
        ['Ticket end date', 'end', 'The return date — the day treatment days stop counting.']
      ],
      layouts: [['Every patient (detailed)', null], ['Summary by status', 'status'], ['Summary by package', 'package'], ['Summary by month', 'month']],
      filters: [
        { label: 'Treatment status', col: 'status', options: COUNTDOWN.concat(TREATMENT),
          sections: [['Countdown — not reached yet', COUNTDOWN], ['Reached — in treatment', TREATMENT]],
          note: 'Countdown runs 90 days from the applied date until the patient reaches the treatment country.' },
        { label: 'Package', col: 'package', options: PACKAGES },
        { label: 'Source', col: 'source', options: SOURCES }
      ],
      columns: [
        { group: 'Patient', cols: [['lead_id', 'Lead ID'], ['patient_id', 'Patient ID'], ['patient', 'Patient name'], ['guardian', 'Guardian name'], ['phone', 'Phone'], ['source', 'Source']] },
        { group: 'Countdown', cols: [['applied_date', 'Applied date'], ['days_left', 'Days left to travel']] },
        { group: 'Treatment', cols: [['package', 'Package'], ['country', 'Country'], ['hospital', 'Hospital'], ['start', 'Ticket start date'], ['end', 'Ticket end date'], ['days', 'Treatment days'], ['status', 'Status'], ['outcome', 'Outcome note']] },
        { group: 'Travel back', cols: [['return_ticket', 'Return ticket']] }
      ]
    }
  };
  var ORDER = ['lead', 'expense', 'visa-ticket', 'treatment'];
  var SHORT = { lead: 'Lead & Patient', expense: 'Expense', 'visa-ticket': 'Visa & Ticket', treatment: 'Treatment' };

  /* ---------- helpers ---------- */
  var $ = function (id) { return document.getElementById(id); };
  var all = function (sel, root) { return [].slice.call((root || document).querySelectorAll(sel)); };
  var esc = function (v) { return String(v).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var opt = function (v, i) { return '<option value="' + i + '">' + esc(v) + '</option>'; };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var iso = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var parse = function (s) { return new Date(s + 'T00:00'); };
  var nice = function (d) { return (typeof d === 'string' ? parse(d) : d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); };
  var allCols = function (R) { return [].concat.apply([], R.columns.map(function (g) { return g.cols; })); };
  var colLabel = function (R, key) { var c = allCols(R).filter(function (c) { return c[0] === key; })[0]; return c ? c[1] : key; };
  var money = function (n) { return Number(n).toLocaleString('en-US'); };
  var RANGES = { month: 'This month', lastmonth: 'Last month', custom: 'Custom dates' };

  function presetDates(p) {
    var t = new Date(), y = t.getFullYear(), m = t.getMonth();
    if (p === 'month') return [new Date(y, m, 1), new Date(y, m + 1, 0)];
    if (p === 'lastmonth') return [new Date(y, m - 1, 1), new Date(y, m, 0)];
    return null;
  }

  /* Read the choices from the URL (both pages). */
  function readState() {
    var q = new URLSearchParams(location.search);
    var type = REPORTS[q.get('type')] ? q.get('type') : 'lead';
    var R = REPORTS[type];
    var idx = function (k, max) { var n = parseInt(q.get(k), 10); return n >= 0 && n < max ? n : 0; };
    var range = RANGES[q.get('range')] ? q.get('range') : (q.get('from') ? 'custom' : 'month');
    var dates = presetDates(range);
    return {
      type: type, R: R, range: range,
      from: dates ? iso(dates[0]) : (q.get('from') || ''),
      to: dates ? iso(dates[1]) : (q.get('to') || ''),
      basis: idx('basis', R.basis.length), layout: idx('layout', R.layouts.length),
      cols: q.has('cols') ? q.get('cols').split(',').filter(Boolean) : null,
      /* per group: the ticked options (all of them when the param is absent) */
      filters: R.filters.map(function (f, gi) {
        if (!q.has('f' + gi)) return f.options.slice();
        return q.get('f' + gi).split(',').filter(Boolean).map(Number)
          .filter(function (n) { return n < f.options.length; })
          .map(function (n) { return f.options[n]; });
      })
    };
  }

  /* Collapsible blocks: a .rb-collapse-head toggles its .rb-collapsible
     parent; clicks on the head's own buttons and checkboxes don't. */
  function wireCollapse(root) {
    root.addEventListener('click', function (ev) {
      var head = ev.target.closest('.rb-collapse-head');
      if (!head || ev.target.closest('button, input, label, a, select')) return;
      var box = head.closest('.rb-collapsible');
      box.classList.toggle('is-collapsed');
      head.setAttribute('aria-expanded', String(!box.classList.contains('is-collapsed')));
    });
    root.addEventListener('keydown', function (ev) {
      if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.classList.contains('rb-collapse-head')) { ev.preventDefault(); ev.target.click(); }
    });
    all('.rb-collapse-head', root).forEach(function (h) { h.setAttribute('role', 'button'); h.setAttribute('tabindex', '0'); h.setAttribute('aria-expanded', 'true'); });
  }

  /* ================================================================== *
   * Report Builder
   * ================================================================== */
  function initBuilder() {
    var st = readState(), R = st.R, type = st.type;
    var small = window.matchMedia('(max-width: 767.98px)').matches;
    $('rb').style.setProperty('--rc', R.rgb);

    $('rb-types').innerHTML = ORDER.map(function (k) {
      return '<a href="report-builder.html?type=' + k + '" class="rb-type' + (k === type ? ' active' : '') + '" style="--rc:' + REPORTS[k].rgb + '"' +
        (k === type ? ' aria-current="page"' : '') + '><i class="mdi ' + REPORTS[k].icon + '"></i>' + SHORT[k] + '</a>';
    }).join('');
    $('rb-hero-icon').classList.add(R.icon);
    $('rb-hero-title').textContent = 'Generate ' + R.title;
    $('rb-hero-sub').textContent = R.sub;
    document.title = R.title + ' | E Life Healthcare CRM';
    $('rb-basis').innerHTML = R.basis.map(function (b, i) { return opt(b[0], i); }).join('');
    $('rb-layout').innerHTML = R.layouts.map(function (l, i) { return opt(l[0], i); }).join('');
    $('rb-basis').value = st.basis;
    $('rb-layout').value = st.layout;
    $('rb-basis-help').innerHTML = '<div class="fw-semibold mb-1">Which date decides whether a record falls inside the period</div><ul class="mb-0 ps-3">' +
      R.basis.map(function (b) { return '<li><b>' + esc(b[0]) + '</b> — ' + esc(b[2]) + '</li>'; }).join('') + '</ul>';

    /* Filters: a collapsible group per filter, with a tick-all box and chips */
    var chip = function (gi, o) {
      var oi = R.filters[gi].options.indexOf(o), id = 'rb-f' + gi + '-' + oi;
      return '<input type="checkbox" class="btn-check" id="' + id + '" data-group="' + gi + '" data-idx="' + oi + '" value="' + esc(o) + '" autocomplete="off"' +
        (st.filters[gi].indexOf(o) > -1 ? ' checked' : '') + '>' +
        '<label class="rb-chip" for="' + id + '">' + esc(o) + '</label>';
    };
    $('rb-filters').innerHTML = R.filters.map(function (f, gi) {
      var chips = f.sections
        ? f.sections.map(function (s) { return '<div class="rb-chip-section">' + esc(s[0]) + '</div><div class="rb-chips">' + s[1].map(function (o) { return chip(gi, o); }).join('') + '</div>'; }).join('')
        : '<div class="rb-chips">' + f.options.map(function (o) { return chip(gi, o); }).join('') + '</div>';
      return '<div class="rb-filter rb-collapsible' + (small ? ' is-collapsed' : '') + '">' +
        '<div class="rb-group-head rb-collapse-head">' +
          '<input class="form-check-input" type="checkbox" id="rb-fa' + gi + '" data-fall="' + gi + '" aria-label="Tick all ' + esc(f.label) + '">' +
          '<span class="rb-group-label">' + esc(f.label) + '</span>' +
          '<span class="rb-group-count" id="rb-fc' + gi + '"></span>' +
          '<i class="mdi mdi-chevron-down rb-chev"></i>' +
        '</div><div class="rb-collapse-body">' +
          (f.note ? '<div class="rb-group-note"><i class="mdi mdi-information-outline"></i>' + esc(f.note) + '</div>' : '') +
          chips + '</div></div>';
    }).join('');

    /* Columns: a collapsible group per column group, all ticked to start */
    var isOn = function (c) { return st.cols ? st.cols.indexOf(c[0]) > -1 : true; };
    $('rb-columns').innerHTML = R.columns.map(function (g, gi) {
      return '<div class="rb-colgroup rb-collapsible' + (small ? ' is-collapsed' : '') + '">' +
        '<div class="rb-group-head rb-collapse-head">' +
          '<input class="form-check-input" type="checkbox" id="rb-g' + gi + '" data-colgroup="' + gi + '" aria-label="Tick all ' + esc(g.group) + ' columns">' +
          '<span class="rb-group-label">' + esc(g.group) + '</span>' +
          '<span class="rb-group-count" id="rb-gc' + gi + '"></span>' +
          '<i class="mdi mdi-chevron-down rb-chev"></i>' +
        '</div><div class="rb-collapse-body"><div class="rb-colgrid">' +
        g.cols.map(function (c) {
          return '<div class="form-check"><input class="form-check-input" type="checkbox" id="rb-c-' + c[0] + '" data-col="' + c[0] + '" data-in="' + gi + '"' + (isOn(c) ? ' checked' : '') + '>' +
            '<label class="form-check-label" for="rb-c-' + c[0] + '">' + esc(c[1]) + '</label></div>';
        }).join('') + '</div></div></div>';
    }).join('');

    wireCollapse($('rb'));

    var total = allCols(R).length;
    var colBoxes = function () { return all('[data-col]'); };
    var chosenCols = function () { return colBoxes().filter(function (b) { return b.checked; }); };
    var groupBoxes = function (gi) { return all('[data-group="' + gi + '"]'); };
    var tickedIn = function (gi) { return groupBoxes(gi).filter(function (b) { return b.checked; }); };
    var tri = function (head, on, of) { head.checked = on === of; head.indeterminate = on > 0 && on < of; };
    var countText = function (on, of) { return on === of ? 'All ' + of : on === 0 ? 'None' : on + ' of ' + of; };

    function setDates(p) {
      var d = presetDates(p), custom = !d;
      $('rb-from').disabled = !custom;
      $('rb-to').disabled = !custom;
      if (d) { $('rb-from').value = iso(d[0]); $('rb-to').value = iso(d[1]); }
    }

    function render() {
      var from = $('rb-from').value, to = $('rb-to').value;
      var rangeOk = !!(from && to && from <= to);
      var msg = $('rb-range-msg');
      $('rb-from').classList.toggle('is-invalid', !from || !!(to && from > to));
      $('rb-to').classList.toggle('is-invalid', !to || !!(from && from > to));
      if (!from || !to) { msg.className = 'fs-12 mt-2 text-danger'; msg.textContent = 'Pick a start date and an end date.'; }
      else if (from > to) { msg.className = 'fs-12 mt-2 text-danger'; msg.textContent = 'The start date is after the end date.'; }
      else {
        var days = Math.round((parse(to) - parse(from)) / 86400000) + 1;
        msg.className = 'fs-12 mt-2 text-muted';
        msg.textContent = nice(from) + ' – ' + nice(to) + ' · ' + days + ' day' + (days === 1 ? '' : 's') + ', by ' + R.basis[$('rb-basis').value][0].toLowerCase();
      }

      /* filter groups */
      var emptyGroup = null;
      var filterHtml = R.filters.map(function (f, gi) {
        var on = tickedIn(gi).map(function (b) { return b.value; });
        tri($('rb-fa' + gi), on.length, f.options.length);
        $('rb-fc' + gi).textContent = countText(on.length, f.options.length);
        $('rb-fc' + gi).classList.toggle('is-none', !on.length);
        if (!on.length && emptyGroup === null) emptyGroup = f.label;
        var shown = on.length === f.options.length ? '<span class="rb-tag">All</span>'
          : !on.length ? '<span class="text-danger">None ticked</span>'
          : on.map(function (v) { return '<span class="rb-tag">' + esc(v) + '</span>'; }).join('');
        return '<div class="rb-sum-filter"><span>' + esc(f.label) + '</span><span>' + shown + '</span></div>';
      }).join('');

      /* column groups */
      var chosen = chosenCols();
      $('rb-col-count').textContent = chosen.length + ' of ' + total + ' selected';
      R.columns.forEach(function (g, gi) {
        var on = colBoxes().filter(function (b) { return b.getAttribute('data-in') === String(gi) && b.checked; }).length;
        tri($('rb-g' + gi), on, g.cols.length);
        $('rb-gc' + gi).textContent = countText(on, g.cols.length);
        $('rb-gc' + gi).classList.toggle('is-none', !on);
      });

      $('rb-summary').innerHTML =
        '<dt>Report</dt><dd>' + esc(R.title) + '</dd>' +
        '<dt>Period</dt><dd>' + (rangeOk ? nice(from) + ' – ' + nice(to) : '<span class="text-danger">Not set</span>') + '</dd>' +
        '<dt>Date based on</dt><dd>' + esc(R.basis[$('rb-basis').value][0]) + '</dd>' +
        '<dt>Columns</dt><dd>' + (chosen.length === total ? 'All ' + total : chosen.length ? chosen.length + ' of ' + total : '<span class="text-danger">None selected</span>') + '</dd>' +
        '<dt class="rb-sum-wide">Filters</dt><dd class="rb-sum-wide">' + filterHtml + '</dd>';

      var problem = !rangeOk ? 'Set a valid start and end date to generate.'
        : emptyGroup ? 'Tick at least one option under "' + emptyGroup + '".'
        : !chosen.length ? 'Tick at least one column to generate.' : '';
      $('rb-generate').disabled = !!problem;
      $('rb-note').innerHTML = '<i class="mdi mdi-information-outline me-1"></i>' + esc(problem || 'The report opens on its own page, with a Download as Excel button.');
      $('rb-note').classList.toggle('text-danger', !!problem);
    }

    function resultUrl() {
      var q = new URLSearchParams();
      var range = $('rb-preset').value;
      q.set('type', type);
      q.set('range', range);
      if (range === 'custom') { q.set('from', $('rb-from').value); q.set('to', $('rb-to').value); }
      q.set('basis', $('rb-basis').value);
      q.set('layout', $('rb-layout').value);
      var chosen = chosenCols();
      if (chosen.length < allCols(R).length) q.set('cols', chosen.map(function (b) { return b.getAttribute('data-col'); }).join(','));
      R.filters.forEach(function (f, gi) {
        var on = tickedIn(gi);
        if (on.length < f.options.length) q.set('f' + gi, on.map(function (b) { return b.getAttribute('data-idx'); }).join(','));
      });
      return 'report-result.html?' + q.toString();
    }

    /* Events */
    $('rb-preset').addEventListener('change', function () {
      setDates(this.value);
      if (this.value === 'custom') {
        $('rb-from').focus();
        try { $('rb-from').showPicker(); } catch (e) { /* not every browser opens it from script */ }
      }
      render();
    });
    ['rb-from', 'rb-to'].forEach(function (id) { $(id).addEventListener('change', render); });
    $('rb-basis').addEventListener('change', render);
    $('rb-layout').addEventListener('change', render);
    $('rb-basis-info').addEventListener('click', function () {
      var open = $('rb-basis-help').classList.toggle('d-none') === false;
      this.setAttribute('aria-expanded', String(open));
      this.classList.toggle('active', open);
    });
    $('rb-filters').addEventListener('change', function (ev) {
      var g = ev.target.getAttribute('data-fall');
      if (g !== null) groupBoxes(g).forEach(function (b) { b.checked = ev.target.checked; });
      render();
    });
    $('rb-filters-reset').addEventListener('click', function () {
      all('[data-group]').forEach(function (b) { b.checked = true; });
      render();
    });
    $('rb-columns').addEventListener('change', function (ev) {
      var g = ev.target.getAttribute('data-colgroup');
      if (g !== null) colBoxes().forEach(function (b) { if (b.getAttribute('data-in') === g) b.checked = ev.target.checked; });
      render();
    });
    var setCols = function (on) { colBoxes().forEach(function (b) { b.checked = on; }); render(); };
    $('rb-cols-all').addEventListener('click', function () { setCols(true); });
    $('rb-cols-none').addEventListener('click', function () { setCols(false); });
    $('rb-generate').addEventListener('click', function () { if (!this.disabled) location.href = resultUrl(); });

    $('rb-preset').value = st.range;
    setDates(st.range);
    if (st.range === 'custom') { $('rb-from').value = st.from; $('rb-to').value = st.to; }
    render();
  }

  /* ================================================================== *
   * Sample rows — shaped by the chosen dates and filters
   * ================================================================== */
  var NAMES = ['Ayesha Rahim', 'Karim Mia', 'Nasrin Akter', 'Rafiqul Islam', 'Shirin Sultana', 'Abdul Halim', 'Farzana Yasmin', 'Mizanur Rahman', 'Rokeya Begum', 'Jahangir Alam', 'Sumaiya Khatun', 'Habibur Rahman', 'Taslima Nasreen', 'Anwar Hossain', 'Mahmuda Khanam', 'Delwar Hossain', 'Salma Begum', 'Kamrul Hasan', 'Parvin Akter', 'Shafiqul Islam'];
  var GUARDIANS = ['Rahim Uddin', 'Abdul Kader', 'Selina Islam', 'Mosharraf Hossain', 'Yasin Ali', 'Nurjahan Rahman', 'Shahidul Haque'];
  var DISTRICTS = ['Dhaka', 'Chattogram', 'Sylhet', 'Rajshahi', 'Khulna', 'Barishal', 'Rangpur', 'Mymensingh', 'Cumilla', 'Narayanganj'];
  var EXECUTIVES = ['Tanvir Ahmed', 'Sadia Islam', 'Rafiq Hasan', 'Mitu Akter'];
  var CONDITIONS = ['Kidney transplant', 'Cardiac bypass', 'Knee replacement', 'Cancer treatment', 'Liver transplant', 'Spine surgery', 'IVF treatment'];
  var NI_REASONS = list('notInterestedReasons', ['Price beyond budget', 'Continuing treatment locally', 'Chose another agency']);
  var HOSPITALS = { India: ['Apollo Hospitals, Chennai', 'Fortis, Delhi', 'CMC Vellore'], Thailand: ['Bumrungrad, Bangkok', 'Bangkok Hospital'], Singapore: ['Mount Elizabeth', 'Gleneagles Singapore'], Malaysia: ['Prince Court, Kuala Lumpur', 'Sunway Medical Centre'] };
  var AIRLINES = { India: ['US-Bangla', 'Air India', 'IndiGo'], Thailand: ['Thai Airways', 'Biman Bangladesh'], Singapore: ['Singapore Airlines', 'Biman Bangladesh'], Malaysia: ['Malaysia Airlines', 'US-Bangla'] };
  var PKG_PRICE = { 'Full-Funded Package': [400000, 0], 'Partial-Funded Package': [250000, 2500], 'Paid Package': [300000, 4000] };
  var OTHER_ITEMS = ['Printer toner', 'Facebook boost campaign', 'Office tea & snacks', 'Courier charges', 'Generator fuel', 'Website hosting renewal', 'Team transport', 'Stationery'];
  var DASH = '—';

  function seeded(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function () { h += 0x6D2B79F5; var t = h; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }

  function makeRows(st) {
    var R = st.R, rnd = seeded(location.search);
    var from = parse(st.from), to = parse(st.to);
    var span = Math.max(0, Math.round((to - from) / 86400000));
    var want = Math.min(60, 14 + Math.round(span / 3));
    var pick = function (arr) { return arr[Math.floor(rnd() * arr.length)]; };
    var inRange = function () { return new Date(from.getTime() + Math.floor(rnd() * (span + 1)) * 86400000); };
    var plus = function (d, n) { return new Date(d.getTime() + n * 86400000); };
    var round = function (lo, hi, step) { return Math.round((lo + rnd() * (hi - lo)) / step) * step; };
    var phone = function () { return '+880 1' + (3 + Math.floor(rnd() * 7)) + pad(Math.floor(rnd() * 100)) + '-' + String(100000 + Math.floor(rnd() * 899999)); };
    var basisKey = R.basis[st.basis][1];
    /* A partly-ticked group keeps only rows whose value is ticked. */
    var limits = R.filters.map(function (f, gi) { return { col: f.col, on: st.filters[gi], partial: st.filters[gi].length < f.options.length }; })
      .filter(function (l) { return l.partial; });
    var keep = function (r) { return limits.every(function (l) { return l.on.indexOf(r[l.col]) > -1; }); };
    var rows = [];

    for (var tries = 0; rows.length < want && tries < 4000; tries++) {
      var d = inRange(), r = { _date: d }, i = rows.length;
      r.patient = pick(NAMES);
      r.guardian = rnd() < .3 ? r.patient : pick(GUARDIANS);
      r.phone = phone();
      r.lead_id = 'Lead26-0' + (300 + Math.floor(rnd() * 120));
      r.source = pick(SOURCES);

      if (st.type === 'lead') {
        r.status = pick(LEAD_STATUSES);
        var applied = r.status === 'Applied' || r.status === 'Confirmed';
        r.journey = applied ? pick(JOURNEY) : DASH;
        var J = { 'Visa pending': ['Processing', DASH, DASH], 'Visa approved': ['Approved', 'Not Purchased', DASH], 'Ticket pending': ['Approved', 'Not Purchased', DASH], 'Ticket purchased': ['Approved', 'Upcoming Flight', 'Countdown'], 'In treatment': ['Approved', 'Reached', 'Ongoing'], 'Treatment done': ['Approved', 'Reached', 'Successful'] }[r.journey] || [DASH, DASH, DASH];
        r.visa_status = J[0]; r.ticket_status = J[1]; r.treatment_status = J[2];
        r.patient_id = applied ? 'PT26-00' + (40 + i) : DASH;
        r.age = 18 + Math.floor(rnd() * 55);
        r.gender = rnd() < .5 ? 'Male' : 'Female';
        r.whatsapp = rnd() < .7 ? r.phone : phone();
        r.district = pick(DISTRICTS);
        r.address = 'House ' + (1 + Math.floor(rnd() * 90)) + ', Road ' + (1 + Math.floor(rnd() * 20)) + ', ' + r.district;
        r.executive = pick(EXECUTIVES);
        r.priority = pick(PRIORITIES);
        r.created = d;
        r.last_conv = plus(d, Math.floor(rnd() * 6));
        r.next_fu = applied || r.status === 'Not Interested' ? DASH : plus(d, 3 + Math.floor(rnd() * 10));
        r.applied_date = applied ? plus(d, 4 + Math.floor(rnd() * 10)) : DASH;
        r.confirmed_date = r.status === 'Confirmed' ? plus(r.applied_date, 2 + Math.floor(rnd() * 6)) : DASH;
        r.ni_reason = r.status === 'Not Interested' ? pick(NI_REASONS) : DASH;
        r.condition = pick(CONDITIONS);
        r.package = applied ? pick(PACKAGES) : DASH;
        var price = PKG_PRICE[r.package] || [0, 0];
        r.invoice_total = price[0];
        r.dollar = price[1];
        r.payment = applied ? pick(['Fully paid', 'Has due', 'Has due', 'No payment yet']) : DASH;
        r.paid = r.payment === 'Fully paid' ? price[0] : r.payment === 'Has due' ? round(price[0] * .2, price[0] * .8, 5000) : 0;
        r.due = r.invoice_total - r.paid;
        r.last_payment = r.paid ? plus(r.applied_date, 1 + Math.floor(rnd() * 10)) : DASH;
        var visaPaid = applied && r.visa_status !== DASH, ticketPaid = ['Upcoming Flight', 'Reached'].indexOf(r.ticket_status) > -1;
        r.visa_cost = visaPaid ? round(3000, 12000, 100) : 0;
        r.ticket_cost = ticketPaid ? round(28000, 65000, 500) : 0;
        r.source_cost = applied && rnd() < .6 ? round(5000, 25000, 500) : 0;
        r.total_cost = r.visa_cost + r.ticket_cost + r.source_cost;
      } else if (st.type === 'expense') {
        r.type = pick(EXPENSE_TYPES);
        var isPatient = r.type.indexOf('Patient') === 0;
        r.category = isPatient ? DASH : pick(CATEGORIES);
        r.date = d;
        r.entered_on = plus(d, Math.floor(rnd() * 3));
        r.entered_by = pick(EXECUTIVES.concat(['Nusrat Jahan']));
        r.ref = 'EXP-' + (2600 + tries);
        r.method = pick(METHODS);
        if (!isPatient) { r.patient = DASH; r.lead_id = DASH; r.phone = DASH; r.source = DASH; }
        if (r.type === 'Fixed expense') { r.item = r.category + ' — ' + d.toLocaleDateString('en-GB', { month: 'long' }); r.amount = r.category === 'Salaries' ? 450000 : r.category === 'Office Rent' ? 85000 : round(3000, 25000, 500); }
        else if (r.type === 'Other expense') { r.item = pick(OTHER_ITEMS); r.amount = round(800, 20000, 100); }
        else if (r.type === 'Patient — Ticket') { r.item = 'Air ticket Dhaka – ' + pick(['Chennai', 'Kolkata', 'Bangkok', 'Singapore', 'Kuala Lumpur']); r.amount = round(28000, 65000, 500); }
        else if (r.type === 'Patient — Visa') { r.item = 'Visa fee — ' + pick(COUNTRIES); r.amount = round(3000, 12000, 100); }
        else { r.item = 'Referral payment to ' + r.source; r.amount = round(5000, 25000, 500); }
      } else if (st.type === 'visa-ticket') {
        r.visa_status = pick(VISA_STATUSES);
        r.ticket_status = r.visa_status === 'Approved' ? pick(TICKET_STATUSES) : DASH;
        r.country = pick(COUNTRIES);
        r.visa_type = pick(VISA_TYPES);
        r.passport = 'A' + String(10000000 + Math.floor(rnd() * 89999999));
        r.visa_applied = r.visa_status === 'Eligible' ? DASH : d;
        r.visa_decision = r.visa_status === 'Approved' || r.visa_status === 'Rejected' ? plus(d, 5 + Math.floor(rnd() * 10)) : DASH;
        r.reject_reason = r.visa_status === 'Rejected' ? pick(['Incomplete documents', 'Hospital letter missing', 'Passport validity too short']) : DASH;
        r.visa_cost = r.visa_status === 'Eligible' ? 0 : round(3000, 12000, 100);
        var ticketed = ['Upcoming Flight', 'Flight Passed', 'Cancelled'].indexOf(r.ticket_status) > -1;
        r.airline = ticketed ? pick(AIRLINES[r.country] || ['Biman Bangladesh']) : DASH;
        r.flight_no = ticketed ? r.airline.replace(/[^A-Z]/g, '').slice(0, 2) + '-' + (100 + Math.floor(rnd() * 800)) : DASH;
        r.ticket_start = ticketed ? plus(d, 12 + Math.floor(rnd() * 20)) : DASH;
        /* A flown patient has a return date once the return ticket is booked;
           treatment days run start → end, or start → today while there is none. */
        var flown = r.ticket_status === 'Flight Passed';
        r.ticket_end = flown && rnd() < .5 ? plus(r.ticket_start, 10 + Math.floor(rnd() * 30)) : DASH;
        r.days_away = flown ? (r.ticket_end !== DASH ? Math.round((r.ticket_end - r.ticket_start) / 86400000) : 5 + Math.floor(rnd() * 25)) : DASH;
        r.reschedules = ticketed ? Math.floor(rnd() * 3) : DASH;
        r.cancel_reason = r.ticket_status === 'Cancelled' ? pick(['Patient unwell', 'Visa date mismatch', 'Family decision']) : DASH;
        r.ticket_cost = ticketed ? round(28000, 65000, 500) : 0;
      } else {
        r.status = pick(COUNTDOWN.concat(TREATMENT, TREATMENT));
        var reached = TREATMENT.indexOf(r.status) > -1;
        r.package = pick(PACKAGES);
        r.country = pick(COUNTRIES);
        r.hospital = reached ? pick(HOSPITALS[r.country] || ['Apollo Hospitals, Chennai']) : DASH;
        r.patient_id = 'PT26-00' + (40 + i);
        var leftBy = { '3 months left': 61 + Math.floor(rnd() * 29), '2 months left': 31 + Math.floor(rnd() * 30), '1 month left': 1 + Math.floor(rnd() * 30), 'Overdue': 0 }[r.status];
        r.applied_date = reached ? plus(d, -(20 + Math.floor(rnd() * 60))) : d;
        r.days_left = reached ? 'Reached' : r.status === 'Overdue' ? 'Overdue by ' + (1 + Math.floor(rnd() * 20)) + ' days' : leftBy + ' days';
        r.days = reached ? 7 + Math.floor(rnd() * 38) : DASH;
        r.start = reached ? d : DASH;
        r.end = reached && r.status !== 'Ongoing' ? plus(d, r.days) : DASH;
        r.outcome = { Ongoing: 'Under treatment', Successful: 'Recovered well, discharged', Failed: 'Complications, referred back' }[r.status] || 'Awaiting travel';
        r.return_ticket = r.status === 'Ongoing' ? 'Not booked' : reached ? 'Booked' : DASH;
      }
      if (basisKey && r[basisKey] !== DASH) r[basisKey] = d;
      if (keep(r)) rows.push(r);
    }
    rows.sort(function (a, b) { return a._date - b._date; });
    return rows;
  }

  var cell = function (key, v) {
    if (v instanceof Date) return nice(v);
    if (MONEY[key]) return money(v || 0);
    return v == null ? DASH : v;
  };

  /* ================================================================== *
   * Report result
   * ================================================================== */
  function initResult() {
    var st = readState(), R = st.R;
    $('rr').style.setProperty('--rc', R.rgb);
    $('rr-back').href = 'report-builder.html' + location.search;
    $('rr-icon').classList.add(R.icon);
    $('rr-title').textContent = R.title;
    document.title = R.title + ' | E Life Healthcare CRM';

    if (!st.from || !st.to || st.from > st.to) {
      $('rr-period').innerHTML = '<span class="text-danger">No valid date range was chosen.</span>';
      $('rr-excel').disabled = true;
      $('rr-thead').innerHTML = '<th>Report</th>';
      $('rr-tbody').innerHTML = '<tr><td class="rb-empty">Go back to <a href="' + $('rr-back').href + '">Change selection</a> and pick a start and end date.</td></tr>';
      $('rr-tfoot').parentNode.remove();
      return;
    }

    var valid = allCols(R).map(function (c) { return c[0]; });
    var cols = (st.cols || valid).filter(function (k) { return valid.indexOf(k) > -1; });
    var layout = R.layouts[st.layout];
    var period = nice(st.from) + ' – ' + nice(st.to);
    var basisText = 'by ' + R.basis[st.basis][0].toLowerCase();
    $('rr-period').textContent = (st.range === 'custom' ? '' : RANGES[st.range] + ': ') + period + ' · ' + basisText + ' · ' + layout[0];

    var narrowed = R.filters.map(function (f, gi) { return { label: f.label, on: st.filters[gi], all: st.filters[gi].length === f.options.length }; })
      .filter(function (f) { return !f.all; });
    $('rr-meta').innerHTML = '<span class="rr-meta-label">Filters</span>' + (narrowed.length
      ? narrowed.map(function (f) { return '<span class="rr-meta-item">' + esc(f.label) + ': <b>' + esc(f.on.join(', ')) + '</b></span>'; }).join('')
      : '<span class="rr-meta-item">All selected — everything in the period</span>');

    var rows = makeRows(st);
    var head, body, foot = null;
    var moneyCols = cols.filter(function (k) { return MONEY[k]; });
    var sum = function (list, k) { return list.reduce(function (s, r) { return s + (Number(r[k]) || 0); }, 0); };

    if (!layout[1]) {
      head = cols.map(function (k) { return colLabel(R, k); });
      body = rows.map(function (r) { return cols.map(function (k) { return cell(k, r[k]); }); });
      if (moneyCols.length && rows.length) foot = cols.map(function (k, i) { return MONEY[k] ? money(sum(rows, k)) : (i === 0 ? 'Total' : ''); });
      $('rr-table-title').textContent = 'All records';
    } else {
      var key = layout[1];
      var groupOf = function (r) {
        if (key === 'month') return r._date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
        var v = r[key];
        if (v !== DASH && v != null) return v;
        if (st.type === 'expense') return key === 'category' ? 'Patient expense (no category)' : 'Company expense (no ' + key + ')';
        return 'Not applied yet';
      };
      var groups = {}, order = [];
      rows.forEach(function (r) { var g = groupOf(r); if (!groups[g]) { groups[g] = []; order.push(g); } groups[g].push(r); });
      if (key !== 'month') order.sort(function (a, b) { return groups[b].length - groups[a].length; });
      head = [key === 'month' ? 'Month' : colLabel(R, key), 'Records'].concat(moneyCols.map(function (k) { return colLabel(R, k); }));
      body = order.map(function (g) { return [g, groups[g].length].concat(moneyCols.map(function (k) { return money(sum(groups[g], k)); })); });
      if (rows.length) foot = ['Total', rows.length].concat(moneyCols.map(function (k) { return money(sum(rows, k)); }));
      $('rr-table-title').textContent = layout[0];
    }

    $('rr-count').textContent = body.length + (layout[1] ? ' groups' : ' rows');
    $('rr-thead').innerHTML = head.map(function (h) { return '<th class="text-nowrap">' + esc(h) + '</th>'; }).join('');
    $('rr-tbody').innerHTML = body.map(function (row) {
      return '<tr>' + row.map(function (v) { return '<td class="text-nowrap">' + esc(v) + '</td>'; }).join('') + '</tr>';
    }).join('');
    if (foot) $('rr-tfoot').innerHTML = foot.map(function (v) { return '<th class="text-nowrap">' + esc(v) + '</th>'; }).join('');
    else $('rr-tfoot').parentNode.remove();
    if (!rows.length) $('rr-excel').disabled = true;

    var filename = R.title.replace(/[^A-Za-z]+/g, '-').replace(/-$/, '') + '_' + st.from + '_to_' + st.to;
    var filterLine = narrowed.length ? 'Filters — ' + narrowed.map(function (f) { return f.label + ': ' + f.on.join(', '); }).join(' | ') : 'Filters — all selected';

    if (window.jQuery && jQuery.fn.DataTable) {
      /* No scrollX: it splits the header into a second table that can drift
         out of line with the body. The wrapper scrolls instead (CSS). */
      var dt = jQuery('#rr-table').DataTable({
        pageLength: 25,
        lengthMenu: [10, 25, 50, 100],
        order: [],
        autoWidth: false,
        language: {
          search: '', searchPlaceholder: 'Search report...', lengthMenu: '_MENU_ per page',
          info: 'Showing _START_ to _END_ of _TOTAL_', infoEmpty: 'No records',
          emptyTable: 'No records match these dates and filters. Use Change selection to widen them.',
          paginate: { previous: '<i class="mdi mdi-chevron-left"></i>', next: '<i class="mdi mdi-chevron-right"></i>' }
        }
      });
      jQuery('.dt-search input').addClass('form-control form-control-sm');
      jQuery('.dt-length select').addClass('form-select form-select-sm');
      if (jQuery.fn.dataTable.Buttons) {
        new jQuery.fn.dataTable.Buttons(dt, {
          buttons: [{
            extend: 'excelHtml5', filename: filename, sheetName: R.title.slice(0, 31), footer: true,
            title: 'E Life Healthcare — ' + R.title,
            messageTop: period + ' (' + basisText + ') · ' + layout[0] + ' · ' + filterLine,
            exportOptions: { modifier: { search: 'none', order: 'current' } }
          }]
        });
        $('rr-excel').addEventListener('click', function () { dt.button(0).trigger(); });
        return;
      }
    }
    $('rr-excel').disabled = true;
  }

  document.addEventListener('DOMContentLoaded', function () {
    if ($('rb')) initBuilder();
    if ($('rr')) initResult();
  });
})();
