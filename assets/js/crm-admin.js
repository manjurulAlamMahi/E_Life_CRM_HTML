/**
 * E Life Healthcare CRM — Administration behaviour.
 *
 * Users and the role/permission matrix. Loaded only on pages flagged
 * `adminjs` in build/build.js.
 *
 * The permission model is Spatie's: a role holds permissions, and a user's
 * role is the only thing granting them anything. There are no per-user
 * overrides by design.
 */
(function () {
  'use strict';

  window.CRMAdmin = {};

  function toast(msg) {
    if (window.Swal) Swal.fire({ icon: 'success', title: 'Saved', text: msg, confirmButtonColor: '#024766' });
    else window.alert(msg);
  }

  /* What each role can do, in one sentence, so the person assigning a role
     is told the consequence rather than having to go and read the matrix. */
  var ROLE_NOTES = {
    'Admin': 'Full access, including packages, users, roles and settings.',
    'Manager': 'Runs the pipeline and sees reports. Cannot verify payments or change roles.',
    'Sales Executive': 'Works their own leads and deals. Cannot verify payments or see reports.',
    'Accounts': 'Verifies payments, issues receipts and chases dues. No lead editing.'
  };

  document.addEventListener('DOMContentLoaded', function () {

    /* ---------- Users: filters ------------------------------------------- */
    var userFilters = document.getElementById('user-filters');
    if (userFilters) {
      var table = document.querySelector('table.crm-table');
      var criteria = { role: '', active: '' };

      if (window.jQuery && jQuery.fn.dataTable) {
        jQuery.fn.dataTable.ext.search.push(function (settings, data, index) {
          if (settings.nTable !== table) return true;
          var row = settings.aoData[index] && settings.aoData[index].nTr;
          if (!row) return true;
          if (criteria.role && row.dataset.role !== criteria.role) return false;
          if (criteria.active && row.dataset.active !== criteria.active) return false;
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
      bind('uf-role', 'role');
      bind('uf-active', 'active');

      var search = document.getElementById('uf-search');
      if (search) {
        search.addEventListener('input', function () {
          if (window.jQuery && jQuery.fn.dataTable && jQuery.fn.dataTable.isDataTable(table)) {
            jQuery(table).DataTable().search(search.value).draw();
          }
        });
      }
      var reset = document.getElementById('uf-reset');
      if (reset) {
        reset.addEventListener('click', function () {
          criteria = { role: '', active: '' };
          ['uf-role', 'uf-active', 'uf-search'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.value = '';
          });
          if (window.jQuery && jQuery.fn.dataTable && jQuery.fn.dataTable.isDataTable(table)) {
            jQuery(table).DataTable().search('').draw();
          }
        });
      }
    }

    /* ---------- Users: enable / disable ----------------------------------- */
    document.querySelectorAll('.crm-user-toggle').forEach(function (input) {
      input.addEventListener('change', function () {
        var row = input.closest('tr');
        var label = row ? row.querySelector('.crm-user-state') : null;
        var name = row ? (row.querySelector('.fw-semibold') || {}).textContent : 'This user';
        if (label) label.textContent = input.checked ? 'Active' : 'Disabled';
        if (row) row.dataset.active = input.checked ? 'true' : 'false';
        toast((name || 'This user') + (input.checked ? ' can sign in again.' : ' can no longer sign in.'));
      });
    });

    /* ---------- Add / edit user -------------------------------------------- */
    var userModal = document.getElementById('userModal');
    if (userModal) {
      var roleSel = document.getElementById('um-role');
      var roleNote = document.getElementById('um-role-note');

      var showRoleNote = function () {
        if (roleNote && roleSel) roleNote.textContent = ROLE_NOTES[roleSel.value] || '';
      };
      if (roleSel) roleSel.addEventListener('change', showRoleNote);

      userModal.addEventListener('show.bs.modal', function (ev) {
        var btn = ev.relatedTarget;
        var editing = btn && btn.dataset.userName;
        var title = userModal.querySelector('.um-title');
        if (title) title.textContent = editing ? 'Edit User' : 'Add User';

        var set = function (id, v) {
          var el = document.getElementById(id);
          if (el) el.value = v || '';
        };
        set('um-name', editing ? btn.dataset.userName : '');
        set('um-email', editing ? btn.dataset.userEmail : '');
        set('um-phone', editing ? btn.dataset.userPhone : '');
        set('um-desig', editing ? btn.dataset.userDesig : '');
        set('um-role', editing ? btn.dataset.userRole : 'Sales Executive');
        /* New users get the next Employee ID in the Settings format; the
           counter only moves when the user is actually saved (server side). */
        var ids = window.CRMSettings && CRMSettings.get().ids.employee;
        set('um-empid', editing ? (btn.dataset.userEmpid || '—') : (ids ? CRMSettings.formatId('employee', ids.next) : ''));
        showRoleNote();
      });
    }

    /* ---------- Permission matrix ------------------------------------------ *
     * An administrator always holds every permission, so that column is
     * locked rather than merely pre-ticked — an admin who could revoke
     * their own access to Roles would lock everyone out of it. */
    var matrix = document.getElementById('permission-matrix');
    if (matrix) {
      matrix.querySelectorAll('.crm-perm[data-role="Admin"]').forEach(function (box) {
        box.checked = true;
        box.disabled = true;
      });

      var save = document.getElementById('perm-save');
      if (save) {
        save.addEventListener('click', function () {
          var counts = {};
          matrix.querySelectorAll('.crm-perm').forEach(function (box) {
            if (box.checked) counts[box.dataset.role] = (counts[box.dataset.role] || 0) + 1;
          });
          var summary = Object.keys(counts).map(function (r) {
            return r + ' ' + counts[r];
          }).join(' · ');
          toast('Permissions saved. ' + summary + '.');
        });
      }
    }
  });
})();
