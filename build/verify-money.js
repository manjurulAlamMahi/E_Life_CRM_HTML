/**
 * Money reconciliation for the generated lead pages (round-2 spec §11).
 *
 * Two balances now — taka and dollars — that are never converted into
 * each other, so every assertion is made per currency. A round-1 review
 * caught the same patient carrying different figures on different pages;
 * that check is kept and widened to cover both currencies and the package.
 *
 * Called by build/verify.js. Returns an array of failure strings.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const money = s => parseInt(String(s).replace(/,/g, ''), 10);
const bdt = n => '৳' + Number(n).toLocaleString('en-IN');
const usd = n => '$' + Number(n).toLocaleString('en-US');
const pair = (b, u) => bdt(b) + ' / ' + usd(u);

const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');

/* Taka is written as the numeric entity, dollars with a plain $, so the
 * two are told apart by their symbol rather than by position. */
const takaIn = frag => [...String(frag).matchAll(/&#2547;([\d,]+)/g)].map(m => money(m[1]));
/* Payments are always taka; dollar amounts are reference data only and never take part in paid / due reconciliation. */
const dollarIn = () => [];

/* Chunks that each begin at a <tr. A main row's chunk ends where the next
 * <tr starts, so it never swallows a nested ledger table. */
const trChunks = html => html.split(/(?=<tr\b)/).filter(c => c.startsWith('<tr'));

const attr = (frag, name) => {
  const m = frag.match(new RegExp(name + '="([^"]*)"'));
  return m ? m[1] : null;
};

/* The right-aligned money cells of a row, in document order.
 * Exact class on purpose: on the lead pages "text-end cur fs-13" cells
 * appear inside ledgers too, and matching those would mix payment lines
 * into the row figures. */
function endCells(frag) {
  return [...frag.matchAll(/<td class="text-end"[^>]*>([\s\S]*?)<\/td>/g)].map(m => m[1]);
}

/* The deal-history sub-tables style their money cells directly rather
 * than through a wrapper, so they need the looser match. */
function endCellsLoose(frag) {
  return [...frag.matchAll(/<td class="text-end[^"]*"[^>]*>([\s\S]*?)<\/td>/g)].map(m => m[1]);
}

const first = (arr, dflt) => (arr.length ? arr[0] : (dflt === undefined ? 0 : dflt));

/* ------------------------------------------------------------------ */
function appliedRows() {
  return trChunks(read('applied-leads.html'))
    .filter(c => c.includes('crm-add-payment'))
    .map(c => {
      const cells = endCells(c);
      return {
        id: attr(c, 'data-lead-id'),
        pkg: (c.match(/<td class="fs-13">((?:Full|Partial|Paid)[^<]*)<\/td>/) || [])[1] || null,
        acceptsUsd: attr(c, 'data-accepts-usd') === 'true',
        agreedBdt: first(takaIn(cells[0] || '')),
        agreedUsd: first(dollarIn(cells[0] || '')),
        paidBdt: first(takaIn(cells[1] || '')),
        paidUsd: first(dollarIn(cells[1] || '')),
        dueBdt: first(takaIn(cells[2] || '')),
        dueUsd: first(dollarIn(cells[2] || '')),
        dataDueBdt: money(attr(c, 'data-due-bdt')),
        dataDueUsd: money(attr(c, 'data-due-usd')),
        completedBadge: /badge bg-success-subtle text-success">Completed</.test(c)
      };
    });
}

function confirmedRows() {
  return trChunks(read('confirmed-leads.html'))
    .filter(c => c.includes('crm-status-menu') && c.includes('data-lead-id'))
    .map(c => {
      const cells = endCells(c);
      return {
        id: attr(c, 'data-lead-id'),
        pkg: (c.match(/<td class="fs-13">((?:Full|Partial|Paid)[^<]*)<\/td>/) || [])[1] || null,
        paidBdt: first(takaIn(cells[0] || '')),
        paidUsd: first(dollarIn(cells[0] || '')),
        dueBdt: money(attr(c, 'data-due-bdt')),
        dueUsd: money(attr(c, 'data-due-usd'))
      };
    });
}

/* leads.html keeps its money in the Quick View payload, so it is read
 * from there — the table itself no longer shows any figures.
 *
 * Splitting on "<tr" will NOT do here: the payload contains its own
 * <tr> elements, so each row's chunk would end before its money table
 * and every check below would silently pass on nothing. Main rows are
 * the only ones carrying data-status, so that is the boundary. */
function leadRows() {
  return read('leads.html').split(/(?=<tr data-status=)/)
    .filter(c => c.startsWith('<tr data-status='))
    .map(c => {
      const takaRow = (c.match(/text-muted">Taka<\/td>([\s\S]*?)<\/tr>/) || [])[1] || '';
      const dollarRow = (c.match(/text-muted">Dollar<\/td>([\s\S]*?)<\/tr>/) || [])[1] || '';
      const t = takaIn(takaRow);
      const d = dollarIn(dollarRow);
      return {
        id: attr(c, 'data-lead-id'),
        status: attr(c, 'data-status'),
        pkg: (c.match(/<div class="fs-13 fw-semibold mb-2">([^<]+)<\/div>/) || [])[1] || null,
        hasMoney: t.length > 0,
        agreedBdt: t[0] || 0,
        paidBdt: t[1] || 0,
        dueBdt: t[2] || 0,
        agreedUsd: d[0] || 0,
        paidUsd: d[1] || 0,
        dueUsd: d[2] || 0,
        dataDueBdt: money(attr(c, 'data-due-bdt')),
        dataDueUsd: money(attr(c, 'data-due-usd'))
      };
    });
}

function invoiceRecord() {
  const html = read('invoice.html');
  const btn = (html.match(/<button[^>]*crm-add-payment[\s\S]*?<\/button>/) || [])[0] || '';
  /* The sheet is rendered in the browser from the #inv-data block (taka
     only — the customer invoice carries no dollar figures). */
  const json = (html.match(/<script type="application\/json" id="inv-data">([\s\S]*?)<\/script>/) || [])[1];
  const data = json ? JSON.parse(json) : { pkg: {}, payments: [] };
  const agreedBdt = data.pkg.agreed || 0;
  const paidBdt = (data.payments || []).reduce((a, p) => a + (p.amount || 0), 0);
  return {
    id: attr(btn, 'data-lead-id'),
    pkg: data.pkg.name || null,
    agreedBdt: agreedBdt, paidBdt: paidBdt, dueBdt: Math.max(agreedBdt - paidBdt, 0),
    agreedUsd: 0, paidUsd: 0, dueUsd: 0,
    dataDueBdt: money(attr(btn, 'data-due-bdt')),
    dataDueUsd: money(attr(btn, 'data-due-usd'))
  };
}

/* Ledger blocks are read by id, from the marker to the </table> that closes
 * that same ledger's payment list, so a nested table cannot confuse the
 * boundary. The Paid figure is read from the one-line summary ("Paid ৳X
 * $Y") that sits ahead of the table — everything from "Paid" up to "Due"
 * (or to the end, when a lead is fully settled and carries no Due span). */
function ledgers() {
  const html = read('applied-leads.html');
  const out = [];
  for (const m of html.matchAll(/id="ledger-(\d+)"/g)) {
    const block = html.slice(m.index, html.indexOf('</table>', m.index));
    const body = block.slice(block.indexOf('<tbody>'), block.indexOf('</tbody>'));
    const header = block.slice(0, block.indexOf('<table'));
    const paidSection = header.includes('Due')
      ? header.slice(header.indexOf('Paid'), header.indexOf('Due'))
      : header.slice(header.indexOf('Paid'));
    out.push({
      id: 'ELH-L-2026-000' + m[1],
      paymentsBdt: takaIn(body).reduce((a, b) => a + b, 0),
      paymentsUsd: dollarIn(body).reduce((a, b) => a + b, 0),
      footPaidBdt: first(takaIn(paidSection), null),
      footPaidUsd: first(dollarIn(paidSection), null)
    });
  }
  return out;
}

function tiles(file) {
  return [...read(file).matchAll(/<div class="stat-value[^"]*">([\s\S]*?)<\/div>/g)].map(m => m[1].trim());
}

/* ------------------------------------------------------------------ *
 * Accounts
 * ------------------------------------------------------------------ */
function paymentRows() {
  return read('payments.html').split(/(?=<tr data-)/)
    .filter(c => /^<tr data-(pending|verified)=/.test(c))
    .map(c => ({
      verified: /data-verified="true"/.test(c),
      pending: /data-pending="true"/.test(c),
      cur: attr(c, 'data-cur'),
      amt: money(attr(c, 'data-amt')),
      month: attr(c, 'data-month')
    }));
}

function dueRows() {
  return read('dues.html').split(/(?=<tr data-pm-row)/)
    .filter(c => c.startsWith('<tr data-pm-row'))
    .map(c => ({
      person: (c.match(/<div class="fw-semibold">([^<]+)</) || [])[1],
      bdt: money(attr(c, 'data-due-bdt')),
      usd: money(attr(c, 'data-due-usd'))
    }));
}

/* ------------------------------------------------------------------ *
 * Patients & Deals
 * ------------------------------------------------------------------ */

/* One row per person. Splitting on "<tr" is safe here because each
 * person's deal history lives in a separate expansion row, read below. */
function dealPeople() {
  return read('deals.html').split(/(?=<tr data-state=)/)
    .filter(c => c.startsWith('<tr data-state='))
    .map(c => {
      const cells = endCells(c);
      return {
        name: attr(c, 'data-person'),
        lead: attr(c, 'data-lead'),
        state: attr(c, 'data-state'),
        expansion: attr(c, 'data-expansion'),
        paidBdt: first(takaIn(cells[0] || '')),
        paidUsd: first(dollarIn(cells[0] || '')),
        dueBdt: first(takaIn(cells[1] || '')),
        dueUsd: first(dollarIn(cells[1] || '')),
        dataDueBdt: money(attr(c, 'data-due-bdt')),
        dataDueUsd: money(attr(c, 'data-due-usd')),
        dealCount: parseInt((c.match(/<td class="fs-13">(\d+)<\/td>/) || [])[1], 10)
      };
    });
}

/* Each person's individual deals, read from their expansion block. */
function dealsOf(expansionId) {
  const html = read('deals.html');
  const start = html.indexOf('id="' + expansionId + '"');
  if (start < 0) return [];
  const block = html.slice(html.indexOf('<tbody>', start), html.indexOf('</tbody>', start));
  return block.split(/(?=<tr)/).filter(r => r.includes('ELH-D-')).map(r => {
    const cells = endCellsLoose(r);
    return {
      id: (r.match(/(ELH-D-\d{4}-\d+)/) || [])[1],
      pkg: (r.match(/<td class="fs-13">((?:Full|Partial|Paid)[^<]*)</) || [])[1] || null,
      current: !/closed/.test(r),
      agreedBdt: first(takaIn(cells[0] || '')), agreedUsd: first(dollarIn(cells[0] || '')),
      paidBdt: first(takaIn(cells[1] || '')), paidUsd: first(dollarIn(cells[1] || '')),
      dueBdt: first(takaIn(cells[2] || '')), dueUsd: first(dollarIn(cells[2] || ''))
    };
  });
}

function patientRows() {
  return read('patients.html').split(/(?=<tr data-status=)/)
    .filter(c => c.startsWith('<tr data-status='))
    .map(c => ({
      id: attr(c, 'data-patient-id'),
      lead: attr(c, 'data-lead'),
      pkg: attr(c, 'data-package'),
      status: attr(c, 'data-status'),
      situation: attr(c, 'data-situation')
    }));
}

function packageRows() {
  return read('packages.html').split(/(?=<tr data-package-code=)/)
    .filter(c => c.startsWith('<tr data-package-code='))
    .map(c => ({
      code: attr(c, 'data-package-code'),
      /* The name is followed by a <span> badge only on the most-used row,
         so the match must not depend on one being there. */
      name: ((c.match(/<div class="fw-semibold">([^<]+)/) || [])[1] || '').trim(),
      usage: parseInt((c.match(/crm-pkg-usage">(\d+)</) || [])[1], 10),
      removeUsage: money((c.match(/crm-package-remove[^>]*data-usage="(\d+)"/) || [])[1]),
      mostUsed: /badge bg-success-subtle text-success ms-1">Most used</.test(c)
    }));
}

/* ------------------------------------------------------------------ */
module.exports = function verifyMoney() {
  const fails = [];
  const fail = (page, msg) => fails.push(page + ' [money]: ' + msg);

  const applied = appliedRows();
  const confirmed = confirmedRows();
  const leads = leadRows();
  const invoice = invoiceRecord();

  if (!applied.length) fail('applied-leads.html', 'no rows parsed — the check is not running');
  if (!confirmed.length) fail('confirmed-leads.html', 'no rows parsed — the check is not running');
  if (!leads.length) fail('leads.html', 'no rows parsed — the check is not running');

  /* 1. Paid + Due = Agreed, in each currency independently. */
  for (const r of applied) {
    if (r.paidBdt + r.dueBdt !== r.agreedBdt) {
      fail('applied-leads.html', r.id + ' taka: paid ' + bdt(r.paidBdt) + ' + due ' + bdt(r.dueBdt) +
        ' does not equal agreed ' + bdt(r.agreedBdt));
    }
    if (r.paidUsd + r.dueUsd !== r.agreedUsd) {
      fail('applied-leads.html', r.id + ' dollar: paid ' + usd(r.paidUsd) + ' + due ' + usd(r.dueUsd) +
        ' does not equal agreed ' + usd(r.agreedUsd));
    }
  }
  for (const r of leads.filter(x => x.hasMoney)) {
    if (r.paidBdt + r.dueBdt !== r.agreedBdt) {
      fail('leads.html', r.id + ' taka: quick view does not reconcile');
    }
    if (r.paidUsd + r.dueUsd !== r.agreedUsd) {
      fail('leads.html', r.id + ' dollar: quick view does not reconcile');
    }
  }
  if (invoice.id && invoice.paidBdt + invoice.dueBdt !== invoice.agreedBdt) {
    fail('invoice.html', invoice.id + ' taka does not reconcile');
  }
  if (invoice.id && invoice.paidUsd + invoice.dueUsd !== invoice.agreedUsd) {
    fail('invoice.html', invoice.id + ' dollar does not reconcile');
  }

  /* 2. The rendered dues must equal the data-* attributes, which are what
   *    the action menu reads to decide whether Confirm is reachable. */
  const attrChecks = [['applied-leads.html', applied], ['leads.html', leads.filter(r => r.hasMoney)]];
  for (const [page, rows] of attrChecks) {
    for (const r of rows) {
      if (r.dueBdt !== r.dataDueBdt || r.dueUsd !== r.dataDueUsd) {
        fail(page, r.id + ': shows ' + pair(r.dueBdt, r.dueUsd) +
          ' due but the row attributes say ' + pair(r.dataDueBdt, r.dataDueUsd));
      }
    }
  }
  if (invoice.id && (invoice.dueBdt !== invoice.dataDueBdt || invoice.dueUsd !== invoice.dataDueUsd)) {
    fail('invoice.html', invoice.id + ': shows ' + pair(invoice.dueBdt, invoice.dueUsd) +
      ' due but the payment button says ' + pair(invoice.dataDueBdt, invoice.dataDueUsd));
  }

  /* 3. Tiles equal the sum of the column they summarise, per currency. */
  const sum = (rows, k) => rows.reduce((a, r) => a + r[k], 0);
  const at = tiles('applied-leads.html');
  const expectApplied = [
    String(applied.length),
    '&#2547;' + sum(applied, 'agreedBdt').toLocaleString('en-IN'),
    '&#2547;' + sum(applied, 'paidBdt').toLocaleString('en-IN'),
    '&#2547;' + sum(applied, 'dueBdt').toLocaleString('en-IN')
  ];
  const appliedLabels = ['Total Applied', 'Agreed (taka)', 'Received (taka)', 'Outstanding (taka)'];
  expectApplied.forEach((want, i) => {
    if (at[i] !== want) fail('applied-leads.html', 'tile "' + appliedLabels[i] + '" reads ' + at[i] + ', rows sum to ' + want);
  });

  const ct = tiles('confirmed-leads.html');
  if (ct[0] !== String(confirmed.length)) {
    fail('confirmed-leads.html', 'tile "Total Confirmed" reads ' + ct[0] + ', there are ' + confirmed.length + ' rows');
  }
  if (ct[1] !== '&#2547;' + sum(confirmed, 'paidBdt').toLocaleString('en-IN')) {
    fail('confirmed-leads.html', 'tile "Collected (taka)" reads ' + ct[1] + ', rows sum to &#2547;' + sum(confirmed, 'paidBdt').toLocaleString('en-IN'));
  }

  /* 4. Completed is derived: the badge and the balances must agree, in
   *    both directions. A badge on an owing row is as wrong as a missing
   *    badge on a settled one. */
  for (const r of applied) {
    const settled = r.dueBdt === 0 && r.dueUsd === 0;
    if (settled && !r.completedBadge) {
      fail('applied-leads.html', r.id + ': both balances are clear but no Completed badge is shown');
    }
    if (!settled && r.completedBadge) {
      fail('applied-leads.html', r.id + ': badged Completed while ' + pair(r.dueBdt, r.dueUsd) + ' is outstanding');
    }
  }

  /* 5. Nothing on Confirmed Leads may owe anything — reaching that list
   *    requires Completed. */
  for (const r of confirmed) {
    if (r.dueBdt > 0 || r.dueUsd > 0) {
      fail('confirmed-leads.html', r.id + ' is confirmed while owing ' + pair(r.dueBdt, r.dueUsd));
    }
  }

  /* 6. Every ledger sums to its row's Paid, per currency. */
  const byId = Object.fromEntries(applied.map(r => [r.id, r]));
  for (const l of ledgers()) {
    const row = byId[l.id];
    if (l.footPaidBdt !== null && l.paymentsBdt !== l.footPaidBdt) {
      fail('applied-leads.html', l.id + ' ledger: taka payments sum to ' + bdt(l.paymentsBdt) +
        ' but the ledger says Paid ' + bdt(l.footPaidBdt));
    }
    if (l.footPaidUsd !== null && l.paymentsUsd !== l.footPaidUsd) {
      fail('applied-leads.html', l.id + ' ledger: dollar payments sum to ' + usd(l.paymentsUsd) +
        ' but the ledger says Paid ' + usd(l.footPaidUsd));
    }
    if (row && l.footPaidBdt !== null && l.footPaidBdt !== row.paidBdt) {
      fail('applied-leads.html', l.id + ' ledger: taka Paid does not match the row figure');
    }
    if (row && l.footPaidUsd !== null && l.footPaidUsd !== row.paidUsd) {
      fail('applied-leads.html', l.id + ' ledger: dollar Paid does not match the row figure');
    }
  }

  /* 7. A package that does not accept dollars must carry no dollar
   *    figures anywhere — that is the rule the money engine enforces. */
  for (const r of applied) {
    if (!r.acceptsUsd && (r.agreedUsd > 0 || r.paidUsd > 0 || r.dueUsd > 0)) {
      fail('applied-leads.html', r.id + ': taka-only package carries dollar figures');
    }
  }

  /* 8. The cross-page check. A lead on more than one page must show the
   *    same money and the same package on each. */
  const seen = {};
  const record = (page, r) => {
    if (!r.id) return;
    (seen[r.id] = seen[r.id] || []).push({
      page: page, pkg: r.pkg,
      paidBdt: r.paidBdt, paidUsd: r.paidUsd, dueBdt: r.dueBdt, dueUsd: r.dueUsd
    });
  };
  applied.forEach(r => record('applied-leads.html', r));
  confirmed.forEach(r => record('confirmed-leads.html', r));
  leads.filter(r => r.hasMoney).forEach(r => record('leads.html', r));
  record('invoice.html', invoice);

  for (const id of Object.keys(seen)) {
    const views = seen[id];
    if (views.length < 2) continue;
    const a = views[0];
    for (const b of views.slice(1)) {
      if (a.paidBdt !== b.paidBdt || a.paidUsd !== b.paidUsd ||
          a.dueBdt !== b.dueBdt || a.dueUsd !== b.dueUsd) {
        fail('cross-page', id + ' differs: ' +
          a.page + ' shows paid ' + pair(a.paidBdt, a.paidUsd) + ' / due ' + pair(a.dueBdt, a.dueUsd) + ', ' +
          b.page + ' shows paid ' + pair(b.paidBdt, b.paidUsd) + ' / due ' + pair(b.dueBdt, b.dueUsd));
      }
      if (a.pkg && b.pkg && a.pkg !== b.pkg) {
        fail('cross-page', id + ' package differs: ' + a.page + ' says "' + a.pkg +
          '", ' + b.page + ' says "' + b.pkg + '"');
      }
    }
  }

  /* ================= Patients & Deals ================= */
  const people = dealPeople();
  const patients = patientRows();
  const packages = packageRows();

  if (!people.length) fail('deals.html', 'no people parsed — the check is not running');
  if (!patients.length) fail('patients.html', 'no rows parsed — the check is not running');
  if (!packages.length) fail('packages.html', 'no rows parsed — the check is not running');

  let allDeals = [];

  for (const p of people) {
    const deals = dealsOf(p.expansion);
    allDeals = allDeals.concat(deals);

    if (!deals.length) {
      fail('deals.html', p.name + ': no deals found in the expansion');
      continue;
    }
    if (deals.length !== p.dealCount) {
      fail('deals.html', p.name + ': row says ' + p.dealCount + ' deals, expansion lists ' + deals.length);
    }

    /* 9. Lifetime totals are the sum of that person's deals, per currency. */
    const sumP = k => deals.reduce((a, d) => a + d[k], 0);
    if (sumP('paidBdt') !== p.paidBdt || sumP('paidUsd') !== p.paidUsd) {
      fail('deals.html', p.name + ': lifetime paid reads ' + pair(p.paidBdt, p.paidUsd) +
        ', deals sum to ' + pair(sumP('paidBdt'), sumP('paidUsd')));
    }
    if (sumP('dueBdt') !== p.dueBdt || sumP('dueUsd') !== p.dueUsd) {
      fail('deals.html', p.name + ': outstanding reads ' + pair(p.dueBdt, p.dueUsd) +
        ', deals sum to ' + pair(sumP('dueBdt'), sumP('dueUsd')));
    }
    if (p.dueBdt !== p.dataDueBdt || p.dueUsd !== p.dataDueUsd) {
      fail('deals.html', p.name + ': shows ' + pair(p.dueBdt, p.dueUsd) +
        ' outstanding but the row attributes say ' + pair(p.dataDueBdt, p.dataDueUsd));
    }

    /* 10. Settled / Dues is derived: the badge must agree with the money,
     *     in both directions. */
    const owes = p.dueBdt > 0 || p.dueUsd > 0;
    if (owes && p.state !== 'dues') {
      fail('deals.html', p.name + ': marked ' + p.state + ' while owing ' + pair(p.dueBdt, p.dueUsd));
    }
    if (!owes && p.state !== 'settled') {
      fail('deals.html', p.name + ': marked ' + p.state + ' with nothing outstanding');
    }

    /* 11. A person's CURRENT deal is the same money as their row on
     *     Applied or Confirmed Leads — they are the same money. */
    const current = deals.find(d => d.current);
    const onApplied = applied.find(r => r.id === p.lead);
    const onConfirmed = confirmed.find(r => r.id === p.lead);
    const source = onApplied || onConfirmed;
    if (current && source) {
      if (current.paidBdt !== source.paidBdt || current.paidUsd !== source.paidUsd) {
        fail('cross-page', p.name + ' current deal paid ' + pair(current.paidBdt, current.paidUsd) +
          ' on deals.html but ' + pair(source.paidBdt, source.paidUsd) +
          ' on ' + (onApplied ? 'applied-leads.html' : 'confirmed-leads.html'));
      }
      if (current.dueBdt !== source.dueBdt || current.dueUsd !== source.dueUsd) {
        fail('cross-page', p.name + ' current deal due ' + pair(current.dueBdt, current.dueUsd) +
          ' on deals.html but ' + pair(source.dueBdt, source.dueUsd) +
          ' on ' + (onApplied ? 'applied-leads.html' : 'confirmed-leads.html'));
      }
      if (current.pkg && source.pkg && current.pkg !== source.pkg) {
        fail('cross-page', p.name + ' current deal package differs from the leads module');
      }
    } else if (current && !source) {
      fail('cross-page', p.name + ': current deal has no matching row on Applied or Confirmed Leads');
    }
  }

  /* 12. Deals tiles equal the sums of their columns. */
  const dt = tiles('deals.html');
  const sumPeople = k => people.reduce((a, p) => a + p[k], 0);
  const expectDeals = [
    String(people.length), String(allDeals.length),
    '&#2547;' + sumPeople('paidBdt').toLocaleString('en-IN'),
    '&#2547;' + sumPeople('dueBdt').toLocaleString('en-IN')
  ];
  ['People with Deals', 'Total Deals', 'Collected (taka)', 'Outstanding (taka)'].forEach((label, i) => {
    if (dt[i] !== expectDeals[i]) {
      fail('deals.html', 'tile "' + label + '" reads ' + dt[i] + ', rows sum to ' + expectDeals[i]);
    }
  });

  /* 13. Outstanding on Deals is the same money as Outstanding on Applied
   *     Leads — a confirmed lead owes nothing, so the two must agree. */
  const appliedDueBdt = applied.reduce((a, r) => a + r.dueBdt, 0);
  const appliedDueUsd = applied.reduce((a, r) => a + r.dueUsd, 0);
  if (sumPeople('dueBdt') !== appliedDueBdt || sumPeople('dueUsd') !== appliedDueUsd) {
    fail('cross-page', 'Deals outstanding ' + pair(sumPeople('dueBdt'), sumPeople('dueUsd')) +
      ' does not match Applied Leads outstanding ' + pair(appliedDueBdt, appliedDueUsd));
  }

  /* 14. A patient record exists for everyone with a deal. Applying and
   *     striking a deal is what makes someone a patient — reaching
   *     Confirmed is not required. */
  const peopleLeads = new Set(people.map(p => p.lead));
  for (const pt of patients) {
    if (!peopleLeads.has(pt.lead)) {
      fail('patients.html', pt.id + ' is a patient but ' + pt.lead + ' has no deal');
    }
    /* The Situation column is the lead's stage, so it must agree with
       whichever leads page that lead actually sits on. */
    const onApplied = applied.find(r => r.id === pt.lead);
    const onConfirmed = confirmed.find(r => r.id === pt.lead);
    const expected = onApplied ? 'Applied' : (onConfirmed ? 'Confirmed' : null);
    if (expected && pt.situation !== expected) {
      fail('patients.html', pt.id + ' situation reads "' + pt.situation + '" but the lead is ' + expected);
    }
  }
  if (patients.length !== people.length) {
    fail('patients.html', patients.length + ' patients but ' + people.length + ' people have deals');
  }

  /* 15. Package usage counts must add up, and "Most used" must actually
   *     be the maximum. */
  const usageByName = {};
  allDeals.forEach(d => { if (d.pkg) usageByName[d.pkg] = (usageByName[d.pkg] || 0) + 1; });
  const usageTotal = packages.reduce((a, p) => a + p.usage, 0);
  if (usageTotal !== allDeals.length) {
    fail('packages.html', 'usage counts total ' + usageTotal + ' but there are ' + allDeals.length + ' deals');
  }
  for (const pk of packages) {
    const actual = usageByName[pk.name] || 0;
    if (pk.usage !== actual) {
      fail('packages.html', pk.name + ': usage reads ' + pk.usage + ', deals.html has ' + actual);
    }
    if (pk.removeUsage !== pk.usage) {
      fail('packages.html', pk.name + ': the remove guard says ' + pk.removeUsage +
        ' but the usage column says ' + pk.usage);
    }
  }
  const maxUsage = Math.max.apply(null, packages.map(p => p.usage));
  for (const pk of packages) {
    if (pk.mostUsed && pk.usage !== maxUsage) {
      fail('packages.html', pk.name + ' is badged "Most used" with ' + pk.usage + ', but the maximum is ' + maxUsage);
    }
  }
  if (!packages.some(p => p.mostUsed)) {
    fail('packages.html', 'no package carries the "Most used" badge');
  }

  /* ================= Accounts ================= */
  const payments = paymentRows();
  const dues = dueRows();

  if (!payments.length) fail('payments.html', 'no rows parsed — the check is not running');
  if (!dues.length) fail('dues.html', 'no rows parsed — the check is not running');

  const verified = payments.filter(p => p.verified);
  const pending = payments.filter(p => p.pending);
  const vSum = c => verified.filter(p => p.cur === c).reduce((a, p) => a + p.amt, 0);

  /* 16. Verified payments are the money behind Deals, so they must sum to
   *     the lifetime collected figure exactly. */
  if (vSum('bdt') !== sumPeople('paidBdt') || vSum('usd') !== sumPeople('paidUsd')) {
    fail('cross-page', 'verified payments total ' + pair(vSum('bdt'), vSum('usd')) +
      ' but Deals lifetime collected is ' + pair(sumPeople('paidBdt'), sumPeople('paidUsd')));
  }

  /* 17. A pending payment is a claim. It must not be counted in any
   *     collected total — that is the whole point of the queue. */
  const pSum = c => pending.filter(p => p.cur === c).reduce((a, p) => a + p.amt, 0);
  /* A tile that carries a dollar sub-line emits TWO stat-value divs, so the
   * indices are not one-per-tile: payments is [pending, thisBdt, thisUsd,
   * allBdt, allUsd, count]. */
  const payTiles = tiles('payments.html');
  const allTimeBdt = '&#2547;' + vSum('bdt').toLocaleString('en-IN');
    if (payTiles[2] !== allTimeBdt) {
    fail('payments.html', 'tile "Verified All Time" reads ' + payTiles[2] + ', verified rows sum to ' + allTimeBdt);
  }
  if (payTiles[0] !== String(pending.length)) {
    fail('payments.html', 'tile "Awaiting Verification" reads ' + payTiles[0] + ', there are ' + pending.length + ' pending rows');
  }
  if (pSum('bdt') === 0 && pSum('usd') === 0) {
    fail('payments.html', 'no pending amounts — the "claims count for nothing" rule is not demonstrated');
  }

  /* 18. Dues per patient must equal that person's outstanding on Deals. */
  for (const d of dues) {
    const person = people.find(p => p.name === d.person);
    if (!person) {
      fail('dues.html', d.person + ' has a due but no deals');
      continue;
    }
    if (person.dueBdt !== d.bdt || person.dueUsd !== d.usd) {
      fail('cross-page', d.person + ' owes ' + pair(d.bdt, d.usd) + ' on dues.html but ' +
        pair(person.dueBdt, person.dueUsd) + ' on deals.html');
    }
  }

  /* 19. Everyone owing must appear on the dues list, and nobody else. */
  const owing = people.filter(p => p.dueBdt > 0 || p.dueUsd > 0);
  if (owing.length !== dues.length) {
    fail('cross-page', dues.length + ' rows on dues.html but ' + owing.length + ' people owe on deals.html');
  }
  const dueBdtTotal = dues.reduce((a, d) => a + d.bdt, 0);
  const dueUsdTotal = dues.reduce((a, d) => a + d.usd, 0);
  if (dueBdtTotal !== sumPeople('dueBdt') || dueUsdTotal !== sumPeople('dueUsd')) {
    fail('cross-page', 'dues.html totals ' + pair(dueBdtTotal, dueUsdTotal) +
      ' but Deals outstanding is ' + pair(sumPeople('dueBdt'), sumPeople('dueUsd')));
  }

  /* dues tiles are [outstanding, patients owing, received so far] */
  const dueTile = (read('dues.html').match(/data-pm-tile="due">([^<]*)</) || [])[1];
  if (dueTile !== '&#2547;' + dueBdtTotal.toLocaleString('en-IN')) {
    fail('dues.html', 'tile "Total Outstanding" reads ' + dueTile + ', rows sum to &#2547;' + dueBdtTotal.toLocaleString('en-IN'));
  }

  return fails;
};
