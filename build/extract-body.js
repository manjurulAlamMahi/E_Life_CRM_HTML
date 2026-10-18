#!/usr/bin/env node
/**
 * Extracts a page body from a generated page, inverting the shell in
 * build.js. Used once, to re-seed build/pages/ from the pages that had
 * drifted ahead of it.
 *
 *   node build/extract-body.js <generated.html> > build/pages/<page>.html
 */
'use strict';
const fs = require('fs');

const START = '                <!-- end page title -->\n';
const END = '\n\n            </div><!-- container-fluid -->';

function extract(file) {
  const html = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const i = html.indexOf(START);
  const j = html.lastIndexOf(END);
  if (i < 0 || j < 0) throw new Error('shell markers not found in ' + file);
  return html.slice(i + START.length, j).replace(/^\n/, '') + '\n';
}

module.exports = extract;
if (require.main === module) process.stdout.write(extract(process.argv[2]));
