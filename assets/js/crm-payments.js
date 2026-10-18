/**
 * E Life Healthcare CRM — Payment module (Payment Due / Payment Completed).
 *
 * Each page carries its patients as a JSON block (#pm-data, keyed by lead
 * ID) and one table row per patient (tr[data-pm-row]). From a row:
 *   Pay Now          — record a payment; its invoice opens straight away.
 *   Payment History  — every payment on the package, each with its own
 *                      invoice, plus a Full Package Invoice.
 *   Package Invoice  — the whole package, all payments, ready to print.
 * A patient whose outstanding reaches zero leaves Payment Due (they now
 * belong on Payment Completed). Invoices render through CRMInvoice
 * (crm-demo.js), the same sheet the Patient Profile uses.
 *
 * Static preview: nothing is stored; a reload restores the sample data.
 * Loaded only on pages flagged `paymentsjs` in build/build.js.
 */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var dataEl = document.getElementById('pm-data');
    if (!dataEl) return;
    var DATA = {};
    try { DATA = JSON.parse(dataEl.textContent); } catch (e) { return; }

    var $ = function (id) { return document.getElementById(id); };
    var num = function (v) { var n = parseFloat(v); return isFinite(n) && n > 0 ? n : 0; };
    var taka = function (n) { return (window.bdt || String)(num(n)); };
    var today = window.CRMInvoice ? window.CRMInvoice.today : function () { return ''; };
    var isDueList = !!document.querySelector('[data-pm-list="due"]');

    function paidOf(p) { return (p.payments || []).reduce(function (t, x) { return t + num(x.amount); }, 0); }
    function dueOf(p) { return Math.max(num(p.agreed) - paidOf(p), 0); }
    function lastOf(p) { var l = p.payments || []; return l.length ? l[l.length - 1] : null; }
    function label(id) { var p = DATA[id]; return p.patient + ' · G: ' + p.guardian + ' · ' + id; }
    function rowOf(id) { return document.querySelector('tr[data-pm-row][data-lead-id="' + id + '"]'); }

    /* Bootstrap does not stack modals: close whatever is open, then open. */
    function openModal(el) {
      var open = document.querySelector('.modal.show');
      if (open && open !== el) {
        open.addEventListener('hidden.bs.modal', function once() {
          open.removeEventListener('hidden.bs.modal', once);
          bootstrap.Modal.getOrCreateInstance(el).show();
        });
        bootstrap.Modal.getOrCreateInstance(open).hide();
      } else {
        bootstrap.Modal.getOrCreateInstance(el).show();
      }
    }

    /* ---- Rows + tiles, re-rendered from DATA after every payment ---- */
    function renderRow(id) {
      var row = rowOf(id), p = DATA[id];
      if (!row || !p) return;
      var last = lastOf(p), due = dueOf(p);
      row.dataset.dueBdt = due;
      var lastCell = row.querySelector('.pm-last');
      if (lastCell) lastCell.innerHTML = last
        ? '<span class="cur">' + taka(last.amount) + '</span><div class="fs-12 text-muted">' + last.date + ' &middot; ' + last.method + '</div>'
        : '<span class="text-muted">No payment yet</span>';
      var dueCell = row.querySelector('.pm-due');
      if (dueCell) dueCell.innerHTML = '<div class="cur fw-bold ' + (due > 0 ? 'text-danger' : 'text-success') + '">' + taka(due) + '</div>' +
        '<div class="fs-12 text-muted">' + taka(paidOf(p)) + ' of ' + taka(p.agreed) + ' paid</div>';
      var paidCell = row.querySelector('.pm-paid');
      if (paidCell) paidCell.innerHTML = '<div class="cur fw-bold text-success">' + taka(paidOf(p)) + '</div><div class="fs-12 text-muted">' + p.pkgName + '</div>';
    }

    function renderTiles() {
      var ids = Object.keys(DATA).filter(function (id) { return rowOf(id); });
      var set = function (key, v) { var el = document.querySelector('[data-pm-tile="' + key + '"]'); if (el) el.textContent = v; };
      set('due', taka(ids.reduce(function (t, id) { return t + dueOf(DATA[id]); }, 0)));
      set('count', ids.length);
      set('paid', taka(ids.reduce(function (t, id) { return t + paidOf(DATA[id]); }, 0)));
      set('payments', ids.reduce(function (t, id) { return t + (DATA[id].payments || []).length; }, 0));
      var empty = document.getElementById('pm-empty');
      if (empty) empty.classList.toggle('d-none', ids.length > 0);
    }

    Object.keys(DATA).forEach(renderRow);
    renderTiles();

    /* ---- Search ---- */
    var search = $('pm-search');
    if (search) {
      search.addEventListener('input', function () {
        var q = search.value.trim().toLowerCase();
        document.querySelectorAll('tr[data-pm-row]').forEach(function (r) {
          r.classList.toggle('d-none', !!q && r.textContent.toLowerCase().indexOf(q) === -1);
        });
      });
    }

    /* ---- Invoice ---- */
    var invModal = $('pmInvoiceModal');
    function showInvoice(id, receipt, note) {
      var p = DATA[id];
      if (!p || !window.CRMInvoice) return;
      $('pm-invoice').innerHTML = window.CRMInvoice.render({
        leadId: id, receipt: receipt || '', payments: p.payments || [],
        billTo: { guardian: p.guardian, patient: p.patient, phone: p.phone, address: p.address },
        pkg: { id: p.pkgId, name: p.pkgName, listPrice: p.listPrice, agreed: p.agreed,
          agreedUsd: p.agreedUsd, appliedOn: p.appliedOn, appliedBy: p.appliedBy }
      });
      $('pm-inv-title').textContent = (receipt ? 'Payment Invoice · ' + receipt : 'Package Invoice · ' + p.pkgId) + ' — ' + p.patient;
      $('pm-inv-note').classList.toggle('d-none', !note);
      /* One wrapper: the alert lays out as flex, which would swallow the spaces between inline pieces. */
      $('pm-inv-note').innerHTML = note ? '<span>' + note + '</span>' : '';
      openModal(invModal);
    }
    $('pm-inv-print').addEventListener('click', function () { window.print(); });

    /* ---- Payment History ---- */
    var histModal = $('pmHistoryModal');
    function showHistory(id) {
      var p = DATA[id];
      if (!p) return;
      var due = dueOf(p);
      $('pm-hist-label').textContent = label(id);
      $('pm-hist-agreed').textContent = taka(p.agreed);
      $('pm-hist-pkg').textContent = p.pkgName + ' · ' + p.pkgId;
      $('pm-hist-paid').textContent = taka(paidOf(p));
      $('pm-hist-due').textContent = taka(due);
      $('pm-hist-due').className = 'fw-bold cur ' + (due > 0 ? 'text-danger' : 'text-success');
      $('pm-hist-due-tile').classList.toggle('is-owing', due > 0);
      $('pm-hist-due-tile').classList.toggle('is-clear', due <= 0);
      $('pm-hist-body').innerHTML = (p.payments || []).slice().reverse().map(function (x) {
        return '<tr><td class="text-nowrap">' + x.date + '</td><td>' + (x.type || 'Instalment') + '</td><td>' + x.method + '</td>' +
          '<td class="mono fs-12">' + x.receipt + '</td><td class="text-end cur fw-semibold">' + taka(x.amount) + '</td>' +
          '<td class="text-end"><button type="button" class="btn btn-sm btn-light pm-open-invoice" data-lead-id="' + id + '" data-receipt="' + x.receipt + '"><i class="mdi mdi-printer me-1"></i>Invoice</button></td></tr>';
      }).join('') || '<tr><td colspan="6" class="text-muted">No payments yet.</td></tr>';
      $('pm-hist-invoice').dataset.leadId = id;
      $('pm-hist-pay').dataset.leadId = id;
      $('pm-hist-pay').classList.toggle('d-none', due <= 0);
      openModal(histModal);
    }

    /* ---- Pay Now ---- */
    var payModal = $('pmPayModal');
    var payId = null;
    var amount = $('pm-amount');
    function syncAfter() {
      var p = DATA[payId];
      if (!p) return;
      var due = dueOf(p), a = num(amount.value);
      var err = $('pm-amount-error');
      var bad = a > due;
      err.classList.toggle('d-none', !bad);
      amount.classList.toggle('is-invalid', bad);
      if (bad) err.textContent = 'Only ' + taka(due) + ' is outstanding.';
      $('pm-after').innerHTML = a > 0 && !bad
        ? 'Outstanding after this payment: <span class="fw-semibold ' + (due - a > 0 ? 'text-danger' : 'text-success') + '">' + taka(due - a) + '</span>' +
          (due - a === 0 ? ' &mdash; fully paid.' : '')
        : '';
    }
    function showPay(id) {
      var p = DATA[id];
      if (!p || dueOf(p) <= 0) return;
      payId = id;
      $('pm-pay-label').textContent = label(id);
      $('pm-pay-agreed').textContent = taka(p.agreed);
      $('pm-pay-paid').textContent = taka(paidOf(p));
      $('pm-pay-due').textContent = taka(dueOf(p));
      amount.value = '';
      $('pm-ref').value = '';
      var d = new Date();
      $('pm-date').value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      syncAfter();
      openModal(payModal);
      window.setTimeout(function () { amount.focus(); }, 400);
    }
    amount.addEventListener('input', syncAfter);
    $('pm-full').addEventListener('click', function () { amount.value = dueOf(DATA[payId]); syncAfter(); });

    function nextReceipt() {
      var max = 300;
      Object.keys(DATA).forEach(function (id) {
        (DATA[id].payments || []).forEach(function (x) { var n = parseInt(String(x.receipt).replace(/\D/g, ''), 10); if (n > max) max = n; });
      });
      /* Numbered in the Receipt No. format from Settings. */
      return window.CRMSettings ? CRMSettings.nextId('receipt') : 'MR-' + String(max + 1).padStart(6, '0');
    }

    $('pm-pay-save').addEventListener('click', function () {
      var p = DATA[payId];
      var a = num(amount.value);
      if (!p || a <= 0 || a > dueOf(p)) {
        amount.classList.add('is-invalid');
        var err = $('pm-amount-error');
        err.classList.remove('d-none');
        err.textContent = a <= 0 ? 'Enter the amount received.' : 'Only ' + taka(dueOf(p)) + ' is outstanding.';
        return;
      }
      var clears = a === dueOf(p);
      var dateVal = $('pm-date').value;
      var dateTxt = today();
      if (dateVal) {
        var M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        var parts = dateVal.split('-');
        dateTxt = parts[2] + ' ' + M[+parts[1] - 1] + ' ' + parts[0];
      }
      var receipt = nextReceipt();
      p.payments = p.payments || [];
      p.payments.push({
        date: dateTxt, method: $('pm-method').value, receipt: receipt, amount: a,
        type: p.payments.length === 0 ? (clears ? 'Full settlement' : 'Advance') : (clears ? 'Final payment' : 'Instalment')
      });
      renderRow(payId);

      var note = '<i class="mdi mdi-check-circle me-1"></i>Payment of <strong>' + taka(a) + '</strong> recorded (' + receipt + '). Its invoice is below, ready to print.';
      if (clears && isDueList) {
        /* Fully paid: this patient now belongs on Payment Completed. */
        var row = rowOf(payId);
        if (row) row.remove();
        note += ' <strong>' + p.patient + '</strong> is now fully paid and has moved to <a href="completed-leads.html" class="alert-link">Payment Completed</a>.';
      }
      renderTiles();
      showInvoice(payId, receipt, note);
    });

    /* ---- One click handler for every trigger on the page ---- */
    document.addEventListener('click', function (ev) {
      var btn = ev.target.closest('.pm-open-pay, .pm-open-history, .pm-open-invoice');
      if (!btn) return;
      var row = btn.closest('tr[data-pm-row]');
      var id = btn.dataset.leadId || (row ? row.dataset.leadId : '');
      if (!id || !DATA[id]) return;
      ev.preventDefault();
      if (btn.classList.contains('pm-open-pay')) showPay(id);
      else if (btn.classList.contains('pm-open-history')) showHistory(id);
      else showInvoice(id, btn.dataset.receipt || '');
    });
  });
})();
