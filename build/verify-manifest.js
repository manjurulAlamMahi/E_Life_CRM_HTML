/**
 * Required element IDs per generated page.
 * Each round adds the ids it introduces, so a later refactor that drops
 * them fails verification instead of failing silently.
 */
'use strict';
module.exports = {
  'leads.html': [
    'logConvModal', 'cv-save', 'cv-discussion', 'cv-date', 'cv-reason-pick',
    'addLeadModal', 'al-condition', 'al-save', 'al-executive', 'al-behalf',
    'lead-filter-bar', 'lf-status', 'lf-source', 'lf-executive', 'lf-start-date', 'lf-end-date',
    'lead-count-all', 'lead-count-followup', 'lead-count-interested', 'lead-count-not-interested',
    'bulk-action-bar', 'bulk-select-all',
    'stFollowupModal', 'st-followup-date-wrap', 'st-followup-hint',
    'stInterestedModal', 'stAppliedModal', 'stConfirmedModal', 'stNotInterestedModal',
    'stUnreachableModal',
    'quickViewModal', 'qv-body', 'qv-title',
    'editLeadModal', 'el-save', 'leadPrintModal', 'lp-print',
    'leadOverviewModal', 'lo-edit', 'lo-print', 'lo-continue',
    'al-dob', 'al-division', 'al-district', 'al-upazila', 'al-offered', 'al-package-offered', 'al-drive',
    'al-email', 'al-date-override'
  ],
  'conversations.html': [
    'lc-package', 'lc-price-bdt', 'lc-negotiated-bdt', 'lc-agreed-bdt',
    'lc-usd-block', 'lc-price-usd', 'lc-negotiated-usd', 'lc-suggested-usd',

    'lc-expected-bdt', 'lc-offered-bdt',
    'lc-pay-amount', 'lc-pay-method', 'lc-pay-txn', 'lc-pay-date',
    'lc-payment-is-done', 'lc-payment-not-done', 'lc-payment-fields-wrap', 'lc-payment-later-note', 'lc-remaining-bdt',
    'logConvModal', 'cv-save', 'cv-channel', 'conv-log-btn', 'stAppliedModal'
  ],
  'applied-leads.html': [
    'addPaymentModal', 'pay-currency', 'pay-amount', 'pay-prefix',
    'pay-total', 'pay-due-after', 'pay-save', 'docsModal'
  ],
  'confirmed-leads.html': ['stConfirmedModal', 'stNotInterestedModal'],
  'followups.html': ['logConvModal', 'cv-save', 'cv-discussion', 'cv-date', 'cv-reason-pick', 'stAppliedModal', 'rescheduleModal', 'rs-save'],
  'not-interested-leads.html': ['logConvModal', 'cv-save', 'cv-discussion', 'cv-date', 'cv-reason-pick', 'stAppliedModal', 'rescheduleModal', 'rs-save', 'ni-count', 'ni-recent', 'ni-earlier'],
  'interested-leads.html': ['logConvModal', 'cv-save', 'cv-discussion', 'cv-date', 'cv-reason-pick', 'stAppliedModal', 'rescheduleModal', 'rs-save', 'in-today', 'in-overdue', 'in-upcoming'],
  'sources.html': ['source-table', 'sourceViewModal', 'sv-chart', 'sv-all', 'sv-applied-list', 'addSourceModal'],
  'invoice.html': [
    'inv-print', 'inv-sample-note', 'addPaymentModal', 'pay-currency',
    'pay-amount', 'pay-total', 'pay-due-after', 'pay-save'
  ],
  'packages.html': ['addPackageModal', 'pk-name', 'pk-price-bdt', 'pk-accepts-usd', 'pk-usd-wrap'],
  'patients.html': ['patient-filters', 'pf-search', 'pf-status', 'pf-situation', 'pf-package', 'pf-staff', 'pf-reset'],
  'deals.html': ['deal-state-tabs', 'dealPayModal', 'dp-currency', 'dp-amount', 'dp-total', 'dp-after', 'dp-save', 'newDealModal'],
  'patient-profile.html': [
    'pp-sample-note', 'pp-requested-patient', 'pp-tabs',
    'pp-overview', 'pp-packages', 'pp-payments', 'pp-conversations',
    'pp-root', 'pp-journey', 'pp-payment', 'pp-pay-btn', 'pp-next-step', 'pp-drive-link',
    'pp-avatar', 'addPaymentModal', 'applyVisaModal', 'nextFollowupModal', 'editLeadModal',
    'ppNewPackageModal', 'pp-np-save', 'lc-package',
    'ppPackageModal', 'pp-package-data', 'pp-dl-badge', 'pp-dl-note', 'pp-tc-badge', 'pp-tc-bar', 'pk-journey', 'pk-steps', 'pk-payments'
  ],
  'payments.html': ['paymentDetailsModal', 'rejectModal', 'rj-reason', 'rj-save', 'pd-person', 'pd-exec'],
  'receipts.html': ['receipt-filters', 'receipt-transactions', 'rf-search', 'rf-state', 'rf-exec', 'rf-method', 'rf-reset'],
  'dollar-payments.html': ['dl-table', 'dl-tabs', 'dl-search', 'dlPayModal', 'dl-pay-amount', 'dl-pay-all', 'dl-pay-save', 'dlHistoryModal', 'dl-hist-body'],
  'dues.html': ['pm-data', 'pmPayModal', 'pm-amount', 'pm-pay-save', 'pmHistoryModal', 'pm-hist-body', 'pmInvoiceModal', 'pm-invoice', 'pm-inv-print', 'logConvModal'],
  'completed-leads.html': ['pm-data', 'pmPayModal', 'pm-amount', 'pm-pay-save', 'pmHistoryModal', 'pm-hist-body', 'pmInvoiceModal', 'pm-invoice', 'pm-inv-print'],
  'users.html': ['user-filters', 'uf-search', 'uf-role', 'uf-active', 'uf-reset', 'userModal', 'um-name', 'um-role', 'um-role-note'],
  'roles.html': ['permission-matrix', 'perm-save', 'roleModal', 'rm-name', 'rm-copy'],
  'expenses.html': ['fx-table', 'fx-month', 'fi-table', 'fi-add', 'fixedItemModal', 'fi-save', 'ex-table', 'ex-from', 'ex-to', 'expenseModal', 'ex-save'],
  'expense-patient.html': ['px-table', 'px-filter', 'px-status', 'px-from', 'px-to', 'px-search', 'patientExpenseModal', 'px-f-amount', 'px-f-date', 'px-save', 'patientCostsModal', 'pv-table', 'pv-totals'],
  'tickets.html': ['tk-table', 'tk-tabs', 'tk-search', 'tkFormModal', 'tkf-date', 'tkf-flight', 'tkf-reason', 'tkf-save', 'tkViewModal', 'tkv-sheet', 'tkv-print'],
  'expense-report.html': ['rp-preset', 'rp-from', 'rp-to', 'rp-view', 'rp-table', 'rp-sources', 'rp-patients', 'rp-fixed-list', 'rp-other-list', 'rp-total', 'rp-ticket', 'rp-visa', 'rp-source']
};
