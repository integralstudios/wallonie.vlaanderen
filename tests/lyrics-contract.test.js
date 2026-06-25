const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const lyricsBackgroundPath = path.join(__dirname, '..', 'lyrics-bg.jpg');
const expectedDutchLyrics = [
  "O dierbaar België, o heilig land der vaad'ren",
  'Onze ziel en ons hart zijn u gewijd.',
  '',
  'Aanvaard ons kracht en het bloed van onze adren,',
  'Wees ons doel in arbeid en in strijd.',
  '',
  'Bloei, o land, in eendracht niet te breken;',
  'Wees immer u zelf en ongeknecht,',
  '',
  'Het woord getrouw, dat ge onbevreesd moogt spreken:',
  'Voor Vorst, voor Vrijheid en voor Recht.',
  '',
  'Het woord getrouw, dat ge onbevreesd moogt spreken:',
  'Voor Vorst, voor Vrijheid en voor Recht!',
  '',
  'Voor Vorst, voor Vrijheid en voor Recht!',
  'Voor Vorst, voor Vrijheid en voor Recht!',
];
const expectedFrenchLyrics = [
  'O Belgique, ô mère chérie,',
  'À toi nos cœurs, à toi nos bras,',
  '',
  'À toi notre sang, ô Patrie !',
  'Nous le jurons tous, tu vivras !',
  '',
  'Tu vivras toujours grande et belle',
  'Et ton invincible unité',
  '',
  'Aura pour devise immortelle :',
  'Le Roi, la Loi, la Liberté !',
  '',
  'Aura pour devise immortelle :',
  'Le Roi, la Loi, la Liberté !',
  '',
  'Le Roi, la Loi, la Liberté !',
  'Le Roi, la Loi, la Liberté !',
];
const expectedGermanLyrics = [
  'O liebes Land, o Belgiens Erde,',
  'Dir unser Herz, Dir unsere Hand,',
  '',
  'Dir unser Blut, dem Heimatherde,',
  "wir schwören's Dir, o Vaterland!",
  '',
  'So blühe froh in voller Schöne,',
  'zu der die Freiheit Dich erzog,',
  '',
  'und fortan singen Deine Söhne:',
  'Gesetz und König und die Freiheit hoch!',
  '',
  'und fortan singen Deine Söhne:',
  'Gesetz und König und die Freiheit hoch!',
  '',
  'Gesetz und König und die Freiheit hoch!',
  'Gesetz und König und die Freiheit hoch!',
];

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

function extractPageScript() {
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(scriptMatch, 'Expected page script');
  return scriptMatch[1];
}

function createFakeElement(text = '') {
  let ownText = text;
  const element = {
    attributes: {},
    children: [],
    className: '',
    focused: false,
    handlers: {},
    parentNode: null,
    scrollTop: 0,
    style: {
      values: {},
      setProperty(name, value) {
        this.values[name] = value;
      },
    },
    addEventListener(name, handler) {
      this.handlers[name] = handler;
    },
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      return child;
    },
    contains(node) {
      return node === this || this.children.some((child) => child.contains && child.contains(node));
    },
    get firstChild() {
      return this.children[0] || null;
    },
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
    },
    getBoundingClientRect() {
      return { left: 0, width: Math.max(this.textContent.length * 8, 16) };
    },
    removeAttribute(name) {
      delete this.attributes[name];
    },
    removeChild(child) {
      const index = this.children.indexOf(child);
      if (index >= 0) this.children.splice(index, 1);
      child.parentNode = null;
      return child;
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
  };
  Object.defineProperty(element, 'textContent', {
    get() {
      return ownText + element.children.map((child) => child.textContent).join('');
    },
    set(value) {
      ownText = String(value);
      element.children.length = 0;
    },
  });
  element.classList = {
    add(...classNames) {
      const classes = new Set(element.className.split(/\s+/).filter(Boolean));
      classNames.forEach((className) => classes.add(className));
      element.className = Array.from(classes).join(' ');
    },
    remove(...classNames) {
      const classes = new Set(element.className.split(/\s+/).filter(Boolean));
      classNames.forEach((className) => classes.delete(className));
      element.className = Array.from(classes).join(' ');
    },
    toggle(className, force) {
      const classes = new Set(element.className.split(/\s+/).filter(Boolean));
      const shouldAdd = force === undefined ? !classes.has(className) : Boolean(force);
      if (shouldAdd) classes.add(className);
      else classes.delete(className);
      element.className = Array.from(classes).join(' ');
    },
  };
  return element;
}

function createLyricsRuntime({ languages, language }) {
  const audio = createFakeElement();
  const muteBtn = createFakeElement();
  const lyricsBtn = createFakeElement();
  const lyricsOverlay = createFakeElement();
  const lyricsTrack = createFakeElement();
  const lyricsViewport = createFakeElement();
  const languageSwitcher = createFakeElement();
  const languageUnderline = createFakeElement();
  const languageButtons = ['de', 'fr', 'nl'].map((code) => {
    const button = createFakeElement(code.toUpperCase());
    button.className = code === 'nl' ? 'lyrics-language is-selected' : 'lyrics-language';
    button.setAttribute('data-language', code);
    button.setAttribute('aria-pressed', String(code === 'nl'));
    return button;
  });
  const documentHandlers = {};
  const windowHandlers = {};

  lyricsViewport.appendChild(lyricsTrack);
  audio.paused = false;
  audio.play = () => ({
    then(callback) {
      callback();
      return { catch() {} };
    },
  });

  const document = {
    activeElement: null,
    addEventListener(name, handler) {
      documentHandlers[name] = handler;
    },
    createElement() {
      return createFakeElement();
    },
    createRange() {
      let selectedNode = null;
      return {
        detach() {},
        getBoundingClientRect() {
          return selectedNode ? selectedNode.getBoundingClientRect() : { left: 0, width: 0 };
        },
        selectNodeContents(node) {
          selectedNode = node;
        },
      };
    },
    createTextNode(text) {
      return createFakeElement(text);
    },
    fonts: null,
    getElementById(id) {
      return {
        anthem: audio,
        muteBtn,
        lyricsBtn,
        lyricsOverlay,
        lyricsTrack,
      }[id];
    },
    querySelector(selector) {
      return {
        '.lyrics-language-switcher': languageSwitcher,
        '.lyrics-language-underline': languageUnderline,
      }[selector] || null;
    },
    querySelectorAll(selector) {
      return selector === '.lyrics-language' ? languageButtons : [];
    },
  };

  vm.runInNewContext(extractPageScript(), {
    console: { log() {} },
    document,
    navigator: { language, languages },
    window: {
      addEventListener(name, handler) {
        windowHandlers[name] = handler;
      },
    },
  });

  return {
    documentHandlers,
    languageButtons,
    lyricsBtn,
    lyricsOverlay,
    lyricsTrack,
    windowHandlers,
  };
}

function click(element) {
  assert.equal(typeof element.handlers.click, 'function', 'Expected click handler');
  element.handlers.click();
}

function selectedLyricsLanguage(runtime) {
  return runtime.languageButtons
    .find((button) => button.getAttribute('aria-pressed') === 'true')
    .getAttribute('data-language');
}

function renderedLyrics(runtime) {
  return runtime.lyricsTrack.children.map((line) => line.textContent);
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
  assert.match(
    html,
    /data-language="de"[\s\S]*>DE<\/button>\s*<button[\s\S]*data-language="fr"[\s\S]*>FR<\/button>\s*<button[\s\S]*data-language="nl"[\s\S]*>NL<\/button>/,
  );
  assert.match(html, /class="lyrics-language-underline"/);
});

test('lyrics language picker is a bottom-aligned underline control', () => {
  assert.match(html, /\.lyrics-language-switcher[\s\S]*bottom:\s*64px/);
  assert.match(html, /\.lyrics-language-switcher[\s\S]*transform:\s*translate\(-50%, 50%\)/);
  assert.doesNotMatch(html, /\.lyrics-language-switcher[\s\S]*top:\s*28px/);
  assert.match(html, /\.lyrics-language-switcher[\s\S]*--language-underline-x:\s*0px/);
  assert.match(html, /\.lyrics-language-switcher[\s\S]*--language-underline-width:\s*0px/);
  assert.match(html, /\.lyrics-language[\s\S]*border:\s*0/);
  assert.match(html, /\.lyrics-language[\s\S]*background:\s*transparent/);
  assert.match(html, /\.lyrics-language[\s\S]*color:\s*rgba\(255, 255, 255, 0\.6\)/);
  assert.match(html, /\.lyrics-language[\s\S]*font:\s*400 12px\/1 "mendl-sans-dusk", sans-serif/);
  assert.match(html, /\.lyrics-language[\s\S]*letter-spacing:\s*1px/);
  assert.match(html, /\.lyrics-language[\s\S]*mix-blend-mode:\s*plus-lighter/);
  assert.match(html, /\.lyrics-language:not\(\.is-selected\):hover[\s\S]*color:\s*#ffffff/);
  assert.match(html, /\.lyrics-language:focus[\s\S]*outline:\s*none/);
  assert.match(html, /\.lyrics-language:focus-visible[\s\S]*color:\s*#ffffff/);
  assert.match(html, /\.lyrics-language\.is-selected[\s\S]*color:\s*#ffffff/);
  assert.match(html, /\.lyrics-language\.is-selected[\s\S]*mix-blend-mode:\s*normal/);
  assert.match(html, /\.lyrics-language-underline[\s\S]*position:\s*absolute/);
  assert.match(html, /\.lyrics-language-underline[\s\S]*bottom:\s*0/);
  assert.match(html, /\.lyrics-language-underline[\s\S]*height:\s*1px/);
  assert.match(html, /\.lyrics-language-underline[\s\S]*background:\s*#ffffff/);
  assert.match(html, /\.lyrics-language-underline[\s\S]*width:\s*var\(--language-underline-width\)/);
  assert.match(html, /\.lyrics-language-underline[\s\S]*transform:\s*translate3d\(var\(--language-underline-x\), 0, 0\)/);
  assert.match(html, /\.lyrics-language-underline[\s\S]*transition:\s*transform 0\.34s cubic-bezier\(0\.22, 0\.61, 0\.36, 1\),\s*width 0\.34s cubic-bezier\(0\.22, 0\.61, 0\.36, 1\)/);
  assert.match(html, /@media \(max-width:\s*520px\)[\s\S]*\.lyrics-language-switcher[\s\S]*bottom:\s*52px/);
  assert.match(html, /function updateLanguageUnderline\(\)/);
  assert.match(html, /document\.createRange\(\)/);
  assert.match(html, /range\.selectNodeContents\(selectedButton\)/);
  assert.match(html, /range\.getBoundingClientRect\(\)/);
  assert.match(html, /languageSwitcher\.style\.setProperty\('--language-underline-x'/);
  assert.match(html, /languageSwitcher\.style\.setProperty\('--language-underline-width'/);
  assert.match(html, /window\.addEventListener\('resize', updateLanguageUnderline\)/);
  assert.match(html, /document\.fonts\.ready\.then\(updateLanguageUnderline\)/);
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

test('lyrics overlay uses the provided image as a blurred background', () => {
  assert.ok(fs.existsSync(lyricsBackgroundPath), 'Expected lyrics-bg.jpg asset');
  assert.ok(fs.statSync(lyricsBackgroundPath).size > 0, 'Expected lyrics-bg.jpg to be non-empty');
  assert.match(html, /class="lyrics-background"/);
  assert.match(html, /class="lyrics-background-image"/);
  assert.match(html, /class="lyrics-background-wash"/);
  assert.match(html, /\.lyrics-background-image[\s\S]*background-image:\s*url\('lyrics-bg\.jpg'\)/);
  assert.match(html, /\.lyrics-background-image[\s\S]*background-size:\s*cover/);
  assert.match(html, /\.lyrics-background-image[\s\S]*filter:\s*blur\(28px\) saturate\(1\.12\)/);
  assert.match(html, /\.lyrics-background-image[\s\S]*transform:\s*scale\(1\.08\)/);
  assert.match(html, /\.lyrics-background-wash[\s\S]*linear-gradient\(180deg/);
  assert.doesNotMatch(html, /backdrop-filter:\s*blur\(/);
  assert.doesNotMatch(html, /-webkit-backdrop-filter:\s*blur\(/);
  assert.match(html, /prefers-reduced-motion:\s*reduce/);
  assert.match(html, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.lyrics-background-image/);
  assert.match(html, /\.lyrics-viewport[\s\S]*max-height:\s*min\(84vh, 760px\)/);
  assert.match(html, /\.lyrics-viewport[\s\S]*overflow-y:\s*auto/);
  assert.doesNotMatch(html, /\.lyrics-line\.is-active/);
});

test('lyrics words stagger animate in when the overlay opens', () => {
  assert.match(html, /@keyframes lyricsTrackRise/);
  assert.match(html, /@keyframes lyricWordIn/);
  assert.match(html, /@keyframes lyricsLanguageSwitch/);
  assert.match(html, /<link rel="stylesheet" href="https:\/\/use\.typekit\.net\/qsr7tur\.css">/);
  assert.match(html, /\.lyrics-line[\s\S]*color:\s*rgba\(255, 255, 255, 0\.8\)/);
  assert.match(html, /\.lyrics-line[\s\S]*font:\s*400 20px\/1\.18 "mendl-serif-dusk", sans-serif/);
  assert.match(html, /\.lyrics-line[\s\S]*font-style:\s*normal/);
  assert.match(html, /\.lyrics-line[\s\S]*mix-blend-mode:\s*plus-lighter/);
  assert.match(html, /\.lyrics-line[\s\S]*-webkit-font-smoothing:\s*antialiased/);
  assert.match(html, /\.lyrics-line[\s\S]*-moz-osx-font-smoothing:\s*grayscale/);
  assert.match(html, /\.lyrics-line\.is-spacer[\s\S]*height:\s*32px/);
  assert.doesNotMatch(html, /font:\s*800 clamp/);
  assert.doesNotMatch(html, /font-size:\s*clamp\(19px, 6\.6vw, 28px\)/);
  assert.match(html, /\.lyrics-overlay\.is-open\.is-lyrics-entering \.lyrics-track[\s\S]*animation:\s*lyricsTrackRise 0\.82s cubic-bezier\(0\.22, 0\.61, 0\.36, 1\) both/);
  assert.match(html, /\.lyrics-word[\s\S]*display:\s*inline-block/);
  assert.match(html, /\.lyrics-overlay\.is-open\.is-lyrics-entering \.lyrics-word[\s\S]*animation:\s*lyricWordIn 0\.68s cubic-bezier\(0\.22, 0\.61, 0\.36, 1\) both/);
  assert.match(html, /\.lyrics-overlay\.is-open\.is-lyrics-entering \.lyrics-word[\s\S]*animation-delay:\s*calc\(var\(--word-index\) \* 15ms\)/);
  assert.doesNotMatch(html, /\.lyrics-overlay\.is-open\s+\.lyrics-word/);
  assert.match(html, /\.lyrics-overlay\.is-open\.is-language-switching \.lyrics-track[\s\S]*animation:\s*lyricsLanguageSwitch 0\.32s cubic-bezier\(0\.22, 0\.61, 0\.36, 1\) both/);
  assert.match(html, /@keyframes lyricsTrackRise[\s\S]*from\s*\{[\s\S]*transform:\s*translate3d\(0, 28px, 0\)/);
  assert.match(html, /@keyframes lyricsLanguageSwitch[\s\S]*from\s*\{[\s\S]*opacity:\s*0;[\s\S]*transform:\s*translate3d\(0, 6px, 0\)/);
  assert.match(html, /from\s*\{[\s\S]*opacity:\s*0;[\s\S]*transform:\s*translate3d\(0, 32px, 0\)/);
  assert.match(html, /64%\s*\{[\s\S]*opacity:\s*1/);
  assert.match(html, /to\s*\{[\s\S]*opacity:\s*1;[\s\S]*transform:\s*translate3d\(0, 0, 0\)/);
  assert.match(html, /var wordIndex = 0/);
  assert.match(html, /var tokens = line\.split\(\s*\/\(\\s\+\)\/\s*\)/);
  assert.match(html, /wordNode\.className = 'lyrics-word'/);
  assert.match(html, /wordNode\.style\.setProperty\('--word-index', String\(wordIndex\)\)/);
  assert.match(html, /wordIndex \+= 1/);
  assert.match(html, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.lyrics-overlay\.is-open\.is-lyrics-entering \.lyrics-track[\s\S]*animation:\s*none/);
  assert.match(html, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.lyrics-overlay\.is-open\.is-language-switching \.lyrics-track[\s\S]*animation:\s*none/);
  assert.match(html, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.lyrics-overlay\.is-open\.is-lyrics-entering \.lyrics-word[\s\S]*animation:\s*none/);
  assert.doesNotMatch(html, /lyricLineIn/);
  assert.doesNotMatch(html, /--line-index/);
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
  assert.doesNotMatch(html, /\(x3\)/);
  assert.doesNotMatch(html, /\(ter\)/);
  assert.doesNotMatch(html, /time:\s*\d/);
});

test('lyrics data has static sheet structure without timing metadata', () => {
  const lyrics = extractLyricsData();
  assert.deepEqual(Object.keys(lyrics), ['nl', 'fr', 'de']);

  assert.deepEqual(Array.from(lyrics.nl), expectedDutchLyrics);
  assert.deepEqual(Array.from(lyrics.fr), expectedFrenchLyrics);
  assert.deepEqual(Array.from(lyrics.de), expectedGermanLyrics);
  Object.values(lyrics).forEach((lines) => {
    assert.deepEqual(
      lines.reduce((indexes, line, index) => (line === '' ? indexes.concat(index) : indexes), []),
      [2, 5, 8, 11, 14],
    );
    assert.equal(lines.length, 17);
  });

  Object.entries(lyrics).forEach(([language, lines]) => {
    lines.forEach((line, index) => {
      assert.equal(typeof line, 'string');
      if ([2, 5, 8, 11, 14].includes(index)) {
        assert.equal(line, '', `Expected ${language} spacer at index ${index}`);
        return;
      }
      assert.notEqual(line.trim(), '', `Expected non-empty ${language} lyric at index ${index}`);
    });
  });
});

test('lyrics runtime exposes open, close, language, and render hooks', () => {
  assert.match(html, /var lyricsOpen = false/);
  assert.match(html, /var selectedLanguage = 'nl'/);
  assert.match(html, /function setLyricsOpen\(open\)/);
  assert.match(html, /function setLanguage\(language, animateSwitch\)/);
  assert.match(html, /function renderLyrics\(\)/);
  assert.match(html, /lyricsBtn\.addEventListener\('click'/);
  assert.match(html, /document\.addEventListener\('keydown'/);
  assert.match(html, /lyricsOverlay\.removeAttribute\('inert'\)/);
  assert.match(html, /lyricsOverlay\.setAttribute\('inert', ''\)/);
});

test('lyrics runtime opens with the first supported browser language', () => {
  [
    {
      browserLanguage: 'nl-BE',
      browserLanguages: ['nl-BE', 'fr-BE'],
      expectedLanguage: 'nl',
      expectedLyrics: expectedDutchLyrics,
    },
    {
      browserLanguage: 'en-US',
      browserLanguages: ['fr-BE', 'nl-BE'],
      expectedLanguage: 'fr',
      expectedLyrics: expectedFrenchLyrics,
    },
    {
      browserLanguage: 'de-DE',
      browserLanguages: [],
      expectedLanguage: 'de',
      expectedLyrics: expectedGermanLyrics,
    },
    {
      browserLanguage: 'en-US',
      browserLanguages: ['en-US', 'es-ES'],
      expectedLanguage: 'nl',
      expectedLyrics: expectedDutchLyrics,
    },
  ].forEach(({ browserLanguage, browserLanguages, expectedLanguage, expectedLyrics }) => {
    const runtime = createLyricsRuntime({
      language: browserLanguage,
      languages: browserLanguages,
    });

    click(runtime.lyricsBtn);

    assert.equal(selectedLyricsLanguage(runtime), expectedLanguage);
    assert.deepEqual(renderedLyrics(runtime), expectedLyrics);
  });
});

test('lyrics runtime keeps a manually selected language when reopened', () => {
  const runtime = createLyricsRuntime({
    language: 'fr-BE',
    languages: ['fr-BE', 'nl-BE'],
  });

  click(runtime.lyricsBtn);
  assert.equal(selectedLyricsLanguage(runtime), 'fr');

  const germanButton = runtime.languageButtons.find(
    (button) => button.getAttribute('data-language') === 'de',
  );
  click(germanButton);
  click(runtime.lyricsBtn);
  click(runtime.lyricsBtn);

  assert.equal(selectedLyricsLanguage(runtime), 'de');
  assert.deepEqual(renderedLyrics(runtime), expectedGermanLyrics);
});

test('lyrics runtime uses a lighter transition for open language switches', () => {
  const runtime = createLyricsRuntime({
    language: 'fr-BE',
    languages: ['fr-BE', 'nl-BE'],
  });

  click(runtime.lyricsBtn);
  assert.match(runtime.lyricsOverlay.className, /\bis-lyrics-entering\b/);
  assert.doesNotMatch(runtime.lyricsOverlay.className, /\bis-language-switching\b/);
  assert.equal(selectedLyricsLanguage(runtime), 'fr');

  const germanButton = runtime.languageButtons.find(
    (button) => button.getAttribute('data-language') === 'de',
  );
  click(germanButton);
  assert.match(runtime.lyricsOverlay.className, /\bis-language-switching\b/);
  assert.doesNotMatch(runtime.lyricsOverlay.className, /\bis-lyrics-entering\b/);
  assert.equal(selectedLyricsLanguage(runtime), 'de');

  click(runtime.lyricsBtn);
  assert.doesNotMatch(runtime.lyricsOverlay.className, /\bis-lyrics-entering\b/);
  assert.doesNotMatch(runtime.lyricsOverlay.className, /\bis-language-switching\b/);

  click(runtime.lyricsBtn);
  assert.match(runtime.lyricsOverlay.className, /\bis-lyrics-entering\b/);
  assert.doesNotMatch(runtime.lyricsOverlay.className, /\bis-language-switching\b/);
  assert.equal(selectedLyricsLanguage(runtime), 'de');
});

test('lyrics runtime renders text safely and restores focus before inert close', () => {
  const renderLyricsMatch = html.match(/function renderLyrics\(\) \{([\s\S]*?)\n        \}/);
  assert.ok(renderLyricsMatch, 'Expected renderLyrics function body');
  assert.doesNotMatch(renderLyricsMatch[1], /innerHTML/);
  assert.match(renderLyricsMatch[1], /while \(lyricsTrack\.firstChild\) lyricsTrack\.removeChild\(lyricsTrack\.firstChild\);/);
  assert.match(renderLyricsMatch[1], /document\.createElement\('p'\)/);
  assert.match(renderLyricsMatch[1], /document\.createElement\('span'\)/);
  assert.match(renderLyricsMatch[1], /lineNode\.className \+= ' is-spacer'/);
  assert.match(renderLyricsMatch[1], /document\.createTextNode\(part\)/);
  assert.match(renderLyricsMatch[1], /wordNode\.textContent = part/);
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
