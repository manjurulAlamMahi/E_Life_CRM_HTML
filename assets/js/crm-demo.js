/**
 * E Life Healthcare CRM — demo behaviour for the static client preview.
 *
 * In the Laravel build this is replaced by:
 *   - server-side yajra/laravel-datatables endpoints  (plan.md §14)
 *   - real aggregates from the Deal/Payment models    (plan.md R2)
 * Nothing here carries business logic; it only makes the preview clickable.
 */
(function () {
  'use strict';

  /* ---------- Demo notices ------------------------------------------- *
   * Yellow ".crm-demo-note" banners explain the static preview. Each has
   * a close button (this visit only) and "Don't show again" (remembered
   * in this browser); Settings → Notifications → "Show demo notices"
   * turns them back on. The class goes on <html> straight away, so a
   * hidden notice never flashes. */
  var DEMO_KEY = 'crm_hide_demo_notes';
  function demoHidden() { try { return localStorage.getItem(DEMO_KEY) === '1'; } catch (e) { return false; } }
  function setDemoHidden(on) {
    try { if (on) localStorage.setItem(DEMO_KEY, '1'); else localStorage.removeItem(DEMO_KEY); } catch (e) { /* demo only */ }
    document.documentElement.classList.toggle('crm-hide-demo-notes', on);
  }
  document.documentElement.classList.toggle('crm-hide-demo-notes', demoHidden());
  document.addEventListener('click', function (ev) {
    var btn = ev.target.closest('[data-demo-hide]');
    if (!btn) return;
    var note = btn.closest('.crm-demo-note');
    if (btn.getAttribute('data-demo-hide') === 'all') setDemoHidden(true);
    else if (note) note.classList.add('d-none');
  });
  document.addEventListener('DOMContentLoaded', function () {
    var toggle = document.getElementById('set-demo-notes');
    if (!toggle) return;
    toggle.checked = !demoHidden();
    toggle.addEventListener('change', function () { setDemoHidden(!toggle.checked); });
  });

  /* ---------- Settings store (Settings page) ------------------------- *
   * The one place company details, ID formats and the editable dropdown
   * lists live. Kept in this browser's localStorage for the static
   * preview (in Laravel: a settings table). Everything that shows them
   * reads from here, so a change on Settings reaches every form, invoice
   * and printout:
   *   <select data-crm-list="paymentMethods">   options filled from a list
   *       (a leading value="" placeholder and a trailing "Other" are kept;
   *       "a,b" joins two lists)
   *   data-company="name|address|phone|email|contact", data-company-case="upper"
   *   <img data-company-logo>                    the uploaded logo
   *   CRMSettings.nextId('lead')                 Lead26-0417, Lead27-0001… */
  var SETTINGS_KEY = 'crm_settings_v1';
  var SETTINGS_DEFAULTS = {
    company: {
      name: 'E Life Healthcare',
      address: 'House 42, Road 6, Dhanmondi, Dhaka 1205, Bangladesh',
      phone: '+880 9600-123456',
      email: 'info@elifehealthcare.com',
      logo: ''                      // '' = assets/logo.png; else an uploaded data: URL
    },
    /* year: '' | 'yy' | 'yyyy'. With yearly on, numbering restarts at 1 each
       new year, so 2027's first lead is Lead27-0001 without anyone touching it. */
    ids: {
      lead:     { label: 'Lead ID',     prefix: 'Lead', year: 'yy', sep: '-', digits: 4, yearly: true,  next: 417 },
      patient:  { label: 'Patient ID',  prefix: 'PT',   year: 'yy', sep: '-', digits: 4, yearly: true,  next: 95 },
      employee: { label: 'Employee ID', prefix: 'EMP',  year: '',   sep: '-', digits: 3, yearly: false, next: 13 },
      invoice:  { label: 'Invoice No.', prefix: 'INV',  year: 'yy', sep: '-', digits: 4, yearly: true,  next: 95 },
      receipt:  { label: 'Receipt No.', prefix: 'MR',   year: 'yy', sep: '-', digits: 4, yearly: true,  next: 320 }
    },
    lists: {
      paymentMethods: ['Cash', 'Bank Transfer', 'bKash', 'Nagad', 'Rocket', 'Card'],
      paymentRejectReasons: ['No such transaction found', 'Amount does not match', 'Proof unreadable', 'Duplicate submission'],
      notInterestedReasons: ['Price beyond budget', 'Continuing treatment locally', 'Chose another agency', 'Patient condition changed', 'No longer needed', 'Duplicate enquiry'],
      unreachableReasons: ['No answer', 'Phone switched off', 'Wrong number', 'Number busy every attempt'],
      leadPriorities: ['Normal', 'High', 'Critical', 'Special'],
      conversationChannels: ['Phone', 'WhatsApp', 'In Person'],
      followupActions: ['Call back', 'WhatsApp message', 'Send package quotation', "Share doctor's opinion", 'Request medical documents', 'Invite to office visit'],
      rescheduleReasons: ['Patient unavailable', 'Guardian requested later date', 'Awaiting doctor opinion', 'Awaiting funds'],
      expenseCategories: ['Office Rent', 'Salaries', 'Marketing & Ads', 'Utilities', 'Travel & Transport', 'Office Supplies', 'Software & Internet', 'Miscellaneous'],
      visaCountries: ['India', 'Thailand', 'Singapore', 'Malaysia'],
      visaTypes: ['Medical Visa', 'Medical Attendant Visa', 'Tourist Visa']
    },
    backup: { schedule: 'Daily at 02:00', destination: 'Google Drive', retention: '30 days', last: '31 Aug 2026, 02:00 AM' }
  };
  function settingsClone(o) { return JSON.parse(JSON.stringify(o)); }
  function settingsMerge(base, saved) {
    if (saved === null || saved === undefined) return base;
    /* Lists and plain values are taken whole; only objects merge key by
       key, so a key added to the defaults later still gets its value. */
    if (Array.isArray(base) || typeof base !== 'object' || typeof saved !== 'object') return saved;
    var out = {};
    Object.keys(saved).forEach(function (k) { out[k] = saved[k]; });
    Object.keys(base).forEach(function (k) { out[k] = k in saved ? settingsMerge(base[k], saved[k]) : base[k]; });
    return out;
  }
  function loadSettings() {
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null'); } catch (e) { /* blocked or corrupt */ }
    return settingsMerge(settingsClone(SETTINGS_DEFAULTS), saved);
  }
  var crmSettings = loadSettings();
  function pad(n, d) { n = String(Math.max(0, parseInt(n, 10) || 0)); while (n.length < d) n = '0' + n; return n; }
  window.CRMSettings = {
    defaults: function () { return settingsClone(SETTINGS_DEFAULTS); },
    get: function () { return crmSettings; },
    save: function (next) {
      crmSettings = settingsMerge(settingsClone(SETTINGS_DEFAULTS), next || crmSettings);
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(crmSettings)); } catch (e) { /* demo only */ }
    },
    reset: function () {
      crmSettings = settingsClone(SETTINGS_DEFAULTS);
      try { localStorage.removeItem(SETTINGS_KEY); } catch (e) { /* demo only */ }
    },
    list: function (key) { return (crmSettings.lists[key] || []).slice(); },
    company: function () { return crmSettings.company; },
    logo: function () { return crmSettings.company.logo || 'assets/logo.png'; },
    /* Format number n for an ID kind; `date` picks the year (default today). */
    formatId: function (kind, n, date, fmt) {
      var f = fmt || crmSettings.ids[kind];
      if (!f) return String(n);
      var y = (date || new Date()).getFullYear();
      var yr = f.year === 'yyyy' ? String(y) : f.year === 'yy' ? String(y).slice(-2) : '';
      return f.prefix + yr + f.sep + pad(n, f.digits);
    },
    /* Issue the next ID of a kind and advance its counter. A yearly
       sequence starts again at 1 the first time it is used in a new year. */
    nextId: function (kind) {
      var f = crmSettings.ids[kind];
      if (!f) return '';
      var year = new Date().getFullYear();
      if (f.yearly && f.lastYear && f.lastYear !== year) f.next = 1;
      var id = this.formatId(kind, f.next);
      f.next = (parseInt(f.next, 10) || 0) + 1;
      f.lastYear = year;
      this.save();
      return id;
    },
    /* A lead id in either the sample-data format or the configured one. */
    isLeadId: function (id) {
      var f = crmSettings.ids.lead;
      return /^ELH-L-/.test(id || '') || (!!f.prefix && String(id || '').indexOf(f.prefix) === 0);
    }
  };

  /* Fill every [data-crm-list] select and [data-company] slot on the page.
     Runs before the module scripts (this file loads first), so their own
     code sees the configured options. Exposed for the Settings page. */
  function applySettingsToPage(root) {
    root = root || document;
    var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    [].forEach.call(root.querySelectorAll('select[data-crm-list]'), function (sel) {
      var items = [];
      sel.getAttribute('data-crm-list').split(',').forEach(function (k) {
        CRMSettings.list(k.trim()).forEach(function (v) { if (items.indexOf(v) === -1) items.push(v); });
      });
      var opts = [].slice.call(sel.options);
      var head = opts.filter(function (o) { return o.hasAttribute('value') && o.value === ''; }).map(function (o) { return o.outerHTML; });
      var hasOther = opts.some(function (o) { return o.textContent.trim() === 'Other'; }) || sel.hasAttribute('data-crm-other');
      if (hasOther) sel.setAttribute('data-crm-other', '');
      var cur = sel.value;
      sel.innerHTML = head.join('') + items.map(function (v) { return '<option>' + esc(v) + '</option>'; }).join('') +
        (hasOther ? '<option>Other</option>' : '');
      if (cur && [].some.call(sel.options, function (o) { return o.value === cur; })) sel.value = cur;
    });
    var c = CRMSettings.company();
    [].forEach.call(root.querySelectorAll('[data-company]'), function (el) {
      var k = el.getAttribute('data-company');
      if (k === 'contact') { el.innerHTML = esc(c.address) + '<br>' + esc(c.phone) + ' &middot; ' + esc(c.email); return; }
      var v = c[k] || '';
      el.textContent = el.getAttribute('data-company-case') === 'upper' ? v.toUpperCase() : v;
    });
    [].forEach.call(root.querySelectorAll('img[data-company-logo]'), function (img) {
      if (c.logo) img.src = c.logo;
      img.alt = c.name;
    });
  }
  window.CRMSettings.applyToPage = applySettingsToPage;
  document.addEventListener('DOMContentLoaded', function () { applySettingsToPage(document); });

  /* ---------- Sidebar scroll position -------------------------------- *
   * Every page load rebuilds the sidebar scrolled to the top, so an active
   * entry low in the menu (Source List, Audit Logs…) was out of sight. The
   * scroll offset is kept for this tab (sessionStorage) and restored, then
   * the active entry is brought into view if it still isn't. The
   * template's own attempt in app.js targets .vertical-menu, which this
   * layout doesn't have. Runs after load: the deep-link script and some
   * module scripts only settle which entry is active at that point. */
  var SIDEBAR_KEY = 'crm_sidebar_scroll';
  function sidebarScroller() {
    return document.querySelector('.sidebar-left:not(.horizontal-sidebar) .simplebar-content-wrapper') ||
      document.querySelector('.sidebar-left:not(.horizontal-sidebar) .sidebar-slide');
  }
  window.addEventListener('pagehide', function () {
    var sc = sidebarScroller();
    if (!sc) return;
    try { sessionStorage.setItem(SIDEBAR_KEY, String(sc.scrollTop)); } catch (e) { /* storage blocked */ }
  });
  window.addEventListener('load', function () {
    setTimeout(function () {
      var sc = sidebarScroller();
      if (!sc) return;
      var saved = null;
      try { saved = sessionStorage.getItem(SIDEBAR_KEY); } catch (e) { /* storage blocked */ }
      if (saved !== null) sc.scrollTop = parseInt(saved, 10) || 0;
      var active = sc.querySelector('#sidebar-menu a.active');
      if (!active) return;
      var a = active.getBoundingClientRect(), box = sc.getBoundingClientRect();
      if (a.top < box.top + 8 || a.bottom > box.bottom - 8) {
        sc.scrollTop += a.top - box.top - (box.height - a.height) / 2;
      }
    }, 0);
  });

  var BRAND = {
    primary: '#024766',
    accent: '#53AA25',
    info: '#7588de',
    warning: '#f4d078',
    danger: '#fd6161',
    muted: '#8a92a4'
  };

  /* Bengali Taka, Indian digit grouping (1,50,000) as used in Bangladesh. */
  function bdt(n) {
    var s = Math.round(Math.abs(n)).toString();
    var last3 = s.slice(-3);
    var rest = s.slice(0, -3);
    if (rest) last3 = ',' + last3;
    return (n < 0 ? '-' : '') + '৳' + rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + last3;
  }
  window.bdt = bdt;

  document.addEventListener('DOMContentLoaded', function () {

    /* ---------- Fullscreen toggle -------------------------------------- */
    var fsBtn = document.getElementById('fullscreen-toggle');
    if (fsBtn) {
      fsBtn.addEventListener('click', function () {
        if (!document.fullscreenElement) {
          if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
        } else if (document.exitFullscreen) {
          document.exitFullscreen();
        }
      });
      document.addEventListener('fullscreenchange', function () {
        var icon = document.getElementById('fullscreen-icon');
        if (icon) icon.className = document.fullscreenElement ? 'mdi mdi-fullscreen-exit align-middle' : 'mdi mdi-fullscreen align-middle';
      });
    }

    /* ---------- DataTables ------------------------------------------- */
    if (window.jQuery && jQuery.fn.DataTable) {
      jQuery('table.crm-table').each(function () {
        var $t = jQuery(this);
        if (jQuery.fn.DataTable.isDataTable($t)) return;
        $t.DataTable({
          responsive: true,
          pageLength: 10,
          lengthMenu: [10, 25, 50, 100],
          order: [],
          columnDefs: [{ orderable: false, targets: 'no-sort' }],
          language: {
            search: '',
            searchPlaceholder: 'Search...',
            lengthMenu: '_MENU_ per page',
            info: 'Showing _START_ to _END_ of _TOTAL_',
            infoEmpty: 'No records',
            paginate: { previous: '<i class="mdi mdi-chevron-left"></i>', next: '<i class="mdi mdi-chevron-right"></i>' }
          }
        });
      });
      jQuery('.dataTables_filter input').addClass('form-control form-control-sm');
      jQuery('.dataTables_length select').addClass('form-select form-select-sm');
    }

    /* ---------- select2 ---------------------------------------------- */
    if (window.jQuery && jQuery.fn.select2) {
      jQuery('.crm-select2').select2({ width: '100%', placeholder: 'Select...', allowClear: true });
    }

    /* ---------- Auto-dismissing alerts --------------------------------- *
     * An .alert with data-auto-dismiss="ms" (and .fade.show) fades out and
     * is removed after that long — for page-top info banners. */
    [].forEach.call(document.querySelectorAll('.alert[data-auto-dismiss]'), function (el) {
      var ms = parseInt(el.getAttribute('data-auto-dismiss'), 10) || 5000;
      setTimeout(function () {
        if (window.bootstrap && bootstrap.Alert) bootstrap.Alert.getOrCreateInstance(el).close();
        else el.remove();
      }, ms);
    });

    /* ---------- Profile eye on every lead row --------------------------- *
     * Any list row that is a lead (CRMSettings.isLeadId) gets an eye
     * button in its Action column linking to that lead's profile. Several
     * pages render their Action cells from script (Treatment, Countdown,
     * Visa, Dollar), so each table is watched and re-checked whenever its
     * rows change. Idempotent: a cell that already has the eye is skipped.
     * Quick view keeps its own (different) icon. */
    function ensureProfileEyes(table) {
      var ths = table.tHead && table.tHead.rows[0] ? table.tHead.rows[0].cells : [];
      var col = -1;
      for (var i = 0; i < ths.length; i++) if (/^actions?$/i.test(ths[i].textContent.trim())) col = i;
      if (col < 0) return;
      [].forEach.call(table.querySelectorAll('tbody > tr[data-lead-id]'), function (row) {
        if (!CRMSettings.isLeadId(row.getAttribute('data-lead-id'))) return;
        var cell = row.cells[col];
        if (!cell || cell.querySelector('.crm-profile-eye')) return;
        var a = document.createElement('a');
        a.className = 'btn btn-sm btn-icon btn-light crm-profile-eye';
        a.href = 'patient-profile.html?lead=' + encodeURIComponent(row.getAttribute('data-lead-id'));
        a.title = 'View profile';
        a.setAttribute('aria-label', 'View profile');
        a.innerHTML = '<i class="mdi mdi-eye-outline"></i>';
        var holder = cell.querySelector('.d-flex') || cell;
        holder.insertBefore(a, holder.firstChild);
        if (holder === cell && cell.childNodes.length > 1) a.classList.add('me-1');
      });
    }
    [].forEach.call(document.querySelectorAll('table'), function (t) {
      if (t.parentElement.closest('table') || !t.querySelector('tbody > tr[data-lead-id]')) return;
      ensureProfileEyes(t);
      if (window.MutationObserver) {
        new MutationObserver(function () { ensureProfileEyes(t); })
          .observe(t.tBodies[0] || t, { childList: true, subtree: true });
      }
    });

    /* ---------- Table filters ------------------------------------------ *
     * One behaviour for every list page. A .crm-filter bar filters the
     * tables in its card (or those matched by data-filter-for), live, as
     * its controls change. Each control says what it tests:
     *   data-filter="col:Heading"  a cell under that heading (heading
     *       matched by how it starts; "A|B" tries both) — equal to the
     *       whole cell, one of its badges, or one line inside it; an
     *       option value starting "!" matches cells WITHOUT that value
     *   data-filter="attr:name"    the row's data-name attribute
     *   data-filter="from:Heading" / "to:Heading"  the cell's first
     *       "dd Mon yyyy" date, inclusive
     *   data-filter="text"         anywhere in the row
     * A control whose column a table lacks is ignored for that table, so
     * one bar can serve tabs with different columns. Rows are hidden with
     * .crm-filtered-out, never d-none, so tab and search scripts that use
     * d-none keep working on top. Runs after DataTables init (above). */
    var MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
    var fNorm = function (s) { return String(s || '').replace(/\s+/g, ' ').trim().toLowerCase(); };
    function cellDate(text) {
      var m = /(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})/.exec(text || '');
      var mon = m ? MONTHS[m[2].toLowerCase()] : undefined;
      return mon === undefined ? null : new Date(+m[3], mon, +m[1]);
    }
    function cellValues(td) {
      var vals = [fNorm(td.textContent)];
      [].forEach.call(td.childNodes, function (n) { vals.push(fNorm(n.textContent)); });
      [].forEach.call(td.querySelectorAll('.badge'), function (b) { vals.push(fNorm(b.textContent)); });
      return vals;
    }
    function colIndex(table, spec) {
      var ths = table.tHead && table.tHead.rows[0] ? table.tHead.rows[0].cells : [];
      var names = spec.toLowerCase().split('|');
      for (var i = 0; i < ths.length; i++) {
        var h = fNorm(ths[i].textContent);
        for (var j = 0; j < names.length; j++) if (h.indexOf(names[j]) === 0) return i;
      }
      return -1;
    }
    function rowPasses(bar, table, row) {
      var ctls = bar.querySelectorAll('[data-filter]');
      for (var c = 0; c < ctls.length; c++) {
        var v = (ctls[c].value || '').trim();
        if (!v) continue;
        var spec = ctls[c].getAttribute('data-filter');
        var kind = spec.split(':')[0], arg = spec.slice(kind.length + 1);
        if (kind === 'text') { if (fNorm(row.textContent).indexOf(fNorm(v)) === -1) return false; continue; }
        if (kind === 'attr') { if (fNorm(row.getAttribute('data-' + arg)) !== fNorm(v)) return false; continue; }
        var i = colIndex(table, arg);
        if (i < 0 || !row.cells[i]) continue;
        if (kind === 'col') {
          /* A leading "!" means "not this value" (e.g. Due remaining = not Completed). */
          var neg = v.charAt(0) === '!';
          var hit = cellValues(row.cells[i]).indexOf(fNorm(neg ? v.slice(1) : v)) !== -1;
          if (hit === neg) return false;
          continue;
        }
        var d = cellDate(row.cells[i].textContent);
        var limit = new Date(v + 'T00:00:00');
        if (!d || (kind === 'from' ? d < limit : d > limit)) return false;
      }
      return true;
    }
    function barTables(bar) {
      var sel = bar.getAttribute('data-filter-for');
      var scope = sel ? document : (bar.closest('.card') || document);
      return [].filter.call(scope.querySelectorAll(sel || 'table'), function (t) {
        return t.tHead && !t.parentElement.closest('table');
      });
    }
    var isDT = function (t) { return !!(window.jQuery && jQuery.fn.DataTable && jQuery.fn.DataTable.isDataTable(t)); };
    function filterEmptyNote(t, show) {
      var wrap = t.closest('.table-responsive') || t;
      var note = wrap.nextElementSibling;
      if (!note || !note.classList.contains('crm-filter-empty')) {
        if (!show) return;
        note = document.createElement('div');
        note.className = 'crm-filter-empty text-center text-muted fs-13 py-4';
        note.innerHTML = '<i class="mdi mdi-filter-remove-outline d-block fs-3 mb-1"></i>No records match these filters.';
        wrap.parentNode.insertBefore(note, wrap.nextSibling);
      }
      note.classList.toggle('d-none', !show);
    }
    function applyFilterBar(bar) {
      var active = [].some.call(bar.querySelectorAll('[data-filter]'), function (c) { return (c.value || '').trim(); });
      barTables(bar).forEach(function (t) {
        if (isDT(t)) { jQuery(t).DataTable().draw(); return; }  // DataTables shows its own empty row
        var shown = 0, hideDetail = false;
        [].forEach.call(t.tBodies, function (tb) {
          [].forEach.call(tb.rows, function (r) {
            /* A one-cell row is a ledger / expansion row: it follows its parent. */
            if (r.cells.length > 1) {
              hideDetail = !rowPasses(bar, t, r);
              if (!hideDetail) shown++;
            }
            r.classList.toggle('crm-filtered-out', hideDetail);
          });
        });
        filterEmptyNote(t, active && shown === 0);
      });
    }
    var filterBars = [].slice.call(document.querySelectorAll('.crm-filter'));
    if (filterBars.length && window.jQuery && jQuery.fn.dataTable) {
      jQuery.fn.dataTable.ext.search.push(function (settings, data, idx) {
        var bar = settings.nTable.crmFilterBar;
        var tr = settings.aoData[idx] && settings.aoData[idx].nTr;
        return !bar || !tr || rowPasses(bar, settings.nTable, tr);
      });
    }
    filterBars.forEach(function (bar) {
      barTables(bar).forEach(function (t) { t.crmFilterBar = bar; });
      bar.addEventListener('input', function () { applyFilterBar(bar); });
      bar.addEventListener('change', function () { applyFilterBar(bar); });
      var reset = bar.querySelector('[data-filter-reset]');
      if (reset) reset.addEventListener('click', function () {
        [].forEach.call(bar.querySelectorAll('[data-filter]'), function (c) { c.value = ''; });
        applyFilterBar(bar);
      });
    });

    /* ---------- Kanban pipeline (plan.md §7) -------------------------- */
    var cols = [].slice.call(document.querySelectorAll('.kanban-items'));
    if (cols.length && window.dragula) {
      dragula(cols).on('drop', function () { recountPipeline(); });
      recountPipeline();
    }

    function recountPipeline() {
      document.querySelectorAll('.kanban-col').forEach(function (col) {
        var cards = col.querySelectorAll('.kanban-card');
        var total = 0;
        cards.forEach(function (c) { total += parseInt(c.dataset.value || '0', 10); });
        var cEl = col.querySelector('[data-count]');
        var vEl = col.querySelector('[data-total]');
        if (cEl) cEl.textContent = cards.length;
        if (vEl) vEl.textContent = bdt(total);
      });
    }

    /* ---------- Charts ------------------------------------------------ */
    if (!window.ApexCharts) return;

    var base = {
      chart: { fontFamily: 'inherit', toolbar: { show: false }, animations: { enabled: false } },
      dataLabels: { enabled: false },
      grid: { borderColor: 'rgba(138,146,164,.18)', strokeDashArray: 3 },
      tooltip: { theme: document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'dark' : 'light' }
    };

    function mount(id, opts) {
      var el = document.querySelector(id);
      if (!el) return;
      new ApexCharts(el, opts).render();
    }

    /* Leads vs confirmed — dashboard */
    mount('#chart-lead-trend', Object.assign({}, base, {
      chart: Object.assign({}, base.chart, { type: 'area', height: 300 }),
      series: [
        { name: 'Leads', data: [42, 55, 48, 61, 74, 68, 82, 91] },
        { name: 'Confirmed', data: [11, 16, 14, 19, 24, 21, 27, 32] }
      ],
      colors: [BRAND.primary, BRAND.accent],
      stroke: { curve: 'smooth', width: 2.5 },
      fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.28, opacityTo: 0.02, stops: [0, 90] } },
      xaxis: { categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'] },
      yaxis: { labels: { formatter: function (v) { return Math.round(v); } } },
      legend: { position: 'top', horizontalAlign: 'right', markers: { radius: 3 } }
    }));

    /* My leads vs confirmed vs lost — user dashboard. Lost is drawn as a
       plain red line (not filled) so it reads as "the one to watch" rather
       than competing with the two filled area series for visual weight. */
    mount('#chart-my-leads-trend', Object.assign({}, base, {
      chart: Object.assign({}, base.chart, { type: 'line', height: 320 }),
      series: [
        { name: 'My Leads', type: 'area', data: [9, 12, 10, 14, 17, 15, 19, 22] },
        { name: 'Confirmed', type: 'area', data: [3, 4, 3, 5, 6, 5, 7, 8] },
        { name: 'Lost', type: 'line', data: [2, 3, 2, 3, 2, 4, 3, 3] }
      ],
      colors: [BRAND.primary, BRAND.accent, BRAND.danger],
      stroke: { curve: 'smooth', width: [2.5, 2.5, 2], dashArray: [0, 0, 4] },
      fill: { type: ['gradient', 'gradient', 'solid'], gradient: { shadeIntensity: 1, opacityFrom: 0.28, opacityTo: 0.02, stops: [0, 90] } },
      xaxis: { categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'] },
      yaxis: { labels: { formatter: function (v) { return Math.round(v); } } },
      legend: { position: 'top', horizontalAlign: 'right', markers: { radius: 3 } }
    }));

    /* Monthly target achievement — user dashboard */
    mount('#chart-my-target', Object.assign({}, base, {
      chart: Object.assign({}, base.chart, { type: 'radialBar', height: 200 }),
      series: [70],
      labels: ['Achieved'],
      colors: [BRAND.accent],
      plotOptions: {
        radialBar: {
          hollow: { size: '65%' },
          track: { background: 'rgba(138,146,164,.15)' },
          dataLabels: {
            name: { fontSize: '12px', color: BRAND.muted, offsetY: 18 },
            value: { fontSize: '24px', fontWeight: 700, offsetY: -12, formatter: function (v) { return v + '%'; } }
          }
        }
      }
    }));

    /* Source performance — dashboard + sources page */
    var sourceOpts = Object.assign({}, base, {
      chart: Object.assign({}, base.chart, { type: 'bar', height: 320 }),
      series: [
        { name: 'Leads', data: [64, 48, 39, 27, 22, 18] },
        { name: 'Confirmed', data: [22, 19, 11, 9, 6, 4] }
      ],
      colors: [BRAND.primary, BRAND.accent],
      plotOptions: { bar: { horizontal: true, borderRadius: 3, barHeight: '62%' } },
      xaxis: { categories: ['Facebook', 'Dr. Ilias Patowary', 'Noman', 'Website', 'Hospital', 'Walk-in'] },
      legend: { position: 'top', horizontalAlign: 'right', markers: { radius: 3 } }
    });
    mount('#chart-source', sourceOpts);
    mount('#chart-source-perf', sourceOpts);

    /* Collection vs due — dashboard */
    mount('#chart-collection', Object.assign({}, base, {
      chart: Object.assign({}, base.chart, { type: 'donut', height: 292 }),
      series: [4820000, 1960000],
      labels: ['Collected', 'Outstanding Due'],
      colors: [BRAND.accent, BRAND.warning],
      stroke: { width: 0 },
      legend: { position: 'bottom', markers: { radius: 3 } },
      plotOptions: {
        pie: {
          donut: {
            size: '72%',
            labels: {
              show: true,
              value: { formatter: function (v) { return bdt(v); }, fontSize: '17px', fontWeight: 700 },
              total: { show: true, label: 'Total Sales', formatter: function (w) { return bdt(w.globals.seriesTotals.reduce(function (a, b) { return a + b; }, 0)); } }
            }
          }
        }
      },
      tooltip: { y: { formatter: function (v) { return bdt(v); } } }
    }));

    /* Conversion funnel — reports */
    mount('#chart-funnel', Object.assign({}, base, {
      chart: Object.assign({}, base.chart, { type: 'bar', height: 330 }),
      series: [{ name: 'Leads', data: [412, 338, 264, 189, 126, 92, 78] }],
      colors: [BRAND.primary],
      plotOptions: { bar: { horizontal: true, borderRadius: 3, distributed: true, barHeight: '68%' } },
      xaxis: { categories: ['New', 'Contacted', 'Interested', 'Follow-up', 'Negotiation', 'Confirmed', 'Completed'] },
      legend: { show: false }
    }));

    /* Monthly collection — reports + dues */
    mount('#chart-collection-trend', Object.assign({}, base, {
      chart: Object.assign({}, base.chart, { type: 'bar', height: 300 }),
      series: [{ name: 'Collection', data: [380000, 520000, 445000, 610000, 720000, 665000, 810000, 940000] }],
      colors: [BRAND.accent],
      plotOptions: { bar: { borderRadius: 4, columnWidth: '46%' } },
      xaxis: { categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'] },
      yaxis: { labels: { formatter: function (v) { return bdt(v); } } },
      tooltip: { y: { formatter: function (v) { return bdt(v); } } }
    }));

    /* Executive performance — reports */
    mount('#chart-executive', Object.assign({}, base, {
      chart: Object.assign({}, base.chart, { type: 'bar', height: 300 }),
      series: [
        { name: 'Confirmed', data: [18, 14, 11, 9] },
        { name: 'Lost', data: [6, 9, 7, 12] }
      ],
      colors: [BRAND.accent, BRAND.danger],
      plotOptions: { bar: { borderRadius: 3, columnWidth: '48%' } },
      xaxis: { categories: ['Tanvir Ahmed', 'Nusrat Jahan', 'Sabbir Hossain', 'Farhana Akter'] },
      legend: { position: 'top', horizontalAlign: 'right', markers: { radius: 3 } }
    }));

    /* Due ageing — dues */
    mount('#chart-ageing', Object.assign({}, base, {
      chart: Object.assign({}, base.chart, { type: 'bar', height: 280 }),
      series: [{ name: 'Outstanding', data: [640000, 520000, 410000, 390000] }],
      colors: [BRAND.accent, BRAND.warning, '#f1734f', BRAND.danger],
      plotOptions: { bar: { borderRadius: 4, columnWidth: '46%', distributed: true } },
      xaxis: { categories: ['0-30 days', '31-60 days', '61-90 days', '90+ days'] },
      yaxis: { labels: { formatter: function (v) { return bdt(v); } } },
      tooltip: { y: { formatter: function (v) { return bdt(v); } } },
      legend: { show: false }
    }));
  });

  /* ---------- Sources: one source's leads ------------------------------ *
   * The eye/View button on a Source-wise Report row opens #sourceViewModal
   * with that source's leads: a compact chart (received vs applied vs
   * confirmed) and two columns — every lead, and the ones that applied for
   * a package. Static preview: the leads are generated from the row's
   * counts with a seed per source, so the same source always lists the
   * same people and the lists always add up to the table's numbers. In
   * the Laravel build these come from Lead::where('source', …). */
  document.addEventListener('DOMContentLoaded', function () {
    var modal = document.getElementById('sourceViewModal');
    if (!modal) return;
    var chart = null;
    var current = null;

    var FIRST = ['Ayesha', 'Karim', 'Nadia', 'Rafiq', 'Sumaiya', 'Jamal', 'Mim', 'Tanvir', 'Rokeya', 'Sajid', 'Halima', 'Nurul',
      'Farzana', 'Imran', 'Shirin', 'Habib', 'Taslima', 'Mahmud', 'Rehana', 'Sohel', 'Laila', 'Anwar', 'Jesmin', 'Kamrul'];
    var LAST = ['Akter', 'Hossain', 'Rahman', 'Islam', 'Begum', 'Uddin', 'Khatun', 'Ahmed', 'Mia', 'Sultana', 'Haque', 'Chowdhury'];
    var PACKAGES = ['Paid Package', 'Partial-Funded Package', 'Full-Funded Package'];
    var STATUS = {
      confirmed: ['Confirmed', 'success'], applied: ['Applied', 'warning'], interested: ['Interested', 'primary'],
      followup: ['Follow-up', 'info'], lost: ['Not Interested', 'secondary']
    };

    function seeded(str) {
      var h = 2166136261;
      for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
      return function () { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
    }
    function esc(v) {
      return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
    }

    /* Leads for one source, newest first. Statuses follow the row: applied
       includes confirmed, interested includes applied, the rest are
       not-interested or still in follow-up. */
    function leadsFor(row) {
      var d = row.dataset;
      var n = +d.leads, applied = +d.applied, confirmed = +d.confirmed, interested = +d.interested, lost = +d.lost;
      var rnd = seeded(d.source);
      var statuses = [];
      for (var i = 0; i < n; i++) {
        statuses.push(i < confirmed ? 'confirmed' : i < applied ? 'applied' : i < interested ? 'interested' : i < interested + lost ? 'lost' : 'followup');
      }
      for (var j = statuses.length - 1; j > 0; j--) { var k = Math.floor(rnd() * (j + 1)); var t = statuses[j]; statuses[j] = statuses[k]; statuses[k] = t; }
      var base = 100 + Math.floor(rnd() * 250);
      var list = statuses.map(function (st, idx) {
        var day = 31 - Math.floor(idx * 30 / n);
        var first = FIRST[Math.floor(rnd() * FIRST.length)], last = LAST[Math.floor(rnd() * LAST.length)];
        var gFirst = FIRST[Math.floor(rnd() * FIRST.length)];
        return {
          id: 'ELH-L-2026-' + String(base + n - idx).padStart(6, '0'),
          patient: first + ' ' + last, guardian: gFirst + ' ' + last,
          date: String(day).padStart(2, '0') + ' Aug 2026', status: st,
          pkg: PACKAGES[Math.floor(rnd() * PACKAGES.length)]
        };
      });
      /* Keep the demo's one real profile findable under its real source. */
      if (d.source === 'Hospital') {
        var c = list.filter(function (l) { return l.status === 'confirmed'; })[0];
        if (c) { c.id = 'ELH-L-2026-000406'; c.patient = 'Sharmin Akter'; c.guardian = 'Abul Kalam'; c.pkg = 'Paid Package'; }
      }
      return list;
    }

    function item(l, showPkg) {
      var s = STATUS[l.status];
      return '<a class="sv-item" href="patient-profile.html?lead=' + encodeURIComponent(l.id) + '">' +
        '<div class="min-w-0"><div class="fw-semibold fs-13 text-body">' + esc(l.patient) + '</div>' +
        '<div class="fs-12 text-muted"><span class="mono">' + esc(l.id) + '</span> &middot; G: ' + esc(l.guardian) + '</div></div>' +
        '<div class="text-end flex-shrink-0"><span class="badge bg-' + s[1] + '-subtle text-' + s[1] + '">' + s[0] + '</span>' +
        '<div class="fs-11 text-muted mt-1">' + (showPkg ? esc(l.pkg) + ' &middot; ' : '') + esc(l.date) + '</div></div></a>';
    }

    modal.addEventListener('show.bs.modal', function (ev) {
      var row = ev.relatedTarget ? ev.relatedTarget.closest('tr') : null;
      if (!row) return;
      current = row;
      var d = row.dataset;
      var leads = leadsFor(row);
      var applied = leads.filter(function (l) { return l.status === 'applied' || l.status === 'confirmed'; });
      var typeBadge = row.querySelector('td:nth-child(2) .badge');
      document.getElementById('sv-name').textContent = d.source;
      var type = document.getElementById('sv-type');
      type.className = typeBadge ? typeBadge.className + ' ms-1 align-middle' : 'badge';
      type.textContent = d.type;
      document.getElementById('sv-contact').textContent = 'Contact: ' + d.contact + (d.phone && d.phone !== '—' ? ' · ' + d.phone : '');
      document.getElementById('sv-leads').textContent = leads.length;
      document.getElementById('sv-applied').textContent = applied.length;
      document.getElementById('sv-rate').textContent = (leads.length ? (applied.length / leads.length * 100).toFixed(1) : '0') + '%';
      document.getElementById('sv-all-count').textContent = leads.length;
      document.getElementById('sv-applied-count').textContent = applied.length;
      document.getElementById('sv-all').innerHTML = leads.map(function (l) { return item(l, false); }).join('');
      document.getElementById('sv-applied-list').innerHTML = applied.map(function (l) { return item(l, true); }).join('') ||
        '<div class="fs-13 text-muted p-3">No lead from this source has applied yet.</div>';
      if (chart) { chart.destroy(); chart = null; }
      document.getElementById('sv-chart').innerHTML = '';
    });

    /* Drawn once the modal is visible, so the chart gets its real width. */
    modal.addEventListener('shown.bs.modal', function () {
      if (!current || typeof ApexCharts === 'undefined') return;
      var d = current.dataset;
      chart = new ApexCharts(document.getElementById('sv-chart'), {
        chart: { type: 'bar', height: 130, toolbar: { show: false }, fontFamily: 'inherit', sparkline: { enabled: false } },
        series: [{ name: 'Leads', data: [+d.leads, +d.applied, +d.confirmed] }],
        colors: [BRAND.primary, BRAND.accent, '#2f7d12'],
        plotOptions: { bar: { horizontal: true, distributed: true, borderRadius: 3, barHeight: '62%' } },
        dataLabels: { enabled: true, style: { fontSize: '11px' } },
        xaxis: { categories: ['Leads received', 'Applied', 'Confirmed'], labels: { show: false }, axisBorder: { show: false }, axisTicks: { show: false } },
        yaxis: { labels: { minWidth: 110, maxWidth: 140, style: { fontSize: '12px' } } },
        grid: { show: false, padding: { top: -10, bottom: -10, left: 8 } },
        legend: { show: false },
        tooltip: { enabled: false }
      });
      chart.render();
    });
  });

  /* ---------- Invoice sheet (shared) ------------------------------------ *
   * The one customer-facing invoice for the whole app — the Invoice page,
   * Patient Profile and the Payment module all render through here, so an
   * invoice looks the same wherever it is printed from. It is handed to the
   * patient's family after every payment, so it carries only what they
   * should see: no lead / package ids, no staff names, no dollar figures,
   * no list-vs-negotiated pricing — just the package amount, what has been
   * paid and what is left. `receipt` set = the invoice for that one payment
   * (paid-to-date up to and including it); unset = the whole package.
   *   CRMInvoice.render({ billTo: { guardian, patient, age, phone, address },
   *     pkg: { id, name, agreed, closed },
   *     payments: [{ date, type, method, receipt, amount }], receipt })
   * Other fields callers pass (leadId, listPrice, agreedUsd, appliedBy…)
   * are ignored on purpose. Company details, logo and the invoice number
   * format come from Settings (CRMSettings). */
  var INV_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function invToday() {
    var d = new Date();
    return String(d.getDate()).padStart(2, '0') + ' ' + INV_MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }
  function invParseDate(t) {
    var m = /(\d{1,2})\s+([A-Za-z]{3})\w*\s+(\d{4})/.exec(t || '');
    var i = m ? INV_MONTHS.indexOf(m[2].charAt(0).toUpperCase() + m[2].slice(1, 3).toLowerCase()) : -1;
    return i < 0 ? null : new Date(+m[3], i, +m[1]);
  }
  function invNum(v) { var n = parseFloat(v); return isFinite(n) && n > 0 ? n : 0; }
  function invEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* Amount in words, Bangladeshi style (crore / lakh / thousand). */
  var INV_ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven',
    'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  var INV_TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  function invBelow1000(n) {
    var out = [];
    if (n >= 100) { out.push(INV_ONES[Math.floor(n / 100)] + ' Hundred'); n %= 100; }
    if (n >= 20) { out.push(INV_TENS[Math.floor(n / 10)] + (n % 10 ? '-' + INV_ONES[n % 10] : '')); }
    else if (n) out.push(INV_ONES[n]);
    return out.join(' ');
  }
  function invWords(n) {
    n = Math.round(invNum(n));
    if (!n) return 'Taka Zero Only';
    var parts = [];
    var crore = Math.floor(n / 10000000); n %= 10000000;
    var lakh = Math.floor(n / 100000); n %= 100000;
    var thousand = Math.floor(n / 1000); n %= 1000;
    if (crore) parts.push(invWords(crore).replace(/^Taka | Only$/g, '') + ' Crore');
    if (lakh) parts.push(invBelow1000(lakh) + ' Lakh');
    if (thousand) parts.push(invBelow1000(thousand) + ' Thousand');
    if (n) parts.push(invBelow1000(n));
    return 'Taka ' + parts.join(' ') + ' Only';
  }

  window.CRMInvoice = {
    today: invToday,
    words: invWords,
    /* The sequence number is taken from the receipt / deal it belongs to
       (MR-000231 -> 231) and written in the Invoice No. format from
       Settings, dated by that payment when there is one. */
    number: function (pkgId, receipt, date) {
      var digits = String(receipt || pkgId || '').replace(/^.*[^0-9]/, '');
      return CRMSettings.formatId('invoice', parseInt(digits, 10) || 0, date);
    },
    render: function (o) {
      var taka = function (n) { return bdt(invNum(n)); };
      var p = o.pkg || {}, list = o.payments || [], b = o.billTo || {};
      var idx = -1;
      if (o.receipt) for (var i = 0; i < list.length; i++) if (list[i].receipt === o.receipt) idx = i;
      var single = idx >= 0;
      var total = invNum(p.agreed);
      var paidBefore = single ? list.slice(0, idx).reduce(function (t, x) { return t + invNum(x.amount); }, 0) : 0;
      var paidToDate = (single ? list.slice(0, idx + 1) : list).reduce(function (t, x) { return t + invNum(x.amount); }, 0);
      var balance = Math.max(total - paidToDate, 0);
      /* Only a settled invoice carries a stamp — no "Partially Paid" /
         "Unpaid" labels; the Balance Due line already says what is left. */
      var stamp = total > 0 && balance <= 0 ? '<span class="inv-status is-paid">Paid</span>' : '';

      var sumRow = function (label, value, cls) {
        return '<tr class="' + (cls || '') + '"><td>' + label + '</td><td class="text-end cur">' + value + '</td></tr>';
      };
      var summary =
        sumRow('Package Amount', taka(total)) +
        (single ? sumRow('Previously Paid', taka(paidBefore)) +
          sumRow('This Payment' + (list[idx].method ? ' <span class="inv-sub">(' + invEsc(list[idx].method) + ')</span>' : ''), taka(list[idx].amount), 'inv-this') : '') +
        sumRow('Total Paid', taka(paidToDate)) +
        sumRow('Balance Due', taka(balance), 'inv-balance');

      /* Label / value lines; a value the caller didn't pass is left out. */
      var field = function (label, value, mono) {
        return value ? '<div class="inv-field"><span>' + label + '</span><span' + (mono ? ' class="mono"' : '') + '>' + invEsc(value) + '</span></div>' : '';
      };

      var C = CRMSettings.company();
      return '' +
        '<div class="crm-invoice">' +
          '<div class="inv-head">' +
            '<div class="inv-brand"><img src="' + invEsc(CRMSettings.logo()) + '" alt="' + invEsc(C.name) + '" class="inv-logo">' +
              '<div class="inv-company"><div class="inv-company-name">' + invEsc(C.name) + '</div><div>' + invEsc(C.address) + '</div><div>' + invEsc(C.phone) + ' &middot; ' + invEsc(C.email) + '</div></div></div>' +
            '<div class="inv-title"><div class="inv-word">Invoice</div>' +
              '<table class="inv-meta"><tr><td>Invoice No.</td><td class="mono">' + this.number(p.id, single ? o.receipt : '', single ? invParseDate(list[idx].date) : null) + '</td></tr>' +
              '<tr><td>Date</td><td>' + (single ? invEsc(list[idx].date) : invToday()) + '</td></tr>' +
              (single ? '<tr><td>Receipt No.</td><td class="mono">' + invEsc(o.receipt) + '</td></tr>' : '') +
              '</table>' + stamp + '</div>' +
          '</div>' +

          '<div class="inv-parties">' +
            '<div><div class="inv-label">Bill To</div><div class="inv-name">' + invEsc(b.guardian) + '</div>' +
              field('Phone', b.phone) + field('Address', b.address) + '</div>' +
            '<div><div class="inv-label">Patient</div><div class="inv-name">' + invEsc(b.patient) + '</div>' +
              field('Age', b.age) + field('Lead ID', o.leadId, true) + field('Package', p.name) + '</div>' +
          '</div>' +

          '<table class="inv-items"><thead><tr><th style="width:40px">#</th><th>Description</th><th class="text-end">Amount</th></tr></thead>' +
            '<tbody><tr><td>1</td><td><div class="fw-semibold">' + invEsc(p.name) + '</div><div class="inv-sub">Treatment package for ' + invEsc(b.patient) + '</div></td>' +
            '<td class="text-end cur">' + taka(total) + '</td></tr></tbody></table>' +

          '<div class="inv-bottom">' +
            '<div class="inv-words">' + (single
              ? '<div class="inv-label">Amount Received in Words</div><div>' + invWords(list[idx].amount) + '</div>'
              : balance > 0
                ? '<div class="inv-label">Balance Due in Words</div><div>' + invWords(balance) + '</div>'
                : '<div class="inv-label">Amount Paid in Words</div><div>' + invWords(paidToDate) + '</div>') + '</div>' +
            '<table class="inv-summary">' + summary + '</table>' +
          '</div>' +

          '<div class="inv-foot">' +
            '<div class="inv-terms"><div class="inv-thanks">Thank you for choosing ' + C.name + '.</div>' +
              '<div>' + (balance > 0 ? 'Please clear the remaining balance before the treatment date. ' : '') +
              'This is a computer-generated invoice.</div></div>' +
            '<div class="inv-sign"><div class="inv-sign-line"></div><div>Authorised Signature</div></div>' +
          '</div>' +
        '</div>';
    }
  };

  /* ---------- Printable sheet (Ticket and Visa quick views) ----------- *
   * The lead registration form's paper layout (.lead-form-sheet) for any
   * record: letterhead from Settings, a title, meta line and sections.
   *   CRMSheet.render(el, { title, meta: [[label, value]], sections: [
   *     { title, rows: [[label, value]] }  — values are text ('' → —)
   *     { title, html }                   — ready-made markup
   *   ] })  */
  function shEsc(v) { return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  window.CRMSheet = {
    render: function (el, o) {
      el.innerHTML =
        '<div class="lf-logo"><img src="assets/logo.png" data-company-logo alt=""></div>' +
        '<div class="lf-title" data-company="name" data-company-case="upper"></div>' +
        '<div class="lf-contact" data-company="contact"></div>' +
        '<div class="lf-sub">' + shEsc(o.title) + '</div>' +
        '<div class="lf-meta">' + (o.meta || []).map(function (m) { return '<span>' + shEsc(m[0]) + ': <strong>' + shEsc(m[1]) + '</strong></span>'; }).join('') +
        '<span>Printed: ' + shEsc(new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })) + '</span></div>' +
        (o.sections || []).map(function (sec) {
          return '<div class="lf-section">' + shEsc(sec.title) + '</div>' + (sec.html != null ? sec.html :
            sec.rows.map(function (r) { return '<div class="lf-row"><div class="lf-label">' + shEsc(r[0]) + '</div><div class="lf-value">' + (r[1] === '' || r[1] == null ? '&mdash;' : shEsc(r[1])) + '</div></div>'; }).join(''));
        }).join('');
      if (window.CRMSettings && CRMSettings.applyToPage) CRMSettings.applyToPage(el);
    }
  };

  /* ---------- Treatment days (ticket start → ticket end) -------------- *
   * How long a patient has been / was abroad for treatment, counted from
   * the departure ticket to the return ticket. While the patient is still
   * away (no return, or the return is in the future) it counts up to
   * today. `tickets` holds the sample dates for patients that pages
   * without their own ticket data (Countdown, Profile, Quick View,
   * Patient Expense) look up; Visa & Travel and Treatment carry the same
   * dates on their rows. */
  var TDAY = 86400000;
  function tDate(s) { var p = String(s || '').split('-'); return p.length === 3 ? new Date(+p[0], +p[1] - 1, +p[2]) : null; }
  function tToday() { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function tPretty(d) { return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
  function tPlural(n) { return n + (n === 1 ? ' day' : ' days'); }
  window.CRMTravel = {
    tickets: {
      'ELH-L-2026-000395': ['2026-08-10', ''],
      'ELH-L-2026-000389': ['2026-09-15', '2026-10-20'],
      'ELH-L-2026-000383': ['2026-09-20', ''],
      'ELH-L-2026-000380': ['2026-07-05', '2026-08-18'],
      'ELH-L-2026-000377': ['2026-06-02', '2026-08-07'],
      'ELH-L-2026-000372': ['2026-06-10', '2026-06-30']
    },
    /* { days, done, start, end, planned } or null before departure.
       `returned` forces done (the patient is back even if no date moved). */
    days: function (start, end, returned) {
      var a = tDate(start);
      if (!a) return null;
      var b = tDate(end), t = tToday();
      var done = !!b && (returned || b <= t);
      var upto = done ? b : t;
      return { days: Math.max(0, Math.round((upto - a) / TDAY)), done: done, start: a, end: b, planned: b && !done ? Math.round((b - a) / TDAY) : null };
    },
    /* The "Treatment Days" cell: a badge plus the date span (`brief` drops
       the span where the dates already have their own columns). */
    cell: function (start, end, returned, brief) {
      var d = this.days(start, end, returned);
      if (!d) return '<span class="text-muted">&mdash;</span>';
      return '<span class="badge ' + (d.done ? 'bg-secondary-subtle text-secondary' : 'bg-primary-subtle text-primary') + ' fs-12">' + tPlural(d.days) + (d.done ? '' : ' so far') + '</span>' + (brief ? (d.planned ? '<div class="fs-11 text-muted mt-1">' + tPlural(d.planned) + ' planned</div>' : '') :
        '<div class="fs-11 text-muted mt-1">' + tPretty(d.start) + ' &rarr; ' + (d.done ? tPretty(d.end) : d.end ? 'return ' + tPretty(d.end) + ' (' + tPlural(d.planned) + ' planned)' : 'no return yet') + '</div>');
    },
    /* One line of text, for headers and summaries. */
    text: function (start, end, returned) {
      var d = this.days(start, end, returned);
      if (!d) return 'Not travelled yet';
      return 'Treatment ' + tPretty(d.start) + ' – ' + (d.done ? tPretty(d.end) + ' · ' + tPlural(d.days) : (d.end ? 'return ' + tPretty(d.end) : 'ongoing') + ' · ' + tPlural(d.days) + ' so far');
    },
    forLead: function (id) { var t = this.tickets[id]; return t ? { start: t[0], end: t[1] } : null; }
  };

  /* Any block marked data-travel-lead="<lead id>" (Patient Profile) fills
     its .js-ticket-start / -end / -days from the lead's tickets. */
  document.addEventListener('DOMContentLoaded', function () {
    [].forEach.call(document.querySelectorAll('[data-travel-lead]'), function (box) {
      var t = window.CRMTravel.forLead(box.getAttribute('data-travel-lead'));
      var d = t && window.CRMTravel.days(t.start, t.end);
      var set = function (sel, html) { var el = box.querySelector(sel); if (el) el.innerHTML = html; };
      set('.js-ticket-start', d ? tPretty(d.start) : 'Not travelled yet');
      set('.js-ticket-end', d && d.end ? tPretty(d.end) : '<span class="text-muted">Not booked</span>');
      set('.js-ticket-days', d ? tPlural(d.days) + (d.done ? '' : ' so far') : '&mdash;');
    });
  });

  /* Quick View: add the treatment line under the journey for any lead
     with a ticket. */
  document.addEventListener('show.bs.modal', function (ev) {
    if (!ev.target || ev.target.id !== 'quickViewModal') return;
    var slot = document.getElementById('qv-treatment');
    if (!slot) return;
    var id = ev.relatedTarget && ev.relatedTarget.getAttribute('data-lead-id');
    var t = id && window.CRMTravel.forLead(id);
    slot.classList.toggle('d-none', !t);
    if (t) slot.innerHTML = '<i class="mdi mdi-calendar-clock me-1 text-muted"></i>' + window.CRMTravel.text(t.start, t.end);
  });
})();
