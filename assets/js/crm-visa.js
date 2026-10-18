/**
 * E Life Healthcare CRM — Visa & Travel tracker.
 *
 * The journey after a lead has applied for a package:
 *
 *   Visa Processing ─┬─ Approved ── (Add Ticket) ──► Treatment Ongoing ── (Mark Returned) ──► Returned
 *                    └─ Rejected ── (Re-apply Visa) ──► back to Visa Processing
 *
 * Each table row carries everything about its patient in data-* attributes;
 * the Progress text, Status badge and Action buttons are rendered from them,
 * so moving a patient to the next stage is: change data-stage, re-render.
 * Static preview — nothing is stored, the tracker keeps its own sample rows.
 */
(function () {
  'use strict';

  var STAGES = {
    processing: { label: 'Visa Processing', badge: 'bg-warning-subtle text-warning', journey: 3 },
    approved:   { label: 'Visa Approved',   badge: 'bg-success-subtle text-success', journey: 4 },
    rejected:   { label: 'Visa Rejected',   badge: 'bg-danger-subtle text-danger',   journey: 3 },
    ongoing:    { label: 'Treatment Ongoing', badge: 'bg-primary-subtle text-primary', journey: 5 },
    returned:   { label: 'Returned to Country', badge: 'bg-secondary-subtle text-secondary', journey: 7 }
  };

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function pretty(iso) {
    if (!iso) return '';
    var d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function today() { return new Date().toISOString().slice(0, 10); }

  function toast(msg) {
    if (window.Swal) Swal.fire({ icon: 'success', title: 'Saved', text: msg, confirmButtonColor: '#024766' });
    else window.alert(msg);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var table = document.getElementById('vt-table');
    if (!table) return;

    var tabs = document.getElementById('vt-tabs');
    var search = document.getElementById('vt-search');
    var empty = document.getElementById('vt-empty');
    var activeStage = 'all';
    var current = null;   /* the row a modal was opened for */

    function dataRows() { return [].slice.call(table.querySelectorAll('tbody tr[data-stage]')); }
    function $(id) { return document.getElementById(id); }
    function modal(id) { return bootstrap.Modal.getOrCreateInstance($(id)); }

    /* ---------- Rendering ------------------------------------------------ */
    function details(r) {
      var d = r.dataset, line = function (t, muted) {
        return '<div' + (muted ? ' class="fs-12 text-muted"' : '') + '>' + t + '</div>';
      };
      switch (d.stage) {
        case 'processing':
          return line('Applied ' + esc(pretty(d.visaApplied))) +
            (d.visaRef ? line('Ref ' + esc(d.visaRef), true) : '');
        case 'approved':
          return line('Approved ' + esc(pretty(d.visaDecided))) +
            (d.visaValid ? line('Valid until ' + esc(pretty(d.visaValid)), true) : '');
        case 'rejected':
          return line('Rejected ' + esc(pretty(d.visaDecided))) +
            (d.rejectReason ? line(esc(d.rejectReason), true) : '');
        case 'ongoing':
          return line('Departed ' + esc(pretty(d.depDate)) + ' · ' + esc(d.depFlight)) +
            (d.depRoute || d.depRef ? line(esc([d.depRoute, d.depRef].filter(Boolean).join(' · ')), true) : '') +
            line('Return ticket: ' + (d.retDate ? esc(pretty(d.retDate)) : '<span class="text-muted">Not booked yet</span>'));
        case 'returned':
          return line('Returned ' + esc(pretty(d.retDate)) + (d.retFlight ? ' · ' + esc(d.retFlight) : '')) +
            line('Departed ' + esc(pretty(d.depDate)) + ' · ' + esc(d.depFlight), true);
      }
      return '';
    }

    function actions(r) {
      var d = r.dataset, s = d.stage;
      var view = '<button type="button" class="btn btn-sm btn-icon btn-light" title="Quick view" data-bs-toggle="modal" data-bs-target="#quickViewModal"' +
        ' data-journey-stage="' + STAGES[s].journey + '"' + (s === 'rejected' ? ' data-journey-outcome="rejected"' : '') +
        ' data-lead-id="' + esc(d.leadId) + '" data-lead-name="' + esc(d.leadName) + '" data-lead-patient="' + esc(d.leadPatient) + '"><i class="mdi mdi-card-account-details-outline"></i></button>';
      var conv = '<a href="conversations.html?lead=' + encodeURIComponent(d.leadId) + '" class="btn btn-sm btn-icon btn-light" title="Conversation log"><i class="mdi mdi-comment-text-outline"></i></a>';
      var main = '';
      if (s === 'processing') main = '<button type="button" class="btn btn-sm btn-primary" data-act="result"><i class="mdi mdi-passport me-1"></i>Update Visa Result</button>';
      /* Tickets are bought in the Ticket module (step 03). */
      if (s === 'approved')   main = '<a href="tickets.html?lead=' + encodeURIComponent(d.leadId) + '&action=purchase" class="btn btn-sm btn-primary"><i class="mdi mdi-ticket-confirmation-outline me-1"></i>Add Ticket</a>';
      if (s === 'rejected')   main = '<button type="button" class="btn btn-sm btn-warning" data-act="reapply"><i class="mdi mdi-refresh me-1"></i>Re-apply Visa</button>';
      if (s === 'ongoing')    main = '<button type="button" class="btn btn-sm btn-label-primary" data-act="ticket"><i class="mdi mdi-ticket-confirmation-outline me-1"></i>Update Ticket</button>' +
                                     ' <button type="button" class="btn btn-sm btn-primary" data-act="return"><i class="mdi mdi-flag-checkered me-1"></i>Mark Returned</button>';
      var print = '<button type="button" class="btn btn-sm btn-icon btn-light" data-act="print" title="Print visa details"><i class="mdi mdi-printer"></i></button>';
      return (main ? '<div class="d-flex flex-wrap gap-1 mb-1">' + main + '</div>' : '') +
        '<div class="d-flex gap-1">' + view + print + conv + '</div>';
    }

    function render(r) {
      var s = STAGES[r.dataset.stage];
      r.querySelector('.vt-details').innerHTML = details(r);
      /* Days abroad for treatment, from the departure to the return ticket. */
      var d = r.dataset, travelled = d.stage === 'ongoing' || d.stage === 'returned';
      r.querySelector('.vt-days').innerHTML = travelled && window.CRMTravel
        ? CRMTravel.cell(d.depDate, d.retDate, d.stage === 'returned') : '<span class="text-muted">&mdash;</span>';
      r.querySelector('.vt-status').innerHTML = '<span class="badge ' + s.badge + '">' + s.label + '</span>';
      r.querySelector('.vt-action').innerHTML = actions(r);
    }

    function refresh() {
      var q = search ? search.value.trim().toLowerCase() : '';
      var counts = { all: 0 }, shown = 0;
      dataRows().forEach(function (r) {
        counts.all++;
        counts[r.dataset.stage] = (counts[r.dataset.stage] || 0) + 1;
        var hit = (activeStage === 'all' || r.dataset.stage === activeStage) &&
          (!q || r.textContent.toLowerCase().indexOf(q) !== -1);
        r.classList.toggle('d-none', !hit);
        if (hit) shown++;
      });
      [].slice.call(document.querySelectorAll('[data-count]')).forEach(function (el) {
        el.textContent = counts[el.dataset.count] || 0;
      });
      if (empty) empty.classList.toggle('d-none', shown !== 0);
    }

    function setStage(stage, push) {
      activeStage = STAGES[stage] || stage === 'all' ? stage : 'all';
      [].slice.call(tabs.querySelectorAll('.nav-link')).forEach(function (a) {
        a.classList.toggle('active', a.dataset.stage === activeStage);
      });
      if (push && window.history && history.replaceState) {
        history.replaceState(null, '', 'visa-processing.html' + (activeStage === 'all' ? '' : '?stage=' + activeStage));
      }
      highlightSidebar();
      refresh();
    }

    /* The sidebar's Visa & Travel entries are deep links (?stage=...), which
       app.js's exact-URL match can't tell apart — mirror the active tab. */
    function highlightSidebar() {
      var want = 'visa-processing.html' + (activeStage === 'all' ? '' : '?stage=' + activeStage);
      [].slice.call(document.querySelectorAll('#sidebar-menu a[href]:not(.has-arrow)')).forEach(function (a) {
        var href = a.getAttribute('href') || '';
        if (href.indexOf('visa-processing.html') !== 0) return;
        var on = href === want;
        a.classList.toggle('active', on);
        a.parentNode.classList.toggle('mm-active', on);
      });
    }

    function move(r, stage, patch) {
      Object.keys(patch || {}).forEach(function (k) { r.dataset[k] = patch[k]; });
      r.dataset.stage = stage;
      render(r);
      refresh();
    }

    function label(id) {
      [].slice.call(document.querySelectorAll('#' + id + ' .vt-lead-label')).forEach(function (l) {
        l.textContent = current.dataset.leadPatient + ' · ' + current.dataset.leadId;
      });
    }

    /* ---------- Row buttons ---------------------------------------------- */
    table.addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-act]');
      if (!btn) return;
      current = btn.closest('tr');
      var d = current.dataset;

      if (btn.dataset.act === 'print') {
        printVisa(current);
      } else if (btn.dataset.act === 'result') {
        label('visaResultModal');
        $('vr-approved').checked = true;
        $('vr-date').value = today();
        $('vr-valid').value = '';
        $('vr-reason').value = '';
        syncResult();
        modal('visaResultModal').show();
      } else if (btn.dataset.act === 'ticket') {
        label('ticketModal');
        var editing = d.stage === 'ongoing';
        $('tk-title').textContent = editing ? 'Update Ticket' : 'Add Ticket';
        $('tk-date').value = editing ? d.depDate || '' : '';
        $('tk-flight').value = editing ? d.depFlight || '' : '';
        $('tk-route').value = editing ? d.depRoute || '' : '';
        $('tk-ref').value = editing ? d.depRef || '' : '';
        $('tk-return').value = editing ? d.retDate || '' : '';
        modal('ticketModal').show();
      } else if (btn.dataset.act === 'return') {
        label('returnModal');
        $('rt-date').value = d.retDate || today();
        $('rt-flight').value = d.retFlight || '';
        $('rt-ref').value = '';
        modal('returnModal').show();
      } else if (btn.dataset.act === 'reapply') {
        var row = current;
        var go = function () {
          move(row, 'processing', { visaApplied: today(), visaDecided: '', rejectReason: '' });
          toast(row.dataset.leadPatient + ' is back in Visa Processing.');
        };
        if (window.Swal) {
          Swal.fire({
            icon: 'question', title: 'Re-apply for this visa?',
            text: 'The patient moves back to Visa Processing.',
            showCancelButton: true, confirmButtonText: 'Re-apply', confirmButtonColor: '#024766'
          }).then(function (r) { if (r.isConfirmed) go(); });
        } else go();
      }
    });

    function need(id) {
      var el = $(id);
      var bad = !String(el.value).trim();
      el.classList.toggle('is-invalid', bad);
      return !bad;
    }

    /* Visa result: rejection needs its reason; approval takes a validity date. */
    function syncResult() {
      var rejected = $('vr-rejected').checked;
      $('vr-reason-wrap').classList.toggle('d-none', !rejected);
      $('vr-valid-wrap').classList.toggle('d-none', rejected);
    }
    $('vr-approved').addEventListener('change', syncResult);
    $('vr-rejected').addEventListener('change', syncResult);

    $('vr-save').addEventListener('click', function () {
      var rejected = $('vr-rejected').checked;
      var ok = need('vr-date');
      if (rejected) ok = need('vr-reason') && ok;
      if (!ok) return;
      var row = current;
      modal('visaResultModal').hide();
      if (rejected) {
        move(row, 'rejected', { visaDecided: $('vr-date').value, rejectReason: $('vr-reason').value.trim() });
        toast('Visa rejection recorded for ' + row.dataset.leadPatient + '.');
      } else {
        move(row, 'approved', { visaDecided: $('vr-date').value, visaValid: $('vr-valid').value });
        toast('Visa approved for ' + row.dataset.leadPatient + ' — next step: add the ticket.');
      }
    });

    /* Ticket: departure details; return date stays blank until it's booked.
       Saving from Visa Approved starts Treatment Ongoing; saving from
       Treatment Ongoing just updates the ticket. */
    $('tk-save').addEventListener('click', function () {
      var ok = need('tk-date');
      ok = need('tk-flight') && ok;
      if (!ok) return;
      var row = current, wasOngoing = row.dataset.stage === 'ongoing';
      modal('ticketModal').hide();
      move(row, 'ongoing', {
        depDate: $('tk-date').value, depFlight: $('tk-flight').value.trim(),
        depRoute: $('tk-route').value.trim(), depRef: $('tk-ref').value.trim(),
        retDate: $('tk-return').value
      });
      toast(wasOngoing ? 'Ticket updated.' : row.dataset.leadPatient + ' is now Treatment Ongoing.');
    });

    $('rt-save').addEventListener('click', function () {
      if (!need('rt-date')) return;
      var row = current;
      modal('returnModal').hide();
      move(row, 'returned', { retDate: $('rt-date').value, retFlight: $('rt-flight').value.trim() });
      toast(row.dataset.leadPatient + ' has returned to the country.');
    });

    /* ---------- Print: the visa (and travel, once booked) on a paper sheet */
    function printVisa(r) {
      var d = r.dataset, s = d.stage, travelled = s === 'ongoing' || s === 'returned';
      var visa = [['Country', d.country], ['Visa type', d.visaType], ['Applied on', pretty(d.visaApplied)], ['Reference', d.visaRef]];
      if (s === 'rejected') visa.push(['Result', 'Rejected on ' + pretty(d.visaDecided)], ['Reason', d.rejectReason]);
      else if (d.visaDecided) visa.push(['Result', 'Approved on ' + pretty(d.visaDecided)], ['Valid until', pretty(d.visaValid)]);
      else visa.push(['Result', 'Waiting for the embassy']);
      var sections = [
        { title: 'Patient', rows: [['Patient', d.leadPatient], ['Guardian', d.leadName]] },
        { title: 'Visa', rows: visa }
      ];
      if (travelled) sections.push({ title: 'Travel', rows: [
        ['Departure', pretty(d.depDate) + (d.depFlight ? ' · ' + d.depFlight : '')], ['Route', d.depRoute], ['Booking reference', d.depRef],
        ['Return', d.retDate ? pretty(d.retDate) + (d.retFlight ? ' · ' + d.retFlight : '') : ''],
        ['Treatment days', window.CRMTravel ? CRMTravel.text(d.depDate, d.retDate, s === 'returned') : '']
      ] });
      sections.push({ title: 'Status', rows: [['Current status', STAGES[s].label]] });
      CRMSheet.render($('vp-sheet'), { title: 'Visa Details', meta: [['Lead ID', d.leadId]], sections: sections });
      var m = $('visaPrintModal');
      m.addEventListener('shown.bs.modal', function () { window.print(); }, { once: true });
      modal('visaPrintModal').show();
    }
    $('vp-print').addEventListener('click', function () { window.print(); });

    /* ---------- Tabs, search, deep link ---------------------------------- */
    tabs.addEventListener('click', function (ev) {
      var a = ev.target.closest('.nav-link');
      if (!a) return;
      ev.preventDefault();
      setStage(a.dataset.stage, true);
    });
    if (search) search.addEventListener('input', refresh);

    dataRows().forEach(render);
    setStage(new URLSearchParams(window.location.search).get('stage') || 'all', false);
    window.addEventListener('load', highlightSidebar);
  });
})();
