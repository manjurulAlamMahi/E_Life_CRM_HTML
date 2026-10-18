/**
 * E Life Healthcare CRM — Dollar Payments.
 *
 * Packages other than Full-Funded carry a partial dollar amount (e.g.
 * $2,500), set when the package is applied. It is an internal matter of
 * the business: it is not a patient payment, never appears on an invoice
 * or receipt, and never touches the taka balances. Staff only record what
 * has come in — "$500 paid", "$1,500 paid", "all paid" — and the CRM shows
 * paid / remaining / status. Who pays it and where it goes is deliberately
 * not recorded anywhere.
 *
 * Tracked on dollar-payments.html; Patient Profile shows only the status.
 *
 * Static preview: payments are kept in localStorage (crm_dollar_payments)
 * so both pages agree; clear the site data to reset the demo.
 */
(function () {
  'use strict';

  var KEY = 'crm_dollar_payments';
  /* Payments already on record in this demo, keyed by lead ID. */
  var SEED = {
    'ELH-L-2026-000408': [{ date: '2026-09-02', amount: 500 }],
    'ELH-L-2026-000406': [{ date: '2026-08-26', amount: 1500 }],
    'ELH-L-2026-000386': [{ date: '2026-07-30', amount: 2500 }],
    'ELH-L-2026-000380': [{ date: '2026-05-10', amount: 1000 }, { date: '2026-05-12', amount: 1500 }]
  };

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function write(map) {
    try { localStorage.setItem(KEY, JSON.stringify(map)); } catch (e) { /* demo only */ }
  }
  function num(v) { var n = parseFloat(v); return isFinite(n) && n > 0 ? n : 0; }

  function entries(id) {
    var m = read();
    return (m[id] || SEED[id] || []).slice();
  }

  var LABEL = { 'not-paid': 'Not paid yet', partial: 'Partially paid', paid: 'Paid' };

  window.CRMDollar = {
    entries: entries,
    add: function (id, amount, date) {
      var list = entries(id);
      list.push({ date: date, amount: num(amount) });
      var m = read(); m[id] = list; write(m);
    },
    paid: function (id) { return entries(id).reduce(function (t, e) { return t + num(e.amount); }, 0); },
    /* total = the lead's partial dollar amount. */
    status: function (id, total) {
      total = num(total);
      var paid = Math.min(this.paid(id), total);
      var key = paid <= 0 ? 'not-paid' : paid >= total ? 'paid' : 'partial';
      return { key: key, label: LABEL[key], paid: paid, remaining: Math.max(total - paid, 0) };
    },
    badgeClass: function (key) {
      return key === 'paid' ? 'bg-success-subtle text-success' : key === 'partial' ? 'bg-warning-subtle text-warning' : 'bg-danger-subtle text-danger';
    }
  };

  function usd(n) { return '$' + Number(n).toLocaleString('en-US'); }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function pretty(iso) {
    var d = new Date(iso + 'T00:00:00');
    return isNaN(d) ? iso : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function todayIso() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /* ---------- Dollar Payments page ---------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    var table = document.getElementById('dl-table');
    if (!table) return;
    var D = window.CRMDollar;
    var $ = function (id) { return document.getElementById(id); };
    var tabs = $('dl-tabs'), search = $('dl-search'), empty = $('dl-empty');
    var tab = 'open';
    var rows = [].slice.call(table.querySelectorAll('tbody tr[data-lead-id]'));
    var current = null;

    function stat(r) { return D.status(r.dataset.leadId, r.dataset.usd); }

    function render(r) {
      var s = stat(r);
      r.querySelector('.dl-paid').textContent = usd(s.paid);
      r.querySelector('.dl-remaining').textContent = usd(s.remaining);
      r.querySelector('.dl-remaining').className = 'dl-remaining text-end cur fs-13 fw-semibold ' + (s.remaining > 0 ? 'text-danger' : 'text-success');
      r.querySelector('.dl-status').innerHTML = '<span class="badge ' + D.badgeClass(s.key) + '">' + s.label + '</span>';
      r.querySelector('.dl-action').innerHTML =
        (s.remaining > 0 ? '<button type="button" class="btn btn-sm btn-success me-1" data-act="pay"><i class="mdi mdi-plus me-1"></i>Add Payment</button>' : '') +
        '<button type="button" class="btn btn-sm btn-icon btn-light" data-act="history" title="Payment history"><i class="mdi mdi-history"></i></button>';
    }

    function refresh() {
      var q = search ? search.value.trim().toLowerCase() : '';
      var n = { open: 0, paid: 0 }, total = 0, paid = 0, shown = 0;
      rows.forEach(function (r) {
        var s = stat(r);
        var isPaid = s.key === 'paid';
        n[isPaid ? 'paid' : 'open']++;
        total += num(r.dataset.usd); paid += s.paid;
        var hit = (tab === 'all' || (tab === 'paid') === isPaid) && (!q || r.textContent.toLowerCase().indexOf(q) !== -1);
        r.classList.toggle('d-none', !hit);
        if (hit) shown++;
      });
      var set = function (id, v) { var el = $(id); if (el) el.textContent = v; };
      set('dl-sum-total', usd(total)); set('dl-sum-paid', usd(paid)); set('dl-sum-remaining', usd(total - paid));
      set('dl-n-open', n.open);
      set('dl-tab-open', n.open); set('dl-tab-paid', n.paid); set('dl-tab-all', rows.length);
      if (empty) empty.classList.toggle('d-none', shown !== 0);
      var b = document.querySelector('#side-menu a[href="dollar-payments.html"] .badge');
      if (b) { b.textContent = n.open; b.classList.toggle('d-none', !n.open); }
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

    /* ---- Add payment ---- */
    var payModal = $('dlPayModal');
    function openPay(r) {
      current = r;
      var s = stat(r);
      $('dl-pay-who').textContent = r.dataset.patient + ' · ' + r.dataset.leadId;
      $('dl-pay-total').textContent = usd(num(r.dataset.usd));
      $('dl-pay-paid').textContent = usd(s.paid);
      $('dl-pay-left').textContent = usd(s.remaining);
      $('dl-pay-amount').value = '';
      $('dl-pay-amount').max = s.remaining;
      $('dl-pay-amount').classList.remove('is-invalid');
      $('dl-pay-date').value = todayIso();
      bootstrap.Modal.getOrCreateInstance(payModal).show();
    }
    $('dl-pay-all').addEventListener('click', function () {
      if (current) $('dl-pay-amount').value = stat(current).remaining;
    });
    $('dl-pay-save').addEventListener('click', function () {
      if (!current) return;
      var left = stat(current).remaining;
      var amt = num($('dl-pay-amount').value);
      var bad = amt <= 0 || amt > left;
      $('dl-pay-amount').classList.toggle('is-invalid', bad);
      $('dl-pay-amount-error').textContent = amt > left ? 'That is more than the ' + usd(left) + ' remaining.' : 'Enter the amount received.';
      if (bad) return;
      D.add(current.dataset.leadId, amt, $('dl-pay-date').value || todayIso());
      render(current); refresh();
      bootstrap.Modal.getOrCreateInstance(payModal).hide();
      var s = stat(current);
      if (window.Swal) {
        Swal.fire({
          icon: 'success', title: 'Dollar payment recorded', confirmButtonColor: '#024766',
          text: usd(amt) + ' for ' + current.dataset.patient + '. ' + (s.remaining > 0 ? usd(s.remaining) + ' remaining.' : 'Fully paid.')
        });
      }
    });

    /* ---- History ---- */
    var histModal = $('dlHistoryModal');
    function openHistory(r) {
      var list = D.entries(r.dataset.leadId);
      var s = stat(r);
      $('dl-hist-who').textContent = r.dataset.patient + ' · ' + r.dataset.leadId;
      $('dl-hist-body').innerHTML = list.length
        ? list.map(function (e, i) {
          return '<tr><td>' + (i + 1) + '</td><td>' + esc(pretty(e.date)) + '</td><td class="text-end cur">' + usd(num(e.amount)) + '</td></tr>';
        }).join('')
        : '<tr><td colspan="3" class="text-muted text-center py-3">No dollar payment recorded yet.</td></tr>';
      $('dl-hist-foot').innerHTML = '<span>Total <b class="cur">' + usd(num(r.dataset.usd)) + '</b></span><span>Paid <b class="cur text-success">' + usd(s.paid) +
        '</b></span><span>Remaining <b class="cur ' + (s.remaining > 0 ? 'text-danger' : 'text-success') + '">' + usd(s.remaining) + '</b></span>';
      bootstrap.Modal.getOrCreateInstance(histModal).show();
    }

    table.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-act]');
      if (!btn) return;
      var r = btn.closest('tr');
      if (btn.dataset.act === 'pay') openPay(r);
      else if (btn.dataset.act === 'history') openHistory(r);
    });

    rows.forEach(render);
    refresh();
  });
})();
