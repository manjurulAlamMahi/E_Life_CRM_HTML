/**
 * E Life Healthcare CRM — Settings page (settings.html).
 *
 * Edits the CRMSettings store (crm-demo.js): company profile, ID formats,
 * database backup and the dropdown option lists. Every other page reads
 * the same store, so a saved change shows up on the next form, invoice or
 * printout that is opened. In Laravel: SettingsController + a settings table.
 */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function toast(msg, icon) {
    if (window.Swal) {
      Swal.fire({ toast: true, position: 'top-end', icon: icon || 'success', title: msg, showConfirmButton: false, timer: 2200, timerProgressBar: true });
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!$('set-company-form') || !window.CRMSettings) return;
    var S = CRMSettings.get();

    /* ---------- Company profile ------------------------------------- */
    var logoData = S.company.logo || '';
    function fillCompany() {
      $('co-name').value = S.company.name;
      $('co-address').value = S.company.address;
      $('co-phone').value = S.company.phone;
      $('co-email').value = S.company.email;
      $('co-logo-preview').src = logoData || 'assets/logo.png';
    }
    fillCompany();

    $('co-logo').addEventListener('change', function () {
      var f = this.files && this.files[0];
      this.value = '';
      if (!f) return;
      if (f.size > 500 * 1024) { toast('That logo is over 500 KB — please use a smaller file.', 'error'); return; }
      var r = new FileReader();
      r.onload = function () { logoData = r.result; $('co-logo-preview').src = logoData; };
      r.readAsDataURL(f);
    });
    $('co-logo-reset').addEventListener('click', function () {
      logoData = '';
      $('co-logo-preview').src = 'assets/logo.png';
    });

    $('set-company-form').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var name = $('co-name').value.trim(), address = $('co-address').value.trim();
      $('co-name').classList.toggle('is-invalid', !name);
      $('co-address').classList.toggle('is-invalid', !address);
      if (!name || !address) return;
      S.company = { name: name, address: address, phone: $('co-phone').value.trim(), email: $('co-email').value.trim(), logo: logoData };
      CRMSettings.save(S);
      CRMSettings.applyToPage(document);   // topbar logo etc. update straight away
      toast('Company profile saved');
    });

    /* ---------- ID format ------------------------------------------- */
    var KINDS = ['lead', 'patient', 'employee', 'invoice', 'receipt'];
    function idRow(kind) {
      var f = S.ids[kind];
      var opt = function (v, label, cur) { return '<option value="' + v + '"' + (v === cur ? ' selected' : '') + '>' + label + '</option>'; };
      var digits = [3, 4, 5, 6].map(function (d) { return opt(String(d), String(d), String(f.digits)); }).join('');
      return '<tr data-kind="' + kind + '">' +
        '<td class="text-nowrap"><div class="fw-semibold">' + esc(f.label) + '</div>' +
          '<div class="mono fs-12 text-primary" data-preview></div><div class="fs-11 text-muted" data-preview-next></div></td>' +
        '<td><input type="text" class="form-control form-control-sm" data-f="prefix" value="' + esc(f.prefix) + '" maxlength="10" style="width:84px"></td>' +
        '<td><select class="form-select form-select-sm" data-f="year" style="width:92px">' + opt('', 'None', f.year) + opt('yy', '26', f.year) + opt('yyyy', '2026', f.year) + '</select></td>' +
        '<td><select class="form-select form-select-sm" data-f="sep" style="width:68px">' + opt('-', '-', f.sep) + opt('/', '/', f.sep) + opt('', 'None', f.sep) + '</select></td>' +
        '<td><select class="form-select form-select-sm" data-f="digits" style="width:68px">' + digits + '</select></td>' +
        '<td><input type="number" class="form-control form-control-sm" data-f="next" min="1" value="' + esc(f.next) + '" style="width:76px"></td>' +
        '<td class="text-center"><div class="form-check form-switch d-inline-block mb-0"><input class="form-check-input" type="checkbox" data-f="yearly"' + (f.yearly ? ' checked' : '') + '></div></td>' +
        '</tr>';
    }
    function readRow(tr) {
      var f = {};
      [].forEach.call(tr.querySelectorAll('[data-f]'), function (el) {
        var k = el.getAttribute('data-f');
        f[k] = el.type === 'checkbox' ? el.checked : el.value;
      });
      f.prefix = f.prefix.trim();
      f.digits = parseInt(f.digits, 10);
      f.next = Math.max(1, parseInt(f.next, 10) || 1);
      return f;
    }
    function previewRow(tr) {
      var f = readRow(tr), y = new Date().getFullYear();
      tr.querySelector('[data-preview]').textContent = CRMSettings.formatId(null, f.next, null, f);
      tr.querySelector('[data-preview-next]').textContent = f.yearly && f.year
        ? 'From ' + (y + 1) + ': ' + CRMSettings.formatId(null, 1, new Date(y + 1, 0, 1), f)
        : '';
    }
    $('set-id-rows').innerHTML = KINDS.map(idRow).join('');
    [].forEach.call($('set-id-rows').rows, previewRow);
    $('set-id-rows').addEventListener('input', function (ev) { previewRow(ev.target.closest('tr')); });
    $('set-id-rows').addEventListener('change', function (ev) { previewRow(ev.target.closest('tr')); });
    $('set-ids-save').addEventListener('click', function () {
      var ok = true;
      [].forEach.call($('set-id-rows').rows, function (tr) {
        var f = readRow(tr), input = tr.querySelector('[data-f="prefix"]');
        input.classList.toggle('is-invalid', !f.prefix);
        if (!f.prefix) { ok = false; return; }
        var cur = S.ids[tr.getAttribute('data-kind')];
        Object.keys(f).forEach(function (k) { cur[k] = f[k]; });
      });
      if (!ok) { toast('Every ID needs a prefix.', 'error'); return; }
      CRMSettings.save(S);
      toast('ID formats saved');
    });

    /* ---------- Database backup ------------------------------------- */
    $('bk-last').textContent = S.backup.last;
    ['schedule', 'destination', 'retention'].forEach(function (k) { $('bk-' + k).value = S.backup[k]; });
    $('bk-save').addEventListener('click', function () {
      ['schedule', 'destination', 'retention'].forEach(function (k) { S.backup[k] = $('bk-' + k).value; });
      CRMSettings.save(S);
      toast('Backup schedule saved');
    });
    $('bk-run').addEventListener('click', function () {
      var btn = this;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Backing up…';
      setTimeout(function () {
        var d = new Date();
        S.backup.last = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' +
          d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        CRMSettings.save(S);
        $('bk-last').textContent = S.backup.last;
        btn.disabled = false;
        btn.innerHTML = '<i class="mdi mdi-database-arrow-up-outline me-1"></i>Back Up Now';
        toast('Backup sent to ' + S.backup.destination);
      }, 1200);
    });

    /* ---------- Dropdown option lists ------------------------------- *
     * One editor per [data-list-editor]: add, rename, move up/down,
     * remove. Removing an option only takes it out of future dropdowns —
     * records that already used it keep their text. */
    function renderEditor(box) {
      var key = box.getAttribute('data-list-editor');
      var items = S.lists[key] || [];
      box.className = 'card set-list';
      box.innerHTML =
        '<div class="card-header d-flex flex-nowrap align-items-start justify-content-between gap-2">' +
          '<div class="flex-grow-1" style="min-width:0"><h5 class="card-title mb-0">' + esc(box.getAttribute('data-title')) +
            ' <span class="badge bg-secondary-subtle text-secondary ms-1 fw-semibold">' + items.length + '</span></h5>' +
          '<p class="fs-12 text-muted mb-0">Used in: ' + esc(box.getAttribute('data-used-in')) + '</p></div>' +
          '<button type="button" class="btn btn-sm btn-link text-muted p-0 text-nowrap" data-act="defaults" title="Restore the original options">Reset</button>' +
        '</div>' +
        '<ul class="list-unstyled mb-0 set-list-items">' +
          (items.map(function (v, i) {
            return '<li data-i="' + i + '"><span class="set-list-name">' + esc(v) + '</span>' +
              '<span class="set-list-actions">' +
                '<button type="button" class="btn btn-sm btn-icon btn-light" data-act="up" title="Move up"' + (i === 0 ? ' disabled' : '') + '><i class="mdi mdi-arrow-up"></i></button>' +
                '<button type="button" class="btn btn-sm btn-icon btn-light" data-act="down" title="Move down"' + (i === items.length - 1 ? ' disabled' : '') + '><i class="mdi mdi-arrow-down"></i></button>' +
                '<button type="button" class="btn btn-sm btn-icon btn-light" data-act="edit" title="Rename"><i class="mdi mdi-pencil-outline"></i></button>' +
                '<button type="button" class="btn btn-sm btn-icon btn-light text-danger" data-act="remove" title="Remove"><i class="mdi mdi-trash-can-outline"></i></button>' +
              '</span></li>';
          }).join('') || '<li class="text-muted fs-13 justify-content-center">No options yet — add the first one below.</li>') +
        '</ul>' +
        '<form class="card-footer bg-transparent d-flex gap-2" data-act="add" novalidate>' +
          '<input type="text" class="form-control form-control-sm" maxlength="60" placeholder="' + esc(box.getAttribute('data-placeholder') || 'New option') + '" aria-label="New option">' +
          '<button type="submit" class="btn btn-sm btn-primary text-nowrap"><i class="mdi mdi-plus me-1"></i>Add</button>' +
        '</form>';
    }
    function exists(key, v, except) {
      return (S.lists[key] || []).some(function (x, i) { return i !== except && x.toLowerCase() === v.toLowerCase(); });
    }
    function commit(box, msg) {
      CRMSettings.save(S);
      renderEditor(box);
      if (msg) toast(msg);
    }
    var editors = [].slice.call(document.querySelectorAll('[data-list-editor]'));
    editors.forEach(function (box) {
      var key = box.getAttribute('data-list-editor');
      renderEditor(box);

      box.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var input = ev.target.querySelector('input');
        var v = input.value.trim();
        if (!v) { input.classList.add('is-invalid'); input.focus(); return; }
        if (exists(key, v)) { input.classList.add('is-invalid'); toast('“' + v + '” is already in the list.', 'warning'); return; }
        S.lists[key].push(v);
        commit(box, '“' + v + '” added');
        box.querySelector('form input').focus();
      });
      box.addEventListener('input', function (ev) { ev.target.classList.remove('is-invalid'); });

      box.addEventListener('click', function (ev) {
        var btn = ev.target.closest('[data-act]');
        if (!btn || btn.tagName === 'FORM') return;
        var act = btn.getAttribute('data-act');
        var li = btn.closest('li'), i = li ? parseInt(li.getAttribute('data-i'), 10) : -1;
        var list = S.lists[key];

        if (act === 'up' || act === 'down') {
          var j = act === 'up' ? i - 1 : i + 1;
          var t = list[i]; list[i] = list[j]; list[j] = t;
          commit(box);
        } else if (act === 'edit') {
          var name = li.querySelector('.set-list-name');
          name.innerHTML = '<input type="text" class="form-control form-control-sm" maxlength="60" value="' + esc(list[i]) + '">';
          var inp = name.querySelector('input');
          inp.focus(); inp.select();
          var done = false;
          var finish = function (save) {
            if (done) return; done = true;
            var v = inp.value.trim();
            if (save && v && v !== list[i]) {
              if (exists(key, v, i)) { toast('“' + v + '” is already in the list.', 'warning'); renderEditor(box); return; }
              list[i] = v; commit(box, 'Renamed');
            } else renderEditor(box);
          };
          inp.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); finish(true); }
            if (e.key === 'Escape') finish(false);
          });
          inp.addEventListener('blur', function () { finish(true); });
        } else if (act === 'remove') {
          var remove = function () { var v = list.splice(i, 1)[0]; commit(box, '“' + v + '” removed'); };
          if (!window.Swal) { remove(); return; }
          Swal.fire({
            icon: 'warning', title: 'Remove “' + list[i] + '”?',
            text: 'It will no longer appear in dropdowns. Records that already use it keep it.',
            showCancelButton: true, confirmButtonText: 'Remove', confirmButtonColor: '#d63939'
          }).then(function (r) { if (r.isConfirmed) remove(); });
        } else if (act === 'defaults') {
          var restore = function () { S.lists[key] = CRMSettings.defaults().lists[key]; commit(box, 'Original options restored'); };
          if (!window.Swal) { restore(); return; }
          Swal.fire({
            icon: 'question', title: 'Restore the original options?', text: 'Anything you added to this list will be removed.',
            showCancelButton: true, confirmButtonText: 'Restore', confirmButtonColor: '#024766'
          }).then(function (r) { if (r.isConfirmed) restore(); });
        }
      });
    });

    /* Open the tab named in the URL hash (settings.html#set-payments). */
    var hashLink = location.hash && document.querySelector('.set-nav a[href="' + location.hash + '"]');
    if (hashLink && window.bootstrap) bootstrap.Tab.getOrCreateInstance(hashLink).show();
  });
})();
