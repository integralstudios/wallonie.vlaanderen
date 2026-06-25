const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('lyrics controls and overlay shell are present', () => {
  assert.match(html, /id="lyricsBtn"/);
  assert.match(html, /class="lyrics-btn control-btn"/);
  assert.match(html, /<section id="lyricsOverlay" class="lyrics-overlay" aria-hidden="true" aria-label="Lyrics" inert>/);
  assert.match(html, /class="lyrics-overlay"/);
  assert.match(html, /id="lyricsTrack"/);
  assert.match(html, /data-language="nl"/);
  assert.match(html, /data-language="fr"/);
  assert.match(html, /data-language="de"/);
});

test('lyrics overlay has blur, readable fallback, and reduced-motion styling', () => {
  assert.match(html, /backdrop-filter:\s*blur\(/);
  assert.match(html, /-webkit-backdrop-filter:\s*blur\(/);
  assert.match(html, /@supports not \(\(backdrop-filter:\s*blur\(1px\)\)/);
  assert.match(html, /prefers-reduced-motion:\s*reduce/);
  assert.match(html, /\.lyrics-line\.is-active/);
});

test('first-interaction audio guard ignores shared controls', () => {
  assert.match(html, /evt\.target\.closest\('\.control-btn'\)/);
});
