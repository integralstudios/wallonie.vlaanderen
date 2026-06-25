const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function tagWithAttribute(tagName, attributeName, value) {
  const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`<${tagName}\\b(?=[^>]*\\b${attributeName}="${escapedValue}")[^>]*>`);
  const match = html.match(pattern);
  assert.ok(match, `Expected <${tagName}> with ${attributeName}="${value}"`);
  return match[0];
}

function assertTagHasAttribute(tag, attributeName, value) {
  const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert.match(tag, new RegExp(`\\b${attributeName}="${escapedValue}"`));
}

function assertTagHasBooleanAttribute(tag, attributeName) {
  assert.match(tag, new RegExp(`\\b${attributeName}(?:\\s|>|$)`));
}

function assertTagHasClass(tag, className) {
  const classMatch = tag.match(/\bclass="([^"]*)"/);
  assert.ok(classMatch, `Expected class attribute on ${tag}`);
  assert.ok(
    classMatch[1].split(/\s+/).includes(className),
    `Expected ${tag} to include class "${className}"`,
  );
}

function extractLyricsData() {
  const lyricsMatch = html.match(/var LYRICS = (\{[\s\S]*?\n        \});/);
  assert.ok(lyricsMatch, 'Expected LYRICS object literal');
  return vm.runInNewContext(`(${lyricsMatch[1]})`);
}

test('lyrics controls and overlay shell are present', () => {
  const lyricsButton = tagWithAttribute('button', 'id', 'lyricsBtn');
  assertTagHasClass(lyricsButton, 'lyrics-btn');
  assertTagHasClass(lyricsButton, 'control-btn');
  assertTagHasAttribute(lyricsButton, 'aria-pressed', 'false');
  assertTagHasAttribute(lyricsButton, 'aria-controls', 'lyricsOverlay');

  const overlay = tagWithAttribute('section', 'id', 'lyricsOverlay');
  assertTagHasClass(overlay, 'lyrics-overlay');
  assertTagHasAttribute(overlay, 'aria-hidden', 'true');
  assertTagHasAttribute(overlay, 'aria-label', 'Lyrics');
  assertTagHasBooleanAttribute(overlay, 'inert');

  assert.match(html, /id="lyricsTrack"/);
  ['nl', 'fr', 'de'].forEach((language) => {
    const languageButton = tagWithAttribute('button', 'data-language', language);
    assertTagHasClass(languageButton, 'lyrics-language');
    assertTagHasAttribute(languageButton, 'type', 'button');
  });
});

test('mute control hooks are preserved', () => {
  const muteButton = tagWithAttribute('button', 'id', 'muteBtn');
  assertTagHasClass(muteButton, 'mute-btn');
  assertTagHasClass(muteButton, 'control-btn');
  assertTagHasAttribute(muteButton, 'aria-pressed', 'false');
  assert.match(html, /class="icon icon-on"/);
  assert.match(html, /class="icon icon-off"/);
  assert.match(html, /\.mute-btn\.is-muted \.icon-on/);
  assert.match(html, /\.mute-btn\.is-muted \.icon-off/);
});

test('lyrics overlay has a static flag-derived blur bloom and reduced-motion styling', () => {
  assert.match(html, /class="lyrics-flag-blur-backdrop"/);
  assert.match(html, /class="lyrics-flag-blur-layer lyrics-flag-blur-color"/);
  assert.match(html, /class="lyrics-flag-blur-layer lyrics-flag-blur-shadow"/);
  assert.match(html, /class="lyrics-flag-blur-layer lyrics-flag-blur-glow"/);
  assert.match(html, /class="lyrics-flag-blur-vignette"/);
  assert.match(html, /\.lyrics-flag-blur-layer[\s\S]*border-radius:\s*9999px/);
  assert.match(html, /\.lyrics-flag-blur-layer[\s\S]*linear-gradient\(90deg, #030303 0 33\.333%, #fdda24 33\.333% 66\.666%, #ef3340 66\.666% 100%\)/);
  assert.match(html, /\.lyrics-flag-blur-color[\s\S]*filter:\s*blur\(58px\) saturate\(1\.55\) contrast\(1\.08\)/);
  assert.match(html, /\.lyrics-flag-blur-color[\s\S]*mix-blend-mode:\s*screen/);
  assert.match(html, /\.lyrics-flag-blur-shadow[\s\S]*filter:\s*blur\(64px\) saturate\(1\.2\)/);
  assert.match(html, /\.lyrics-flag-blur-shadow[\s\S]*mix-blend-mode:\s*multiply/);
  assert.match(html, /\.lyrics-flag-blur-glow[\s\S]*filter:\s*blur\(44px\) saturate\(1\.85\)/);
  assert.match(html, /\.lyrics-flag-blur-color[\s\S]*transform:\s*translate3d\([^)]*\) rotate\([^)]*\) scale\(/);
  assert.match(html, /\.lyrics-flag-blur-vignette[\s\S]*linear-gradient\(180deg/);
  assert.doesNotMatch(html, /@keyframes/);
  assert.doesNotMatch(html, /animation:\s*[a-zA-Z]/);
  assert.match(html, /prefers-reduced-motion:\s*reduce/);
  assert.match(html, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.lyrics-flag-blur-layer/);
  assert.match(html, /\.lyrics-viewport[\s\S]*overflow-y:\s*auto/);
  assert.doesNotMatch(html, /\.lyrics-line\.is-active/);
});

test('first-interaction audio guard safely ignores shared controls', () => {
  assert.match(html, /var isControl = evt\.target && evt\.target\.closest && evt\.target\.closest\('\.control-btn'\);/);
  assert.match(
    html,
    /var isControl = evt\.target && evt\.target\.closest && evt\.target\.closest\('\.control-btn'\);\s*if \(isControl\) return;\s*play\(\);\s*events\.forEach/s,
  );
});

test('audio control reflects autoplay blocking and retries playback on click', () => {
  assert.match(html, /var playbackBlocked = false/);
  assert.match(html, /var isPlaying = true/);
  assert.match(html, /var shouldShowSoundOff = muted \|\| playbackBlocked \|\| !isPlaying/);
  assert.match(html, /btn\.classList\.toggle\('is-muted', shouldShowSoundOff\)/);
  assert.match(html, /btn\.setAttribute\('aria-label', muted \? 'Unmute' : shouldShowSoundOff \? 'Play anthem' : 'Mute'\)/);

  const playMatch = html.match(/function play\(\) \{([\s\S]*?)\n        \}/);
  assert.ok(playMatch, 'Expected play function body');
  assert.match(playMatch[1], /p\.then\(function \(\) \{/);
  assert.match(playMatch[1], /playbackBlocked = false;\s*isPlaying = true;\s*render\(\);/);
  assert.match(playMatch[1], /catch\(function \(\) \{/);
  assert.match(playMatch[1], /playbackBlocked = true;\s*isPlaying = false;\s*render\(\);/);

  const muteClickMatch = html.match(/btn\.addEventListener\('click', function \(\) \{([\s\S]*?)\n        \}\);/);
  assert.ok(muteClickMatch, 'Expected mute button click handler');
  assert.match(muteClickMatch[1], /if \(playbackBlocked \|\| !isPlaying \|\| audio\.paused\) \{/);
  assert.match(muteClickMatch[1], /muted = false;\s*audio\.muted = false;\s*play\(\);\s*render\(\);\s*return;/);
});

test('lyrics data includes full Dutch, French, and German lyric sheets', () => {
  assert.match(html, /var LYRICS = \{/);
  assert.match(html, /nl:\s*\[/);
  assert.match(html, /fr:\s*\[/);
  assert.match(html, /de:\s*\[/);
  assert.match(html, /O dierbaar België/);
  assert.match(html, /O Belgique, ô mère chérie,/);
  assert.match(html, /À toi nos cœurs/);
  assert.match(html, /À toi notre sang, ô Patrie !/);
  assert.match(html, /O liebes Land/);
  assert.match(html, /Liberté/);
  assert.match(html, /König/);
  assert.match(html, /\(x3\)/);
  assert.match(html, /\(ter\)/);
  assert.doesNotMatch(html, /time:\s*\d/);
});

test('lyrics data has static sheet structure without timing metadata', () => {
  const lyrics = extractLyricsData();
  assert.deepEqual(Object.keys(lyrics), ['nl', 'fr', 'de']);

  assert.equal(lyrics.nl.length, 11);
  assert.equal(lyrics.fr.length, 8);
  assert.equal(lyrics.de.length, 8);

  Object.values(lyrics).forEach((lines) => {
    lines.forEach((line, index) => {
      assert.equal(typeof line, 'string');
      assert.notEqual(line.trim(), '', `Expected non-empty lyric at index ${index}`);
    });
  });
});

test('lyrics runtime exposes open, close, language, and render hooks', () => {
  assert.match(html, /var lyricsOpen = false/);
  assert.match(html, /var selectedLanguage = 'nl'/);
  assert.match(html, /function setLyricsOpen\(open\)/);
  assert.match(html, /function setLanguage\(language\)/);
  assert.match(html, /function renderLyrics\(\)/);
  assert.match(html, /lyricsBtn\.addEventListener\('click'/);
  assert.match(html, /document\.addEventListener\('keydown'/);
  assert.match(html, /lyricsOverlay\.removeAttribute\('inert'\)/);
  assert.match(html, /lyricsOverlay\.setAttribute\('inert', ''\)/);
});

test('lyrics runtime renders text safely and restores focus before inert close', () => {
  const renderLyricsMatch = html.match(/function renderLyrics\(\) \{([\s\S]*?)\n        \}/);
  assert.ok(renderLyricsMatch, 'Expected renderLyrics function body');
  assert.doesNotMatch(renderLyricsMatch[1], /innerHTML/);
  assert.match(renderLyricsMatch[1], /while \(lyricsTrack\.firstChild\) lyricsTrack\.removeChild\(lyricsTrack\.firstChild\);/);
  assert.match(renderLyricsMatch[1], /document\.createElement\('p'\)/);
  assert.match(renderLyricsMatch[1], /lineNode\.textContent = line/);
  assert.match(renderLyricsMatch[1], /lyricsTrack\.appendChild\(lineNode\)/);

  assert.match(html, /lyricsOverlay\.contains\(document\.activeElement\)/);
  assert.match(html, /lyricsBtn\.focus\(\)/);
});

test('lyrics runtime presents a static sheet without audio sync machinery', () => {
  const setLyricsOpenMatch = html.match(/function setLyricsOpen\(open\) \{([\s\S]*?)\n        function setLanguage/);
  assert.ok(setLyricsOpenMatch, 'Expected setLyricsOpen function body');

  assert.match(setLyricsOpenMatch[1], /play\(\)/);
  assert.doesNotMatch(html, /var lyricsSyncFrame/);
  assert.doesNotMatch(html, /function findActiveLyricIndex/);
  assert.doesNotMatch(html, /function updateActiveLyric/);
  assert.doesNotMatch(html, /function startLyricsSync/);
  assert.doesNotMatch(html, /function stopLyricsSync/);
  assert.doesNotMatch(html, /function syncLyrics/);
  assert.doesNotMatch(html, /audio\.currentTime/);
  assert.doesNotMatch(html, /requestAnimationFrame/);
  assert.doesNotMatch(html, /cancelAnimationFrame/);
  assert.doesNotMatch(html, /audio\.addEventListener\('timeupdate'/);
  assert.doesNotMatch(html, /classList\.toggle\('is-past'/);
  assert.doesNotMatch(setLyricsOpenMatch[1], /requestAnimationFrame\(syncLyrics\)/);
});
