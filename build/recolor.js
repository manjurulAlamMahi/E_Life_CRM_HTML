#!/usr/bin/env node
/**
 * Recolour the Aquiry template CSS from its stock palette to the
 * E Life Healthcare brand palette, reproducing Bootstrap 5.3's own
 * tint-color() / shade-color() maths so every derived shade
 * (hover, active, subtle, emphasis) stays internally consistent.
 *
 *   primary  #a47bc8  ->  #024766   (contrast text flips #000 -> #fff)
 *   success  #4ec5ad  ->  #53AA25   (contrast text stays #000)
 */
'use strict';
const fs = require('fs');

const TOL = 0.9; // channel tolerance when matching a derived shade

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16));
const toHex = (c) =>
  '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

// Bootstrap: tint-color($c, $w) = mix(white, $c, $w)
const tint = (c, t) => c.map((v) => v + (255 - v) * t);
// Bootstrap: shade-color($c, $w) = mix(black, $c, $w)
const shade = (c, s) => c.map((v) => v * (1 - s));

// WCAG relative luminance -> pick #000 or #fff the way Bootstrap does
function contrastColor(c) {
  const lin = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  const L = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  return (L + 0.05) / 0.05 > 1.05 / (L + 0.05) ? '#000' : '#fff';
}

/** If `obs` is a tint or shade of `base`, return {kind, amount}. */
function classify(base, obs) {
  // widest channel gives the most numerically stable solve
  const pick = (ranges) =>
    ranges.indexOf(Math.max(...ranges.map(Math.abs)));

  // tint: obs = base + (255-base)*t
  let i = pick(base.map((v) => 255 - v));
  if (255 - base[i] > 1) {
    const t = (obs[i] - base[i]) / (255 - base[i]);
    if (t >= -0.001 && t <= 1.001 && tint(base, t).every((v, k) => Math.abs(v - obs[k]) < TOL))
      return { kind: 'tint', amount: t };
  }
  // shade: obs = base*(1-s)
  i = pick(base);
  if (base[i] > 1) {
    const s = 1 - obs[i] / base[i];
    if (s >= -0.001 && s <= 1.001 && shade(base, s).every((v, k) => Math.abs(v - obs[k]) < TOL))
      return { kind: 'shade', amount: s };
  }
  return null;
}

const MAPS = [
  { name: 'primary', from: '#a47bc8', to: '#024766' },
  { name: 'success', from: '#4ec5ad', to: '#53aa25' },
].map((m) => {
  const f = hex(m.from), t = hex(m.to);
  return { ...m, f, t, fromContrast: contrastColor(f), toContrast: contrastColor(t) };
});

const num = '-?\\d+(?:\\.\\d+)?';
const stats = {};
const bump = (k) => (stats[k] = (stats[k] || 0) + 1);

function recolour(css) {
  // Work block by block so contrast-text flips only apply where the
  // block actually paints with the colour being replaced.
  return css.replace(/\{[^{}]*\}/g, (block) => {
    let out = block;

    for (const m of MAPS) {
      const usesColour =
        new RegExp(m.from, 'i').test(block) ||
        new RegExp(`${m.f[0]},\\s*${m.f[1]},\\s*${m.f[2]}`).test(block);

      // 1. exact hex
      out = out.replace(new RegExp(m.from, 'gi'), () => {
        bump(`${m.name}:hex`);
        return m.to;
      });

      // 2. bare rgb triplets used by --bs-*-rgb  (e.g. "164, 123, 200")
      out = out.replace(
        new RegExp(`(?<![\\d.])${m.f[0]},\\s*${m.f[1]},\\s*${m.f[2]}(?![\\d.])`, 'g'),
        () => {
          bump(`${m.name}:rgb-triplet`);
          return `${m.t[0]}, ${m.t[1]}, ${m.t[2]}`;
        }
      );

      // 3. rgb(...) values that are tints/shades of the old colour
      out = out.replace(
        new RegExp(`rgb\\(\\s*(${num})[, ]+\\s*(${num})[, ]+\\s*(${num})\\s*\\)`, 'g'),
        (whole, r, g, b) => {
          const obs = [+r, +g, +b];
          const cls = classify(m.f, obs);
          if (!cls) return whole;
          const next = cls.kind === 'tint' ? tint(m.t, cls.amount) : shade(m.t, cls.amount);
          bump(`${m.name}:${cls.kind}`);
          const fmt = (v) => (Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : v.toFixed(4).replace(/0+$/, '').replace(/\.$/, ''));
          return `rgb(${next.map(fmt).join(', ')})`;
        }
      );

      // 4. contrast text flip, only inside blocks that paint with this colour
      if (usesColour && m.fromContrast !== m.toContrast) {
        out = out.replace(
          /(--bs-(?:btn-|table-)?(?:hover-|active-|disabled-)?color:\s*)#000\b/g,
          (_, p) => { bump(`${m.name}:contrast-flip`); return p + m.toContrast; }
        );
        out = out.replace(
          /(^|;|\{)(\s*color:\s*)#000\b/g,
          (_, pre, p) => { bump(`${m.name}:contrast-flip`); return pre + p + m.toContrast; }
        );
        // focus ring = mix(contrast, base, 15%)
        out = out.replace(
          new RegExp(`(--bs-btn-focus-shadow-rgb:\\s*)${num},\\s*${num},\\s*${num}`, 'g'),
          (whole, p) => {
            const cc = m.toContrast === '#fff' ? [255, 255, 255] : [0, 0, 0];
            const mixed = m.t.map((v, k) => Math.round(cc[k] * 0.15 + v * 0.85));
            bump(`${m.name}:focus-ring`);
            return p + mixed.join(', ');
          }
        );
      }
    }
    return out;
  });
}

const files = process.argv.slice(2);
if (!files.length) { console.error('usage: recolor.js <file.css> ...'); process.exit(1); }

for (const file of files) {
  const before = fs.readFileSync(file, 'utf8');
  const after = recolour(before);
  fs.writeFileSync(file, after);
  console.log(`${file}: ${before.length} -> ${after.length} bytes`);
}
console.log('\nreplacements:');
for (const [k, v] of Object.entries(stats).sort()) console.log(`  ${k.padEnd(26)} ${v}`);

// Safety net: nothing from the old palette may survive.
let leaks = 0;
for (const file of files) {
  const css = fs.readFileSync(file, 'utf8');
  for (const m of MAPS) {
    const n = (css.match(new RegExp(m.from, 'gi')) || []).length;
    if (n) { console.log(`  !! ${file}: ${n} leftover ${m.from}`); leaks += n; }
  }
}
console.log(leaks ? `\nFAILED: ${leaks} leftovers` : '\nOK: no stock palette colours remain');
