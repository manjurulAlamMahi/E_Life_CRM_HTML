#!/usr/bin/env node
/**
 * Static-site assembler for the E Life Healthcare CRM demo.
 *
 * Assembles  head + topbar + sidebars + page content + footer + scripts
 * into the repo root's *.html, using the Aquiry template's own chrome
 * markup so the design renders exactly as the template intends.
 *
 * Mirrors the Blade structure in plan.md:
 *   partials/topbar.html   -> Backend/Partials/header.blade.php
 *   partials/sidebar*      -> Backend/Partials/sidebar.blade.php
 *   partials/footer.html   -> Backend/Partials/footer.blade.php
 *   this assembler         -> Backend/main.blade.php
 *
 *   node build/build.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = ROOT;
const P = (f) => fs.readFileSync(path.join(__dirname, 'partials', f), 'utf8').replace(/\s+$/, '');

/* Shared blocks injected into page bodies at their marker comments.
   Authored once in build/partials/ — see Task 5 of the Leads plan. */
const INJECTIONS = {
  '<!--@apply-block-->': 'apply-block.html',
  '<!--@status-modals-->': 'status-modals.html',
  '<!--@quick-view-->': 'quick-view.html',
  '<!--@lead-modals-->': 'lead-modals.html',
  '<!--@next-followup-->': 'next-followup-modal.html',
  '<!--@apply-visa-->': 'apply-visa-modal.html',
  '<!--@log-conversation-->': 'log-conversation.html',
  '<!--@reschedule-->': 'reschedule-modal.html',
  '<!--@payment-modals-->': 'payment-modals.html',
  '<!--@record-payment-->': 'record-payment.html',
  '<!--@payment-review-->': 'payment-review.html',
};

/* Partials may themselves contain markers (status-modals.html embeds the
   apply block), so resolve to a fixed point rather than in one pass. */
function inject(content) {
  for (let depth = 0; depth < 5; depth++) {
    let changed = false;
    for (const [marker, file] of Object.entries(INJECTIONS)) {
      if (!content.includes(marker)) continue;
      if (content.indexOf(marker) !== content.lastIndexOf(marker)) {
        throw new Error(marker + ' appears more than once — ids would collide');
      }
      content = content.replace(marker, P(file));
      changed = true;
    }
    if (!changed) return checkNoStrayMarkers(content);
  }
  throw new Error('injection did not settle — check for a marker cycle');
}

/* A marker whose name is misspelled matches no INJECTIONS key, so the loop
   settles and would ship the literal comment into the page. Fail instead:
   the page would silently be missing a whole block. */
function checkNoStrayMarkers(content) {
  const stray = content.match(/<!--@[\w-]*-->/);
  if (stray) {
    throw new Error(
      'unresolved marker ' + stray[0] + ' — known markers: ' + Object.keys(INJECTIONS).join(', ')
    );
  }
  return content;
}

const menu = require('./menu.js');

/* ------------------------------------------------------------------ *
 * Pages — title, breadcrumb trail, extra head/scripts, content file
 * ------------------------------------------------------------------ */
const PAGES = [
  { file: 'user-dashboard.html', title: 'Dashboard',  crumb: ['Dashboard'], content: 'index.html', dollarjs: true },
  { file: 'index.html',         title: 'Dashboard',  crumb: ['Dashboard'], dollarjs: true },
  { file: 'leads.html',         title: 'Leads',              crumb: ['Lead Management', 'Leads'],       dt: true, swal: true, leadsjs: true },
  { file: 'applied-leads.html',   title: 'Applied Leads',   crumb: ['Lead Management', 'Applied Leads'],   dt: true, swal: true, leadsjs: true },
  { file: 'confirmed-leads.html', title: 'Confirmed Leads', crumb: ['Lead Management', 'Confirmed Leads'], dt: true, swal: true, leadsjs: true },
  { file: 'conversations.html', title: 'Conversations',      crumb: ['Lead Management', 'Conversations'], swal: true, leadsjs: true },
  /* Reached from the Apply step and from applied/confirmed rows, never from
     the sidebar — an invoice only exists in the context of one lead, so it
     is deliberately absent from menu.js. */
  { file: 'invoice.html',       title: 'Invoice',            crumb: ['Lead Management', 'Invoice'],     swal: true, leadsjs: true },
  { file: 'followups.html',     title: 'Follow-ups',         crumb: ['Lead Management', 'Follow-ups'],  dt: true, leadsjs: true },
  { file: 'interested-leads.html', title: 'Interested', crumb: ['Lead Management', 'Interested'], swal: true, leadsjs: true },
  { file: 'not-interested-leads.html', title: 'Not Interested', crumb: ['Lead Management', 'Not Interested'], dt: true, swal: true, leadsjs: true },
  { file: 'completed-leads.html', title: 'Payment Completed', crumb: ['Payment Module', 'Payment Completed'], swal: true, paymentsjs: true },
  { file: 'dollar-payments.html', title: 'Dollar Payments', crumb: ['Dollar Module', 'Dollar Payments'], swal: true, dollarjs: true },
  { file: 'treatment-countdown.html', title: 'Treatment Countdown', crumb: ['Visa & Travel', 'Treatment Countdown'], swal: true, countdownjs: true },
  { file: 'visa-eligible.html', title: 'Eligible for Visa', crumb: ['Visa & Travel', 'Eligible to Apply'], swal: true, leadsjs: true },
  { file: 'pipeline.html',      title: 'Sales Pipeline',     crumb: ['Lead Management', 'Sales Pipeline'], dragula: true },
  { file: 'expense-report.html', title: 'Expense Report', crumb: ['Expense Module', 'Expense Report'], swal: true, expensejs: true },
  { file: 'expense-patient.html', title: 'Patient Expense', crumb: ['Expense Module', 'Patient Expense'], swal: true, expensejs: true },
  { file: 'expenses.html', title: 'Expenses', crumb: ['Expense Module', 'Expenses'], swal: true, expensejs: true },
  { file: 'source-admin.html', title: 'Sources', crumb: ['Settings', 'Sources'], dt: true, swal: true },
  { file: 'tickets.html', title: 'Tickets', crumb: ['Ticket Module', 'Tickets'], swal: true, ticketsjs: true },
  { file: 'treatment.html', title: 'Treatment', crumb: ['Treatment Module', 'Treatment'], swal: true, treatmentjs: true },
  { file: 'sources.html',       title: 'Sources & Referrals',crumb: ['Lead Management', 'Sources'],     dt: true, apex: true, leadsjs: true },
  /* Stub — see the comment at the top of build/pages/visa-processing.html. */
  { file: 'visa-processing.html', title: 'Visa & Travel', crumb: ['Visa & Travel', 'Overview'], swal: true, leadsjs: true, visajs: true },
  { file: 'patients.html',      title: 'Patients',           crumb: ['Patients & Deals', 'Patients'],   dt: true, dealsjs: true },
  /* Reached from a patient row, never from the sidebar. */
  { file: 'patient-profile.html', title: 'Patient Profile', crumb: ['Patients & Deals', 'Patient Profile'], swal: true, leadsjs: true, dollarjs: true, dealsjs: true },
  { file: 'packages.html',      title: 'Packages',           crumb: ['Settings', 'Packages'],     dt: true, leadsjs: true, dealsjs: true },
  { file: 'deals.html',         title: 'Deals',              crumb: ['Patients & Deals', 'Deals'],      swal: true, leadsjs: true, dealsjs: true },
  { file: 'payments.html',      title: 'Payments',           crumb: ['Accounts', 'Payments'],           dt: true, swal: true, accountsjs: true },
  { file: 'receipts.html',      title: 'Money Receipts',     crumb: ['Accounts', 'Money Receipts'],     dt: true, swal: true, accountsjs: true },
  { file: 'dues.html',          title: 'Payment Due',        crumb: ['Payment Module', 'Payment Due'],  swal: true, leadsjs: true, paymentsjs: true },
  { file: 'reports.html',       title: 'Reports',            crumb: ['Report Module', 'Reports'] },
  /* Opened from a Reports card (?type=...), never from the sidebar; keeps
     the Reports entry highlighted. */
  { file: 'report-builder.html', title: 'Generate Report', crumb: ['Report Module', 'Reports', 'Generate Report'], menuActive: 'reports.html', reportsjs: true },
  /* The generated report — opened by Generate Report, never from the sidebar. */
  { file: 'report-result.html', title: 'Report', crumb: ['Report Module', 'Reports', 'Report'], menuActive: 'reports.html', dt: true, dtexport: true, reportsjs: true },
  { file: 'users.html',         title: 'Users',              crumb: ['Settings', 'Users'],        dt: true, swal: true, adminjs: true },
  { file: 'roles.html',         title: 'Roles & Permissions', crumb: ['Settings', 'Roles & Permissions'], swal: true, adminjs: true },
  { file: 'settings.html',      title: 'Settings',           crumb: ['Settings', 'General'], swal: true, settingsjs: true },
  { file: 'audit-log.html',     title: 'Audit Logs',         crumb: ['Administration', 'Audit Logs'],   dt: true },
  /* Reached from the profile dropdown, never from the sidebar — this is
     one person's own account, not a module in the CRM Main Menu. */
  { file: 'my-account.html',    title: 'My Account',         crumb: ['My Account'] },
];

/* ------------------------------------------------------------------ *
 * Sidebars, generated from the single menu definition
 * ------------------------------------------------------------------ */
function menuItems(kind, active) {
  const badgeHtml = (badge) =>
    badge === 'due' ? ' <span class="badge bg-danger ms-auto fs-10">5</span>'
    : badge === 'countdown' ? ' <span class="badge bg-danger ms-auto fs-10">4</span>'
    : badge === 'dollar' ? ' <span class="badge bg-warning ms-auto fs-10">4</span>'
    : badge === 'passed' ? ' <span class="badge bg-danger ms-auto fs-10">2</span>' : '';

  return menu
    .map((m) => {
      if (m.type === 'title') return `                    <li class="menu-title">${m.label}</li>`;
      const icon =
        kind === 'vertical'
          ? `<i data-eva="${m.eva}"></i>`
          : `<i class="${m.fa}"></i>`;

      /* Dropdown: a metisMenu sub-menu. Whether it's expanded/highlighted
         on load is decided here rather than left to the runtime href-match
         in app.js, so there's no flash of a collapsed menu around the
         active page. A child with a query string (Add Lead) is an action,
         not a destination, and never counts as "active" on its own. */
      if (m.type === 'dropdown') {
        const childActive = m.children.some((c) => c.file === active);
        const childrenHtml = m.children
          .map((c) => {
            const href = c.query ? `${c.file}?${c.query}` : c.file;
            const isActive = c.file === active && !c.query;
            return `                            <li${isActive ? ' class="mm-active"' : ''}><a href="${href}"${isActive ? ' class="active"' : ''}>${c.label}${badgeHtml(c.badge)}</a></li>`;
          })
          .join('\n');
        return `                    <li${childActive ? ' class="mm-active"' : ''}>
                        <a href="javascript: void(0);" class="has-arrow${childActive ? ' mm-active' : ''}">
                            ${icon}
                            <span>${m.label}</span>
                        </a>
                        <ul class="sub-menu${childActive ? ' mm-show' : ''}" aria-expanded="false">
${childrenHtml}
                        </ul>
                    </li>`;
      }

      const badge = badgeHtml(m.badge);
      const isActive = m.file === active && !m.query;
      const href = m.query ? `${m.file}?${m.query}` : m.file;
      const cls = isActive ? ' class="active"' : '';
      return `                    <li${isActive ? ' class="mm-active"' : ''}>
                        <a href="${href}"${cls}>
                            ${icon}
                            <span>${m.label}</span>${badge}
                        </a>
                    </li>`;
    })
    .join('\n');
}

const sidebarVertical = (active) => `    <!-- ========== Left Sidebar Start ========== -->
    <div class="sidebar-left">

        <div class="sidebar-slide h-100" data-simplebar>

            <!--- Sidebar-menu -->
            <div id="sidebar-menu">
                <!-- Left Menu Start -->
                <ul class="left-menu list-unstyled" id="side-menu">
${menuItems('vertical', active)}
                </ul>
            </div>
            <!-- Sidebar -->
        </div>
    </div>
    <!-- Left Sidebar End -->`;

const sidebarHorizontal = (active) => `    <!-- ========== Left Sidebar Start ========== -->
    <div class="sidebar-left horizontal-sidebar">

        <div class="sidebar-slide h-100">

            <!--- Sidebar-menu -->
            <div id="sidebar-menu">
                <!-- Left Menu Start -->
                <ul class="left-menu list-unstyled" id="side-menu">
${menuItems('horizontal', active)}
                </ul>
            </div>
            <!-- Sidebar -->
        </div>
    </div>
    <!-- Left Sidebar End -->
    <div class="sidebar-backdrop" id="sidebar-backdrop"></div>`;

/* ------------------------------------------------------------------ *
 * Page shell
 * ------------------------------------------------------------------ */
const head = (p) => `<!DOCTYPE html>
<html lang="en">

<head>

    <meta charset="utf-8">
    <title>${p.title} | E Life Healthcare CRM</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <meta content="E Life Healthcare — CRM System" name="description">
    <meta content="E Life Healthcare" name="author">

    <!-- App favicon -->
    <link rel="shortcut icon" href="assets/images/logo-sm.png">
${p.dragula ? '    <link rel="stylesheet" href="assets/libs/dragula/dragula.min.css">\n' : ''}${p.dt ? '    <link href="assets/libs/datatables.net-bs5/css/dataTables.bootstrap5.min.css" rel="stylesheet" type="text/css">\n    <link href="assets/libs/datatables.net-responsive-bs5/css/responsive.bootstrap5.min.css" rel="stylesheet" type="text/css">\n' : ''}${p.swal ? '    <link href="assets/libs/sweetalert2/sweetalert2.min.css" rel="stylesheet" type="text/css">\n' : ''}    <!-- select2 -->
    <link href="assets/libs/select2/css/select2.min.css" rel="stylesheet" type="text/css">

    <!-- Simplebar Css -->
    <link rel="stylesheet" href="assets/libs/simplebar/simplebar.min.css">

    <!-- Bootstrap Css -->
    <link href="assets/css/bootstrap.min.css" id="bootstrap-style" rel="stylesheet" type="text/css">

    <!--icons css-->
    <link href="assets/css/icons.min.css" rel="stylesheet" type="text/css">

    <!-- App Css-->
    <link href="assets/css/app.min.css" id="app-style" rel="stylesheet" type="text/css">

    <!-- CRM brand css -->
    <link href="assets/css/crm-brand.css" rel="stylesheet" type="text/css">
</head>

<body>
<!-- Begin page -->
<div id="layout-wrapper">
`;

const pageTitle = (p) => {
  const crumbs = p.crumb
    .map((c, i) =>
      i === p.crumb.length - 1
        ? `<li class="breadcrumb-item active">${c}</li>`
        : `<li class="breadcrumb-item">${c}</li>`
    )
    .join('\n                                    ');
  return `                <!-- start page title -->
                <div class="row">
                    <div class="col-12">
                        <div class="page-title-box d-flex align-items-center justify-content-between">
                            <h4 class="mb-sm-0">${p.title}</h4>
                            <nav aria-label="breadcrumb" class="page-title-right">
                                <ol class="breadcrumb border-0">
                                    <li class="breadcrumb-item"><a href="index.html">CRM</a></li>
                                    ${crumbs}
                                </ol>
                            </nav>
                        </div>
                    </div>
                </div>
                <!-- end page title -->
`;
};

const scripts = (p) => `<!-- Bootstrap bundle js -->
<script src="assets/libs/bootstrap/js/bootstrap.bundle.min.js"></script>

<!-- Layouts main js -->
<script src="assets/libs/jquery/jquery.min.js"></script>

<!-- Metimenu js -->
<script src="assets/libs/metismenu/metisMenu.min.js"></script>

<!-- simplebar js -->
<script src="assets/libs/simplebar/simplebar.min.js"></script>

<script src="assets/libs/eva-icons/eva.min.js"></script>

<!-- Scroll Top init -->
<script src="assets/js/scroll-top.init.js"></script>
${p.dragula ? '\n<!-- dragula js -->\n<script src="assets/libs/dragula/dragula.min.js"></script>\n' : ''}${p.dt ? '\n<!-- datatables js -->\n<script src="assets/libs/datatables.net/js/dataTables.min.js"></script>\n<script src="assets/libs/datatables.net-bs5/js/dataTables.bootstrap5.min.js"></script>\n<script src="assets/libs/datatables.net-responsive/js/dataTables.responsive.min.js"></script>\n<script src="assets/libs/datatables.net-responsive-bs5/js/responsive.bootstrap5.min.js"></script>\n' : ''}${p.dtexport ? '\n<!-- datatables excel export -->\n<script src="assets/libs/datatables.net-buttons/js/dataTables.buttons.min.js"></script>\n<script src="assets/libs/jszip/jszip.min.js"></script>\n<script src="assets/libs/datatables.net-buttons/js/buttons.html5.min.js"></script>\n' : ''}${p.apex ? '\n<!-- apexcharts -->\n<script src="assets/libs/apexcharts/apexcharts.min.js"></script>\n' : ''}
<!-- select2 -->
<script src="assets/libs/select2/js/select2.min.js"></script>

<!-- App js -->
<script src="assets/js/app.js"></script>
${p.swal ? '\n<!-- sweetalert2 -->\n<script src="assets/libs/sweetalert2/sweetalert2.min.js"></script>\n' : ''}
<!-- CRM demo js -->
<script src="assets/js/crm-demo.js"></script>
${p.leadsjs ? '\n<!-- CRM leads module js -->\n<script src="assets/js/crm-leads.js"></script>\n' : ''}${p.dealsjs ? '\n<!-- CRM patients & deals js -->\n<script src="assets/js/crm-deals.js"></script>\n' : ''}${p.accountsjs ? '\n<!-- CRM accounts js -->\n<script src="assets/js/crm-accounts.js"></script>\n' : ''}${p.expensejs ? '\n<!-- CRM expenses js -->\n<script src="assets/js/crm-expenses.js"></script>\n' : ''}${p.treatmentjs ? '\n<!-- CRM treatment js -->\n<script src="assets/js/crm-treatment.js"></script>\n' : ''}${p.countdownjs ? '\n<!-- CRM treatment countdown js -->\n<script src="assets/js/crm-countdown.js"></script>\n' : ''}${p.dollarjs ? '\n<!-- CRM dollar payments js -->\n<script src="assets/js/crm-dollar.js"></script>\n' : ''}${p.ticketsjs ? '\n<!-- CRM ticket module js -->\n<script src="assets/js/crm-tickets.js"></script>\n' : ''}${p.visajs ? '\n<!-- CRM visa & travel js -->\n<script src="assets/js/crm-visa.js"></script>\n' : ''}${p.paymentsjs ? '\n<!-- CRM payment module js -->\n<script src="assets/js/crm-payments.js"></script>\n' : ''}${p.settingsjs ? '\n<!-- CRM settings js -->\n<script src="assets/js/crm-settings.js"></script>\n' : ''}${p.reportsjs ? '\n<!-- CRM report builder js -->\n<script src="assets/js/crm-reports.js"></script>\n' : ''}
<!-- Sidebar deep links (page.html?x=y): highlight the entry matching the query -->
<script>
window.addEventListener('load', function () {
  var page = location.pathname.split('/').pop(), q = location.search;
  var links = [].slice.call(document.querySelectorAll('#sidebar-menu a[href]:not(.has-arrow)'));
  var exact = links.filter(function (a) {
    var h = a.getAttribute('href') || '', i = h.indexOf('?');
    return i > -1 && h.slice(0, i) === page && h.slice(i) === q;
  });
  if (!exact.length) return;
  links.forEach(function (a) { a.classList.remove('active'); a.parentNode.classList.remove('mm-active'); });
  exact.forEach(function (a) { a.classList.add('active'); a.parentNode.classList.add('mm-active'); });
});
</script>
</body>
</html>
`;

/* ------------------------------------------------------------------ *
 * Under construction — every page but the two dashboards, until every
 * module is ready. The real page bodies in build/pages/ are untouched;
 * this just skips injecting them, so switching back later is deleting
 * this block and the `underConstruction` line below, nothing more.
 * ------------------------------------------------------------------ */
/* The merged Dashboard is a stub until its content is designed. Both files
   are still built (login and role redirects point at them) so nothing 404s. */
/* Nothing is stubbed now; kept so a page can be parked again by name. */
const STUB_FILES = new Set([]);

const underConstructionPage = (p) => `                <div class="d-flex flex-column align-items-center justify-content-center text-center" style="min-height: 50vh; padding: 2rem 1rem;">
                    <i class="mdi mdi-hammer-wrench" style="font-size: 3.5rem; color: var(--bs-warning);"></i>
                    <h3 class="mt-4 mb-2">Under Construction</h3>
                    <p class="text-muted mb-0" style="max-width: 420px;">${p.title} isn't ready yet. It'll appear here once this module is complete.</p>
                </div>
`;

/* ------------------------------------------------------------------ *
 * Assemble
 * ------------------------------------------------------------------ */
const topbar = P('topbar.html');
const footer = P('footer.html');

fs.mkdirSync(OUT, { recursive: true });

let built = 0;
for (const p of PAGES) {
  const underConstruction = STUB_FILES.has(p.file);
  /* `content` lets two pages share one body (both dashboards). */
  const contentPath = path.join(__dirname, 'pages', p.content || p.file);
  if (!underConstruction && !fs.existsSync(contentPath)) {
    console.log(`  SKIP ${p.file} (no build/pages/${p.file})`);
    continue;
  }
  const content = underConstruction
    ? underConstructionPage(p)
    : inject(fs.readFileSync(contentPath, 'utf8').replace(/\s+$/, ''));

  const html = [
    head(p),
    topbar,
    '',
    sidebarVertical(p.menuActive || p.file),
    sidebarHorizontal(p.menuActive || p.file),
    '',
    '    <!-- ============================================================== -->',
    '    <!-- Start right Content here -->',
    '    <!-- ============================================================== -->',
    '    <div class="main-content">',
    '',
    '        <div class="page-content">',
    '            <div class="container-fluid">',
    '',
    pageTitle(p),
    content,
    '',
    '            </div><!-- container-fluid -->',
    '        </div><!-- page-content -->',
    '',
    footer,
    '    </div><!-- end main content-->',
    '',
    '</div><!-- END layout-wrapper -->',
    '',
    scripts(p),
  ].join('\n');

  fs.writeFileSync(path.join(OUT, p.file), html);
  built++;
}

console.log(`\nbuilt ${built}/${PAGES.length} pages into ${path.relative(process.cwd(), OUT) || '.'}/`);
