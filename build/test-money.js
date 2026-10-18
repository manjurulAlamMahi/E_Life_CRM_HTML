#!/usr/bin/env node
/**
 * Money engine tests for assets/js/crm-leads.js
 * (round-2 spec §3 and §4 — dual balance, no conversion).
 *
 * There is no browser here, so this loads the real module with minimal
 * window/document stubs — just enough for the module's IIFE to run to
 * completion and set window.CRMLeads.money — then asserts the rules.
 * Dependency-free, Node-only.
 *
 *   node build/test-money.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const file = path.join(__dirname, '..', 'assets', 'js', 'crm-leads.js');
const src = fs.readFileSync(file, 'utf8');

/* The module runs in browser global scope (bare `window` / `document`
 * identifiers, no module wrapper), so it is loaded into a vm context
 * whose sandbox supplies those two globals. Nothing else in the module
 * is touched before window.CRMLeads.money is set — the DOMContentLoaded
 * callback is only registered here, never fired. */
const sandbox = {
  window: {},
  document: { addEventListener: function () {} }
};
vm.createContext(sandbox);
vm.runInContext(src, sandbox, { filename: file });

const money = sandbox.window.CRMLeads && sandbox.window.CRMLeads.money;
if (!money) {
  console.error('FAIL — window.CRMLeads.money was not set by crm-leads.js');
  process.exit(1);
}

const cases = [
  /* ---- Agreed = Negotiated, per currency, clamped at 0 (no discounts) ---- */
  ['agreed(400000)', () => money.agreed(400000), 400000],
  ['agreed(3000) — the same maths in USD', () => money.agreed(3000), 3000],
  ['agreed(-500) clamps at 0', () => money.agreed(-500), 0],
  ['agreed ignores a stray second argument', () => money.agreed(400000, 50000), 400000],

  /* ---- Due = Agreed - Paid, per currency, clamped at 0 ---- */
  ['due(400000, 150000)', () => money.due(400000, 150000), 250000],
  ['due(3000, 1000) — USD balance is its own', () => money.due(3000, 1000), 2000],
  ['due(400000, 400000) — settled', () => money.due(400000, 400000), 0],
  ['due(100, 500) clamps at 0', () => money.due(100, 500), 0],

  /* ---- Completed requires BOTH balances at zero (spec §3.6) ----
   * The whole point of two balances is that clearing one is not enough. */
  ['isCompleted(0, 0)', () => money.isCompleted(0, 0), true],
  ['isCompleted(0, 2000) — USD still owing', () => money.isCompleted(0, 2000), false],
  ['isCompleted(250000, 0) — BDT still owing', () => money.isCompleted(250000, 0), false],
  ['isCompleted(250000, 2000) — both owing', () => money.isCompleted(250000, 2000), false],
  ['isCompleted() with no USD leg at all', () => money.isCompleted(0), true],

  /* ---- The conversion model is gone (spec §10) ----
   * Absent, not merely unused, so a stale caller fails loudly instead of
   * silently converting nothing. */
  ['paymentTotal is gone', () => typeof money.paymentTotal, 'undefined'],
  ['remaining is gone (renamed to due)', () => typeof money.remaining, 'undefined'],
  ['tierPrice is gone', () => typeof money.tierPrice, 'undefined'],
  ['usesUsd is gone', () => typeof money.usesUsd, 'undefined'],
  ['TIERS is gone', () => typeof money.TIERS, 'undefined']
];

let failed = 0;
for (const [label, actual, expected] of cases) {
  /* Each case is a thunk so a missing function reports as a failed case
   * rather than crashing the run and hiding every case after it. */
  let got;
  try {
    got = typeof actual === 'function' ? actual() : actual;
  } catch (e) {
    got = e.constructor.name + ': ' + e.message;
  }
  const ok = got === expected;
  if (!ok) failed++;
  console.log((ok ? 'PASS' : 'FAIL') + ' — ' + label + ' === ' + expected + ' (got ' + got + ')');
}

if (failed) {
  console.error('\n' + failed + ' of ' + cases.length + ' case(s) failed.');
  process.exit(1);
}
console.log('\nPASS — all ' + cases.length + ' money-engine cases verified');
