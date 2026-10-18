/**
 * E Life Healthcare CRM — Leads module behaviour.
 *
 * Owns the lead lifecycle for the static preview: the money engine, the
 * Apply block, the row action menu, Quick View, and the payment ledger.
 * Loaded only on the pages flagged `leadsjs` in build/build.js.
 *
 * In the Laravel build this is replaced by Deal/Payment model methods
 * (plan.md R2) — nothing here is authoritative business logic.
 */
(function () {
  'use strict';

  window.CRMLeads = {};

  /* ---------- Money engine (round-2 spec §3) ------------------------
   * Two balances, BDT and USD, never converted into each other. There is
   * no exchange rate anywhere in this module by design: a payment is made
   * in one currency and reduces that currency's balance only. */
  function num(v) {
    var n = parseFloat(v);
    return isFinite(n) && n > 0 ? n : 0;
  }

  function agreed(negotiated) {
    return Math.max(num(negotiated), 0);
  }

  function due(agreedAmount, paid) {
    return Math.max(num(agreedAmount) - num(paid), 0);
  }

  /* Completed is derived, never chosen. Clearing one currency is not
     enough — a lead owing $2,000 with its taka settled is not done. */
  function isCompleted(dueBdt, dueUsd) {
    return num(dueBdt) === 0 && num(dueUsd) === 0;
  }

  var money = { num: num, agreed: agreed, due: due, isCompleted: isCompleted };
  window.CRMLeads.money = money;

  var bdt = function (n) { return (window.bdt || String)(n); };
  var usd = function (n) { return '$' + Number(num(n)).toLocaleString('en-US'); };
  window.CRMLeads.usd = usd;

  var STATUS_LABELS = {
    followup: 'Follow Up',
    interested: 'Interested',
    applied: 'Applied',
    confirmed: 'Confirmed',
    'not-interested': 'Not Interested',
    unreachable: 'Unreachable'
  };
  window.CRMLeads.STATUS_LABELS = STATUS_LABELS;

  /* ---------- Patient journey --------------------------------------- *
   * Shared by Quick View and the patient profile. `stage` counts steps
   * already COMPLETED (0-7): those are done/green and the next one is the
   * current step. Step 1 is the lead's current status, then Applied →
   * Visa Applied → Visa Approved → Ticket → Treatment Ongoing →
   * Returned. A rejected visa turns step 4 red ("Visa Rejected")
   * and a Not Interested lead turns step 1 red; either leaves nothing
   * after it as "next". Payment is deliberately not a journey step — a
   * visa can be applied before any money comes in — so it has its own
   * 25/50/75/100% tracker. */
  var JOURNEY_STATUS = {
    'new': 'New', contacted: 'Contacted', interested: 'Interested',
    followup: 'Follow-up', negotiation: 'Negotiation', applied: 'Applied',
    confirmed: 'Confirmed', completed: 'Completed', 'not-interested': 'Not Interested'
  };

  function renderJourney(scope, stage, opts) {
    if (!scope) return;
    opts = opts || {};
    var rejected = !!opts.rejected;
    var lost = opts.status === 'not-interested';
    var q = function (sel) { return scope.querySelector(sel); };
    if (q('.js-journey-status-label')) q('.js-journey-status-label').textContent = JOURNEY_STATUS[opts.status] || 'New';
    if (q('.js-journey-status-icon')) q('.js-journey-status-icon').className = 'mdi js-journey-status-icon ' + (lost ? 'mdi-account-cancel-outline' : 'mdi-account-clock-outline');
    if (q('.js-journey-visa-icon')) q('.js-journey-visa-icon').className = 'mdi js-journey-visa-icon ' + (rejected ? 'mdi-close-octagon-outline' : 'mdi-check-decagram');
    if (q('.js-journey-visa-label')) q('.js-journey-visa-label').textContent = rejected ? 'Visa Rejected' : 'Visa Approved';
    scope.querySelectorAll('.crm-journey-step[data-step]').forEach(function (stepEl) {
      var n = parseInt(stepEl.dataset.step, 10);
      stepEl.classList.remove('is-done', 'is-current', 'is-cancelled');
      if ((rejected && n === 4) || (lost && n === 1)) stepEl.classList.add('is-cancelled');
      else if (n <= stage) stepEl.classList.add('is-done');
      else if (n === stage + 1 && !rejected && !lost) stepEl.classList.add('is-current');
    });
  }

  /* Each 25% milestone at or below `pct` is done; the next one is current. */
  function renderPaymentProgress(scope, pct) {
    if (!scope) return;
    pct = Math.max(0, Math.min(100, parseFloat(pct) || 0));
    var out = scope.querySelector('.js-payment-pct');
    if (out) {
      out.textContent = Math.round(pct) + '% paid';
      out.className = 'fs-12 fw-semibold js-payment-pct ' + (pct >= 100 ? 'text-success' : 'text-warning');
    }
    var nextSet = false;
    scope.querySelectorAll('.crm-journey-step[data-pct]').forEach(function (stepEl) {
      stepEl.classList.remove('is-done', 'is-current', 'is-cancelled');
      if (pct >= parseInt(stepEl.dataset.pct, 10)) stepEl.classList.add('is-done');
      else if (!nextSet) { stepEl.classList.add('is-current'); nextSet = true; }
    });
  }

  window.CRMLeads.renderJourney = renderJourney;
  window.CRMLeads.renderPaymentProgress = renderPaymentProgress;

  /* ------------------------------------------------------------------ *
   * Apply block — package, then a money column per currency the package
   * accepts. Authored once in build/partials/apply-block.html.
   * ------------------------------------------------------------------ */
  function initApplyBlock(root) {
    root = root || document;
    var pkg = root.querySelector('#lc-package');
    if (!pkg) return null;

    /* One money column. Both currencies use identical maths, so they use
       identical wiring — only the prefix and the field ids differ. */
    function column(suffix, format) {
      var price = root.querySelector('#lc-price-' + suffix);
      var negotiated = root.querySelector('#lc-negotiated-' + suffix);
      var out = root.querySelector('#lc-agreed-' + suffix);
      if (!price || !negotiated) return null;

      /* Set once the employee types their own negotiated figure. While it
         is set, changing package offers a re-seed instead of performing
         one — overwriting a price just agreed on the phone is worse than
         leaving a stale default on screen. */
      var dirty = false;

      function agreedAmount() {
        return agreed(negotiated.value);
      }

      function render() {
        if (out) out.textContent = format(agreedAmount());
        root.dispatchEvent(new CustomEvent('crm:apply-change', { bubbles: true }));
      }

      function seed(v) {
        price.value = v || '';
        if (!dirty) negotiated.value = v || '';
        render();
      }

      negotiated.addEventListener('input', function () { dirty = true; render(); });
      price.addEventListener('input', render);

      return {
        seed: seed,
        render: render,
        agreed: agreedAmount,
        isDirty: function () { return dirty; },
        clearDirty: function () { dirty = false; }
      };
    }

    var bdtCol = column('bdt', bdt);
    var usdCol = column('usd', usd);
    var usdWrap = root.querySelector('#lc-usd-block');
    var reseedWrap = root.querySelector('#lc-reseed-wrap');
    var reseedLink = root.querySelector('#lc-reseed');
    var note = root.querySelector('#lc-package-note');

    function selected() {
      return pkg.options ? pkg.options[pkg.selectedIndex] : null;
    }

    function acceptsUsd() {
      var opt = selected();
      return !!(opt && opt.getAttribute('data-accepts-usd') === 'true');
    }
    window.CRMLeads.applyAcceptsUsd = acceptsUsd;

    function defaults() {
      var opt = selected();
      return {
        bdt: opt ? opt.getAttribute('data-price-bdt') : '',
        usd: opt ? opt.getAttribute('data-price-usd') : ''
      };
    }

    function syncPackage(force) {
      var takesUsd = acceptsUsd();
      var d = defaults();

      /* A BDT-only package hides the dollar column outright rather than
         leaving it open to be typed into and then ignored. */
      if (usdWrap) usdWrap.classList.toggle('d-none', !takesUsd);

      if (force) {
        if (bdtCol) bdtCol.clearDirty();
        if (usdCol) usdCol.clearDirty();
      }
      if (bdtCol) bdtCol.seed(d.bdt);
      if (usdCol) usdCol.seed(takesUsd ? d.usd : '');

      if (note) {
        var noteText = selected() && selected().value
          ? (takesUsd ? '' : 'This package is settled in taka only.')
          : 'Choose the package this patient is applying under.';
        note.textContent = noteText;
        note.classList.toggle('d-none', !noteText);
      }

      /* Offer a re-seed rather than performing one when the employee has
         already negotiated a figure. */
      var anyDirty = (bdtCol && bdtCol.isDirty()) || (usdCol && usdCol.isDirty());
      if (reseedWrap && reseedLink) {
        reseedWrap.classList.toggle('d-none', !anyDirty);
        reseedLink.textContent = 'Reset the prices to this package’s defaults?';
      }
    }

    pkg.addEventListener('change', function () { syncPackage(false); });
    if (reseedLink) {
      reseedLink.addEventListener('click', function (ev) {
        ev.preventDefault();
        syncPackage(true);
      });
    }

    /* Payment Log — a lead can apply today and pay later ("will pay
       tomorrow"), so whether anything was actually collected is its own
       toggle rather than assumed from the price being agreed. Not Yet
       hides the payment fields instead of leaving them sitting open with
       nothing meaningful to enter. Remaining Amount is always visible —
       it's what's still owed against the Negotiated Package Price
       (taka), whether or not anything has been paid yet. */
    var payDoneRadio = root.querySelector('#lc-payment-is-done');
    var payNotDoneRadio = root.querySelector('#lc-payment-not-done');
    var payFieldsWrap = root.querySelector('#lc-payment-fields-wrap');
    var payLaterNote = root.querySelector('#lc-payment-later-note');
    var payAmountInput = root.querySelector('#lc-pay-amount');
    var remainingOut = root.querySelector('#lc-remaining-bdt');

    function renderRemaining() {
      if (!remainingOut) return;
      var paid = (payDoneRadio && payDoneRadio.checked) ? num(payAmountInput ? payAmountInput.value : 0) : 0;
      remainingOut.textContent = bdt(due(bdtCol ? bdtCol.agreed() : 0, paid));
    }

    function syncPaymentToggle() {
      var done = !!(payDoneRadio && payDoneRadio.checked);
      if (payFieldsWrap) payFieldsWrap.classList.toggle('d-none', !done);
      if (payLaterNote) payLaterNote.classList.toggle('d-none', done);
      renderRemaining();
    }

    if (payDoneRadio && payNotDoneRadio) {
      payDoneRadio.addEventListener('change', syncPaymentToggle);
      payNotDoneRadio.addEventListener('change', syncPaymentToggle);
    }
    if (payAmountInput) payAmountInput.addEventListener('input', renderRemaining);
    root.addEventListener('crm:apply-change', renderRemaining);

    syncPackage(true);
    syncPaymentToggle();
    return {
      acceptsUsd: acceptsUsd,
      agreedBdt: bdtCol ? bdtCol.agreed : function () { return 0; },
      agreedUsd: usdCol ? usdCol.agreed : function () { return 0; }
    };
  }

  window.CRMLeads.initApplyBlock = initApplyBlock;

  /* ------------------------------------------------------------------ */
  document.addEventListener('DOMContentLoaded', function () {

    /* select2 inside a Bootstrap modal must be told where to render, or
       it appends to <body> and the modal's focus trap swallows every
       click in it — which is why the package dropdown looked dead. */
    if (window.jQuery && jQuery.fn.select2) {
      jQuery('.crm-select2').each(function () {
        var modal = this.closest('.modal');
        if (!modal) return;
        if (jQuery(this).data('select2')) jQuery(this).select2('destroy');
        jQuery(this).select2({
          width: '100%',
          placeholder: 'Select...',
          allowClear: true,
          dropdownParent: jQuery(modal)
        });
      });
    }

    window.CRMLeads.apply = initApplyBlock(document);

    /* ---------- Add Lead ---------------------------------------------- *
     * The executive is whoever is adding the lead, so the field is filled
     * and disabled. Entering someone else is deliberate, not the default. */
    var behalf = document.getElementById('al-behalf');
    var execSelect = document.getElementById('al-executive');
    if (behalf && execSelect) {
      var syncExec = function () {
        execSelect.disabled = !behalf.checked;
        if (!behalf.checked) execSelect.value = execSelect.dataset.currentUser || '';
      };
      behalf.addEventListener('change', syncExec);
      syncExec();
    }

    /* Lead Date follows the same rule: it's "now" unless someone says
       otherwise, locked behind the same kind of checkbox as the executive
       so neither can drift from today/whoever-is-logged-in by accident. */
    var dateOverride = document.getElementById('al-date-override');
    var dateField = document.getElementById('al-date');
    if (dateOverride && dateField) {
      var todayIso = dateField.value;
      var syncDate = function () {
        dateField.disabled = !dateOverride.checked;
        if (!dateOverride.checked) dateField.value = todayIso;
      };
      dateOverride.addEventListener('change', syncDate);
      syncDate();
    }

    /* Add Source: a quick way to add a lead source that isn't in the list
       yet, without leaving the form. Appended to the dropdown and selected
       immediately — this is a static demo, so there's nowhere else for a
       new source to be saved to. */
    var sourceAddBtn = document.getElementById('al-source-add');
    var sourceSelect = document.getElementById('al-source');
    if (sourceAddBtn && sourceSelect) {
      sourceAddBtn.addEventListener('click', function () {
        var addOption = function (name) {
          name = (name || '').trim();
          if (!name) return;
          var exists = [].slice.call(sourceSelect.options).some(function (o) {
            return o.textContent.trim().toLowerCase() === name.toLowerCase();
          });
          if (!exists) {
            var opt = document.createElement('option');
            opt.textContent = name;
            sourceSelect.appendChild(opt);
          }
          sourceSelect.value = name;
        };
        if (window.Swal) {
          Swal.fire({
            title: 'Add a new source',
            input: 'text',
            inputPlaceholder: 'e.g. YouTube, Referral Partner...',
            showCancelButton: true,
            confirmButtonText: 'Add',
            confirmButtonColor: '#024766',
            inputValidator: function (v) { return !v || !v.trim() ? 'Enter a source name' : null; }
          }).then(function (r) { if (r.isConfirmed) addOption(r.value); });
        } else {
          addOption(window.prompt('New source name:'));
        }
      });
    }

    /* "2026-08-31" -> "31 Aug 2026", for display on the overview and the
       printed form — the raw <input type="date"> value is ISO, not what a
       registration form should show. */
    function prettyDate(iso) {
      if (!iso) return '—';
      var d = new Date(iso + 'T00:00:00');
      if (isNaN(d)) return iso;
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    /* Reads either .value (input/select/textarea) or .textContent, and
       falls back to an em dash — the print form and overview should never
       show a blank cell, since blank reads as "did you forget to fill
       this in". */
    function fieldText(id) {
      var el = document.getElementById(id);
      if (!el) return '—';
      var v = 'value' in el ? el.value : el.textContent;
      v = (v || '').trim();
      return v || '—';
    }

    function moneyOrDash(v) {
      var n = num(v);
      return n > 0 ? bdt(n) : '—';
    }


    /* ---------- Address cascade (Division -> District -> Upazila) ------ *
     * A small, real subset rather than every union/upazila in Bangladesh —
     * this is a demo data-entry form, not a gazetteer. Covers every
     * district already used elsewhere in the demo data. */
    var BD_GEO = {
      Dhaka:      { Dhaka: ['Savar', 'Dhamrai', 'Keraniganj'], Gazipur: ['Kaliakair', 'Kapasia', 'Sreepur'] },
      Chattogram: { Chattogram: ['Patiya', 'Sitakunda', 'Boalkhali'], Cumilla: ['Debidwar', 'Chandina', 'Laksam'] },
      Rajshahi:   { Rajshahi: ['Paba', 'Godagari', 'Tanore'], Bogura: ['Sherpur', 'Shibganj', 'Sonatola'] },
      Khulna:     { Khulna: ['Dumuria', 'Rupsa', 'Batiaghata'] },
      Barishal:   { Barishal: ['Babuganj', 'Bakerganj', 'Muladi'] },
      Sylhet:     { Sylhet: ['Beanibazar', 'Golapganj', 'Zakiganj'] },
      Rangpur:    { Rangpur: ['Mithapukur', 'Pirganj', 'Badarganj'] },
      Mymensingh: { Mymensingh: ['Trishal', 'Bhaluka', 'Muktagacha'] }
    };

    function fillSelect(sel, items, placeholder) {
      sel.innerHTML = '<option value="">' + placeholder + '</option>' +
        items.map(function (i) { return '<option>' + i + '</option>'; }).join('');
      sel.disabled = !items.length;
    }

    function wireGeoCascade(prefix) {
      var div = document.getElementById(prefix + '-division');
      var dist = document.getElementById(prefix + '-district');
      var upz = document.getElementById(prefix + '-upazila');
      if (!div || !dist || !upz) return;

      div.addEventListener('change', function () {
        var districts = BD_GEO[div.value] ? Object.keys(BD_GEO[div.value]) : [];
        fillSelect(dist, districts, districts.length ? 'Select district' : 'Select division first');
        fillSelect(upz, [], 'Select district first');
      });

      dist.addEventListener('change', function () {
        var upazilas = (BD_GEO[div.value] && BD_GEO[div.value][dist.value]) || [];
        fillSelect(upz, upazilas, upazilas.length ? 'Select upazila' : 'Select district first');
      });
    }
    wireGeoCascade('al');
    wireGeoCascade('el');

    /* ---------- Age from Date of Birth ---------------------------------- */
    function wireAgeFromDob(prefix) {
      var dob = document.getElementById(prefix + '-dob');
      var age = document.getElementById(prefix + '-age');
      if (!dob || !age) return;
      var sync = function () {
        var d = dob.value ? new Date(dob.value) : null;
        if (!d || isNaN(d)) { age.value = ''; return; }
        var today = new Date();
        var years = today.getFullYear() - d.getFullYear();
        var m = today.getMonth() - d.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < d.getDate())) years--;
        age.value = years >= 0 ? years + ' yrs' : '';
      };
      dob.addEventListener('change', sync);
      sync();
    }
    wireAgeFromDob('al');
    wireAgeFromDob('el');

    /* ---------- Add Lead / Overview / Print ------------------------------
     * Save shows a success Overview (spec: "after save it will say
     * successful, show an overview"), which offers Edit (reopens Add Lead
     * with values intact — nothing is cleared on hide), Print (the paper
     * registration form), Go to Conversation, or Done. The print form is
     * shared with each row's own Print action on the list, so population
     * is split into its own function fed from either the Add Lead form or
     * a row's dataset. ------------------------------------------------- */
    function collectLeadData(prefix) {
      var geo = [fieldText(prefix + '-division'), fieldText(prefix + '-district'), fieldText(prefix + '-upazila')]
        .filter(function (v) { return v !== '—'; }).join(' › ') || '—';
      return {
        guardian: fieldText(prefix + '-guardian'),
        patient: fieldText(prefix + '-patient'),
        phone: fieldText(prefix + '-phone'),
        altphone: fieldText(prefix + '-altphone'),
        email: fieldText(prefix + '-email'),
        geo: geo,
        village: fieldText(prefix + '-village'),
        postcode: fieldText(prefix + '-postcode'),
        dob: prettyDate(document.getElementById(prefix + '-dob') && document.getElementById(prefix + '-dob').value),
        age: fieldText(prefix + '-age'),
        gender: fieldText(prefix + '-gender'),
        condition: fieldText(prefix + '-condition'),
        source: fieldText(prefix + '-source'),
        secondary: fieldText(prefix + '-secondary'),
        priority: fieldText(prefix + '-priority'),
        executive: fieldText(prefix + '-executive'),
        date: prettyDate(document.getElementById(prefix + '-date') && document.getElementById(prefix + '-date').value),
        expected: moneyOrDash(document.getElementById(prefix + '-expected') && document.getElementById(prefix + '-expected').value),
        offered: moneyOrDash(document.getElementById(prefix + '-offered') && document.getElementById(prefix + '-offered').value),
        pkgOffered: fieldText(prefix + '-package-offered'),
        drive: fieldText(prefix + '-drive'),
        notes: fieldText(prefix + '-notes')
      };
    }

    /* A pre-existing row on the list was never captured through this form,
       so only what the row already displays can be read back — the rest
       is honestly shown as "—" rather than invented. */
    /* Row cells are found by their column heading, not by position: this
       same Edit / Print machinery now serves Leads, Not Interested, Applied
       and Completed, whose tables order their columns differently (some
       lead with a checkbox or a ledger toggle, some have no Source). */
    function rowCell(row, re) {
      var table = row.closest('table');
      var ths = table ? [].slice.call(table.querySelectorAll('thead th')) : [];
      for (var i = 0; i < ths.length; i++) {
        if (re.test(ths[i].textContent.trim())) return row.children[i] || null;
      }
      return null;
    }
    function cellText(row, re) {
      var c = rowCell(row, re);
      if (!c) return '';
      /* A staff cell carries a small date under the name — take the name. */
      for (var n = c.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 3 && n.textContent.trim()) return n.textContent.trim();
      }
      return c.textContent.trim().replace(/\s+/g, ' ');
    }

    function collectLeadDataFromRow(row) {
      var na = function (v) { return v && String(v).trim() ? v : '—'; };


      var patientCell = rowCell(row, /^Patient/i);
      var patientEl = patientCell && patientCell.querySelector('.fw-semibold');
      return {
        guardian: na(row.dataset.leadName),
        patient: na(patientEl && patientEl.textContent.trim()),
        phone: na(cellText(row, /^Phone/i)),
        altphone: '—',
        email: '—',
        geo: '—',
        village: '—',
        postcode: '—',
        dob: '—',
        age: '—',
        gender: '—',
        condition: '—',
        source: na(row.dataset.source || cellText(row, /^Source/i)),
        secondary: '—',
        priority: '—',
        executive: na(row.dataset.executive || cellText(row, /^(Assigned To|Staff|Marked By)/i)),
        date: '—',
        expected: '—',
        offered: '—',
        pkgOffered: '—',
        drive: '—',
        notes: '—'
      };
    }

    function populateOverview(id, d) {
      var set = function (elId, text) { var t = document.getElementById(elId); if (t) t.textContent = text; };
      set('lo-id', id);
      set('lo-guardian', d.guardian);
      set('lo-phone', d.phone + (d.email !== '—' ? ' · ' + d.email : ''));
      set('lo-patient', d.patient);
      set('lo-agegender', d.age + ' · ' + d.gender);
      set('lo-address', [d.geo, d.village !== '—' ? d.village : '', d.postcode !== '—' ? d.postcode : '']
        .filter(function (v) { return v; }).join(', ') || '—');
      set('lo-condition', d.condition);
      set('lo-source', d.source);
      set('lo-executive', d.executive);
      set('lo-priority', d.priority);
      set('lo-expected', d.expected);
      set('lo-offered', d.offered);
      set('lo-package', d.pkgOffered);
    }

    /* Plain, black-and-white, only what a paper form needs — no Drive link
       (nothing to click on paper) and no signature lines (not asked for). */
    function populatePrintForm(id, d) {
      var set = function (elId, text) { var t = document.getElementById(elId); if (t) t.textContent = text; };
      set('lp-id', id);
      set('lp-date', new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }));
      set('lp-guardian', d.guardian);
      set('lp-phone', d.phone);
      set('lp-altphone', d.altphone);
      set('lp-email', d.email);
      set('lp-patient', d.patient);
      set('lp-dobage', d.dob !== '—' ? d.dob + ' (' + d.age + ')' : d.age);
      set('lp-gender', d.gender);
      set('lp-geo', d.geo);
      set('lp-village', d.village);
      set('lp-postcode', d.postcode);
      set('lp-condition', d.condition);
      set('lp-source', d.source);
      set('lp-secondary', d.secondary);
      set('lp-executive', d.executive);
      set('lp-date-lead', d.date);
      set('lp-expected', d.expected);
      set('lp-offered', d.offered);
      set('lp-package', d.pkgOffered);
      set('lp-notes', d.notes);
    }

    var addSave = document.getElementById('al-save');
    var overviewModal = document.getElementById('leadOverviewModal');
    var leadPrintModal = document.getElementById('leadPrintModal');
    if (addSave && overviewModal && leadPrintModal) {
      addSave.addEventListener('click', function () {
        var id = window.CRMSettings ? CRMSettings.nextId('lead') : 'ELH-L-2026-000417';
        var addModalEl = addSave.closest('.modal');
        var data = collectLeadData('al');
        populateOverview(id, data);
        populatePrintForm(id, data);

        if (window.bootstrap && addModalEl) bootstrap.Modal.getOrCreateInstance(addModalEl).hide();
        window.setTimeout(function () {
          bootstrap.Modal.getOrCreateInstance(overviewModal).show();
        }, 250);

        var editBtn = document.getElementById('lo-edit');
        if (editBtn) editBtn.onclick = function () {
          bootstrap.Modal.getOrCreateInstance(overviewModal).hide();
          window.setTimeout(function () {
            bootstrap.Modal.getOrCreateInstance(addModalEl).show();
          }, 250);
        };

        var printBtn = document.getElementById('lo-print');
        if (printBtn) printBtn.onclick = function () {
          bootstrap.Modal.getOrCreateInstance(leadPrintModal).show();
        };

        var continueBtn = document.getElementById('lo-continue');
        if (continueBtn) continueBtn.onclick = function () {
          bootstrap.Modal.getOrCreateInstance(overviewModal).hide();
          window.setTimeout(function () {
            window.location.href = 'conversations.html?lead=' + encodeURIComponent(id) + '&log=1';
          }, 250);
        };
      });
    }

    /* Opened from a row's own Print button, populate from that row; opened
       programmatically (Overview's Print button already called
       populatePrintForm above), relatedTarget is absent and the existing
       population is left alone. */
    if (leadPrintModal) {
      leadPrintModal.addEventListener('show.bs.modal', function (ev) {
        var btn = ev.relatedTarget;
        var row = btn ? btn.closest('tr') : null;
        if (!row) return;
        populatePrintForm(row.dataset.leadId || '', collectLeadDataFromRow(row));
      });
    }

    var lpPrint = document.getElementById('lp-print');
    if (lpPrint) lpPrint.addEventListener('click', function () { window.print(); });

    /* ---------- Edit Lead ----------------------------------------------- *
     * Static preview, no backend, but a form that blanks fields the app
     * already knows (visible two clicks away in Quick View) isn't actually
     * editable — it just looks like the data got wiped. So everything
     * Quick View carries for this row (age, general location, suggested
     * package, expected value, alongside guardian/patient/phone/source
     * already read off the row itself) is prefilled here too. Only what
     * has never been captured anywhere in this demo (DOB, gender, exact
     * address, condition notes, alternative phone, email, secondary
     * source, offered value, drive link, notes) starts empty, same as
     * Add Lead — there's nothing honest to prefill it with. */
    var editLeadModal = document.getElementById('editLeadModal');
    if (editLeadModal) {
      editLeadModal.addEventListener('show.bs.modal', function (ev) {
        var btn = ev.relatedTarget;
        var row = btn ? btn.closest('tr') : null;


        var payload = row ? row.querySelector('.qv-payload') : null;
        var setVal = function (id, v) {
          var el = document.getElementById(id);
          if (el) el.value = v || '';
        };
        var payloadText = function (cls) {
          var el = payload ? payload.querySelector('.' + cls) : null;
          return el ? el.textContent.trim() : '';
        };

        setVal('el-guardian', row ? row.dataset.leadName : '');
        setVal('el-patient', row ? row.dataset.leadPatient || (rowCell(row, /^Patient/i) && rowCell(row, /^Patient/i).querySelector('.fw-semibold') ? rowCell(row, /^Patient/i).querySelector('.fw-semibold').textContent : '') : '');
        var phoneCell = row ? cellText(row, /^Phone/i) : '';
        setVal('el-phone', phoneCell);
        var sourceCell = row ? (row.dataset.source || cellText(row, /^Source/i)) : '';
        var sourceSelect = document.getElementById('el-source');
        if (sourceSelect) sourceSelect.value = [].slice.call(sourceSelect.options).some(function (o) { return o.value === sourceCell || o.textContent === sourceCell; }) ? sourceCell : '';

        var executiveCell = row ? (row.dataset.executive || cellText(row, /^(Assigned To|Staff|Marked By)/i)) : '';
        var executiveSelect = document.getElementById('el-executive');
        if (executiveSelect) executiveSelect.value = [].slice.call(executiveSelect.options).some(function (o) { return o.textContent === executiveCell; }) ? executiveCell : executiveSelect.options[0].value;

        /* No per-row "date this lead was created" is tracked anywhere in
           this demo (only Next Follow-up is), so Lead Date honestly starts
           empty here rather than guessing — same rule as every other field
           with no real source, just applied to a field Add Lead defaults
           instead of leaving blank. */
        ['el-date', 'el-altphone', 'el-email', 'el-postcode', 'el-dob', 'el-gender', 'el-condition', 'el-secondary', 'el-offered', 'el-drive', 'el-notes'].forEach(function (id) { setVal(id, ''); });

        var ageLoc = payloadText('qv-f-agelocation');
        var ageMatch = ageLoc.match(/(\d+)\s*yrs?/i);
        var locParts = ageLoc.split('·');
        setVal('el-age', ageMatch ? ageMatch[1] + ' yrs' : '');
        setVal('el-village', locParts.length > 1 ? locParts[1].trim() : '');

        setVal('el-expected', payloadText('qv-f-expected').replace(/[^\d.]/g, ''));

        var pkgText = payloadText('qv-f-package');
        var pkgSelect = document.getElementById('el-package-offered');
        if (pkgSelect) {
          var pkgIdx = 0;
          for (var pi = 0; pi < pkgSelect.options.length; pi++) {
            if (pkgSelect.options[pi].textContent.trim() === pkgText) { pkgIdx = pi; break; }
          }
          pkgSelect.selectedIndex = pkgIdx;
        }

        var divisionSelect = document.getElementById('el-division');
        if (divisionSelect) divisionSelect.selectedIndex = 0;
        ['el-district', 'el-upazila'].forEach(function (id) {
          var el = document.getElementById(id);
          if (el) { el.innerHTML = '<option value="">Select division first</option>'; el.disabled = true; }
        });
        var prioritySelect = document.getElementById('el-priority');
        if (prioritySelect) prioritySelect.selectedIndex = 0;
        var idLabel = document.getElementById('el-lead-id');
        if (idLabel) idLabel.textContent = row ? row.dataset.leadId || '' : '';
      });
    }

    /* Patient photo: preview the picked file in the modal's avatar. The
       profile page listens for el-save and copies it onto its header. */
    var elPhoto = document.getElementById('el-photo');
    var elPhotoPreview = document.getElementById('el-photo-preview');
    if (elPhoto && elPhotoPreview) {
      elPhoto.addEventListener('change', function () {
        var file = elPhoto.files && elPhoto.files[0];
        if (!file || !/^image\//.test(file.type)) return;
        var img = document.createElement('img');
        img.alt = '';
        img.src = URL.createObjectURL(file);
        elPhotoPreview.innerHTML = '';
        elPhotoPreview.appendChild(img);
      });
      if (editLeadModal) {
        editLeadModal.addEventListener('show.bs.modal', function () {
          elPhoto.value = '';
          elPhotoPreview.innerHTML = '<i class="mdi mdi-account"></i>';
        });
      }
    }

    var elSave = document.getElementById('el-save');
    if (elSave) {
      elSave.addEventListener('click', function () {
        var modalEl = elSave.closest('.modal');
        if (window.bootstrap && modalEl) bootstrap.Modal.getOrCreateInstance(modalEl).hide();
        window.setTimeout(function () { toast('Lead updated.'); }, 250);
      });
    }

    /* ---------- Add Package ------------------------------------------- *
     * Whether a package accepts dollars is set here, and it is what the
     * Apply block reads to decide whether to show a USD column at all. */
    var pkAcceptsUsd = document.getElementById('pk-accepts-usd');
    var pkUsdWrap = document.getElementById('pk-usd-wrap');
    if (pkAcceptsUsd && pkUsdWrap) {
      var syncPk = function () {
        pkUsdWrap.classList.toggle('d-none', !pkAcceptsUsd.checked);
        if (!pkAcceptsUsd.checked) {
          var f = document.getElementById('pk-price-usd');
          if (f) f.value = '';
        }
      };
      pkAcceptsUsd.addEventListener('change', syncPk);
      syncPk();
    }

    /* ---------- Quick View -------------------------------------------- *
     * Everything the slimmed table no longer shows. Where a row carries a
     * hand-authored .qv-payload (Leads), that is used verbatim. Elsewhere
     * (Applied/Confirmed Leads, Follow-ups) the row has no payload of its
     * own, so the fallback below builds a plain label/value list straight
     * from that row's own cells — one View Details button works on any
     * table with no per-row markup to maintain. */
    var qvModal = document.getElementById('quickViewModal');
    if (qvModal) {
      qvModal.addEventListener('show.bs.modal', function (ev) {
        var btn = ev.relatedTarget;
        var body = qvModal.querySelector('#qv-body');
        var title = qvModal.querySelector('#qv-title');
        var sub = qvModal.querySelector('#qv-subtitle');
        if (!btn || !body) return;
        var row = btn.closest('tr');
        var payload = row ? row.querySelector('.qv-payload') : null;
        if (payload) {
          body.innerHTML = payload.innerHTML;
        } else if (row) {
          var table = row.closest('table');
          var heads = table ? [].slice.call(table.querySelectorAll('thead th')) : [];
          var cells = [].slice.call(row.children);
          var rowsHtml = '';
          heads.forEach(function (th, i) {
            var label = th.textContent.trim();
            var cell = cells[i];
            if (!label || !cell || /action/i.test(label)) return;
            var value = (cell.innerText || cell.textContent).trim().replace(/\s+/g, ' ');
            if (!value) return;
            rowsHtml += '<tr><td class="text-muted fs-12" style="width:38%">' + label + '</td><td class="fs-13">' + value + '</td></tr>';
          });
          body.innerHTML = rowsHtml
            ? '<table class="table table-sm mb-0"><tbody>' + rowsHtml + '</tbody></table>'
            : '<p class="text-muted mb-0">No details recorded.</p>';
        } else {
          body.innerHTML = '<p class="text-muted mb-0">No details recorded.</p>';
        }
        if (title) title.textContent = btn.dataset.leadPatient || 'Lead details';
        if (sub) {
          sub.textContent = (btn.dataset.leadName ? 'Guardian: ' + btn.dataset.leadName + ' · ' : '') +
            (btn.dataset.leadId || '');
        }

        /* Patient journey roadmap + View Profile / View Conversation: only
           for an actual lead row. Sources also opens this modal for a
           resource (a referral channel/person), whose data-lead-id is a
           category label like "Channel" rather than a real id — the
           ELH-L- prefix is what tells the two apart. */
        var leadId = btn.dataset.leadId || '';
        var isLeadRow = window.CRMSettings ? CRMSettings.isLeadId(leadId) : /^ELH-L-/.test(leadId);
        var journeyWrap = qvModal.querySelector('#qv-journey-wrap');
        var profileBtn = qvModal.querySelector('#qv-profile-btn');
        var conversationBtn = qvModal.querySelector('#qv-conversation-btn');
        if (journeyWrap) journeyWrap.classList.toggle('d-none', !isLeadRow);
        if (profileBtn) {
          profileBtn.classList.toggle('d-none', !isLeadRow);
          profileBtn.href = isLeadRow ? 'patient-profile.html?lead=' + encodeURIComponent(leadId) : '#';
        }
        if (conversationBtn) {
          conversationBtn.classList.toggle('d-none', !isLeadRow);
          conversationBtn.href = isLeadRow ? 'conversations.html?lead=' + encodeURIComponent(leadId) +
            (btn.dataset.leadName ? '&name=' + encodeURIComponent(btn.dataset.leadName) : '') +
            (btn.dataset.leadPatient ? '&patient=' + encodeURIComponent(btn.dataset.leadPatient) : '') : '#';
        }
        if (isLeadRow) {
          /* journey-stage / paid-pct are authored on the trigger button;
             the status comes from the row. See renderJourney above. */
          var row = btn.closest('tr');
          renderJourney(qvModal.querySelector('#qv-journey'), parseInt(btn.dataset.journeyStage, 10) || 0, {
            rejected: btn.dataset.journeyOutcome === 'rejected',
            status: btn.dataset.leadStatus || (row && row.dataset.status) || ''
          });
          /* Payment progress only once a package exists (data-paid-pct). */
          var payWrap = qvModal.querySelector('#qv-payment-wrap');
          var hasPay = btn.dataset.paidPct !== undefined && btn.dataset.paidPct !== '';
          if (payWrap) payWrap.classList.toggle('d-none', !hasPay);
          if (hasPay) renderPaymentProgress(payWrap, btn.dataset.paidPct);
        }
      });
    }

    /* ---------- Status, from the row action menu ----------------------- *
     * Status changing lives in Actions now, so the table column is a
     * read-only badge. A menu also removes the old <select> problem where
     * arrow-keying through options popped a modal for each one. */
    var MODALS = {
      followup: 'stFollowupModal',
      interested: 'stInterestedModal',
      applied: 'stAppliedModal',
      confirmed: 'stConfirmedModal',
      'not-interested': 'stNotInterestedModal',
      unreachable: 'stUnreachableModal'
    };

    function rowDues(row) {
      return {
        bdt: num(row && row.dataset.dueBdt),
        usd: num(row && row.dataset.dueUsd)
      };
    }

    function dueSentence(d) {
      var parts = [];
      if (d.bdt > 0) parts.push(bdt(d.bdt));
      if (d.usd > 0) parts.push(usd(d.usd));
      return parts.join(' and ');
    }

    /* Confirmed is unreachable until the lead is Completed. This is the
       gate, applied wherever a status menu is rendered. */
    function syncStatusMenu(menu) {
      var row = menu.closest('tr');
      var d = rowDues(row);
      var done = isCompleted(d.bdt, d.usd);
      var item = menu.querySelector('[data-status="confirmed"]');
      if (!item) return;
      item.classList.toggle('disabled', !done);
      item.setAttribute('aria-disabled', done ? 'false' : 'true');
      item.title = done ? '' : dueSentence(d) + ' still due — take the remaining payment first.';
    }

    /* Opens the status modal for one row — from the row's status menu, or
       from Log Conversation when the outcome needs this modal's form (e.g.
       Apply for Package, which carries the Apply block). */
    function openStatus(row, status) {
        var target = MODALS[status];
        var modalEl = target ? document.getElementById(target) : null;
        if (!modalEl || !row) return;

        modalEl.querySelectorAll('.st-lead-label').forEach(function (l) {
          l.textContent = (row.dataset.leadName || '') + ' · ' + (row.dataset.leadId || '');
        });
        /* Expected / Offered Value in the Apply block are read-only, carried
           over from the lead. Only Expected is kept on the row (quick-view
           payload); Offered has no per-row source yet, so it shows "—". */
        ['expected', 'offered'].forEach(function (k) {
          var input = modalEl.querySelector('#lc-' + k + '-bdt');
          var src = row.querySelector('.qv-payload .qv-f-' + k);
          if (input) input.value = src ? src.textContent.replace(/[^\d.]/g, '') : '';
        });
        var modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        var prevStatus = row.dataset.status;
        modalEl.querySelectorAll('.st-save').forEach(function (btn) {
          btn.onclick = function () {
            row.dataset.status = status;
            var badge = row.querySelector('.crm-status-badge');
            if (badge) {
              badge.textContent = STATUS_LABELS[status] || status;
              badge.className = 'badge crm-status-badge ' + badgeClass(status);
            }
            /* A list page (Not Interested) only holds one status — a row moved
               to any other status no longer belongs on it. */
            var listTable = row.closest('table');
            var listStatus = listTable && listTable.dataset.listStatus;
            if (listStatus && status !== listStatus) row.remove();
            renderLeadCounts();
            modal.hide();

            /* Applying is step 3; step 4 is the invoice, so saving Applied
               goes there rather than back to a list. It also means this
               lead's "work in the Leads module is complete" (plan.md) — so
               a row genuinely arriving at Applied from the Leads pipeline
               (Follow Up / Interested / Not Interested / Unreachable)
               leaves this table, same as it already lives on Applied Leads
               instead. Guarded on the previous status rather than which
               page this happens to be, because the same shared menu also
               offers "Back to Applied" on Confirmed Leads, which must not
               delete that row. */
            if (status === 'applied') {
              var FROM_LEADS_PIPELINE = { followup: true, interested: true, 'not-interested': true, unreachable: true };
              if (FROM_LEADS_PIPELINE[prevStatus]) {
                row.remove();
                renderLeadCounts();
                if (syncBulkBarRef) syncBulkBarRef();
              }
              window.setTimeout(function () {
                window.location.href = 'invoice.html?lead=' + encodeURIComponent(row.dataset.leadId || '');
              }, 250);
              return;
            }
            window.setTimeout(function () {
              toast('Status updated to ' + (STATUS_LABELS[status] || status) + '.');
            }, 250);
          };
        });
        modal.show();
    }
    window.CRMLeads.openStatus = openStatus;

    document.querySelectorAll('.crm-status-menu').forEach(function (menu) {
      syncStatusMenu(menu);

      menu.addEventListener('click', function (ev) {
        var item = ev.target.closest('[data-status]');
        if (!item) return;
        ev.preventDefault();
        if (item.classList.contains('disabled')) return;
        openStatus(menu.closest('tr'), item.dataset.status);
      });
    });

    function badgeClass(status) {
      return {
        followup: 'bg-info-subtle text-info',
        interested: 'bg-primary-subtle text-primary',
        applied: 'bg-warning-subtle text-warning',
        confirmed: 'bg-success-subtle text-success',
        'not-interested': 'bg-danger-subtle text-danger',
        unreachable: 'bg-dark-subtle text-dark'
      }[status] || 'bg-secondary-subtle text-secondary';
    }

    /* ---------- Log Conversation (shared modal) ------------------------ *
     * build/partials/log-conversation.html. Every logged call ends in a next
     * action: Follow up again / Interested / Not Interested / Unreachable
     * update the row in place (status badge, next follow-up, last outcome,
     * reason); Apply for Package hands over to the row's Apply modal, which
     * then goes on to the invoice. On a single-status list (Not Interested)
     * a row that changes status leaves the list, as with the status menu. */
    var cvModal = document.getElementById('logConvModal');
    if (cvModal && document.getElementById('cv-save')) {
      var cvRow = null;
      var cv = function (id) { return document.getElementById(id); };
      var cvOutcome = function () {
        var r = cvModal.querySelector('input[name="cv-outcome"]:checked');
        return r ? r.value : '';
      };
      var CV_LABEL = {
        followup: 'Follow-up scheduled', interested: 'Interested', applied: 'Applying for a package',
        'not-interested': 'Not interested', unreachable: 'Unreachable'
      };
      var pad = function (n) { return String(n).padStart(2, '0'); };

      var cvSync = function () {
        var v = cvOutcome();
        var needsDate = v === 'followup' || v === 'interested' || v === 'unreachable';
        cv('cv-date-wrap').classList.toggle('d-none', !needsDate);
        cv('cv-plan-wrap').classList.toggle('d-none', !(v === 'followup' || v === 'interested'));
        cv('cv-reason-wrap').classList.toggle('d-none', !(v === 'not-interested' || v === 'unreachable'));
        cv('cv-apply-note').classList.toggle('d-none', v !== 'applied');
        cv('cv-date-label').innerHTML = v === 'unreachable' ? 'Try again on' :
          v === 'interested' ? 'Next contact <span class="text-muted fw-normal fs-12">(optional)</span>' :
          'Next follow-up date <span class="text-danger">*</span>';
        cv('cv-save').querySelector('span').innerHTML = v === 'applied' ? 'Save &amp; Apply for Package' : 'Save Conversation';
        cv('cv-outcome-error').classList.add('d-none');
      };
      cvModal.querySelectorAll('input[name="cv-outcome"]').forEach(function (r) { r.addEventListener('change', cvSync); });

      cvModal.addEventListener('show.bs.modal', function (ev) {
        var btn = ev.relatedTarget;
        /* A list row, or — on Conversations, which has no rows — the
           trigger itself, carrying the selected lead's data-lead-*. */
        cvRow = btn ? (btn.closest('tr') || (btn.dataset.leadId ? btn : null)) : null;
        cvModal.querySelector('.modal-title').textContent = 'Log Conversation';
        var d = cvRow ? cvRow.dataset : {};
        var patient = d.leadPatient || (cvRow && rowCell(cvRow, /^Patient/i) && rowCell(cvRow, /^Patient/i).querySelector('.fw-semibold')
          ? rowCell(cvRow, /^Patient/i).querySelector('.fw-semibold').textContent : '');
        cv('cv-lead-label').textContent = [d.leadName, patient ? 'Patient: ' + patient : '', d.leadId].filter(Boolean).join(' · ');
        cv('cv-timeline').href = 'conversations.html' + (d.leadId ? '?lead=' + encodeURIComponent(d.leadId) +
          (d.leadName ? '&name=' + encodeURIComponent(d.leadName) : '') +
          (patient ? '&patient=' + encodeURIComponent(patient) : '') : '');
        /* What happened last time, from whichever column this list has. */
        var lastConv = cvRow ? rowCell(cvRow, /^Last (Outcome|Conversation)/i) : null;
        var lastNote = lastConv && lastConv.querySelector('.crm-clamp-2');
        var last = lastNote
          ? lastNote.textContent.trim() + ' (' + lastConv.lastElementChild.textContent.trim() + ')'
          : cvRow ? (cellText(cvRow, /^Last (Outcome|Conversation)/i) || cellText(cvRow, /^Reason/i)) : '';
        cv('cv-last').classList.toggle('d-none', !last);
        cv('cv-last-text').textContent = last;

        var now = new Date();
        cv('cv-when').value = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
        cv('cv-channel').value = 'Phone';
        ['cv-discussion', 'cv-date', 'cv-reason'].forEach(function (id) { cv(id).value = ''; cv(id).classList.remove('is-invalid'); });
        cv('cv-reason-pick').value = '';
        /* A trigger may pre-fill the note — e.g. a payment reminder call. */
        if (btn && btn.dataset.cvNote) cv('cv-discussion').value = btn.dataset.cvNote;
        cv('cv-reason-pick').classList.remove('is-invalid');
        cvModal.querySelectorAll('input[name="cv-outcome"]').forEach(function (r) { r.checked = false; });
        cvSync();
      });

      cv('cv-save').addEventListener('click', function () {
        var v = cvOutcome();
        var ok = true;
        var need = function (id, bad) { cv(id).classList.toggle('is-invalid', bad); if (bad) ok = false; };
        need('cv-discussion', !cv('cv-discussion').value.trim());
        if (!v) { cv('cv-outcome-error').classList.remove('d-none'); ok = false; }
        if (v === 'followup') need('cv-date', !cv('cv-date').value);
        if (v === 'not-interested' || v === 'unreachable') need('cv-reason-pick', !cv('cv-reason-pick').value);
        if (!ok) return;

        var row = cvRow;
        var modal = bootstrap.Modal.getOrCreateInstance(cvModal);

        /* Applying: the conversation is logged, then the row's own Apply
           modal takes over (package, price, payment → invoice). */
        if (v === 'applied') {
          cvModal.addEventListener('hidden.bs.modal', function once() {
            cvModal.removeEventListener('hidden.bs.modal', once);
            if (row && MODALS.applied && document.getElementById(MODALS.applied)) openStatus(row, 'applied');
            else window.location.href = 'invoice.html' + (row && row.dataset.leadId ? '?lead=' + encodeURIComponent(row.dataset.leadId) : '');
          });
          modal.hide();
          return;
        }

        var date = cv('cv-date').value;
        var reason = [cv('cv-reason-pick').value, cv('cv-reason').value.trim()].filter(Boolean).join(' — ');
        var summary = CV_LABEL[v] + (date ? ' · next ' + prettyDate(date) : '') + (reason ? ' · ' + reason : '');
        if (row) {
          if (row.dataset.status !== undefined) {
            row.dataset.status = v;
            var badge = row.querySelector('.crm-status-badge');
            if (badge) {
              badge.textContent = STATUS_LABELS[v] || v;
              badge.className = 'badge crm-status-badge ' + badgeClass(v);
            }
          }
          if (date) {
            row.dataset.followUp = date;
            var nextCell = rowCell(row, /^Next (Follow|Contact)/i);
            if (nextCell) nextCell.textContent = prettyDate(date);
          }
          var lastCell = rowCell(row, /^Last (Outcome|Conversation)/i);
          if (lastCell) {
            var note = cv('cv-discussion').value.trim();
            var noteEl = lastCell.querySelector('.crm-clamp-2');
            if (noteEl) {
              /* The structured cell keeps its when / how / who line. */
              noteEl.textContent = note;
              lastCell.title = note;
              lastCell.lastElementChild.innerHTML = '<i class="mdi mdi-history me-1"></i>' +
                [prettyDate(cv('cv-when').value), cv('cv-channel').value, 'You'].filter(Boolean).join(' · ');
            } else {
              lastCell.textContent = note;
            }
          }
          var reasonCell = rowCell(row, /^Reason/i);
          if (reasonCell && reason) reasonCell.textContent = reason;
          /* Upcoming Follow-ups: this follow-up is done. */
          var statusCell = rowCell(row, /^Status$/i);
          if (statusCell && !statusCell.querySelector('.crm-status-badge')) {
            statusCell.innerHTML = '<span class="badge bg-success-subtle text-success">Done</span><div class="fs-11 text-muted mt-1">' + CV_LABEL[v] + '</div>';
          }
          var listTable = row.closest('table');
          var listStatus = listTable && listTable.dataset.listStatus;
          if (listStatus && v !== listStatus) row.remove();
          renderLeadCounts();
        }
        modal.hide();
        window.setTimeout(function () { toast('Conversation logged — ' + summary + '.'); }, 250);
      });
    }

    /* ---------- Reschedule a follow-up (Upcoming Follow-ups) ------------ *
     * Available on Today, Overdue and Upcoming. The reason is mandatory
     * (plan.md §4). Saving moves the row's date and marks it Rescheduled. */
    var rsModal = document.getElementById('rescheduleModal');
    if (rsModal && document.getElementById('rs-save')) {
      var rsRow = null;
      var rsWhen = document.getElementById('rs-when');
      rsModal.addEventListener('show.bs.modal', function (ev) {
        rsRow = ev.relatedTarget ? ev.relatedTarget.closest('tr') : null;
        document.getElementById('rs-title').textContent = (ev.relatedTarget && ev.relatedTarget.dataset.rsTitle) || 'Reschedule Follow-up';
        var d = rsRow ? rsRow.dataset : {};
        document.getElementById('rs-lead-label').textContent = [d.leadName, d.leadPatient && d.leadPatient !== d.leadName ? 'Patient: ' + d.leadPatient : '', d.leadId].filter(Boolean).join(' · ');
        var current = rsRow ? (cellText(rsRow, /^(Scheduled|Was Due|Next Contact|Try Again)/i)) : '';
        if (current === '—') current = '';
        var cur = document.getElementById('rs-current');
        cur.classList.toggle('d-none', !current);
        cur.innerHTML = '<i class="mdi mdi-calendar-outline me-1"></i>Currently scheduled: <span class="fw-semibold text-body">' + current + '</span>';
        rsWhen.value = '';
        rsWhen.classList.remove('is-invalid');
        document.getElementById('rs-note').value = '';
      });
      document.getElementById('rs-save').addEventListener('click', function () {
        if (!rsWhen.value) { rsWhen.classList.add('is-invalid'); return; }
        var when = new Date(rsWhen.value);
        var label = prettyDate(rsWhen.value.slice(0, 10)) + ', ' +
          when.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        var reason = document.getElementById('rs-reason').value;
        if (rsRow) {
          var dateCell = rowCell(rsRow, /^(Scheduled|Was Due|Next Contact|Try Again)/i);
          if (dateCell) dateCell.innerHTML = label + '<div class="fs-11 text-warning">Rescheduled &middot; ' + reason + '</div>';
          rsRow.dataset.followUp = rsWhen.value.slice(0, 10);
          var lateCell = rowCell(rsRow, /^Days Late/i);
          if (lateCell) lateCell.innerHTML = '<span class="badge bg-warning-subtle text-warning">Rescheduled</span>';
          var statusCell = rowCell(rsRow, /^Status$/i);
          if (statusCell) statusCell.innerHTML = '<span class="badge bg-warning-subtle text-warning">Rescheduled</span>';
        }
        bootstrap.Modal.getOrCreateInstance(rsModal).hide();
        window.setTimeout(function () { toast('Follow-up rescheduled to ' + label + ' — ' + reason + '.'); }, 250);
      });
    }

    /* ---------- Summary counts + list filters --------------------------- *
     * Counts are derived from the rows, never written into the markup, so
     * they cannot drift from the table beneath them. The status pipeline
     * used to live in a tab strip here; it's now the Status dropdown in the
     * filter bar (plus the four summary tiles at the top of the page), so
     * there's one place to filter from instead of two that could disagree.
     * Filtering runs through DataTables' own search pipeline rather than
     * hiding <tr>s directly, which would leave paging and the "showing N of
     * M" count describing rows that are not on screen. */
    function statusRows() {
      return document.querySelectorAll('table.crm-table tbody tr[data-status]');
    }

    function renderLeadCounts() {
      var counts = { all: 0 };
      statusRows().forEach(function (r) {
        counts.all++;
        counts[r.dataset.status] = (counts[r.dataset.status] || 0) + 1;
      });
      var set = function (id, n) { var el = document.getElementById(id); if (el) el.textContent = n; };
      set('lead-count-all', counts.all || 0);
      set('lead-count-followup', counts.followup || 0);
      set('lead-count-interested', counts.interested || 0);
      set('lead-count-not-interested', counts['not-interested'] || 0);
      set('ni-count', document.querySelectorAll('[data-list-status="not-interested"] tbody tr[data-lead-id]').length);
      /* Tabbed single-status lists (Interested / Not Interested): each pill's
         badge counts the rows still in its pane. */
      document.querySelectorAll('.nav-pills [data-bs-toggle="tab"]').forEach(function (link) {
        var pane = document.querySelector(link.getAttribute('href'));
        var badge = link.querySelector('.badge');
        if (!pane || !badge || !pane.querySelector('[data-list-status]')) return;
        badge.textContent = pane.querySelectorAll('tbody tr[data-lead-id]').length;
      });
    }

    var filterBar = document.getElementById('lead-filter-bar');
    if (filterBar) {
      var leadTable = document.querySelector('table.crm-table');
      var lfStatus = document.getElementById('lf-status');
      var lfSource = document.getElementById('lf-source');
      var lfExecutive = document.getElementById('lf-executive');
      var lfStart = document.getElementById('lf-start-date');
      var lfEnd = document.getElementById('lf-end-date');
      var lfApply = document.getElementById('lf-apply-btn');
      var lfReset = document.getElementById('lf-reset-btn');
      var activeFilters = { status: 'all', source: '', executive: '', start: '', end: '' };

      /* Looked up by column heading (rowCell / cellText above), so the
         filter doesn't care whether a checkbox column leads the row. */
      function rowField(row, re) {
        return cellText(row, re);
      }

      function rowMatchesFilters(row) {
        if (activeFilters.status !== 'all' && row.dataset.status !== activeFilters.status) return false;
        if (activeFilters.source && (row.dataset.source || rowField(row, /^Source/i)) !== activeFilters.source) return false;
        if (activeFilters.executive && (row.dataset.executive || rowField(row, /^Assigned To/i)) !== activeFilters.executive) return false;
        if (activeFilters.start || activeFilters.end) {
          var d = row.dataset.followUp || '';
          if (!d) return false;
          if (activeFilters.start && d < activeFilters.start) return false;
          if (activeFilters.end && d > activeFilters.end) return false;
        }
        return true;
      }

      if (window.jQuery && jQuery.fn.dataTable) {
        jQuery.fn.dataTable.ext.search.push(function (settings, data, index) {
          /* Only this page's leads table is filtered — a global search
             hook would otherwise silently empty other tables. */
          if (settings.nTable !== leadTable) return true;
          var row = settings.aoData[index] && settings.aoData[index].nTr;
          return !row || rowMatchesFilters(row);
        });
      }

      function redraw() {
        var dtReady = window.jQuery && jQuery.fn.dataTable &&
          jQuery.fn.dataTable.isDataTable(leadTable);
        if (dtReady) {
          jQuery(leadTable).DataTable().draw();
        } else {
          /* Without DataTables the filter bar still has to work. */
          statusRows().forEach(function (r) { r.classList.toggle('d-none', !rowMatchesFilters(r)); });
        }
      }

      function applyFilters() {
        activeFilters = {
          status: lfStatus ? lfStatus.value : 'all',
          source: lfSource ? lfSource.value : '',
          executive: lfExecutive ? lfExecutive.value : '',
          start: lfStart ? lfStart.value : '',
          end: lfEnd ? lfEnd.value : ''
        };
        redraw();
      }

      if (lfApply) lfApply.addEventListener('click', applyFilters);
      if (lfReset) {
        lfReset.addEventListener('click', function () {
          if (lfStatus) lfStatus.value = 'all';
          if (lfSource) lfSource.value = '';
          if (lfExecutive) lfExecutive.value = '';
          if (lfStart) lfStart.value = '';
          if (lfEnd) lfEnd.value = '';
          applyFilters();
        });
      }
    }

    renderLeadCounts();

    /* ---------- Bulk select: delete / change status --------------------- *
     * Row checkboxes + a "select all" header checkbox + an action bar that
     * only appears once something is checked. Change Status is limited to
     * the four statuses the tabs themselves cover (Follow Up / Interested /
     * Not Interested / Unreachable) — Applied and Confirmed are a per-lead
     * workflow (package, invoice, payment) that a bulk action can't do
     * honestly. Delete just removes the rows: this is a static demo with
     * no backend to call. */
    var bulkBar = document.getElementById('bulk-action-bar');
    var bulkSelectAll = document.getElementById('bulk-select-all');
    var syncBulkBarRef = null;
    if (bulkBar && bulkSelectAll) {
      var bulkCount = document.getElementById('bulk-selected-count');
      var bulkDeleteBtn = document.getElementById('bulk-delete-btn');
      var bulkClearBtn = document.getElementById('bulk-clear-btn');
      var bulkStatusMenu = document.querySelector('.crm-bulk-status-menu');

      function rowCheckboxes() {
        return [].slice.call(document.querySelectorAll('table.crm-table tbody .crm-row-select'));
      }

      function selectedRows() {
        return rowCheckboxes().filter(function (cb) { return cb.checked; })
          .map(function (cb) { return cb.closest('tr'); });
      }

      function syncBulkBar() {
        var boxes = rowCheckboxes();
        boxes.forEach(function (cb) {
          var row = cb.closest('tr');
          if (row) row.classList.toggle('crm-row-selected', cb.checked);
        });

        var checkedN = boxes.filter(function (cb) { return cb.checked; }).length;
        bulkBar.classList.toggle('d-none', checkedN === 0);
        bulkBar.classList.toggle('d-flex', checkedN > 0);
        if (bulkCount) bulkCount.textContent = checkedN;

        bulkSelectAll.checked = boxes.length > 0 && checkedN === boxes.length;
        bulkSelectAll.indeterminate = checkedN > 0 && checkedN < boxes.length;
      }
      syncBulkBarRef = syncBulkBar;

      bulkSelectAll.addEventListener('change', function () {
        rowCheckboxes().forEach(function (cb) { cb.checked = bulkSelectAll.checked; });
        syncBulkBar();
      });

      document.addEventListener('change', function (ev) {
        if (ev.target.classList && ev.target.classList.contains('crm-row-select')) syncBulkBar();
      });

      if (bulkClearBtn) {
        bulkClearBtn.addEventListener('click', function () {
          rowCheckboxes().forEach(function (cb) { cb.checked = false; });
          syncBulkBar();
        });
      }

      if (bulkDeleteBtn) {
        bulkDeleteBtn.addEventListener('click', function () {
          var rows = selectedRows();
          if (!rows.length) return;
          var run = function () {
            rows.forEach(function (r) { r.remove(); });
            bulkSelectAll.checked = false;
            bulkSelectAll.indeterminate = false;
            renderLeadCounts();
            syncBulkBar();
            toast(rows.length + ' lead' + (rows.length > 1 ? 's' : '') + ' deleted.');
          };
          if (window.Swal) {
            Swal.fire({
              icon: 'warning', title: 'Delete ' + rows.length + ' lead' + (rows.length > 1 ? 's' : '') + '?',
              text: 'This cannot be undone.',
              showCancelButton: true, confirmButtonText: 'Delete', confirmButtonColor: '#dc3545'
            }).then(function (r) { if (r.isConfirmed) run(); });
          } else if (window.confirm('Delete ' + rows.length + ' lead(s)? This cannot be undone.')) {
            run();
          }
        });
      }

      if (bulkStatusMenu) {
        bulkStatusMenu.addEventListener('click', function (ev) {
          var item = ev.target.closest('[data-status]');
          if (!item) return;
          ev.preventDefault();
          var status = item.dataset.status;
          var rows = selectedRows();
          if (!rows.length) return;
          rows.forEach(function (row) {
            row.dataset.status = status;
            var badge = row.querySelector('.crm-status-badge');
            if (badge) {
              badge.textContent = STATUS_LABELS[status] || status;
              badge.className = 'badge crm-status-badge ' + badgeClass(status);
            }
            var menu = row.querySelector('.crm-status-menu');
            if (menu) syncStatusMenu(menu);
          });
          renderLeadCounts();
          rowCheckboxes().forEach(function (cb) { cb.checked = false; });
          bulkSelectAll.checked = false;
          bulkSelectAll.indeterminate = false;
          syncBulkBar();
          toast(rows.length + ' lead' + (rows.length > 1 ? 's' : '') + ' updated to ' + (STATUS_LABELS[status] || status) + '.');
        });
      }

      syncBulkBar();
    }

    /* ---------- Single-row delete, with the same warning as bulk delete -- */
    document.querySelectorAll('.crm-row-delete').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var row = btn.closest('tr');
        if (!row) return;
        var label = (row.dataset.leadName || '') + (row.dataset.leadId ? ' · ' + row.dataset.leadId : '');
        var run = function () {
          var ledger = row.nextElementSibling;
          if (ledger && ledger.classList.contains('crm-ledger')) ledger.remove();
          row.remove();
          renderLeadCounts();
          if (syncBulkBarRef) syncBulkBarRef();
          toast('Lead deleted.');
        };
        if (window.Swal) {
          Swal.fire({
            icon: 'warning', title: 'Delete this lead?',
            text: (label ? label + ' — ' : '') + 'This cannot be undone.',
            showCancelButton: true, confirmButtonText: 'Delete', confirmButtonColor: '#dc3545'
          }).then(function (r) { if (r.isConfirmed) run(); });
        } else if (window.confirm('Delete this lead? This cannot be undone.')) {
          run();
        }
      });
    });

    /* ---------- Next follow-up (Interested / Follow Up / Not Interested) ---- *
     * These three statuses all stay in touch, so each row can be given the
     * date and purpose of the next contact. One shared modal; the row it was
     * opened from is remembered and its Next Follow-up cell updated on save. */
    var nfModal = document.getElementById('nextFollowupModal');
    if (nfModal) {
      var nfRow = null;
      nfModal.addEventListener('show.bs.modal', function (ev) {
        var btn = ev.relatedTarget;
        nfRow = btn ? btn.closest('tr') : null;
        var label = nfModal.querySelector('.nf-lead-label');
        if (label) label.textContent = nfRow ? (nfRow.dataset.leadName || '') + ' · ' + (nfRow.dataset.leadId || '') : '';
        document.getElementById('nf-date').value = nfRow && nfRow.dataset.followUp ? nfRow.dataset.followUp : '';
        document.getElementById('nf-note').value = '';
      });
      document.getElementById('nf-save').addEventListener('click', function () {
        var date = document.getElementById('nf-date').value;
        if (!date) {
          document.getElementById('nf-date').classList.add('is-invalid');
          return;
        }
        document.getElementById('nf-date').classList.remove('is-invalid');
        if (nfRow) {
          nfRow.dataset.followUp = date;
          var cell = rowCell(nfRow, /^Next Follow/i);
          if (cell) cell.textContent = prettyDate(date);
        }
        bootstrap.Modal.getOrCreateInstance(nfModal).hide();
        window.setTimeout(function () {
          toast('Next follow-up set for ' + prettyDate(date) + ' — ' + document.getElementById('nf-action').value + '.');
        }, 250);
      });
    }

    /* ---------- Apply Visa (Applied / Completed Leads) ---------------------- *
     * Hands the patient over to Visa & Travel. The row leaves this list — it
     * lives in the visa tracker from here on — and the toast offers a jump
     * there. Static demo: nothing is stored, so the tracker keeps its own
     * sample rows. */
    var visaModal = document.getElementById('applyVisaModal');
    if (visaModal) {
      var visaRow = null;
      visaModal.addEventListener('show.bs.modal', function (ev) {
        var btn = ev.relatedTarget;
        visaRow = btn ? btn.closest('tr') : null;
        var label = visaModal.querySelector('.av-lead-label');
        if (label) label.textContent = visaRow ? (visaRow.dataset.leadName || '') + ' · ' + (visaRow.dataset.leadId || '') : '';
        document.getElementById('av-date').value = new Date().toISOString().slice(0, 10);
        document.getElementById('av-ref').value = '';
        document.getElementById('av-notes').value = '';
      });
      document.getElementById('av-save').addEventListener('click', function () {
        var dateEl = document.getElementById('av-date');
        if (!dateEl.value) { dateEl.classList.add('is-invalid'); return; }
        dateEl.classList.remove('is-invalid');
        var row = visaRow;
        bootstrap.Modal.getOrCreateInstance(visaModal).hide();
        window.setTimeout(function () {
          if (row) {
            var ledger = row.nextElementSibling;
            if (ledger && ledger.classList.contains('crm-ledger')) ledger.remove();
            row.remove();
            refreshVisaEligible();
          }
          if (window.Swal) {
            Swal.fire({
              icon: 'success', title: 'Visa application recorded',
              text: 'It is now tracked under Visa & Travel → Visa Processing.',
              showCancelButton: true, confirmButtonText: 'Open Visa Processing', cancelButtonText: 'Stay here',
              confirmButtonColor: '#024766'
            }).then(function (r) { if (r.isConfirmed) window.location.href = 'visa-processing.html?stage=processing'; });
          } else {
            window.alert('Visa application recorded.');
          }
        }, 250);
      });
    }

    /* Sidebar "Interested" arrives as leads.html?status=interested. */
    var statusParam = new URLSearchParams(window.location.search).get('status');
    if (statusParam && document.getElementById('lf-status')) {
      document.getElementById('lf-status').value = statusParam;
      var lfApplyBtn = document.getElementById('lf-apply-btn');
      if (lfApplyBtn) lfApplyBtn.click();
    }

    /* ---------- Payment ledger ----------------------------------------- */
    document.querySelectorAll('.crm-ledger-toggle').forEach(function (btn) {
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

    /* ---------- Record Payment ------------------------------------------ *
     * A payment is made in one currency and reduces that currency's
     * balance only. Nothing is converted, so there is no rate field. */
    var payModal = document.getElementById('addPaymentModal');
    if (payModal) {
      var currencySel = document.getElementById('pay-currency');
      var amountIn = document.getElementById('pay-amount');
      var prefix = document.getElementById('pay-prefix');
      var totalOut = document.getElementById('pay-total');
      var dueOut = document.getElementById('pay-due-after');
      var settled = document.getElementById('pay-settled');
      var saveBtn = document.getElementById('pay-save');
      var usdOption = currencySel ? currencySel.querySelector('option[value="usd"]') : null;
      var dues = { bdt: 0, usd: 0 };

      function fmtFor(cur) { return cur === 'usd' ? usd : bdt; }

      function renderPayment() {
        var cur = currencySel ? currencySel.value : 'bdt';
        var format = fmtFor(cur);
        var owing = dues[cur] || 0;
        var typed = num(amountIn ? amountIn.value : 0);

        /* A payment cannot exceed what is outstanding in that currency. */
        var appliedAmt = Math.min(typed, owing);
        var after = due(owing, appliedAmt);

        if (prefix) prefix.textContent = cur === 'usd' ? '$' : '৳';
        if (totalOut) totalOut.textContent = format(appliedAmt);
        if (dueOut) dueOut.textContent = format(after);

        var other = cur === 'usd' ? dues.bdt : dues.usd;
        var bothClear = after === 0 && num(other) === 0 && typed > 0;
        if (settled) {
          settled.classList.toggle('d-none', !bothClear);
        }

        var over = document.getElementById('pay-over');
        if (over) {
          var exceeds = typed > owing && owing > 0;
          over.classList.toggle('d-none', !exceeds);
          if (exceeds) {
            over.textContent = 'Exceeds the ' + format(owing) +
              ' outstanding in this currency — only that much will be applied.';
          }
        }
        if (saveBtn) saveBtn.disabled = appliedAmt <= 0;
      }

      if (currencySel) currencySel.addEventListener('change', renderPayment);
      if (amountIn) amountIn.addEventListener('input', renderPayment);

      payModal.addEventListener('show.bs.modal', function (ev) {
        var btn = ev.relatedTarget;
        if (btn) {
          dues.bdt = num(btn.dataset.dueBdt);
          dues.usd = num(btn.dataset.dueUsd);
          var takesUsd = btn.dataset.acceptsUsd === 'true';

          /* This modal is one shared node reused by every row, so a
             currency the package does not accept is removed, not merely
             ignored — and the selection is reset to taka so a stale USD
             choice cannot survive into a BDT-only lead. */
          if (usdOption) usdOption.hidden = !takesUsd;
          if (currencySel && (!takesUsd || currencySel.value === 'usd')) currencySel.value = 'bdt';

          var label = document.getElementById('pay-lead-label');
          if (label) {
            var owed = dueSentence(dues);
            label.textContent = (btn.dataset.leadName || '') + ' · ' + (btn.dataset.leadId || '') +
              (owed ? ' · ' + owed + ' outstanding' : ' · nothing outstanding');
          }
        }
        if (amountIn) amountIn.value = '';
        renderPayment();
      });

      if (saveBtn) {
        saveBtn.addEventListener('click', function () {
          if (saveBtn.disabled) return;
          var after = dueOut ? dueOut.textContent : '';
          bootstrap.Modal.getOrCreateInstance(payModal).hide();
          window.setTimeout(function () {
            toast('Payment recorded, receipt issued. Due in this currency: ' + after + '.');
          }, 250);
        });
      }
    }

    /* ---------- Invoice -------------------------------------------------- */
    var invPrint = document.getElementById('inv-print');
    if (invPrint) invPrint.addEventListener('click', function () { window.print(); });

    /* The sheet itself comes from the shared customer invoice layout. */
    var invSheet = document.getElementById('inv-sheet');
    var invData = document.getElementById('inv-data');
    if (invSheet && invData && window.CRMInvoice) {
      try { invSheet.innerHTML = window.CRMInvoice.render(JSON.parse(invData.textContent)); } catch (e) { /* leave empty */ }
    }

    /* This static demo carries one fully worked invoice. Arriving from a
       different lead says so rather than showing another patient's
       figures under the wrong name. */
    var sampleNote = document.getElementById('inv-sample-note');
    if (sampleNote) {
      var wanted = new URLSearchParams(window.location.search).get('lead');
      if (wanted && wanted !== 'ELH-L-2026-000412') {
        var slot = document.getElementById('inv-requested-lead');
        if (slot) slot.textContent = wanted;
        sampleNote.classList.remove('d-none');
      }
    }

    /* ---------- Conversations: lead list, search, selection --------------- *
     * The list on the left is every lead with a conversation history;
     * clicking one loads its timeline on the right. Only Rahim Uddin
     * (ELH-L-2026-000412) carries a fully authored timeline in this static
     * preview, so selecting anyone else swaps the timeline out for an
     * honest placeholder instead of showing borrowed history. */
    var convList = document.getElementById('conv-lead-list');
    if (convList) {
      var convTimeline = document.getElementById('conv-timeline');
      var convPlaceholder = document.getElementById('conv-detail-placeholder');
      var convDetailName = document.getElementById('conv-detail-name');
      var convDetailNameLink = document.getElementById('conv-detail-name-link');
      var convDetailPatient = document.getElementById('conv-detail-patient');
      var convDetailId = document.getElementById('conv-detail-id');
      var convLogBtn = document.getElementById('conv-log-btn');
      var FULL_TIMELINE_LEAD = 'ELH-L-2026-000412';

      convList.addEventListener('click', function (ev) {
        var item = ev.target.closest('.list-group-item');
        if (!item) return;
        ev.preventDefault();

        convList.querySelectorAll('.list-group-item').forEach(function (i) { i.classList.remove('active'); });
        item.classList.add('active');

        var id = item.dataset.leadId || '';
        var name = item.dataset.leadName || '';
        var patient = item.dataset.leadPatient || '';
        if (convDetailName) convDetailName.textContent = name;
        if (convDetailNameLink) convDetailNameLink.href = 'patient-profile.html?lead=' + encodeURIComponent(id);
        if (convDetailPatient) convDetailPatient.textContent = patient && patient !== name ? '· ' + patient : '';
        if (convDetailId) convDetailId.textContent = id;
        if (convLogBtn) {
          convLogBtn.dataset.leadId = id;
          convLogBtn.dataset.leadName = name;
          convLogBtn.dataset.leadPatient = patient || name;
        }

        var hasFullTimeline = id === FULL_TIMELINE_LEAD;
        if (convTimeline) convTimeline.classList.toggle('d-none', !hasFullTimeline);
        if (convPlaceholder) convPlaceholder.classList.toggle('d-none', hasFullTimeline);

        /* On a phone the list and the timeline stack, so picking a lead
           would otherwise leave the visible viewport unchanged — scroll
           the detail card into view. Left alone on wider screens, where
           both panels already sit side by side. */
        if (window.innerWidth < 992) {
          var detailCard = convTimeline ? convTimeline.closest('.card') : null;
          if (detailCard) detailCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }

    var convSearch = document.getElementById('conv-search');
    if (convSearch) {
      var convEmpty = document.getElementById('conv-search-empty');
      convSearch.addEventListener('input', function () {
        var q = convSearch.value.trim().toLowerCase();
        var shown = 0;
        [].slice.call(document.querySelectorAll('#conv-lead-list .list-group-item')).forEach(function (item) {
          var hit = !q || item.textContent.toLowerCase().indexOf(q) !== -1;
          item.classList.toggle('d-none', !hit);
          if (hit) shown++;
        });
        if (convEmpty) convEmpty.classList.toggle('d-none', shown !== 0);
      });
    }

    document.querySelectorAll('.crm-conv-edit').forEach(function (btn) {
      btn.addEventListener('click', function (ev) {
        ev.preventDefault();
        var modal = document.getElementById('logConvModal');
        if (modal && window.bootstrap) bootstrap.Modal.getOrCreateInstance(modal).show(document.getElementById('conv-log-btn'));
        var title = modal ? modal.querySelector('.modal-title') : null;
        if (title) title.textContent = 'Edit Conversation';
      });
    });

    /* ---------- Eligible for Visa: counts + search ------------------------ */
    function refreshVisaEligible() {
      var t = document.getElementById('ve-table');
      if (!t) return;
      var rows = [].slice.call(t.querySelectorAll('tbody tr'));
      var q = (document.getElementById('ve-search').value || '').trim().toLowerCase();
      var shown = 0;
      rows.forEach(function (r) {
        var hit = !q || r.textContent.toLowerCase().indexOf(q) !== -1;
        r.classList.toggle('d-none', !hit);
        if (hit) shown++;
      });
      document.getElementById('ve-count').textContent = rows.length;
      document.getElementById('ve-paid-count').textContent = rows.filter(function (r) { return r.dataset.paid === '1'; }).length;
      document.getElementById('ve-empty').classList.toggle('d-none', shown !== 0);
    }
    var veSearch = document.getElementById('ve-search');
    if (veSearch) veSearch.addEventListener('input', refreshVisaEligible);

    /* ---------- Not Interested Leads: search ------------------------------ */
    var niSearch = document.getElementById('ni-search');
    if (niSearch) {
      var niTable = document.getElementById('ni-table');
      var niEmpty = document.getElementById('ni-search-empty');
      niSearch.addEventListener('input', function () {
        var q = niSearch.value.trim().toLowerCase();
        var shown = 0;
        [].slice.call(niTable.querySelectorAll('tbody tr')).forEach(function (row) {
          var hit = !q || row.textContent.toLowerCase().indexOf(q) !== -1;
          row.classList.toggle('d-none', !hit);
          if (hit) shown++;
        });
        if (niEmpty) niEmpty.classList.toggle('d-none', shown !== 0);
      });
    }

    document.querySelectorAll('.crm-conv-delete').forEach(function (btn) {
      btn.addEventListener('click', function (ev) {
        ev.preventDefault();
        var item = btn.closest('.crm-timeline-item');
        var run = function () {
          if (item) item.remove();
          toast('Conversation entry deleted.');
        };
        if (window.Swal) {
          Swal.fire({
            icon: 'warning', title: 'Delete this conversation?',
            text: 'This entry will be removed from the timeline.',
            showCancelButton: true, confirmButtonText: 'Delete', confirmButtonColor: '#dc3545'
          }).then(function (r) { if (r.isConfirmed) run(); });
        } else if (window.confirm('Delete this conversation entry?')) {
          run();
        }
      });
    });

    /* ---------- Sidebar "Add Lead" handoff -------------------------------- *
     * The Leads dropdown's Add Lead entry just links to leads.html with a
     * query flag, since a sidebar link can't open a modal directly — this
     * is what actually opens it on arrival. */
    if (new URLSearchParams(window.location.search).get('action') === 'add-lead') {
      var addLeadModalEl = document.getElementById('addLeadModal');
      if (addLeadModalEl && window.bootstrap) {
        bootstrap.Modal.getOrCreateInstance(addLeadModalEl).show();
      }
    }

    /* ---------- Arriving with ?lead= ------------------------------------ *
     * Full Timeline / View Conversation link here to read a lead's history,
     * so that lead is simply selected in the list. Only the Add Lead
     * handoff (&log=1) goes on to open the Log Conversation form. */
    var params = new URLSearchParams(window.location.search);
    var leadParam = params.get('lead');
    if (leadParam) {
      var listItem = convList ? convList.querySelector('.list-group-item[data-lead-id="' + leadParam.replace(/"/g, '') + '"]') : null;
      if (listItem) {
        listItem.click();
        listItem.scrollIntoView({ block: 'nearest' });
      } else if (convList) {
        /* Not in the list yet (no conversation logged): show the lead's
           header with the empty-history placeholder, nothing else selected. */
        var cvName = params.get('name') || leadParam;
        var cvPatient = params.get('patient') || '';
        convList.querySelectorAll('.list-group-item').forEach(function (i) { i.classList.remove('active'); });
        if (convDetailName) convDetailName.textContent = cvName;
        if (convDetailNameLink) convDetailNameLink.href = 'patient-profile.html?lead=' + encodeURIComponent(leadParam);
        if (convDetailPatient) convDetailPatient.textContent = cvPatient && cvPatient !== cvName ? '· ' + cvPatient : '';
        if (convDetailId) convDetailId.textContent = leadParam;
        if (convLogBtn) {
          convLogBtn.dataset.leadId = leadParam;
          convLogBtn.dataset.leadName = cvName;
          convLogBtn.dataset.leadPatient = cvPatient || cvName;
        }
        if (convTimeline) convTimeline.classList.add('d-none');
        if (convPlaceholder) convPlaceholder.classList.remove('d-none');
      }
      if (params.get('log') === '1') {
        var handoffBtn = document.getElementById('conv-log-btn');
        var convModal = document.getElementById('logConvModal');
        if (handoffBtn && convModal && window.bootstrap) {
          bootstrap.Modal.getOrCreateInstance(convModal).show(handoffBtn);
        }
      }
    }

    function toast(msg) {
      if (window.Swal) Swal.fire({ icon: 'success', title: 'Saved', text: msg, confirmButtonColor: '#024766' });
      else window.alert(msg);
    }
  });
})();
