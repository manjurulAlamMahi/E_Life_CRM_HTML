/**
 * E Life Healthcare CRM — Ticket module (step 03, after the visa is approved).
 *
 *   Not Purchased ── (Purchase Ticket) ──► Upcoming Flight ──(flight date passes)──► Flight Passed
 *        ▲                                   │  ▲ Reschedule                              │
 *        │                                   ▼  │                                        ▼
 *        └────────── (Re-book) ────────── Cancelled ◄──── (Cancel) ─────────── (Mark Reached)
 *                                                                               → Treatment Ongoing
 *
 * A purchased ticket is Upcoming or Flight Passed purely by its flight date
 * against today; Flight Passed means nobody has marked the patient reached.
 * Every change (purchase, reschedule, cancel, re-book, reached) is kept in
 * the ticket's history, which the quick view and printout show. Only the
 * departure ticket lives here — the return ticket is recorded on Treatment.
 * Static preview: sample dates are relative to today and changes last until
 * the page is reloaded.
 */
(function () {
  'use strict';

  var DAY = 86400000;
  var USER = 'Mahi Alam';
  var GROUPS = {
    pending:   { label: 'Not Purchased',   badge: 'bg-warning-subtle text-warning', hint: 'Visa approved, ticket not bought yet. Purchase the ticket once the family confirms the travel date.' },
    upcoming:  { label: 'Upcoming Flight', badge: 'bg-primary-subtle text-primary', hint: 'Ticket bought, flight date still ahead. Reschedule if the flight is delayed or moved; cancel if the patient will not travel.' },
    passed:    { label: 'Flight Passed',   badge: 'bg-danger-subtle text-danger',   hint: 'The flight date has passed but the patient is not marked reached yet. Mark Reached, reschedule, or cancel.' },
    cancelled: { label: 'Cancelled',       badge: 'bg-secondary-subtle text-secondary', hint: 'Ticket cancelled, the patient did not travel. Re-book if they decide to go.' },
    reached:   { label: 'Reached Destination', badge: 'bg-info-subtle text-info', hint: '' },
    all:       { label: 'All', hint: 'Every patient in the Ticket module, whatever the ticket status.' }
  };
  var CANCEL_REASONS = ['Family changed their mind', "Patient's health changed", 'Financial reasons', 'Visa problem', 'Treatment no longer needed', 'Other'];

  function today() { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function parse(s) { var p = String(s || '').split('-'); return p.length === 3 ? new Date(+p[0], +p[1] - 1, +p[2]) : null; }
  function rel(n) { return iso(new Date(today().getTime() + n * DAY)); }
  function pretty(s) { var d = parse(s); return d ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''; }
  function diff(s) { return Math.round((parse(s) - today()) / DAY); }
  function days(n) { return n + (n === 1 ? ' day' : ' days'); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function $(id) { return document.getElementById(id); }
  function toast(msg) { if (window.Swal) Swal.fire({ icon: 'success', title: 'Saved', text: msg, confirmButtonColor: '#024766' }); }

  /* Sample patients. Offsets are days from today (negative = past). */
  function seed() {
    function p(id, patient, guardian, phone, country, approvedAgo, stage, t, history) {
      var r = { id: id, patient: patient, guardian: guardian, phone: phone, country: country, visaType: 'Medical Visa', visaApproved: rel(-approvedAgo), visaValid: rel(-approvedAgo + 180), stage: stage, t: t || null, history: history || [] };
      r.history.unshift({ date: r.visaApproved, text: 'Visa approved — waiting for a ticket', by: 'Visa module' });
      return r;
    }
    function t(inDays, time, flight, route, pnr, pax, boughtAgo) { return { date: rel(inDays), time: time, flight: flight, route: route, pnr: pnr, pax: pax, bought: rel(-boughtAgo) }; }
    return [
      p('ELH-L-2026-000398', 'Rokeya Begum', 'Anwar Hossain', '+880 1633-447788', 'India', 9, 'pending'),
      p('ELH-L-2026-000410', 'Nadia Sultana', 'Sultana Begum', '+880 1911-778899', 'India', 4, 'pending'),
      p('ELH-L-2026-000405', 'Jamal Uddin', 'Jamal Uddin', '+880 1745-330011', 'Thailand', 16, 'pending'),
      p('ELH-L-2026-000412', 'Ayesha Rahim', 'Rahim Uddin', '+880 1711-234567', 'India', 12, 'booked',
        t(6, '10:40', 'Biman BG-2021', 'Dhaka to Chennai', 'PNR 8QW2ZK', 'Patient + 1 attendant', 5),
        [{ date: rel(-5), text: 'Ticket purchased — flight ' + pretty(rel(6)), by: USER }]),
      p('ELH-L-2026-000408', 'Mim Akter', 'Jahanara Khatun', '+880 1677-112233', 'India', 20, 'booked',
        t(13, '14:15', 'US-Bangla BS-217', 'Dhaka to Kolkata', 'PNR 3LM7TR', 'Patient + 2 attendants', 14),
        [{ date: rel(-14), text: 'Ticket purchased — flight ' + pretty(rel(4)), by: USER },
         { date: rel(-3), text: 'Rescheduled ' + pretty(rel(4)) + ' → ' + pretty(rel(13)) + ' · Rescheduled by the hospital (admission date moved)', by: USER }]),
      p('ELH-L-2026-000411', 'Karim Mia', 'Karim Mia', '+880 1812-445566', 'India', 25, 'booked',
        t(-2, '09:05', 'IndiGo 6E-1116', 'Dhaka to Kolkata', 'PNR 6TY4PL', 'Patient + 1 attendant', 15),
        [{ date: rel(-15), text: 'Ticket purchased — flight ' + pretty(rel(-2)), by: USER }]),
      p('ELH-L-2026-000386', 'Tanjila Akter', 'Rafiqul Islam', '+880 1712-903344', 'India', 30, 'booked',
        t(-5, '18:30', 'Biman BG-2023', 'Dhaka to Kolkata', 'PNR 2KD9WQ', 'Patient + 1 attendant', 21),
        [{ date: rel(-21), text: 'Ticket purchased — flight ' + pretty(rel(-5)), by: USER }]),
      (function () {
        var r = p('ELH-L-2026-000393', 'Rashida Khatun', 'Mofizul Haque', '+880 1556-208811', 'India', 40, 'cancelled',
          t(8, '11:00', 'Biman BG-2021', 'Dhaka to Chennai', 'PNR 9ZX1AB', 'Patient + 1 attendant', 28),
          [{ date: rel(-28), text: 'Ticket purchased — flight ' + pretty(rel(8)), by: USER },
           { date: rel(-6), text: 'Cancelled · Family changed their mind — want to try treatment in Dhaka first', by: USER }]);
        r.cancel = { reason: 'Family changed their mind', note: 'Want to try treatment in Dhaka first', date: rel(-6) };
        return r;
      })()
    ];
  }

  /* Which list a patient is in right now. */
  function group(r) {
    if (r.stage !== 'booked') return r.stage;
    return diff(r.t.date) >= 0 ? 'upcoming' : 'passed';
  }

  /* Same store as Treatment Countdown (crm-countdown.js). */
  var REACHED_KEY = 'crm_reached';
  function readReached() { try { return JSON.parse(localStorage.getItem(REACHED_KEY) || '{}') || {}; } catch (e) { return {}; } }
  function saveReached(id, date) { var m = readReached(); m[id] = date; try { localStorage.setItem(REACHED_KEY, JSON.stringify(m)); } catch (e) { /* demo only */ } }

  function syncBadge(n) {
    var b = document.querySelector('#side-menu a[href="tickets.html?stage=passed"] .badge');
    if (b) { b.textContent = n; b.classList.toggle('d-none', !n); }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var table = $('tk-table');
    if (!table) return;
    var tbody = table.querySelector('tbody');
    var rows = seed();
    /* already marked reached on Treatment Countdown */
    var known = readReached();
    rows.forEach(function (r) { if (r.stage === 'booked' && known[r.id]) { r.stage = 'reached'; r.reached = known[r.id]; } });
    var params = new URLSearchParams(location.search);
    var active = GROUPS[params.get('stage')] && params.get('stage') !== 'reached' ? params.get('stage') : 'pending';
    var current = null, formMode = 'purchase';

    function find(id) { return rows.filter(function (r) { return r.id === id; })[0]; }
    function log(r, text) { r.history.push({ date: iso(today()), text: text, by: USER }); }

    /* ---------- table ---------- */
    function flightCell(r, g) {
      if (g === 'pending') {
        var waited = -diff(r.visaApproved);
        return '<div class="fs-13 text-muted">Not purchased</div><div class="fs-11 ' + (waited > 14 ? 'text-danger' : 'text-muted') + '">Waiting ' + days(waited) + ' since visa approval</div>';
      }
      var t = r.t, n = diff(t.date);
      var when = g === 'upcoming' ? (n === 0 ? '<span class="text-primary fw-semibold">Flying today</span>' : 'in ' + days(n))
        : g === 'passed' ? '<span class="text-danger fw-semibold">' + days(-n) + ' ago — not updated</span>'
        : g === 'cancelled' ? '<span class="text-muted">Cancelled ' + esc(pretty(r.cancel.date)) + '</span>'
        : '<span class="text-info">Reached ' + esc(pretty(r.reached)) + '</span>';
      return '<div class="fs-13 fw-semibold' + (g === 'cancelled' ? ' text-decoration-line-through text-muted' : '') + '">' + esc(pretty(t.date)) + (t.time ? ' · ' + esc(t.time) : '') + '</div>' +
        '<div class="fs-12">' + esc(t.flight) + (t.route ? ' · ' + esc(t.route) : '') + '</div>' +
        '<div class="fs-11 text-muted">' + (t.pnr ? esc(t.pnr) + ' · ' : '') + when + '</div>';
    }
    function btn(act, cls, icon, label) { return '<button type="button" class="btn btn-sm ' + cls + '" data-act="' + act + '"><i class="mdi ' + icon + ' me-1"></i>' + label + '</button>'; }
    function actionsCell(r, g) {
      var main = [];
      if (g === 'pending') main.push(btn('purchase', 'btn-primary', 'mdi-ticket-confirmation-outline', 'Purchase Ticket'));
      if (g === 'upcoming' || g === 'passed') {
        if (diff(r.t.date) <= 0) main.push(btn('reached', 'btn-info', 'mdi-map-marker-check-outline', 'Mark Reached'));
        main.push(btn('edit', 'btn-label-primary', 'mdi-calendar-edit', 'Reschedule / Edit'));
        main.push(btn('cancel', 'btn-label-danger', 'mdi-close-circle-outline', 'Cancel'));
      }
      if (g === 'cancelled') main.push(btn('rebook', 'btn-label-primary', 'mdi-refresh', 'Re-book Ticket'));
      if (g === 'reached') main.push('<a href="treatment.html" class="btn btn-sm btn-label-success"><i class="mdi mdi-heart-pulse me-1"></i>Treatment Ongoing</a>');
      return '<div class="d-flex flex-wrap gap-1 mb-1">' + main.join('') + '</div>' +
        '<div class="d-flex gap-1">' +
          '<button type="button" class="btn btn-sm btn-icon btn-light" data-act="view" title="Quick view"><i class="mdi mdi-eye-outline"></i></button>' +
          '<button type="button" class="btn btn-sm btn-icon btn-light" data-act="print" title="Print"><i class="mdi mdi-printer"></i></button>' +
          '<a href="conversations.html?lead=' + encodeURIComponent(r.id) + '" class="btn btn-sm btn-icon btn-light" title="Conversation log"><i class="mdi mdi-comment-text-outline"></i></a>' +
        '</div>';
    }

    function render() {
      var q = $('tk-search').value.trim().toLowerCase(), counts = { all: rows.length }, list = [];
      rows.forEach(function (r) {
        var g = group(r);
        counts[g] = (counts[g] || 0) + 1;
        if (active !== 'all' && g !== active) return;
        if (q && [r.id, r.patient, r.guardian, r.phone, r.t && r.t.flight, r.t && r.t.pnr].join(' ').toLowerCase().indexOf(q) === -1) return;
        list.push(r);
      });
      /* soonest flight first; waiting longest first */
      list.sort(function (a, b) { return (a.t ? a.t.date : a.visaApproved) < (b.t ? b.t.date : b.visaApproved) ? -1 : 1; });
      tbody.innerHTML = list.map(function (r) {
        var g = group(r), cancelled = g === 'cancelled' ? '<div class="fs-11 text-muted mt-1">' + esc(r.cancel.reason) + '</div>' : '';
        return '<tr data-id="' + r.id + '"><td class="mono fs-12">' + r.id + '</td>' +
          '<td><div class="fw-semibold">' + esc(r.patient) + '</div><div class="fs-12 text-muted">G: ' + esc(r.guardian) + '</div><div class="fs-11 text-muted">' + esc(r.phone) + '</div></td>' +
          '<td class="fs-13">' + esc(r.country) + '<div class="fs-12 text-muted">Approved ' + esc(pretty(r.visaApproved)) + '</div></td>' +
          '<td>' + flightCell(r, g) + '</td>' +
          '<td><span class="badge ' + GROUPS[g].badge + '">' + GROUPS[g].label + '</span>' + cancelled + '</td>' +
          '<td>' + actionsCell(r, g) + '</td></tr>';
      }).join('');
      $('tk-empty').classList.toggle('d-none', list.length !== 0);
      [].forEach.call(document.querySelectorAll('[data-count]'), function (el) { el.textContent = counts[el.dataset.count] || 0; });
      [].forEach.call($('tk-tabs').querySelectorAll('.nav-link'), function (a) { a.classList.toggle('active', a.dataset.stage === active); });
      $('tk-hint').textContent = GROUPS[active].hint;
      syncBadge(counts.passed || 0);
      highlightSidebar();
    }

    function highlightSidebar() {
      var want = 'tickets.html' + (active === 'pending' ? '' : '?stage=' + active);
      [].forEach.call(document.querySelectorAll('#sidebar-menu a[href]:not(.has-arrow)'), function (a) {
        var href = a.getAttribute('href') || '';
        if (href.indexOf('tickets.html') !== 0) return;
        a.classList.toggle('active', href === want);
        a.parentNode.classList.toggle('mm-active', href === want);
      });
    }

    /* ---------- purchase / reschedule / re-book form ---------- */
    function openForm(r, mode) {
      current = r; formMode = mode;
      var t = mode === 'edit' ? r.t : null;
      $('tkf-title').textContent = mode === 'edit' ? 'Reschedule / Edit Ticket' : mode === 'rebook' ? 'Re-book Ticket' : 'Purchase Ticket';
      $('tkf-sub').textContent = r.patient + ' · ' + r.id + ' · ' + r.country;
      $('tkf-date').value = t ? t.date : '';
      $('tkf-date').min = mode === 'edit' ? '' : iso(today());
      $('tkf-time').value = t ? t.time : '';
      $('tkf-flight').value = t ? t.flight : (mode === 'rebook' && r.t ? r.t.flight : '');
      $('tkf-route').value = t ? t.route : (mode === 'rebook' && r.t ? r.t.route : '');
      $('tkf-pnr').value = t ? t.pnr : '';
      $('tkf-pax').value = t ? t.pax : (r.t ? r.t.pax : '');
      $('tkf-reason').value = ''; $('tkf-note').value = '';
      $('tkf-reason-wrap').classList.toggle('d-none', mode !== 'edit');
      ['tkf-date', 'tkf-flight', 'tkf-reason'].forEach(function (id) { $(id).classList.remove('is-invalid'); });
      bootstrap.Modal.getOrCreateInstance($('tkFormModal')).show();
    }
    function need(id) { var bad = !$(id).value.trim(); $(id).classList.toggle('is-invalid', bad); return !bad; }
    $('tkf-save').addEventListener('click', function () {
      var ok = [need('tkf-date'), need('tkf-flight'), formMode !== 'edit' || need('tkf-reason')].indexOf(false) === -1;
      if (!ok) return;
      var r = current, old = r.t;
      var t = { date: $('tkf-date').value, time: $('tkf-time').value, flight: $('tkf-flight').value.trim(), route: $('tkf-route').value.trim(), pnr: $('tkf-pnr').value.trim(), pax: $('tkf-pax').value.trim(), bought: formMode === 'edit' ? old.bought : iso(today()) };
      if (formMode === 'edit') {
        var what = old.date !== t.date ? 'Rescheduled ' + pretty(old.date) + ' → ' + pretty(t.date) : 'Ticket details updated';
        log(r, what + ' · ' + $('tkf-reason').value + ($('tkf-note').value.trim() ? ' (' + $('tkf-note').value.trim() + ')' : ''));
      } else {
        log(r, (formMode === 'rebook' ? 'Re-booked' : 'Ticket purchased') + ' — flight ' + pretty(t.date));
        r.cancel = null;
      }
      r.t = t; r.stage = 'booked';
      bootstrap.Modal.getOrCreateInstance($('tkFormModal')).hide();
      render();
      toast(formMode === 'edit' ? 'Ticket updated for ' + r.patient + '.' : 'Ticket saved — ' + r.patient + ' flies on ' + pretty(t.date) + '.');
    });

    /* ---------- cancel / mark reached ---------- */
    function cancel(r) {
      if (!window.Swal) return;
      Swal.fire({
        icon: 'warning', title: 'Cancel this ticket?',
        html: '<b>' + esc(r.patient) + '</b> · ' + esc(pretty(r.t.date)) + ' · ' + esc(r.t.flight) +
          '<div class="text-start mt-3"><label class="form-label fs-13" for="tkc-reason">Why is the patient not going? <span class="text-danger">*</span></label>' +
          '<select id="tkc-reason" class="form-select"><option value="">Choose a reason...</option>' + CANCEL_REASONS.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('') + '</select></div>' +
          '<div class="text-start mt-2"><label class="form-label fs-13" for="tkc-note">Note</label><textarea id="tkc-note" class="form-control" rows="2" placeholder="Details (required for Other)"></textarea></div>',
        showCancelButton: true, confirmButtonText: 'Cancel Ticket', cancelButtonText: 'Keep Ticket', confirmButtonColor: '#dc3545',
        preConfirm: function () {
          var reason = $('tkc-reason').value, note = $('tkc-note').value.trim();
          if (!reason) { Swal.showValidationMessage('Please choose a reason.'); return false; }
          if (reason === 'Other' && !note) { Swal.showValidationMessage('Please describe the reason.'); return false; }
          return { reason: reason, note: note };
        }
      }).then(function (res) {
        if (!res.isConfirmed) return;
        r.stage = 'cancelled';
        r.cancel = { reason: res.value.reason, note: res.value.note, date: iso(today()) };
        log(r, 'Cancelled · ' + res.value.reason + (res.value.note ? ' — ' + res.value.note : ''));
        render();
        toast('Ticket cancelled for ' + r.patient + '. They are now in the Cancelled list.');
      });
    }
    /* Mark Reached — the same step and wording as Treatment Countdown, and
       the same record (crm_reached), so either page shows it. */
    function markReached(r) {
      if (!window.Swal) return;
      var t = iso(today());
      Swal.fire({
        icon: 'question', title: 'Has the patient reached the destination?',
        html: 'Confirm that <b>' + esc(r.patient) + '</b> has arrived for treatment.' +
          '<div class="text-start mt-3"><label class="form-label fs-13" for="tkd-date">Date reached</label>' +
          '<input type="date" id="tkd-date" class="form-control" value="' + t + '" min="' + r.t.date + '" max="' + t + '"></div>',
        showCancelButton: true, confirmButtonText: 'Yes, reached', confirmButtonColor: '#024766',
        preConfirm: function () { var v = $('tkd-date').value; if (!v) { Swal.showValidationMessage('Please choose the date the patient reached.'); return false; } return v; }
      }).then(function (res) {
        if (!res.isConfirmed) return;
        saveReached(r.id, res.value);
        r.stage = 'reached'; r.reached = res.value;
        log(r, 'Reached destination — moved to Treatment Ongoing');
        render();
        toast(r.patient + ' has reached the destination and is now Treatment Ongoing.');
      });
    }

    /* ---------- quick view + print ---------- */
    function sheet(r) {
      var g = group(r), t = r.t;
      var ticketRows = t
        ? [['Flight date', pretty(t.date) + (t.time ? ' · ' + t.time : '')], ['Airline & flight', t.flight], ['Route', t.route], ['Booking reference', t.pnr], ['Travellers', t.pax], ['Purchased on', pretty(t.bought)]]
        : [['Flight date', 'Not purchased yet']];
      var status = [['Ticket status', GROUPS[g].label]];
      if (g === 'upcoming') status.push(['Flight', diff(t.date) === 0 ? 'Today' : 'In ' + days(diff(t.date))]);
      if (g === 'passed') status.push(['Flight', days(-diff(t.date)) + ' ago — not marked reached']);
      if (g === 'cancelled') status.push(['Cancelled on', pretty(r.cancel.date)], ['Reason', r.cancel.reason + (r.cancel.note ? ' — ' + r.cancel.note : '')]);
      if (g === 'reached') status.push(['Reached on', pretty(r.reached)]);
      CRMSheet.render($('tkv-sheet'), {
        title: 'Travel Ticket',
        meta: [['Lead ID', r.id]],
        sections: [
          { title: 'Patient', rows: [['Patient', r.patient], ['Guardian', r.guardian], ['Phone', r.phone]] },
          { title: 'Visa', rows: [['Country', r.country], ['Visa type', r.visaType], ['Approved on', pretty(r.visaApproved)], ['Valid until', pretty(r.visaValid)]] },
          { title: 'Departure Ticket', rows: ticketRows },
          { title: 'Return Ticket', rows: [['Return date', ''], ['Note', 'Recorded on Treatment when the return ticket is booked']] },
          { title: 'Status', rows: status },
          { title: 'History', html: '<table class="table table-sm fs-12 mb-0"><tbody>' + r.history.slice().reverse().map(function (h) {
            return '<tr><td class="text-nowrap" style="width:110px;">' + esc(pretty(h.date)) + '</td><td>' + esc(h.text) + '</td><td class="text-muted text-nowrap">' + esc(h.by) + '</td></tr>';
          }).join('') + '</tbody></table>' }
        ]
      });
    }
    function view(r, andPrint) {
      sheet(r);
      var m = $('tkViewModal');
      if (andPrint) m.addEventListener('shown.bs.modal', function () { window.print(); }, { once: true });
      bootstrap.Modal.getOrCreateInstance(m).show();
    }
    $('tkv-print').addEventListener('click', function () { window.print(); });

    /* ---------- wiring ---------- */
    tbody.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-act]');
      if (!b) return;
      var r = find(b.closest('tr').dataset.id), act = b.dataset.act;
      if (act === 'purchase') openForm(r, 'purchase');
      else if (act === 'edit') openForm(r, 'edit');
      else if (act === 'rebook') openForm(r, 'rebook');
      else if (act === 'cancel') cancel(r);
      else if (act === 'reached') markReached(r);
      else if (act === 'view') view(r, false);
      else if (act === 'print') view(r, true);
    });
    $('tk-tabs').addEventListener('click', function (ev) {
      var a = ev.target.closest('[data-stage]');
      if (!a) return;
      ev.preventDefault();
      active = a.dataset.stage;
      if (window.history && history.replaceState) history.replaceState(null, '', 'tickets.html' + (active === 'pending' ? '' : '?stage=' + active));
      render();
    });
    $('tk-search').addEventListener('input', render);

    render();
    window.addEventListener('load', highlightSidebar);

    /* From Visa › Approved: tickets.html?lead=ELH-L-…&action=purchase */
    var want = find(params.get('lead') || '');
    if (want && params.get('action') === 'purchase' && want.stage === 'pending') openForm(want, 'purchase');
  });
})();
