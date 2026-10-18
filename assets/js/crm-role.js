/* ==========================================================================
   E Life Healthcare CRM — presentation-mode role demo login
   --------------------------------------------------------------------------
   This is a static demo build with no backend, so "logging in as a role"
   simply means: remember the chosen role in localStorage, then use it on
   every page to hide the sidebar links / quick links a real user with that
   role would not have, and to redirect away from pages that role has no
   business seeing. Nothing here is real access control — it exists purely
   so a presenter can log out and back in as a different role and have the
   UI visibly change, without needing a server.
   ========================================================================== */
(function () {
    'use strict';

    var STORAGE_KEY = 'crm_demo_role';

    // Every page a role is allowed to open. Admin (or no role picked yet,
    // e.g. opening a file directly during development) means "no restriction".
    var ROLE_PAGES = {
        'Manager': [
            'dashboard.html', 'user-dashboard.html',
            'leads.html', 'conversations.html', 'applied-leads.html', 'followups.html',
            'not-interested-leads.html', 'completed-leads.html', 'visa-processing.html', 'visa-eligible.html', 'tickets.html', 'dollar-payments.html', 'treatment-countdown.html', 'treatment.html', 'source-admin.html', 'expenses.html', 'expense-patient.html', 'expense-report.html',
            'confirmed-leads.html', 'pipeline.html', 'sources.html',
            'patients.html', 'deals.html',
            'payments.html', 'receipts.html', 'dues.html',
            'packages.html', 'reports.html', 'report-builder.html', 'report-result.html'
            // no Users / Roles & Permissions / Settings / Audit Logs
        ],
        'Sales Executive': [
            'user-dashboard.html',
            'leads.html', 'conversations.html', 'applied-leads.html', 'followups.html',
            'not-interested-leads.html', 'completed-leads.html', 'visa-processing.html', 'visa-eligible.html', 'tickets.html', 'treatment-countdown.html', 'treatment.html', 'source-admin.html',
            'confirmed-leads.html', 'pipeline.html', 'sources.html',
            'patients.html', 'deals.html'
            // no Admin dashboard, no Accounts money pages, no Administration
        ],
        'Accounts': [
            'user-dashboard.html',
            'payments.html', 'receipts.html', 'dues.html', 'expenses.html', 'expense-patient.html', 'expense-report.html',
            'patients.html', 'reports.html', 'report-builder.html', 'report-result.html'
            // no lead pipeline, no Administration
        ]
    };

    // The full universe of pages that participate in role gating at all.
    // Anything not in this list (My Account, Screen Lock, Login...) is
    // always left alone, for every role.
    var ALL_GATED_PAGES = [
        'dashboard.html', 'user-dashboard.html',
        'leads.html', 'conversations.html', 'applied-leads.html', 'followups.html',
        'not-interested-leads.html', 'completed-leads.html', 'visa-processing.html', 'visa-eligible.html', 'tickets.html', 'dollar-payments.html', 'treatment-countdown.html', 'treatment.html', 'source-admin.html', 'expenses.html', 'expense-patient.html', 'expense-report.html',
        'confirmed-leads.html', 'pipeline.html', 'sources.html',
        'patients.html', 'deals.html',
        'payments.html', 'receipts.html', 'dues.html',
        'packages.html', 'reports.html', 'report-builder.html', 'report-result.html',
        'users.html', 'roles.html', 'settings.html', 'audit-log.html'
    ];

    var DEMO_USERS = {
        'Admin': { name: 'Mahi Alam', title: 'Administrator', badge: 'Admin', badgeClass: 'badge-label-primary' },
        'Manager': { name: 'Farhana Chowdhury', title: 'Branch Manager', badge: 'Manager', badgeClass: 'badge-label-info' },
        'Sales Executive': { name: 'Tanvir Ahmed', title: 'Sales Executive', badge: 'Sales Executive', badgeClass: 'badge-label-warning' },
        'Accounts': { name: 'Nusrat Jahan', title: 'Accounts Officer', badge: 'Accounts', badgeClass: 'badge-label-success' }
    };

    function getRole() {
        try {
            return localStorage.getItem(STORAGE_KEY) || 'Admin';
        } catch (e) {
            return 'Admin';
        }
    }

    function pageName(href) {
        if (!href) return '';
        // Strip any query string / hash, then take the final path segment.
        var clean = href.split('#')[0].split('?')[0];
        var parts = clean.split('/');
        return parts[parts.length - 1] || 'dashboard.html';
    }

    function toSet(arr) {
        var s = {};
        for (var i = 0; i < arr.length; i++) s[arr[i]] = true;
        return s;
    }

    var GATED_SET = toSet(ALL_GATED_PAGES);

    function isHiddenForRole(page, allowedSet) {
        return !!GATED_SET[page] && !allowedSet[page];
    }

    function hideNav(role) {
        var allowedList = ROLE_PAGES[role];
        if (!allowedList) return; // Admin / unknown role — nothing hidden
        var allowedSet = toSet(allowedList);

        // Sidebar links (both the vertical and the horizontal-layout menu
        // share id="sidebar-menu" in this template's markup).
        var links = document.querySelectorAll('#sidebar-menu a[href]');
        for (var i = 0; i < links.length; i++) {
            var page = pageName(links[i].getAttribute('href'));
            if (isHiddenForRole(page, allowedSet)) {
                var li = links[i].closest('li');
                if (li) li.style.display = 'none';
            }
        }

        // A dropdown (e.g. Settings) whose every sub-item is now hidden goes
        // too — otherwise the role sees an empty menu it cannot open to anything.
        var parents = document.querySelectorAll('#sidebar-menu a.has-arrow');
        for (var p = 0; p < parents.length; p++) {
            var pli = parents[p].closest('li');
            var subs = pli ? pli.querySelectorAll('ul li') : [];
            var visible = 0;
            for (var q = 0; q < subs.length; q++) if (subs[q].style.display !== 'none') visible++;
            if (pli && subs.length && !visible) pli.style.display = 'none';
        }

        // Topbar profile-dropdown quick links (My Account panel grid).
        var quick = document.querySelectorAll('.grid-nav-item[href]');
        for (var j = 0; j < quick.length; j++) {
            var qPage = pageName(quick[j].getAttribute('href'));
            if (isHiddenForRole(qPage, allowedSet)) {
                quick[j].style.display = 'none';
            }
        }

        // Collapse section headings ("Accounts", "Administration"...) whose
        // items are now all hidden, so the sidebar doesn't show a dangling
        // label above nothing.
        var menus = document.querySelectorAll('#sidebar-menu ul.list-unstyled');
        for (var m = 0; m < menus.length; m++) {
            var items = menus[m].children;
            for (var k = 0; k < items.length; k++) {
                if (items[k].classList && items[k].classList.contains('menu-title')) {
                    var any = false, allHidden = true, n = k + 1;
                    while (n < items.length && !(items[n].classList && items[n].classList.contains('menu-title'))) {
                        any = true;
                        if (items[n].style.display !== 'none') allHidden = false;
                        n++;
                    }
                    items[k].style.display = (any && allHidden) ? 'none' : '';
                }
            }
        }
    }

    function paintUserBadge(role) {
        var info = DEMO_USERS[role];
        if (!info) return;
        var scope = document.querySelector('.admin-user-info');
        if (!scope) return;

        var nameEls = scope.querySelectorAll('.admin-name, .rich-list-title');
        for (var i = 0; i < nameEls.length; i++) nameEls[i].textContent = info.name;

        var subtitle = scope.querySelector('.rich-list-subtitle');
        if (subtitle) subtitle.textContent = info.title;

        var badge = scope.querySelector('.rich-list-append .badge');
        if (badge) {
            badge.textContent = info.badge;
            badge.className = 'badge fs-6 ' + info.badgeClass;
        }
    }

    function wireSignOut() {
        // Any "Sign Out" link in this template points at login.html — clear
        // the remembered demo role so the login page starts fresh.
        var signOuts = document.querySelectorAll('a[href="login.html"]');
        for (var i = 0; i < signOuts.length; i++) {
            signOuts[i].addEventListener('click', function () {
                try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
            });
        }
    }

    function init() {
        var role = getRole();
        hideNav(role);
        paintUserBadge(role);
        wireSignOut();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Exposed so login.html's demo-login buttons can reuse the same data
    // instead of duplicating the role list.
    window.CRM_DEMO = { ROLE_PAGES: ROLE_PAGES, DEMO_USERS: DEMO_USERS, STORAGE_KEY: STORAGE_KEY };
})();
