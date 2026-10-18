/**
 * E Life Healthcare CRM — Patients & Deals behaviour.
 *
 * Kept separate from crm-leads.js: that file owns the lead lifecycle, this
 * one owns the patient record, the lifetime deal ledger and the package
 * catalogue. Loaded only on pages flagged `dealsjs` in build/build.js.
 *
 * In the Laravel build this is replaced by model methods (plan.md R2) —
 * nothing here is authoritative business logic.
 */
(function () {
  'use strict';

  window.CRMDeals = {};

  function num(v) {
    var n = parseFloat(v);
    return isFinite(n) && n > 0 ? n : 0;
  }

  /* A person is Settled only when nothing is outstanding in EITHER
     currency — the same rule the leads module uses for Completed. */
  function state(dueBdt, dueUsd) {
    return num(dueBdt) === 0 && num(dueUsd) === 0 ? 'settled' : 'dues';
  }

  window.CRMDeals.state = state;

  function toast(msg, icon) {
    if (window.Swal) {
      Swal.fire({ icon: icon || 'success', title: icon === 'error' ? 'Not allowed' : 'Saved', text: msg, confirmButtonColor: '#024766' });
    } else {
      window.alert(msg);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {

    /* ---------- Row expansion ------------------------------------------ *
     * Each person's row is followed by a hidden row holding their deal
     * history, so the lifetime totals and the deals behind them stay
     * together. */
    document.querySelectorAll('.crm-expand-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var row = document.getElementById(btn.dataset.target);
        if (!row) return;
        row.classList.toggle('d-none');
        var icon = btn.querySelector('i');
        if (icon) {
          icon.className = row.classList.contains('d-none')
            ? 'mdi mdi-chevron-right'
            : 'mdi mdi-chevron-down';
        }
      });
    });

    /* ---------- Deals state tabs ---------------------------------------- *
     * Counts are derived from the rows, never written into the markup, so
     * they cannot drift from the table beneath them. This table is not a
     * DataTable (its expansion rows must stay adjacent to their parent),
     * so filtering hides rows directly — and hides each row's expansion
     * with it, or a filtered-out person's deals would be left on screen. */
    var tabWrap = document.getElementById('deal-state-tabs');
    if (tabWrap) {
      var active = 'all';

      var personRows = function () {
        return document.querySelectorAll('tr[data-state]');
      };

      var render = function () {
        var counts = { all: 0, dues: 0, settled: 0 };
        personRows().forEach(function (r) {
          counts.all++;
          counts[r.dataset.state] = (counts[r.dataset.state] || 0) + 1;
        });
        tabWrap.querySelectorAll('[data-state-tab]').forEach(function (tab) {
          var badge = tab.querySelector('.tab-count');
          if (badge) badge.textContent = counts[tab.dataset.stateTab] || 0;
          tab.classList.toggle('active', tab.dataset.stateTab === active);
        });

        personRows().forEach(function (r) {
          var show = active === 'all' || r.dataset.state === active;
          r.classList.toggle('d-none', !show);

          var exp = r.dataset.expansion ? document.getElementById(r.dataset.expansion) : null;
          if (exp && !show) {
            exp.classList.add('d-none');
            var icon = r.querySelector('.crm-expand-toggle i');
            if (icon) icon.className = 'mdi mdi-chevron-right';
          }
        });
      };

      tabWrap.addEventListener('click', function (ev) {
        var tab = ev.target.closest('[data-state-tab]');
        if (!tab) return;
        ev.preventDefault();
        active = tab.dataset.stateTab;
        render();
      });

      render();
    }

    /* ---------- Patients filter bar ------------------------------------- *
     * Runs through DataTables' search pipeline so paging and the
     * "showing N of M" count stay truthful. */
    var patientFilters = document.getElementById('patient-filters');
    if (patientFilters) {
      var table = document.querySelector('table.crm-table');
      var criteria = { status: '', situation: '', pkg: '', staff: '' };

      if (window.jQuery && jQuery.fn.dataTable) {
        jQuery.fn.dataTable.ext.search.push(function (settings, data, index) {
          if (settings.nTable !== table) return true;
          var row = settings.aoData[index] && settings.aoData[index].nTr;
          if (!row) return true;
          if (criteria.status && row.dataset.status !== criteria.status) return false;
          if (criteria.situation && row.dataset.situation !== criteria.situation) return false;
          if (criteria.pkg && row.dataset.package !== criteria.pkg) return false;
          if (criteria.staff && row.dataset.staff !== criteria.staff) return false;
          return true;
        });
      }

      var redraw = function () {
        if (window.jQuery && jQuery.fn.dataTable && jQuery.fn.dataTable.isDataTable(table)) {
          jQuery(table).DataTable().draw();
        } else {
          /* Without DataTables the filters still have to work. */
          document.querySelectorAll('table.crm-table tbody tr').forEach(function (row) {
            var ok = (!criteria.status || row.dataset.status === criteria.status) &&
              (!criteria.situation || row.dataset.situation === criteria.situation) &&
              (!criteria.pkg || row.dataset.package === criteria.pkg) &&
              (!criteria.staff || row.dataset.staff === criteria.staff);
            row.classList.toggle('d-none', !ok);
          });
        }
      };

      var bind = function (id, key) {
        var el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('change', function () {
          criteria[key] = el.value;
          redraw();
        });
      };
      bind('pf-status', 'status');
      bind('pf-situation', 'situation');
      bind('pf-package', 'pkg');
      bind('pf-staff', 'staff');

      var reset = document.getElementById('pf-reset');
      if (reset) {
        reset.addEventListener('click', function () {
          criteria = { status: '', situation: '', pkg: '', staff: '' };
          ['pf-status', 'pf-situation', 'pf-package', 'pf-staff', 'pf-search'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.value = '';
          });
          if (window.jQuery && jQuery.fn.dataTable && jQuery.fn.dataTable.isDataTable(table)) {
            jQuery(table).DataTable().search('').draw();
          } else {
            redraw();
          }
        });
      }

      var search = document.getElementById('pf-search');
      if (search) {
        search.addEventListener('input', function () {
          if (window.jQuery && jQuery.fn.dataTable && jQuery.fn.dataTable.isDataTable(table)) {
            jQuery(table).DataTable().search(search.value).draw();
          }
        });
      }
    }

    /* ---------- Packages: edit and remove -------------------------------- */
    var pkgModal = document.getElementById('addPackageModal');
    if (pkgModal) {
      pkgModal.addEventListener('show.bs.modal', function (ev) {
        var btn = ev.relatedTarget;
        var title = pkgModal.querySelector('.pk-modal-title');
        var name = document.getElementById('pk-name');
        var priceBdt = document.getElementById('pk-price-bdt');
        var priceUsd = document.getElementById('pk-price-usd');
        var acceptsUsd = document.getElementById('pk-accepts-usd');
        var editing = btn && btn.dataset.pkgName;

        if (title) title.textContent = editing ? 'Edit Package' : 'Add Package';
        if (name) name.value = editing ? btn.dataset.pkgName : '';
        if (priceBdt) priceBdt.value = editing ? btn.dataset.pkgPriceBdt || '' : '';
        if (acceptsUsd) acceptsUsd.checked = editing ? btn.dataset.pkgAcceptsUsd === 'true' : false;
        if (priceUsd) priceUsd.value = editing && acceptsUsd && acceptsUsd.checked ? btn.dataset.pkgPriceUsd || '' : '';

        var wrap = document.getElementById('pk-usd-wrap');
        if (wrap && acceptsUsd) wrap.classList.toggle('d-none', !acceptsUsd.checked);
      });
    }

    /* Removing a package that deals still point at would orphan them, so
       the count is checked before anything is offered. */
    document.querySelectorAll('.crm-package-remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var usage = num(btn.dataset.usage);
        var name = btn.dataset.pkgName || 'this package';
        if (usage > 0) {
          toast(name + ' is used by ' + usage + ' deal' + (usage === 1 ? '' : 's') +
            '. Move those deals to another package before removing it.', 'error');
          return;
        }
        toast(name + ' removed.');
      });
    });

    /* ---------- Package on / off ----------------------------------------- *
     * Switching a package off keeps it on the deals that already use it —
     * they would be orphaned otherwise — but takes it out of the Apply
     * dropdown so nothing new can be sold under it. */
    document.querySelectorAll('.crm-package-toggle').forEach(function (input) {
      input.addEventListener('change', function () {
        var row = input.closest('tr');
        var label = row ? row.querySelector('.crm-package-state') : null;
        var name = row ? (row.querySelector('.fw-semibold') || {}).textContent : 'This package';
        if (label) label.textContent = input.checked ? 'On' : 'Off';
        if (row) row.dataset.active = input.checked ? 'true' : 'false';
        toast(input.checked
          ? (name || 'This package').trim() + ' is on and available in the Apply step.'
          : (name || 'This package').trim() + ' is off. Existing deals keep it; it will not be offered on new applications.');
      });
    });

    /* ---------- Pay against a deal ---------------------------------------- *
     * The same money rules as the leads module: one currency per payment,
     * nothing converted, capped at that currency's outstanding balance. */
    var payModal = document.getElementById('dealPayModal');
    if (payModal) {
      var cur = document.getElementById('dp-currency');
      var amount = document.getElementById('dp-amount');
      var prefix = document.getElementById('dp-prefix');
      var totalOut = document.getElementById('dp-total');
      var afterOut = document.getElementById('dp-after');
      var over = document.getElementById('dp-over');
      var save = document.getElementById('dp-save');
      var usdOption = cur ? cur.querySelector('option[value="usd"]') : null;
      var dues = { bdt: 0, usd: 0 };

      var fmt = function (v, c) {
        return c === 'usd'
          ? '$' + Number(num(v)).toLocaleString('en-US')
          : (window.bdt || String)(v);
      };

      var renderPay = function () {
        var c = cur ? cur.value : 'bdt';
        var owing = dues[c] || 0;
        var typed = num(amount ? amount.value : 0);
        var applied = Math.min(typed, owing);
        var after = Math.max(owing - applied, 0);

        if (prefix) prefix.textContent = c === 'usd' ? '$' : '৳';
        if (totalOut) totalOut.textContent = fmt(applied, c);
        if (afterOut) afterOut.textContent = fmt(after, c);
        if (over) {
          var exceeds = typed > owing && owing > 0;
          over.classList.toggle('d-none', !exceeds);
          if (exceeds) {
            over.textContent = 'Exceeds the ' + fmt(owing, c) +
              ' outstanding in this currency — only that much will be applied.';
          }
        }
        if (save) save.disabled = applied <= 0;
      };

      if (cur) cur.addEventListener('change', renderPay);
      if (amount) amount.addEventListener('input', renderPay);

      payModal.addEventListener('show.bs.modal', function (ev) {
        var btn = ev.relatedTarget;
        if (btn) {
          dues.bdt = num(btn.dataset.dueBdt);
          dues.usd = num(btn.dataset.dueUsd);
          var takesUsd = btn.dataset.acceptsUsd === 'true';

          /* One shared modal serves every row, so a currency the package
             does not accept is removed and the selection reset — a stale
             USD choice must not survive into a taka-only deal. */
          if (usdOption) usdOption.hidden = !takesUsd;
          if (cur && (!takesUsd || cur.value === 'usd')) cur.value = 'bdt';

          var label = document.getElementById('dp-label');
          if (label) {
            var owed = [];
            if (dues.bdt > 0) owed.push(fmt(dues.bdt, 'bdt'));
            if (dues.usd > 0) owed.push(fmt(dues.usd, 'usd'));
            label.textContent = (btn.dataset.person || '') + ' · ' + (btn.dataset.deal || '') +
              (owed.length ? ' · ' + owed.join(' and ') + ' outstanding' : '');
          }
        }
        if (amount) amount.value = '';
        renderPay();
      });

      if (save) {
        save.addEventListener('click', function () {
          if (save.disabled) return;
          bootstrap.Modal.getOrCreateInstance(payModal).hide();
          window.setTimeout(function () {
            toast('Payment recorded. It stays pending until Accounts verifies it.');
          }, 250);
        });
      }
    }

    /* ---------- New deal for a returning patient --------------------------- */
    var newDeal = document.getElementById('newDealModal');
    if (newDeal) {
      newDeal.addEventListener('show.bs.modal', function (ev) {
        var btn = ev.relatedTarget;
        var label = document.getElementById('nd-label');
        if (label && btn) label.textContent = btn.dataset.person || '';
      });
      var ndSave = document.getElementById('nd-save');
      if (ndSave) {
        ndSave.addEventListener('click', function () {
          bootstrap.Modal.getOrCreateInstance(newDeal).hide();
          window.setTimeout(function () {
            toast('New deal created. This patient moves back into Dues until it is paid off.');
          }, 250);
        });
      }
    }

    /* ---------- Patient profile ------------------------------------------ *
     * This demo carries one fully worked profile. Arriving for a different
     * patient (?patient=ELH-P-… from Patients/Deals, or ?lead=ELH-L-… from
     * Quick View) says so rather than showing someone else's history under
     * the wrong name. */
    var profileNote = document.getElementById('pp-sample-note');
    if (profileNote) {
      var params = new URLSearchParams(window.location.search);
      var wanted = params.get('patient') || params.get('lead');
      if (wanted && wanted !== 'ELH-P-2026-000406' && wanted !== 'ELH-L-2026-000406') {
        var slot = document.getElementById('pp-requested-patient');
        if (slot) slot.textContent = wanted;
        profileNote.classList.remove('d-none');
      }
    }

    var pp = document.getElementById('pp-root');
    if (pp) initProfile(pp);
  });

  /* The profile is driven by one package list, #pp-package-data (see the
     comment above it in patient-profile.html): the header's current
     package, Package History, Payments, the package journey window and
     every invoice are rendered from it, so they cannot disagree. #pp-root
     holds the rest of the live state — journey stage, lead status and
     which package is current. Journey and payment progress are drawn by
     the shared renderers in crm-leads.js. */
  function initProfile(pp) {
    var L = window.CRMLeads || {};
    var $ = function (id) { return document.getElementById(id); };
    var taka = function (n) { return (window.bdt || String)(num(n)); };
    var stage = parseInt(pp.dataset.journeyStage, 10) || 0;
    var journeyEl = $('pp-journey');
    var paymentEl = $('pp-payment');
    var payBtn = $('pp-pay-btn');
    var nextBtn = $('pp-next-step');

    var PACKAGES = {};
    try { PACKAGES = JSON.parse(($('pp-package-data') || {}).textContent || '{}'); } catch (e) { PACKAGES = {}; }
    /* Newest first, as authored; a new package is put at the front. */
    var ORDER = Object.keys(PACKAGES);
    var currentId = pp.dataset.currentPkg || ORDER[0];

    var STEP_NAMES = ['', 'Lead Registered', 'Applied for Package', 'Visa Applied', 'Visa Approved',
      'Ticket Purchased', 'Treatment Ongoing', 'Returned to Country'];

    function paidOf(p) { return (p.payments || []).reduce(function (t, x) { return t + num(x.amount); }, 0); }
    function dueOf(p) { return Math.max(num(p.agreed) - paidOf(p), 0); }
    function pctOf(p) { return num(p.agreed) > 0 ? Math.min(paidOf(p) / num(p.agreed) * 100, 100) : 0; }
    function stageOf(p) {
      if (p === PACKAGES[currentId]) return stage;
      return Object.keys(p.steps || {}).reduce(function (m, k) { return Math.max(m, parseInt(k, 10) || 0); }, 0);
    }
    /* "25 Sep 2026", the format used everywhere else in the app. */
    function today() {
      var d = new Date();
      var M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return String(d.getDate()).padStart(2, '0') + ' ' + M[d.getMonth()] + ' ' + d.getFullYear();
    }
    function findPayment(p, receipt) {
      var list = p.payments || [];
      for (var i = 0; i < list.length; i++) if (list[i].receipt === receipt) return i;
      return -1;
    }

    /* ---- Header: current package rate / paid / due, lifetime small ---- */
    function renderHeader() {
      var cur = PACKAGES[currentId];
      if (!cur) return;
      var due = dueOf(cur);
      $('pp-cur-name').textContent = cur.name;
      $('pp-cur-id').textContent = currentId;
      $('pp-cur-rate').textContent = taka(cur.agreed);
      $('pp-cur-paid').textContent = taka(paidOf(cur));
      $('pp-cur-bar').style.width = pctOf(cur) + '%';
      $('pp-cur-due').className = 'fw-bold cur fs-20 ' + (due > 0 ? 'text-danger' : 'text-success');
      $('pp-cur-due').textContent = taka(due);
      $('pp-due-tile').classList.toggle('is-owing', due > 0);
      $('pp-due-tile').classList.toggle('is-clear', due <= 0);
      var lifetime = ORDER.reduce(function (t, id) { return t + paidOf(PACKAGES[id]); }, 0);
      $('pp-lifetime').textContent = taka(lifetime);
      $('pp-lifetime-sub').textContent = 'across ' + ORDER.length + ' package' + (ORDER.length === 1 ? '' : 's');
      var badge = $('pp-pay-badge');
      if (badge) {
        badge.className = 'badge ' + (due > 0 ? 'bg-danger-subtle text-danger' : 'bg-success-subtle text-success');
        badge.textContent = due > 0 ? taka(due) + ' due' : 'Fully Paid';
      }
    }

    /* ---- Partial dollar status + treatment countdown (current package) ---- *
     * The dollar status comes from crm-dollar.js (dollar-payments.html) and
     * the countdown reads the same browser record as
     * treatment-countdown.html (crm_reached), keyed by lead ID, and the
     * same 90-day rule: month 1 on track, 2 attention, 3 urgent, then
     * overdue; counted from the package's applied date. */
    function store(key) {
      return {
        get: function () { try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (e) { return {}; } },
        set: function (id, v) {
          try { var m = this.get(); m[id] = v; localStorage.setItem(key, JSON.stringify(m)); } catch (e) { /* demo only */ }
        }
      };
    }
    var reachedStore = store('crm_reached');
    var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    function fmtDate(d) { return String(d.getDate()).padStart(2, '0') + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
    function parseDate(s) {
      if (!s) return null;
      var iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
      if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
      var m = /^(\d{1,2}) (\w{3}) (\d{4})$/.exec(s);
      return m ? new Date(+m[3], MONTHS.indexOf(m[2]), +m[1]) : null;
    }
    function isoDate(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

    /* Status only, on purpose: the amounts live on Dollar Payments. */
    function renderDollar() {
      var cur = PACKAGES[currentId];
      var total = cur ? num(cur.agreedUsd) : 0;
      var badge = $('pp-dl-badge');
      if (!badge) return;
      if (!total || !window.CRMDollar) {
        badge.className = 'badge bg-light text-muted';
        badge.textContent = 'Not applicable';
        $('pp-dl-note').textContent = 'No partial dollar on this package.';
        return;
      }
      var st = window.CRMDollar.status(pp.dataset.leadId, total);
      badge.className = 'badge ' + window.CRMDollar.badgeClass(st.key);
      badge.textContent = st.label;
      $('pp-dl-note').textContent = st.key === 'paid' ? 'Partial dollar is fully paid.'
        : st.key === 'partial' ? 'Partial dollar is partly paid.' : 'Partial dollar not paid yet.';
    }

    function renderCountdown() {
      var cur = PACKAGES[currentId];
      var applied = cur && cur.steps && cur.steps['2'] ? parseDate(cur.steps['2'].date) : null;
      var badge = $('pp-tc-badge');
      if (!applied) {
        badge.className = 'badge bg-light text-muted';
        badge.textContent = 'Not started';
        $('pp-tc-left').textContent = '—';
        $('pp-tc-passed').textContent = '';
        $('pp-tc-bar').style.width = '0%';
        $('pp-tc-dates').textContent = 'Starts when a package is applied.';
        return;
      }
      var DAY = 86400000, WINDOW = 90;
      var now = new Date(); now = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      var deadline = new Date(applied.getTime() + WINDOW * DAY);
      var passed = Math.max(0, Math.round((now - applied) / DAY));
      var left = WINDOW - passed;
      var reached = reachedStore.get()[pp.dataset.leadId] || '';
      var tone, label;
      if (reached) { tone = 'info'; label = 'Reached'; }
      else if (passed >= WINDOW) { tone = 'danger'; label = 'Overdue'; }
      else if (passed >= 60) { tone = 'danger'; label = 'Urgent'; }
      else if (passed >= 30) { tone = 'warning'; label = 'Attention'; }
      else { tone = 'success'; label = 'On Track'; }
      badge.className = 'badge bg-' + tone + '-subtle text-' + tone;
      badge.textContent = label;
      $('pp-tc-left').className = 'fw-bold fs-20 text-' + tone;
      $('pp-tc-left').textContent = reached ? 'Reached destination' : (left >= 0 ? left + ' days left' : 'Overdue by ' + (-left) + ' days');
      $('pp-tc-passed').textContent = reached ? '' : passed + ' of ' + WINDOW + ' days passed';
      $('pp-tc-bar').className = 'progress-bar bg-' + tone;
      $('pp-tc-bar').style.width = (reached ? 100 : Math.min(100, Math.round(passed / WINDOW * 100))) + '%';
      var rd = parseDate(reached);
      $('pp-tc-dates').textContent = 'Applied ' + fmtDate(applied) + ' · ' +
        (reached ? 'reached ' + (rd ? fmtDate(rd) : reached) : 'deadline ' + fmtDate(deadline));
    }

    /* ---- Package History table ---- */
    function renderPackages() {
      var body = $('pp-pkg-body');
      if (!body) return;
      body.innerHTML = ORDER.map(function (id) {
        var p = PACKAGES[id];
        var st = stageOf(p);
        var closed = p.status === 'closed' && p.closed;
        var reached = STEP_NAMES[st] + '<div class="fs-11 ' + (closed
          ? 'text-danger">closed before ' + STEP_NAMES[p.closed.atStep]
          : 'text-muted">next: ' + (STEP_NAMES[st + 1] || '—')) + '</div>';
        var status = closed
          ? '<span class="badge bg-danger-subtle text-danger">Closed</span><div class="fs-11 text-muted mt-1">' + p.closed.date + '</div>'
          : '<span class="badge bg-primary-subtle text-primary">Active</span>';
        var due = dueOf(p);
        return '<tr class="pp-pkg-row" data-pkg="' + id + '">' +
          '<td><div class="fw-semibold fs-13">' + p.name + '</div><div class="mono fs-12 text-muted">' + id + '</div></td>' +
          '<td class="fs-13">' + (p.steps && p.steps['2'] ? p.steps['2'].date : '—') + '</td>' +
          '<td class="text-end cur fs-13">' + taka(p.agreed) + '</td>' +
          '<td class="text-end cur fs-13 text-success">' + taka(paidOf(p)) + '<div class="fs-11 text-muted">' + Math.round(pctOf(p)) + '%</div></td>' +
          '<td class="text-end cur fs-13 ' + (due > 0 ? 'text-danger fw-semibold' : 'text-muted') + '">' + (due > 0 ? taka(due) : '&mdash;') + '</td>' +
          '<td class="fs-13">' + reached + '</td><td>' + status + '</td>' +
          '<td class="text-end text-nowrap">' +
            '<button type="button" class="btn btn-sm btn-icon btn-light pp-pkg-view" data-pkg="' + id + '" data-bs-toggle="modal" data-bs-target="#ppPackageModal" title="View package journey"><i class="mdi mdi-eye-outline"></i></button> ' +
            '<button type="button" class="btn btn-sm btn-light pp-inv-btn" data-pkg="' + id + '" title="Invoice for the whole package"><i class="mdi mdi-file-document-multiple-outline me-1"></i>Invoice</button>' +
          '</td></tr>';
      }).join('');
      $('pp-pkg-count').textContent = ORDER.length;
    }

    /* ---- Payments tab: one flat list, newest first, an invoice per
       payment. Whole-package invoices live on Package History. ---- */
    function renderPayments() {
      var body = $('pp-pay-body');
      if (!body) return;
      var all = [];
      ORDER.forEach(function (id) {
        (PACKAGES[id].payments || []).forEach(function (x) { all.push({ pkg: id, x: x }); });
      });
      all.sort(function (a, b) { return (parseDate(b.x.date) || 0) - (parseDate(a.x.date) || 0); });
      body.innerHTML = all.map(function (r) {
        var x = r.x;
        return '<tr><td class="fs-13 text-nowrap">' + x.date + '</td>' +
          '<td class="fs-13">' + PACKAGES[r.pkg].name + (r.pkg === currentId ? ' <span class="badge bg-primary-subtle text-primary ms-1">Current</span>' : '') + '</td>' +
          '<td class="fs-13">' + x.method + '</td>' +
          '<td class="mono fs-12"><a href="receipts.html">' + x.receipt + '</a></td>' +
          '<td class="text-end cur fs-13 fw-semibold">' + taka(x.amount) + '</td>' +
          '<td class="text-end"><button type="button" class="btn btn-sm btn-light pp-inv-btn" data-pkg="' + r.pkg + '" data-receipt="' + x.receipt + '"><i class="mdi mdi-file-document-outline me-1"></i>Invoice</button></td></tr>';
      }).join('') || '<tr><td colspan="6" class="fs-13 text-muted">No payments yet.</td></tr>';
      $('pp-pay-count').textContent = all.length;
      var total = all.reduce(function (t, r) { return t + num(r.x.amount); }, 0);
      $('pp-pay-summary').innerHTML = all.length + ' payment' + (all.length === 1 ? '' : 's') + ' &middot; <span class="fw-semibold text-body">' + taka(total) + '</span> received in total';
    }

    var gotoPackages = $('pp-goto-packages');
    if (gotoPackages) {
      gotoPackages.addEventListener('click', function (ev) {
        ev.preventDefault();
        var tab = document.querySelector('[data-bs-target="#pp-packages"]');
        if (tab) bootstrap.Tab.getOrCreateInstance(tab).show();
      });
    }

    /* ---- Journey + quick actions ---- */
    /* What the next-step button offers after `stage` completed steps. A
       step with a modal opens it (the modal's own save advances the
       journey); the rest are a single click. */
    var NEXT = {
      0: { label: 'Add Package', icon: 'mdi-plus-box-outline', modal: '#ppNewPackageModal' },
      1: { label: 'Add Package', icon: 'mdi-plus-box-outline', modal: '#ppNewPackageModal' },
      2: { label: 'Apply Visa', icon: 'mdi-passport', modal: '#applyVisaModal' },
      3: { label: 'Mark Visa Approved', icon: 'mdi-check-decagram' },
      4: { label: 'Mark Ticket Purchased', icon: 'mdi-airplane' },
      5: { label: 'Start Treatment', icon: 'mdi-hospital-building' },
      6: { label: 'Mark Returned to Country', icon: 'mdi-flag-checkered' }
    };

    function renderStage() {
      if (L.renderJourney) L.renderJourney(journeyEl, stage, { status: pp.dataset.status });
      if (!nextBtn) return;
      var next = NEXT[stage];
      nextBtn.disabled = !next;
      nextBtn.querySelector('i').className = 'mdi me-1 ' + (next ? next.icon : 'mdi-check-all');
      nextBtn.querySelector('span').textContent = next ? next.label : 'Journey complete';
      if (next && next.modal) {
        nextBtn.setAttribute('data-bs-toggle', 'modal');
        nextBtn.setAttribute('data-bs-target', next.modal);
      } else {
        nextBtn.removeAttribute('data-bs-toggle');
        nextBtn.removeAttribute('data-bs-target');
      }
    }

    function renderPayment() {
      var cur = PACKAGES[currentId];
      if (!cur) return;
      if (L.renderPaymentProgress) L.renderPaymentProgress(paymentEl, pctOf(cur));
      if (!payBtn) return;
      var owing = dueOf(cur);
      payBtn.dataset.dueBdt = owing;
      payBtn.dataset.dueUsd = 0;
      payBtn.disabled = owing <= 0;
      payBtn.title = owing <= 0 ? 'The current package is fully paid.' : '';
      payBtn.querySelector('span').textContent = owing <= 0 ? 'Fully Paid' : 'Record Payment · ' + taka(owing) + ' due';
    }

    function renderAll() {
      renderHeader();
      renderDollar();
      renderCountdown();
      renderPackages();
      renderPayments();
      renderStage();
      renderPayment();
    }

    function stepDone(n, note) {
      var cur = PACKAGES[currentId];
      if (!cur) return;
      cur.steps = cur.steps || {};
      if (!cur.steps[n]) cur.steps[n] = { date: today(), by: 'You', note: note || '' };
    }

    function advance(to) {
      for (var n = stage + 1; n <= to; n++) stepDone(n);
      stage = Math.max(stage, to);
      pp.dataset.journeyStage = stage;
      renderAll();
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        var next = NEXT[stage];
        if (!next || next.modal) return;
        /* Starting treatment is also the Treatment Countdown's record. */
        if (stage + 1 === 6) reachedStore.set(pp.dataset.leadId, isoDate(new Date()));
        advance(stage + 1);
        toast(next.label.replace(/^Mark /, '') + ' — recorded on the journey.');
      });
    }

    /* The visa modal's own handler (crm-leads.js) validates and confirms;
       here the journey just moves on once a date was given. */
    var avSave = $('av-save');
    if (avSave) {
      avSave.addEventListener('click', function () {
        var date = $('av-date');
        if (date && date.value) advance(3);
      });
    }

    /* A payment saved from the quick action lands on the current package,
       so it shows in Payments and can be invoiced straight away. The
       leads handler caps it at what is owed; the same cap applies here. */
    var paySave = $('pay-save');
    if (paySave) {
      paySave.addEventListener('click', function () {
        var cur = PACKAGES[currentId];
        var amount = Math.min(num(($('pay-amount') || {}).value), dueOf(cur));
        if (!cur || amount <= 0) return;
        var receipt = window.CRMSettings ? CRMSettings.nextId('receipt')
          : 'MR-' + String(300 + ORDER.reduce(function (t, k) { return t + PACKAGES[k].payments.length; }, 0)).padStart(6, '0');
        cur.payments.push({ date: today(), type: 'Instalment', method: ($('pay-method') || {}).value || 'Cash', receipt: receipt, by: 'You', amount: amount });
        renderAll();
      });
    }

    /* A new package: the previous current one is closed and kept in
       history, and the journey restarts at Applied with whatever the
       Apply block says was paid up front. */
    var npSave = $('pp-np-save');
    var npModal = $('ppNewPackageModal');
    if (npSave && npModal) {
      npSave.addEventListener('click', function () {
        var pkg = $('lc-package');
        if (pkg && !pkg.value) { pkg.classList.add('is-invalid'); return; }
        if (pkg) pkg.classList.remove('is-invalid');
        var opt = pkg ? pkg.options[pkg.selectedIndex] : null;
        var apply = L.apply;
        var agreedAmt = apply && apply.agreedBdt ? num(apply.agreedBdt()) : num(opt && opt.getAttribute('data-price-bdt'));
        var paidNow = $('lc-payment-is-done');
        var paidAmt = paidNow && paidNow.checked ? Math.min(num(($('lc-pay-amount') || {}).value), agreedAmt) : 0;

        var prev = PACKAGES[currentId];
        if (prev && prev.status !== 'closed') {
          prev.steps = prev.steps || {};
          for (var n = 1; n <= stage; n++) if (!prev.steps[n]) prev.steps[n] = { date: '—', by: '—', note: '' };
          prev.status = 'closed';
          prev.closed = { atStep: Math.min(stage + 1, 7), date: today(), by: 'You', reason: 'Replaced by a new package.' };
        }
        var year = new Date().getFullYear();
        var newId = 'ELH-D-' + year + '-' + String(90 + ORDER.length).padStart(6, '0');
        PACKAGES[newId] = {
          name: opt ? opt.textContent.trim() : 'Package', status: 'active',
          listPrice: num(opt && opt.getAttribute('data-price-bdt')), agreed: agreedAmt, agreedUsd: apply && apply.acceptsUsd && apply.acceptsUsd() && apply.agreedUsd ? num(apply.agreedUsd()) : 0,
          hospital: prev ? prev.hospital : '', appliedBy: 'You',
          steps: {
            1: { date: prev && prev.steps && prev.steps['1'] ? prev.steps['1'].date : today(), by: '—', note: 'Returning lead.' },
            2: { date: today(), by: 'You', note: (opt ? opt.textContent.trim() : 'Package') + ' agreed at ' + taka(agreedAmt) + '.' }
          },
          payments: paidAmt > 0 ? [{ date: today(), type: 'Advance', method: ($('lc-pay-method') || {}).value || 'Cash', receipt: window.CRMSettings ? CRMSettings.nextId('receipt') : 'MR-000' + (400 + ORDER.length), by: 'You', amount: paidAmt }] : []
        };
        ORDER.unshift(newId);
        currentId = newId;
        pp.dataset.currentPkg = newId;
        pp.dataset.status = 'applied';
        stage = 2;
        pp.dataset.journeyStage = stage;
        renderAll();
        bootstrap.Modal.getOrCreateInstance(npModal).hide();
        window.setTimeout(function () {
          toast('New package added. The previous one is kept in Package History and the journey restarts from Applied.');
        }, 250);
      });
    }

    /* ---- Package journey window ---- */
    document.addEventListener('click', function (ev) {
      var row = ev.target.closest('.pp-pkg-row');
      if (!row || ev.target.closest('button, a')) return;
      var view = row.querySelector('.pp-pkg-view');
      if (view) view.click();
    });

    var pkModal = $('ppPackageModal');
    if (pkModal) {
      pkModal.addEventListener('show.bs.modal', function (ev) {
        var id = ev.relatedTarget ? ev.relatedTarget.dataset.pkg : '';
        var d = PACKAGES[id];
        if (!d) return;
        var steps = d.steps || {};
        var st = stageOf(d);
        var closed = d.status === 'closed' && d.closed;

        $('pk-title').textContent = d.name;
        $('pk-status').className = 'badge ms-1 align-middle ' + (closed ? 'bg-danger-subtle text-danger' : 'bg-primary-subtle text-primary');
        $('pk-status').textContent = closed ? 'Closed' : 'Active';
        $('pk-sub').innerHTML = id + ' &middot; ' + (d.hospital || '—') + ' &middot; applied by ' + (d.appliedBy || '—');
        $('pk-applied').textContent = steps['2'] ? steps['2'].date : '—';
        $('pk-agreed').textContent = taka(d.agreed);
        $('pk-paid').innerHTML = '<span class="text-success">' + taka(paidOf(d)) + '</span> &middot; <span class="' + (dueOf(d) > 0 ? 'text-danger' : '') + '">' + taka(dueOf(d)) + '</span>';
        $('pk-reached').innerHTML = STEP_NAMES[st] + '<div class="fs-11 fw-normal ' + (closed ? 'text-danger">closed before ' + STEP_NAMES[d.closed.atStep] : 'text-muted">next: ' + (STEP_NAMES[st + 1] || '—')) + '</div>';
        $('pk-invoice-btn').dataset.pkg = id;

        $('pk-closed').classList.toggle('d-none', !closed);
        if (closed) {
          $('pk-closed-head').innerHTML = 'Closed on ' + d.closed.date + ' by ' + d.closed.by +
            ' &mdash; stopped after ' + STEP_NAMES[st] + ', before ' + STEP_NAMES[d.closed.atStep] + '.';
          $('pk-closed-reason').innerHTML = d.closed.reason;
        }

        /* Journey strip: the page's own markup, with step 1 read as
           "Lead Registered" (a package has no live status of its own). */
        var journey = $('pk-journey');
        journey.innerHTML = journeyEl.innerHTML;
        var cap = journey.querySelector('.crm-journey-caption');
        if (cap) cap.remove();
        if (L.renderJourney) L.renderJourney(journey, st, { status: 'applied' });
        var first = journey.querySelector('.js-journey-status-label');
        if (first) first.textContent = STEP_NAMES[1];
        if (closed) {
          var stop = journey.querySelector('.crm-journey-step[data-step="' + d.closed.atStep + '"]');
          if (stop) {
            stop.classList.remove('is-current');
            stop.classList.add('is-cancelled');
            stop.querySelector('.crm-journey-icon i').className = 'mdi mdi-close-octagon-outline';
            stop.querySelector('.crm-journey-label').textContent = 'Closed';
          }
        }

        /* Step-by-step table: every step, done / closed / next / pending. */
        var rows = '';
        for (var n = 1; n <= 7; n++) {
          var s = n <= st ? (steps[n] || { date: '—', note: '' }) : null;
          var badge, date = '—', note = '';
          var isStop = closed && n === d.closed.atStep;
          if (s) {
            badge = '<span class="badge bg-success-subtle text-success">Done</span>';
            date = s.date; note = s.note;
          } else if (isStop) {
            badge = '<span class="badge bg-danger-subtle text-danger">Closed</span>';
            date = d.closed.date; note = d.closed.reason;
          } else if (!closed && n === st + 1) {
            badge = '<span class="badge bg-primary-subtle text-primary">Next</span>';
          } else {
            badge = '<span class="badge bg-light text-muted">' + (closed ? 'Not reached' : 'Pending') + '</span>';
          }
          rows += '<tr' + (s || isStop ? '' : ' class="text-muted"') + '><td>' + n + '</td><td class="fw-semibold text-nowrap">' +
            STEP_NAMES[n] + '</td><td>' + badge + '</td><td class="text-nowrap">' + date + '</td><td>' + note + '</td></tr>';
        }
        $('pk-steps').innerHTML = rows;

        var track = $('pk-payment-track');
        track.innerHTML = paymentEl.querySelector('.crm-journey').innerHTML;
        if (L.renderPaymentProgress) {
          L.renderPaymentProgress(track, pctOf(d));
          L.renderPaymentProgress($('pk-payment'), pctOf(d));
        }
        $('pk-payments').innerHTML = (d.payments || []).map(function (x) {
          return '<tr><td>' + x.date + '</td><td>' + x.method + '</td><td class="mono fs-12"><a href="receipts.html">' + x.receipt +
            '</a></td><td class="text-end cur">' + taka(x.amount) + '</td>' +
            '<td class="text-end"><button type="button" class="btn btn-sm btn-icon btn-light pp-inv-btn" data-pkg="' + id + '" data-receipt="' + x.receipt + '" title="Invoice for this payment"><i class="mdi mdi-file-document-outline"></i></button></td></tr>';
        }).join('') || '<tr><td colspan="5" class="text-muted">No payments on this package.</td></tr>';
      });
    }

    /* ---- Invoices: one payment (data-receipt) or a whole package ---- *
     * Opened from Payments, Package History or the package window. Any
     * open modal is closed first — Bootstrap does not stack modals. */
    var invModal = $('ppInvoiceModal');
    var BILL_TO = {
      guardian: 'Abul Kalam', patient: 'Sharmin Akter', age: '39 yrs',
      phone: '+880 1521-889900', address: 'House 14, Road 7, Section 10, Mirpur, Dhaka 1216'
    };

    function invoiceHtml(id, receipt) {
      var p = PACKAGES[id];
      return window.CRMInvoice.render({
        leadId: pp.dataset.leadId, billTo: BILL_TO, receipt: receipt,
        payments: p.payments || [],
        pkg: {
          id: id, name: p.name, listPrice: p.listPrice, agreed: p.agreed, agreedUsd: p.agreedUsd,
          appliedOn: p.steps && p.steps['2'] ? p.steps['2'].date : '', appliedBy: p.appliedBy,
          closed: p.status === 'closed' ? p.closed : null
        }
      });
    }

    if (invModal) {
      var pendingInvoice = null;
      document.addEventListener('click', function (ev) {
        var btn = ev.target.closest('.pp-inv-btn');
        if (!btn || !PACKAGES[btn.dataset.pkg]) return;
        ev.preventDefault();
        $('pp-invoice').innerHTML = invoiceHtml(btn.dataset.pkg, btn.dataset.receipt || '');
        $('inv-kind').textContent = btn.dataset.receipt ? 'Payment Invoice · ' + btn.dataset.receipt : 'Package Invoice · ' + btn.dataset.pkg;
        var open = document.querySelector('.modal.show');
        if (open && open !== invModal) {
          pendingInvoice = true;
          open.addEventListener('hidden.bs.modal', function once() {
            open.removeEventListener('hidden.bs.modal', once);
            if (pendingInvoice) bootstrap.Modal.getOrCreateInstance(invModal).show();
            pendingInvoice = null;
          });
          bootstrap.Modal.getOrCreateInstance(open).hide();
        } else {
          bootstrap.Modal.getOrCreateInstance(invModal).show();
        }
      });
      var invPrint = $('pp-inv-print');
      if (invPrint) invPrint.addEventListener('click', function () { window.print(); });
    }

    /* Drive link: copy to clipboard. */
    var driveCopy = $('pp-drive-copy');
    var driveLink = $('pp-drive-link');
    if (driveCopy && driveLink) {
      driveCopy.addEventListener('click', function () {
        var done = function () {
          driveCopy.innerHTML = '<i class="mdi mdi-check text-success"></i>';
          window.setTimeout(function () { driveCopy.innerHTML = '<i class="mdi mdi-content-copy"></i>'; }, 1500);
        };
        if (navigator.clipboard) navigator.clipboard.writeText(driveLink.href).then(done, function () {});
      });
    }

    /* Edit: crm-leads.js prefills from a table row, and there is none here,
       so the profile fills in everything it holds. Registered after the
       leads handler, so these values win. */
    var PROFILE = {
      'el-date': '2026-08-14', 'el-executive': 'Nusrat Jahan',
      'el-guardian': 'Abul Kalam', 'el-phone': '+880 1521-889900', 'el-altphone': '+880 1711-552203',
      'el-email': 'abul.kalam@example.com', 'el-patient': 'Sharmin Akter', 'el-dob': '1987-03-12',
      'el-age': '39 yrs', 'el-gender': 'Female',
      'el-condition': 'End-stage renal disease; donor matched, kidney transplant planned.',
      'el-village': 'House 14, Road 7, Section 10', 'el-postcode': '1216',
      'el-source': 'Hospital', 'el-secondary': 'Referral from BSMMU nephrology', 'el-priority': 'High',
      'el-expected': '350000', 'el-offered': '300000', 'el-package-offered': 'Paid Package',
      'el-notes': 'Returning patient. Prefers WhatsApp in the evening.'
    };
    var editModal = $('editLeadModal');
    if (editModal) {
      editModal.addEventListener('show.bs.modal', function () {
        Object.keys(PROFILE).forEach(function (id) {
          var el = $(id);
          if (!el) return;
          if (el.tagName === 'SELECT') {
            [].slice.call(el.options).forEach(function (o, i) {
              if (o.value === PROFILE[id] || o.textContent.trim() === PROFILE[id]) el.selectedIndex = i;
            });
          } else {
            el.value = PROFILE[id];
          }
        });
        var drive = $('el-drive');
        if (drive && driveLink) drive.value = driveLink.href;
        var idLabel = $('el-lead-id');
        if (idLabel) idLabel.textContent = pp.dataset.leadId;
        /* Show the current photo, if one was set this session. */
        var preview = $('el-photo-preview');
        var current = document.querySelector('#pp-avatar img');
        if (preview && current) preview.innerHTML = '<img alt="" src="' + current.src + '">';
      });
    }

    /* Saving Edit carries the new photo and Drive link onto the header. */
    var elSave = $('el-save');
    if (elSave) {
      elSave.addEventListener('click', function () {
        var picked = document.querySelector('#el-photo-preview img');
        var avatar = $('pp-avatar');
        if (picked && avatar) avatar.innerHTML = '<img alt="Sharmin Akter" src="' + picked.src + '">';
        var drive = $('el-drive');
        if (drive && driveLink && /^https?:\/\//.test(drive.value)) driveLink.href = drive.value;
      });
    }

    renderAll();
  }
})();
