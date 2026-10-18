/**
 * E Life Healthcare CRM — Treatment Countdown.
 *
 * After a lead applies for a package, the patient must reach the treatment
 * country within 3 months (90 days) of the applied date. This page shows,
 * for every applied lead, the days passed and days left, colour-coded by
 * the month the lead is in:
 *
 *   month 1  green  — on track
 *   month 2  yellow — attention
 *   month 3  red    — urgent (past 90 days: overdue)
 *   reached  blue   — the patient has reached the destination for treatment
 *
 * "Reached" is confirmed by hand (not when a ticket is bought) and moves the
 * lead to the Reached tab. Static preview: sample applied dates are given as
 * "days ago" so every colour shows whenever the demo is opened; a reached
 * confirmation is kept in localStorage (clear site data to reset).
 */
(function () {
  'use strict';

  var WINDOW_DAYS = 90, MONTH = 30;
  var KEY = 'crm_reached';
  var SEED = { 'ELH-L-2026-000395': '2026-08-10', 'ELH-L-2026-000380': '2026-07-05' };
  var DAY = 86400000;

  function read() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
  function write(m) { try { localStorage.setItem(KEY, JSON.stringify(m)); } catch (e) { /* demo only */ } }
  function reachedOn(id) { var m = read(); return m[id] || SEED[id] || ''; }

  function startOfToday() { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function iso(d) {
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function parse(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function pretty(d) { return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }

  /* Colour band for a lead that has not reached yet. */
  function band(passed) {
    if (passed >= WINDOW_DAYS) return { key: 'overdue', tone: 'danger', label: 'Overdue' };
    if (passed >= 2 * MONTH) return { key: 'urgent', tone: 'danger', label: 'Urgent' };
    if (passed >= MONTH) return { key: 'attention', tone: 'warning', label: 'Attention' };
    return { key: 'ontrack', tone: 'success', label: 'On Track' };
  }

  /* Treatment days from the tickets (crm-demo.js); a lead marked reached
     here without a ticket on file counts from the reached date. */
  function treatment(id, reached) {
    if (!window.CRMTravel) return '';
    var t = CRMTravel.forLead(id) || { start: reached, end: '' };
    return CRMTravel.text(t.start, t.end);
  }

  function syncBadge(n) {
    var b = document.querySelector('#side-menu a[href="treatment-countdown.html"] .badge');
    if (b) { b.textContent = n; b.classList.toggle('d-none', !n); }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var table = document.getElementById('tc-table');
    if (!table) return;
    var tabs = document.getElementById('tc-tabs');
    var search = document.getElementById('tc-search');
    var empty = document.getElementById('tc-empty');
    var tab = 'active';
    var today = startOfToday();
    var rows = [].slice.call(table.querySelectorAll('tbody tr[data-lead-id]'));

    /* Applied date = today minus the sample offset. */
    rows.forEach(function (r) {
      var applied = new Date(today.getTime() - Number(r.dataset.daysAgo) * DAY);
      r.dataset.applied = iso(applied);
    });

    function info(r) {
      var applied = parse(r.dataset.applied);
      var deadline = new Date(applied.getTime() + WINDOW_DAYS * DAY);
      var passed = Math.round((today - applied) / DAY);
      var reached = reachedOn(r.dataset.leadId);
      return { applied: applied, deadline: deadline, passed: passed, left: WINDOW_DAYS - passed, reached: reached, band: reached ? null : band(passed) };
    }

    function render(r) {
      var i = info(r);
      var tone = i.reached ? 'info' : i.band.tone;
      r.querySelector('.tc-applied').innerHTML = esc(pretty(i.applied));
      var pct = Math.min(100, Math.round(i.passed / WINDOW_DAYS * 100));
      var leftTxt = i.reached ? 'Reached' : (i.left >= 0 ? i.left + ' days left' : 'Overdue by ' + (-i.left) + ' days');
      r.querySelector('.tc-time').innerHTML =
        '<div class="d-flex justify-content-between fs-12 mb-1"><span>' + i.passed + ' days passed</span><span class="fw-semibold text-' + tone + '">' + leftTxt + '</span></div>' +
        '<div class="progress" style="height:6px;min-width:150px;"><div class="progress-bar bg-' + tone + '" style="width:' + (i.reached ? 100 : pct) + '%"></div></div>' +
        '<div class="fs-11 text-muted mt-1">' + (i.reached ? 'Reached on ' + esc(pretty(parse(i.reached))) : 'Deadline ' + esc(pretty(i.deadline))) + '</div>' +
        (i.reached ? '<div class="fs-12 mt-1"><i class="mdi mdi-calendar-clock me-1 text-muted"></i>' + esc(treatment(r.dataset.leadId, i.reached)) + '</div>' : '');
      r.querySelector('.tc-status').innerHTML = i.reached
        ? '<span class="badge bg-info-subtle text-info">Reached Destination</span>'
        : '<span class="badge bg-' + tone + '-subtle text-' + tone + '">' + i.band.label + '</span>';
      r.querySelector('.tc-action').innerHTML =
        (i.reached ? '' : '<button type="button" class="btn btn-sm btn-info me-1" data-act="reached"><i class="mdi mdi-map-marker-check-outline me-1"></i>Mark Reached</button>') +
        '<a href="conversations.html?lead=' + encodeURIComponent(r.dataset.leadId) + '" class="btn btn-sm btn-icon btn-light" title="Conversation log"><i class="mdi mdi-comment-text-outline"></i></a>';
      r.dataset.group = i.reached ? 'reached' : i.band.key;
    }

    function refresh() {
      var q = search ? search.value.trim().toLowerCase() : '';
      var n = { ontrack: 0, attention: 0, urgent: 0, overdue: 0, reached: 0 }, shown = 0;
      rows.forEach(function (r) { n[r.dataset.group]++; });
      rows.forEach(function (r) {
        var g = r.dataset.group;
        var inTab = tab === 'active' ? g !== 'reached'
          : tab === 'urgent' ? (g === 'urgent' || g === 'overdue') : g === tab;
        var hit = inTab && (!q || r.textContent.toLowerCase().indexOf(q) !== -1);
        r.classList.toggle('d-none', !hit);
        if (hit) shown++;
      });
      var urgent = n.urgent + n.overdue;
      var set = function (id, v) { var el = document.getElementById(id); if (el) el.textContent = v; };
      set('tc-n-ontrack', n.ontrack); set('tc-n-attention', n.attention); set('tc-n-urgent', urgent); set('tc-n-reached', n.reached);
      set('tc-t-active', rows.length - n.reached); set('tc-t-ontrack', n.ontrack); set('tc-t-attention', n.attention);
      set('tc-t-urgent', urgent); set('tc-t-reached', n.reached);
      if (empty) empty.classList.toggle('d-none', shown !== 0);
      syncBadge(urgent);
    }

    tabs.addEventListener('click', function (e) {
      var a = e.target.closest('[data-tab]');
      if (!a) return;
      e.preventDefault();
      tab = a.dataset.tab;
      [].slice.call(tabs.querySelectorAll('.nav-link')).forEach(function (l) { l.classList.toggle('active', l === a); });
      refresh();
    });
    if (search) search.addEventListener('input', refresh);

    table.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-act="reached"]');
      if (!btn) return;
      var row = btn.closest('tr');
      var go = function (date) {
        var m = read(); m[row.dataset.leadId] = date; write(m);
        render(row); refresh();
        if (window.Swal) Swal.fire({ icon: 'success', title: 'Marked as reached', text: row.dataset.patient + ' has reached the destination and moved to the Reached tab.', confirmButtonColor: '#024766' });
      };
      var t = iso(today);
      if (!window.Swal) { go(t); return; }
      Swal.fire({
        icon: 'question', title: 'Has the patient reached the destination?',
        html: 'Confirm that <b>' + esc(row.dataset.patient) + '</b> has arrived for treatment.' +
          '<div class="text-start mt-3"><label class="form-label fs-13" for="tc-date">Date reached</label>' +
          '<input type="date" id="tc-date" class="form-control" value="' + t + '" max="' + t + '"></div>',
        showCancelButton: true, confirmButtonText: 'Yes, reached', confirmButtonColor: '#024766',
        preConfirm: function () {
          var v = document.getElementById('tc-date').value;
          if (!v) { Swal.showValidationMessage('Please choose the date the patient reached.'); return false; }
          return v;
        }
      }).then(function (r) { if (r.isConfirmed) go(r.value); });
    });

    rows.forEach(render);
    refresh();
  });
})();
