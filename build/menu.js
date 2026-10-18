/**
 * CRM navigation — mirrors plan.md §21 "CRM Main Menu".
 * One definition drives the vertical sidebar, the horizontal sidebar,
 * and each page's breadcrumb. Maps 1:1 to Blade Partials/sidebar later.
 *
 *   eva : icon for the vertical sidebar (eva-icons, via data-eva)
 *   fa  : icon for the horizontal sidebar (Font Awesome, as the template does)
 */
'use strict';

/* One Dashboard entry: the two former dashboards were merged, and that page
   is an "Under Construction" stub for now (build.js: STUB_FILES). */
const DASHBOARDS = [
  { type: 'item', label: 'Dashboard', file: 'index.html', eva: 'home-outline', fa: 'fas fa-tachometer-alt' },
];

/* Everything below the Dashboard entry, grouped by module. A flat item may
   carry a query (deep link into a tab of a shared page); such an item is
   highlighted by the deep-link script, not by file name alone. */
const REST_OF_MENU = [
  { type: 'title', label: 'Lead Module' },
  { type: 'dropdown', label: 'Leads', eva: 'person-add-outline', fa: 'fas fa-user-plus', children: [
    { label: 'All',                  file: 'leads.html' },
    { label: 'Add',                  file: 'leads.html', query: 'action=add-lead' },
    { label: 'Upcoming Follow Ups',  file: 'followups.html', badge: 'due' },
    { label: 'Interested',           file: 'interested-leads.html' },
    { label: 'Not Interested',       file: 'not-interested-leads.html' },
    { label: 'Applied',              file: 'applied-leads.html' },
  ] },
  { type: 'item', label: 'Conversations', file: 'conversations.html', eva: 'message-circle-outline', fa: 'fas fa-comments' },

  { type: 'title', label: 'Visa Module' },
  { type: 'item', label: 'Eligible',   file: 'visa-eligible.html', eva: 'checkmark-circle-2-outline', fa: 'fas fa-check-circle' },
  { type: 'item', label: 'Processing', file: 'visa-processing.html', query: 'stage=processing', eva: 'sync-outline', fa: 'fas fa-sync-alt' },
  { type: 'item', label: 'Approved',   file: 'visa-processing.html', query: 'stage=approved', eva: 'done-all-outline', fa: 'fas fa-stamp' },
  { type: 'item', label: 'Rejected',   file: 'visa-processing.html', query: 'stage=rejected', eva: 'close-circle-outline', fa: 'fas fa-times-circle' },
  { type: 'item', label: 'All',        file: 'visa-processing.html', eva: 'list-outline', fa: 'fas fa-list' },

  /* Step 03 — after the visa is approved: tickets by status. */
  { type: 'title', label: 'Ticket Module' },
  { type: 'item', label: 'Not Purchased',   file: 'tickets.html', eva: 'file-remove-outline', fa: 'fas fa-ticket-alt' },
  { type: 'item', label: 'Upcoming Flight', file: 'tickets.html', query: 'stage=upcoming', eva: 'calendar-outline', fa: 'fas fa-plane-departure' },
  { type: 'item', label: 'Flight Passed',   file: 'tickets.html', query: 'stage=passed', eva: 'alert-triangle-outline', fa: 'fas fa-exclamation-triangle', badge: 'passed' },
  { type: 'item', label: 'Cancelled',       file: 'tickets.html', query: 'stage=cancelled', eva: 'close-square-outline', fa: 'fas fa-ban' },
  { type: 'item', label: 'All',             file: 'tickets.html', query: 'stage=all', eva: 'list-outline', fa: 'fas fa-list' },

  { type: 'title', label: 'Treatment Module' },
  { type: 'item', label: 'Countdown',         file: 'treatment-countdown.html', eva: 'clock-outline', fa: 'fas fa-hourglass-half', badge: 'countdown' },
  { type: 'item', label: 'Treatment Ongoing', file: 'treatment.html', eva: 'activity-outline', fa: 'fas fa-heartbeat' },
  { type: 'item', label: 'Successful',        file: 'treatment.html', query: 'stage=successful', eva: 'heart-outline', fa: 'fas fa-smile' },
  { type: 'item', label: 'Treatment Failed',  file: 'treatment.html', query: 'stage=failed', eva: 'slash-outline', fa: 'fas fa-frown' },

  { type: 'title', label: 'Dollar Module' },
  /* The partial dollar on a non-Full-Funded package. Internal only: tracked
     here, on its own, and never on invoices, receipts or taka balances. */
  { type: 'item', label: 'Dollar Payments', file: 'dollar-payments.html', eva: 'pricetags-outline', fa: 'fas fa-dollar-sign', badge: 'dollar' },

  { type: 'title', label: 'Payment Module' },
  { type: 'item', label: 'Payment Due',       file: 'dues.html', eva: 'alert-circle-outline', fa: 'fas fa-exclamation-circle' },
  { type: 'item', label: 'Payment Completed', file: 'completed-leads.html', eva: 'credit-card-outline', fa: 'fas fa-credit-card' },

  { type: 'title', label: 'Expense Module' },
  { type: 'item', label: 'Expenses',         file: 'expenses.html',         eva: 'trending-down-outline', fa: 'fas fa-money-bill-wave' },
  { type: 'item', label: 'Patient Expense',  file: 'expense-patient.html',  eva: 'person-outline',        fa: 'fas fa-user-injured' },
  { type: 'item', label: 'Expense Report',   file: 'expense-report.html',   eva: 'bar-chart-outline',     fa: 'fas fa-chart-bar' },

  { type: 'title', label: 'Source Module' },
  { type: 'item', label: 'Source List', file: 'sources.html', eva: 'share-outline', fa: 'fas fa-share-alt' },

  { type: 'title', label: 'Report Module' },
  { type: 'item', label: 'Reports', file: 'reports.html', eva: 'pie-chart-outline', fa: 'fas fa-chart-pie' },

  { type: 'title', label: 'Administration' },
  /* Everything that configures the CRM sits under one Settings menu; the
     Settings page itself links to the same four pages from its Manage list. */
  { type: 'dropdown', label: 'Settings', eva: 'settings-2-outline', fa: 'fas fa-cog', children: [
    { label: 'General',              file: 'settings.html' },
    { label: 'Packages',             file: 'packages.html' },
    { label: 'Sources',              file: 'source-admin.html' },
    { label: 'Users',                file: 'users.html' },
    { label: 'Roles & Permissions',  file: 'roles.html' },
  ] },
  { type: 'item', label: 'Audit Logs',          file: 'audit-log.html',    eva: 'eye-outline',        fa: 'fas fa-history' },
  { type: 'item', label: 'Log Out',             file: 'login.html',        eva: 'log-out-outline',    fa: 'fas fa-sign-out-alt' },
];

const FULL_MENU = DASHBOARDS.concat(REST_OF_MENU);

module.exports = FULL_MENU;
