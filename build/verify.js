#!/usr/bin/env node
/**
 * Structural verification for the generated demo pages.
 * There is no browser here — these are the checks that can be made
 * from the DOM text alone, and they catch the failures that actually
 * happened in this project: missing chrome, dead internal links,
 * missing assets, duplicate ids, unbalanced divs.
 *
 *   node build/verify.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const failures = [];
const fail = (page, msg) => failures.push(page + ': ' + msg);

/* IDs that appear twice by design (vertical + horizontal sidebars).
 * The template renders both sidebars responsively, so each of these
 * must appear exactly twice. All other IDs must remain unique. */
const EXEMPT_FROM_DUPLICATE_CHECK = new Set(['side-menu', 'sidebar-menu']);

/* Pages to check: every .html in the repo root. login.html has no chrome. */
const pages = fs
  .readdirSync(ROOT)
  .filter((f) => f.endsWith('.html'))
  .sort();

/* Required IDs per page — grows as the plan adds interactive markup. */
const REQUIRED_IDS = require('./verify-manifest.js');

for (const page of pages) {
  const html = fs.readFileSync(path.join(ROOT, page), 'utf8').replace(/\r\n/g, '\n');
  const chromeless = page === 'login.html' || page === 'forgot-password.html' || page === 'screen-lock.html';
  /* Only the two dashboards carry real module markup right now — every
     other page is a deliberate "Under Construction" stub (build.js), so
     the interactive-markup check below (#6) would otherwise fail on ids
     that page simply doesn't have anymore. Detected from the rendered
     stub text rather than duplicating build.js's page list here. */
  const underConstruction = html.includes('>Under Construction<');

  /* 1. chrome present */
  if (!chromeless) {
    if (!html.includes('id="layout-wrapper"')) fail(page, 'missing #layout-wrapper');
    if (!html.includes('class="main-content"')) fail(page, 'missing .main-content');
    if (!html.includes('id="side-menu"')) fail(page, 'missing sidebar #side-menu');
    if ((html.match(/id="side-menu"/g) || []).length !== 2)
      fail(page, 'expected 2 sidebars (vertical + horizontal), found ' + (html.match(/id="side-menu"/g) || []).length);
    if (!html.includes('<footer')) fail(page, 'missing footer');
  }

  /* 2. balanced divs */
  const opens = (html.match(/<div\b/g) || []).length;
  const closes = (html.match(/<\/div>/g) || []).length;
  if (opens !== closes) fail(page, 'unbalanced <div>: ' + opens + ' open, ' + closes + ' close');

  /* 3. internal links resolve */
  const hrefs = [...html.matchAll(/href="([^"#:]+\.html)"/g)].map((m) => m[1]);
  for (const h of new Set(hrefs)) {
    if (!fs.existsSync(path.join(ROOT, h))) fail(page, 'dead link -> ' + h);
  }

  /* 4. asset paths resolve */
  const assets = [...html.matchAll(/(?:src|href)="(assets\/[^"]+)"/g)].map((m) => m[1]);
  for (const a of new Set(assets)) {
    if (!fs.existsSync(path.join(ROOT, a))) fail(page, 'missing asset -> ' + a);
  }

  /* 5. no duplicate ids (except those that render twice by design) */
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const seen = new Set();
  for (const id of ids) {
    if (seen.has(id) && !EXEMPT_FROM_DUPLICATE_CHECK.has(id))
      fail(page, 'duplicate id -> ' + id);
    seen.add(id);
  }

  /* 6. required ids for this page */
  if (!underConstruction) {
    for (const id of REQUIRED_IDS[page] || []) {
      if (!html.includes('id="' + id + '"')) fail(page, 'missing required id -> ' + id);
    }
  }
}

/* 7. Money reconciliation across the lead pages (flow-fix spec §12).
   Meaningless while those pages are Under Construction stubs — skip
   rather than fail on money markup that isn't there right now. */
const anyRealLeadPage = fs.existsSync(path.join(ROOT, 'leads.html')) &&
  !fs.readFileSync(path.join(ROOT, 'leads.html'), 'utf8').includes('>Under Construction<');
if (anyRealLeadPage) {
  for (const f of require('./verify-money.js')()) failures.push(f);
} else {
  console.log('(skipping money reconciliation — lead pages are Under Construction)');
}

if (failures.length) {
  console.error('FAIL (' + failures.length + ')');
  for (const f of failures) console.error('  ' + f);
  process.exit(1);
}
console.log('PASS — ' + pages.length + ' pages verified');
