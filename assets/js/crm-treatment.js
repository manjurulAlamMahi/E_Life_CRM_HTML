/**
 * E Life Healthcare CRM — Treatment (Ongoing / Successful / Failed).
 *
 * A patient who has reached the destination is "Treatment Ongoing" until the
 * outcome is known. The outcome is then recorded as Successful or Treatment
 * Failed (a reason is required for a failure). Treatment days run from the
 * ticket start (departure) to the ticket end (return), counting up to today
 * while the patient is still away. Static preview — nothing is stored; the
 * page keeps its own sample rows.
 */
(function () {
  'use strict';

  var STAGES = {
    ongoing:    { label: 'Treatment Ongoing', badge: 'bg-info-subtle text-info' },
    successful: { label: 'Successful',        badge: 'bg-success-subtle text-success' },
    failed:     { label: 'Treatment Failed',  badge: 'bg-danger-subtle text-danger' }
  };

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  function pretty(iso) {
    var d = new Date(iso + 'T00:00:00');
    return isNaN(d) ? iso : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function today() { return new Date().toISOString().slice(0, 10); }

  document.addEventListener('DOMContentLoaded', function () {
    var table = document.getElementById('tr-table');
    if (!table) return;
    var tabs = document.getElementById('tr-tabs');
    var search = document.getElementById('tr-search');
    var empty = document.getElementById('tr-empty');
    var params = new URLSearchParams(location.search);
    var active = STAGES[params.get('stage')] ? params.get('stage') : 'ongoing';
    var rows = [].slice.call(table.querySelectorAll('tbody tr[data-stage]'));

    function render(r) {
      var d = r.dataset;
      r.querySelector('.tr-start').textContent = d.ticketStart ? pretty(d.ticketStart) : '—';
      r.querySelector('.tr-end').innerHTML = d.ticketEnd ? esc(pretty(d.ticketEnd)) : '<span class="text-muted">Not booked</span>';
      r.querySelector('.tr-days').innerHTML = window.CRMTravel ? CRMTravel.cell(d.ticketStart, d.ticketEnd, d.stage !== 'ongoing', true) : '';
      r.querySelector('.tr-status').innerHTML = '<span class="badge ' + STAGES[d.stage].badge + '">' + STAGES[d.stage].label + '</span>';
      /* The result (hospital's verdict) and the return flight are two
         different things, shown on two lines. */
      var det = d.stage === 'ongoing' ? '<div class="text-muted">Under treatment</div>'
        : '<div>' + (d.stage === 'successful' ? 'Result: successful ' : 'Result: failed ') + esc(pretty(d.outcomeDate)) + '</div>' +
          (d.note ? '<div class="fs-12 text-muted">' + esc(d.note) + '</div>' : '');
      det += '<div class="fs-12 mt-1"><i class="mdi mdi-airplane-landing me-1 text-muted"></i>' + (d.ticketEnd
        ? 'Return flight ' + esc(pretty(d.ticketEnd)) + (d.retFlight ? ' · ' + esc(d.retFlight) : '') + (d.retPnr ? ' · ' + esc(d.retPnr) : '')
        : '<span class="text-muted">Return ticket not booked</span>') + '</div>';
      r.querySelector('.tr-details').innerHTML = det;
      r.querySelector('.tr-action').innerHTML =
        '<div class="d-flex flex-wrap gap-1 mb-1">' +
        (d.stage === 'ongoing'
          ? '<button type="button" class="btn btn-sm btn-success" data-act="successful"><i class="mdi mdi-check-circle-outline me-1"></i>Successful</button>' +
            '<button type="button" class="btn btn-sm btn-label-danger" data-act="failed"><i class="mdi mdi-close-circle-outline me-1"></i>Failed</button>'
          : '') +
        '<button type="button" class="btn btn-sm btn-label-primary" data-act="return"><i class="mdi mdi-airplane-landing me-1"></i>' + (d.ticketEnd ? 'Edit Return Ticket' : 'Add Return Ticket') + '</button></div>' +
        '<a href="conversations.html?lead=' + encodeURIComponent(d.leadId) + '" class="btn btn-sm btn-icon btn-light" title="Conversation log"><i class="mdi mdi-comment-text-outline"></i></a>';
    }

    /* The return ticket block, used on its own and inside the result form. */
    function returnFields(d) {
      return '<div class="text-start border rounded p-3 mt-3" style="background:var(--bs-primary-bg-subtle, #eef5fa);">' +
        '<div class="fw-semibold fs-14 mb-1"><i class="mdi mdi-airplane-landing me-1"></i>Return Ticket &mdash; flight home</div>' +
        '<div class="fs-12 text-muted mb-2">The date printed on the patient\'s <b>return ticket</b> (the flight back to Bangladesh). It is the ticket end date and stops the treatment days count. Leave blank if it is not booked yet.</div>' +
        '<label class="form-label fs-13" for="tr-end">Return flight date</label>' +
        '<input type="date" id="tr-end" class="form-control" value="' + esc(d.ticketEnd || '') + '" min="' + esc(d.ticketStart || '') + '">' +
        '<div class="row g-2 mt-1"><div class="col-6"><label class="form-label fs-13" for="tr-ret-flight">Airline &amp; flight</label><input type="text" id="tr-ret-flight" class="form-control" placeholder="e.g. US-Bangla BS-212" value="' + esc(d.retFlight || '') + '"></div>' +
        '<div class="col-6"><label class="form-label fs-13" for="tr-ret-pnr">Booking ref.</label><input type="text" id="tr-ret-pnr" class="form-control" placeholder="PNR" value="' + esc(d.retPnr || '') + '"></div></div>' +
        '</div>';
    }
    function readReturn(d) {
      var end = document.getElementById('tr-end').value;
      if (end && d.ticketStart && end < d.ticketStart) { Swal.showValidationMessage('The return flight cannot be before the departure (' + pretty(d.ticketStart) + ').'); return null; }
      return { end: end, flight: document.getElementById('tr-ret-flight').value.trim(), pnr: document.getElementById('tr-ret-pnr').value.trim() };
    }
    function applyReturn(row, v) { row.dataset.ticketEnd = v.end; row.dataset.retFlight = v.flight; row.dataset.retPnr = v.pnr; }

    function highlightSidebar() {
      var want = 'treatment.html' + (active === 'ongoing' ? '' : '?stage=' + active);
      [].slice.call(document.querySelectorAll('#sidebar-menu a[href]:not(.has-arrow)')).forEach(function (a) {
        var href = a.getAttribute('href') || '';
        if (href.indexOf('treatment.html') !== 0) return;
        a.classList.toggle('active', href === want);
        a.parentNode.classList.toggle('mm-active', href === want);
      });
    }

    function refresh() {
      var q = search ? search.value.trim().toLowerCase() : '';
      var counts = {}, shown = 0;
      rows.forEach(function (r) {
        counts[r.dataset.stage] = (counts[r.dataset.stage] || 0) + 1;
        var hit = r.dataset.stage === active && (!q || r.textContent.toLowerCase().indexOf(q) !== -1);
        r.classList.toggle('d-none', !hit);
        if (hit) shown++;
      });
      [].slice.call(document.querySelectorAll('[data-count]')).forEach(function (el) { el.textContent = counts[el.dataset.count] || 0; });
      [].slice.call(tabs.querySelectorAll('.nav-link')).forEach(function (a) { a.classList.toggle('active', a.dataset.stage === active); });
      if (empty) empty.classList.toggle('d-none', shown !== 0);
      highlightSidebar();
    }

    tabs.addEventListener('click', function (e) {
      var a = e.target.closest('[data-stage]');
      if (!a) return;
      e.preventDefault();
      active = a.dataset.stage;
      if (window.history && history.replaceState) history.replaceState(null, '', 'treatment.html' + (active === 'ongoing' ? '' : '?stage=' + active));
      refresh();
    });
    if (search) search.addEventListener('input', refresh);

    table.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-act]');
      if (!btn || !window.Swal) return;
      var row = btn.closest('tr'), d = row.dataset, act = btn.dataset.act, ok = act === 'successful';

      if (act === 'return') {
        Swal.fire({
          title: (d.ticketEnd ? 'Edit' : 'Add') + ' return ticket', width: 560,
          html: '<b>' + esc(d.patient) + '</b><div class="fs-12 text-muted">Departed ' + esc(pretty(d.ticketStart)) + '</div>' + returnFields(d),
          showCancelButton: true, confirmButtonText: 'Save Return Ticket', confirmButtonColor: '#024766',
          preConfirm: function () { return readReturn(d) || false; }
        }).then(function (r) {
          if (!r.isConfirmed) return;
          applyReturn(row, r.value);
          render(row); refresh();
          Swal.fire({ icon: 'success', title: 'Saved', text: r.value.end ? 'Return flight ' + pretty(r.value.end) + ' saved for ' + d.patient + '.' : 'Return ticket cleared for ' + d.patient + '.', confirmButtonColor: '#024766' });
        });
        return;
      }

      var t = today();
      Swal.fire({
        icon: ok ? 'question' : 'warning', width: 560,
        title: ok ? 'Mark treatment as successful?' : 'Mark treatment as failed?',
        html: '<b>' + esc(d.patient) + '</b>' +
          '<div class="text-start border rounded p-3 mt-3">' +
          '<div class="fw-semibold fs-14 mb-1"><i class="mdi mdi-hospital-building me-1"></i>Treatment Result</div>' +
          '<label class="form-label fs-13" for="tr-date">Result date <span class="text-danger">*</span></label>' +
          '<input type="date" id="tr-date" class="form-control" value="' + t + '">' +
          '<div class="form-text fs-11">The day the hospital confirmed the ' + (ok ? 'treatment was successful' : 'treatment failed') + ' &mdash; not the flight home.</div>' +
          '<label class="form-label fs-13 mt-2" for="tr-note">' + (ok ? 'Note (optional)' : 'Reason <span class="text-danger">*</span>') + '</label>' +
          '<textarea id="tr-note" class="form-control" rows="2"></textarea></div>' +
          returnFields(d),
        showCancelButton: true, confirmButtonText: ok ? 'Mark Successful' : 'Mark Failed',
        confirmButtonColor: ok ? '#53AA25' : '#dc3545',
        preConfirm: function () {
          var date = document.getElementById('tr-date').value, note = document.getElementById('tr-note').value.trim();
          if (!date) { Swal.showValidationMessage('Please choose the result date.'); return false; }
          if (!ok && !note) { Swal.showValidationMessage('Please enter the reason for the failure.'); return false; }
          var ret = readReturn(d);
          return ret ? { date: date, note: note, ret: ret } : false;
        }
      }).then(function (r) {
        if (!r.isConfirmed) return;
        d.stage = ok ? 'successful' : 'failed';
        d.outcomeDate = r.value.date;
        d.note = r.value.note;
        applyReturn(row, r.value.ret);
        render(row); refresh();
        Swal.fire({ icon: 'success', title: 'Saved', text: d.patient + ' is now ' + STAGES[d.stage].label + '.' + (r.value.ret.end ? '' : ' Add the return ticket when it is booked.'), confirmButtonColor: '#024766' });
      });
    });

    rows.forEach(render);
    refresh();

    window.addEventListener('load', highlightSidebar);
  });
})();
