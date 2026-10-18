/**
 * E Life Healthcare CRM — Accounts behaviour.
 *
 * Payment verification, receipt generation and due chasing. Kept apart
 * from the leads and deals modules so each file stays about one thing.
 * Loaded only on pages flagged `accountsjs` in build/build.js.
 *
 * In the Laravel build this is replaced by Payment/Receipt model methods
 * (plan.md R2) — nothing here is authoritative business logic.
 */
(function () {
  'use strict';

  window.CRMAccounts = {};

  function toast(msg, icon) {
    if (window.Swal) {
      Swal.fire({
        icon: icon || 'success',
        title: icon === 'info' ? 'Sent' : icon === 'error' ? 'Rejected' : 'Done',
        text: msg,
        confirmButtonColor: '#024766'
      });
    } else {
      window.alert(msg);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {

    /* ---------- Verify / Reject, each reversible for 15 minutes ---------- *
     * A mis-click on Verify or Reject shouldn't need a phone call to
     * Accounts to fix. Both actions leave an Undo button live for 15
     * minutes, after which the decision is treated as final and Undo
     * disappears — matching how long the row's own state visibly differs
     * from the original pending row (state badge, Verify/Reject buttons). */
    var UNDO_WINDOW_MS = 15 * 60 * 1000;

    function actionsBar(el) { return el.closest('.d-flex'); }

    function addUndoButton(bar, onUndo) {
      var undoBtn = document.createElement('button');
      undoBtn.type = 'button';
      undoBtn.className = 'btn btn-sm btn-label-secondary crm-pay-undo';
      undoBtn.innerHTML = '<i class="mdi mdi-undo-variant me-1"></i>Undo';
      bar.insertBefore(undoBtn, bar.firstChild);
      var timer = window.setTimeout(function () {
        if (undoBtn.parentNode) undoBtn.remove();
      }, UNDO_WINDOW_MS);
      undoBtn.addEventListener('click', function () {
        window.clearTimeout(timer);
        undoBtn.remove();
        onUndo();
      });
    }

    /* Verifying is the moment a claim becomes money: the receipt is issued
     * and the balance drops. Until then the amount is counted nowhere.
     * attachVerify is a named function (not an inline listener) so a
     * restored action bar's fresh Verify button — a clone from innerHTML,
     * carrying data-* but no handlers — can be rewired the same way after
     * an Undo, without duplicating this logic. */
    function attachVerify(btn) {
      btn.addEventListener('click', function () {
        var row = btn.closest('tr');
        var bar = actionsBar(btn);
        var barHtml = bar.innerHTML;
        if (row) {
          row.dataset.pending = 'false';
          row.classList.remove('table-danger');
          row.classList.add('table-success');
          var state = row.querySelector('.badge');
          if (state) { state.textContent = 'Verified'; state.className = 'badge bg-success-subtle text-success'; }
          bar.querySelectorAll('.crm-pay-verify, .crm-pay-reject').forEach(function (b) { b.remove(); });
          addUndoButton(bar, function () {
            row.dataset.pending = 'true';
            row.classList.remove('table-success');
            if (state) { state.textContent = 'Pending'; state.className = 'badge bg-warning-subtle text-warning'; }
            bar.innerHTML = barHtml;
            wireRow(bar);
            toast('Verification undone — back to Pending Verification.', 'info');
          });
        }
        toast((btn.dataset.person || 'The payment') + '’s ' + (btn.dataset.amount || '') +
          ' is verified. The receipt is issued and the balance has dropped by that amount. You can undo this for the next 15 minutes.');
      });
    }
    document.querySelectorAll('.crm-pay-verify').forEach(attachVerify);

    /* Re-attach listeners to a restored action bar after an Undo. Reject
       needs no rebinding: its modal listener is global and reads
       relatedTarget at open time, so a fresh clone works immediately. */
    function wireRow(bar) {
      var verifyBtn = bar.querySelector('.crm-pay-verify');
      if (verifyBtn) attachVerify(verifyBtn);
    }

    /* Rejecting changes no balance — the due stays exactly as it was. */
    var rejectModal = document.getElementById('rejectModal');
    if (rejectModal) {
      var rejectingRow = null, rejectingBar = null, rejectingBarHtml = null;
      rejectModal.addEventListener('show.bs.modal', function (ev) {
        var btn = ev.relatedTarget;
        var label = document.getElementById('rj-label');
        if (label && btn) label.textContent = btn.dataset.person || '';
        var reason = document.getElementById('rj-reason');
        if (reason) reason.value = '';
        rejectingRow = btn ? btn.closest('tr') : null;
        rejectingBar = btn ? actionsBar(btn) : null;
        rejectingBarHtml = rejectingBar ? rejectingBar.innerHTML : null;
      });
      var rjSave = document.getElementById('rj-save');
      if (rjSave) {
        rjSave.addEventListener('click', function () {
          var reason = document.getElementById('rj-reason');
          if (reason && !reason.value) {
            reason.classList.add('is-invalid');
            return;
          }
          if (reason) reason.classList.remove('is-invalid');
          bootstrap.Modal.getOrCreateInstance(rejectModal).hide();
          var row = rejectingRow, bar = rejectingBar, barHtml = rejectingBarHtml;
          if (row && bar) {
            row.dataset.pending = 'false';
            row.classList.remove('table-success');
            row.classList.add('table-danger');
            var state = row.querySelector('.badge');
            if (state) { state.textContent = 'Rejected'; state.className = 'badge bg-danger-subtle text-danger'; }
            bar.querySelectorAll('.crm-pay-verify, .crm-pay-reject').forEach(function (b) { b.remove(); });
            addUndoButton(bar, function () {
              row.dataset.pending = 'true';
              row.classList.remove('table-danger');
              if (state) { state.textContent = 'Pending'; state.className = 'badge bg-warning-subtle text-warning'; }
              bar.innerHTML = barHtml;
              wireRow(bar);
              toast('Rejection undone — back to Pending Verification.', 'info');
            });
          }
          window.setTimeout(function () {
            toast('Payment rejected. No balance changed. You can undo this for the next 15 minutes.', 'error');
          }, 250);
        });
      }
    }

    /* ---------- Payment details ------------------------------------------ *
     * The executive who took the payment is the field that makes a disputed
     * transaction traceable, so it is shown alongside the patient. */
    var detailsModal = document.getElementById('paymentDetailsModal');
    if (detailsModal) {
      detailsModal.addEventListener('show.bs.modal', function (ev) {
        var btn = ev.relatedTarget;
        if (!btn) return;
        var map = {
          'pd-person': 'person', 'pd-deal': 'deal', 'pd-exec': 'exec',
          'pd-method': 'method', 'pd-ref': 'ref', 'pd-amount': 'amount',
          'pd-date': 'date', 'pd-proof': 'proof', 'pd-notes': 'notes', 'pd-state': 'state'
        };
        var branchEl = document.getElementById('pd-branch');
        if (branchEl) branchEl.textContent = btn.dataset.branch || 'Dhaka Branch';
        Object.keys(map).forEach(function (id) {
          var el = document.getElementById(id);
          if (el) el.textContent = btn.dataset[map[id]] || '—';
        });
      });
    }

    /* ---------- Receipt generation and filters ---------------------------- */
    document.querySelectorAll('.crm-receipt-generate').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var row = btn.closest('tr');
        if (row) row.dataset.hasReceipt = 'true';
        toast('Money receipt generated for ' + (btn.dataset.person || 'this transaction') +
          ' — ' + (btn.dataset.amount || '') + '.');
      });
    });

    var receiptFilters = document.getElementById('receipt-filters');
    if (receiptFilters) {
      /* Pinned by id, not "the first .crm-table": the Receipt Register above
         is also a .crm-table and would otherwise be the one filtered. */
      var table = document.getElementById('receipt-transactions');
      var criteria = { state: '', exec: '', method: '', cur: '' };

      if (window.jQuery && jQuery.fn.dataTable) {
        jQuery.fn.dataTable.ext.search.push(function (settings, data, index) {
          if (settings.nTable !== table) return true;
          var row = settings.aoData[index] && settings.aoData[index].nTr;
          if (!row) return true;
          if (criteria.state && row.dataset.hasReceipt !== criteria.state) return false;
          if (criteria.exec && row.dataset.exec !== criteria.exec) return false;
          if (criteria.method && row.dataset.method !== criteria.method) return false;
          if (criteria.cur && row.dataset.cur !== criteria.cur) return false;
          return true;
        });
      }

      var draw = function () {
        if (window.jQuery && jQuery.fn.dataTable && jQuery.fn.dataTable.isDataTable(table)) {
          jQuery(table).DataTable().draw();
        }
      };
      var bind = function (id, key) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('change', function () { criteria[key] = el.value; draw(); });
      };
      bind('rf-state', 'state');
      bind('rf-exec', 'exec');
      bind('rf-method', 'method');
      bind('rf-currency', 'cur');

      var search = document.getElementById('rf-search');
      if (search) {
        search.addEventListener('input', function () {
          if (window.jQuery && jQuery.fn.dataTable && jQuery.fn.dataTable.isDataTable(table)) {
            jQuery(table).DataTable().search(search.value).draw();
          }
        });
      }
      var reset = document.getElementById('rf-reset');
      if (reset) {
        reset.addEventListener('click', function () {
          criteria = { state: '', exec: '', method: '', cur: '' };
          ['rf-state', 'rf-exec', 'rf-method', 'rf-search'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.value = '';
          });
          if (window.jQuery && jQuery.fn.dataTable && jQuery.fn.dataTable.isDataTable(table)) {
            jQuery(table).DataTable().search('').draw();
          }
        });
      }
    }

    /* ---------- Remind the executive -------------------------------------- *
     * The due sits with whoever owns that patient, so the alert goes to them
     * by name rather than to a general queue nobody reads. */
    document.querySelectorAll('.crm-due-remind').forEach(function (btn) {
      btn.addEventListener('click', function () {
        toast('Reminder sent to ' + (btn.dataset.exec || 'the executive') +
          ' to collect the balance from ' + (btn.dataset.person || 'this patient') + '.', 'info');
      });
    });

    /* ---------- Collection by month --------------------------------------- *
     * A flat "still outstanding" line repeating today's one figure across
     * every past month read as a real trend and wasn't one — dropped in
     * favour of a plain stat next to the chart title (see dues.html). The
     * bar figures still come from data attributes so the chart can't drift
     * from the tables. */
    var chartEl = document.getElementById('dues-collection-chart');
    if (chartEl && window.ApexCharts) {
      var months = JSON.parse(chartEl.dataset.months || '[]');
      var collected = JSON.parse(chartEl.dataset.collected || '[]');

      new ApexCharts(chartEl, {
        chart: { type: 'bar', height: 300, fontFamily: 'inherit', toolbar: { show: false }, animations: { enabled: false } },
        series: [{ name: 'Collected (taka)', data: collected }],
        colors: ['#53AA25'],
        plotOptions: { bar: { columnWidth: '45%', borderRadius: 4 } },
        dataLabels: { enabled: false },
        xaxis: { categories: months },
        yaxis: {
          labels: {
            formatter: function (v) {
              return v >= 100000 ? '৳' + (v / 100000).toFixed(1) + 'L' : '৳' + v;
            }
          }
        },
        legend: { show: false },
        tooltip: { y: { formatter: function (v) { return (window.bdt || String)(v); } } },
        grid: { borderColor: 'rgba(0,0,0,.06)' }
      }).render();
    }
  });
})();
