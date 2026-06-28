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
const expectedDutchMobileLyrics = [
  'O dierbaar België,',
  "o heilig land der vaad'ren",
  'Onze ziel en ons hart zijn u gewijd.',
  '',
  'Aanvaard ons kracht en het bloed van onze adren,',
  'Wees ons doel in arbeid en in strijd.',
  '',
  'Bloei, o land, in eendracht niet te breken;',
  'Wees immer u zelf en ongeknecht,',
  '',
  'Het woord getrouw,',
  'dat ge onbevreesd moogt spreken:',
  'Voor Vorst, voor Vrijheid en voor Recht.',
  '',
  'Het woord getrouw,',
  'dat ge onbevreesd moogt spreken:',
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

function createLyricsRuntime({
  languages,
  language,
  mobile = false,
  protocol = 'https:',
  search = '',
  pathname = '/index.html',
  hash = '',
  AudioContext,
} = {}) {
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
  let animationFrameId = 0;
  const requestedAnimationFrames = [];
  const cancelledAnimationFrames = [];
  const replacedUrls = [];
  const location = { protocol, pathname, search, hash };
  const history = {
    replaceState(state, title, url) {
      replacedUrls.push(url);
      const nextUrl = new URL(url, 'https://example.test');
      location.pathname = nextUrl.pathname;
      location.search = nextUrl.search;
      location.hash = nextUrl.hash;
    },
  };

  lyricsViewport.appendChild(lyricsTrack);
  audio.paused = false;
  let playCalls = 0;
  audio.play = () => ({
    then(callback) {
      playCalls += 1;
      audio.paused = false;
      callback();
      return { catch() {} };
    },
  });

  const document = {
    activeElement: null,
    addEventListener(name, handler) {
      documentHandlers[name] = handler;
    },
    documentElement: createFakeElement(),
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
  const window = {
    addEventListener(name, handler) {
      windowHandlers[name] = handler;
    },
    cancelAnimationFrame(id) {
      cancelledAnimationFrames.push(id);
    },
    matchMedia(query) {
      return { matches: mobile && query === '(max-width: 520px)' };
    },
    requestAnimationFrame(callback) {
      requestedAnimationFrames.push(callback);
      animationFrameId += 1;
      return animationFrameId;
    },
    history,
    location,
    URLSearchParams,
  };
  if (AudioContext) window.AudioContext = AudioContext;

  vm.runInNewContext(extractPageScript(), {
    console: { log() {} },
    document,
    navigator: { language, languages },
    window,
  });

  return {
    audio,
    cancelledAnimationFrames,
    documentHandlers,
    languageButtons,
    lyricsBtn,
    lyricsOverlay,
    lyricsViewport,
    lyricsTrack,
    muteBtn,
    get playCalls() {
      return playCalls;
    },
    replacedUrls,
    requestedAnimationFrames,
    window,
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

function lastReplacedUrl(runtime) {
  assert.ok(runtime.replacedUrls.length > 0, 'Expected a replaceState call');
  return new URL(runtime.replacedUrls[runtime.replacedUrls.length - 1], 'https://example.test');
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

test('site asks mobile browsers to tint browser chrome black', () => {
  const themeColor = tagWithAttribute('meta', 'name', 'theme-color');

  assertTagHasAttribute(themeColor, 'content', '#000000');
});

test('lyrics language picker is center-aligned with the control buttons', () => {
  assert.match(html, /\.lyrics-language-switcher[\s\S]*bottom:\s*50px/);
  assert.match(html, /\.lyrics-language-switcher[\s\S]*transform:\s*translate\(-50%, 50%\)/);
  assert.doesNotMatch(html, /\.lyrics-language-switcher[\s\S]*top:\s*28px/);
  assert.match(html, /\.lyrics-language-switcher[\s\S]*--language-underline-x:\s*0px/);
  assert.match(html, /\.lyrics-language-switcher[\s\S]*--language-underline-width:\s*0px/);
  assert.match(html, /\.lyrics-language-switcher[\s\S]*gap:\s*20px/);
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
  assert.match(html, /@media \(max-width:\s*520px\)[\s\S]*\.lyrics-language-switcher[\s\S]*bottom:\s*38px/);
  assert.match(html, /@media \(max-width:\s*520px\)[\s\S]*\.lyrics-language-switcher[\s\S]*gap:\s*20px/);
  assert.match(html, /function updateLanguageUnderline\(\)/);
  assert.match(html, /document\.createRange\(\)/);
  assert.match(html, /range\.selectNodeContents\(selectedButton\)/);
  assert.match(html, /range\.getBoundingClientRect\(\)/);
  assert.match(html, /languageSwitcher\.style\.setProperty\('--language-underline-x'/);
  assert.match(html, /languageSwitcher\.style\.setProperty\('--language-underline-width'/);
  assert.match(html, /window\.addEventListener\('resize', function \(\) \{[\s\S]*updateLanguageUnderline\(\);[\s\S]*requestLyricsViewportOverflowUpdate\(\);[\s\S]*\}\)/);
  assert.match(html, /document\.fonts\.ready\.then\(function \(\) \{[\s\S]*updateLanguageUnderline\(\);[\s\S]*requestLyricsViewportOverflowUpdate\(\);[\s\S]*\}\)/);
});

test('mute control hooks are preserved', () => {
  const muteButton = tagWithAttribute('button', 'id', 'muteBtn');
  assertTagHasClass(muteButton, 'mute-btn');
  assertTagHasClass(muteButton, 'control-btn');
  assertTagHasAttribute(muteButton, 'aria-pressed', 'false');
  assert.match(html, /class="icon icon-on"/);
  assert.match(html, /class="icon icon-off"/);
  assert.match(html, /data-sketch-icon="volume-on"/);
  assert.match(html, /data-sketch-icon="volume-off"/);
  assert.match(html, /data-sketch-icon="volume-off" viewBox="0 0 24 24"/);
  assert.match(html, /\.mute-btn\.is-muted \.icon-on/);
  assert.match(html, /\.mute-btn\.is-muted \.icon-off/);
});

test('control buttons use compact Sketch icon sizing', () => {
  assert.match(html, /\.control-btn[\s\S]*width:\s*36px/);
  assert.match(html, /\.control-btn[\s\S]*height:\s*36px/);
  assert.match(html, /\.control-btn \.ring[\s\S]*width:\s*36px/);
  assert.match(html, /\.control-btn \.ring[\s\S]*height:\s*36px/);
  assert.match(html, /\.control-btn \.ring\s*\{[^}]*box-sizing:\s*border-box/);
  assert.match(html, /\.control-btn \.ring[\s\S]*margin:\s*-18px 0 0 -18px/);
  assert.match(html, /\.control-btn \.ring[\s\S]*transition:\s*transform 0\.2s ease;/);
  assert.match(
    html,
    /\.control-btn:hover \.ring,\s*\.control-btn:focus-visible \.ring\s*\{\s*transform:\s*scale\(1\.1\);\s*\}/,
  );
  assert.match(html, /\.control-btn \.icon[\s\S]*width:\s*16px/);
  assert.match(html, /\.control-btn \.icon[\s\S]*height:\s*16px/);
  assert.match(html, /\.control-btn \.icon[\s\S]*margin:\s*-8px 0 0 -8px/);
  assert.match(html, /\.control-btn \.icon[\s\S]*color:\s*#ffffff/);
  assert.match(html, /\.lyrics-btn[\s\S]*right:\s*92px/);
  assert.match(html, /@media \(max-width:\s*520px\)[\s\S]*\.lyrics-btn[\s\S]*right:\s*80px/);
  assert.doesNotMatch(html, /background:\s*rgba\(255, 255, 255, 0\.12\)/);
  assert.doesNotMatch(html, /\.lyrics-btn\.is-active \.ring/);
  assert.doesNotMatch(html, /\.control-btn[\s\S]*width:\s*64px/);
  assert.doesNotMatch(html, /\.control-btn \.ring[\s\S]*width:\s*48px/);
  assert.doesNotMatch(html, /\.control-btn \.icon[\s\S]*width:\s*20px/);
});

test('control entrance animation stays snappy', () => {
  const animationMatch = html.match(/animation:\s*control-rise\s+([\d.]+)s\b/);
  assert.ok(animationMatch, 'Expected control-rise animation duration');
  assert.ok(Number(animationMatch[1]) <= 0.3, 'Expected control-rise duration to be 0.30s or less');
});

test('reduced motion disables the control entrance animation after it is declared', () => {
  const controlRiseIndex = html.indexOf('animation: control-rise');
  assert.notEqual(controlRiseIndex, -1, 'Expected control entrance animation');

  const reducedMotionAfterControlRise = html.slice(controlRiseIndex);
  assert.match(
    reducedMotionAfterControlRise,
    /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.control-btn\s*\{\s*animation:\s*none;\s*\}/,
  );
});

test('lyrics control uses a layered Sketch icon with animated fill', () => {
  assert.match(html, /data-sketch-icon="lyrics-selected"/);
  assert.match(html, /class="icon icon-lyrics"/);
  assert.match(html, /data-sketch-icon="lyrics-selected" viewBox="0 0 24 24"/);
  assert.match(html, /class="lyrics-icon-fill"/);
  assert.match(html, /class="lyrics-icon-stroke"/);
  assert.match(html, /\.lyrics-btn \.lyrics-icon-fill[\s\S]*transform-origin:\s*center top/);
  assert.match(html, /\.lyrics-btn \.lyrics-icon-fill[\s\S]*transform:\s*scaleY\(0\)/);
  assert.match(html, /\.lyrics-btn\.is-active \.lyrics-icon-fill[\s\S]*opacity:\s*1/);
  assert.match(html, /\.lyrics-btn\.is-active \.lyrics-icon-fill[\s\S]*transform:\s*scaleY\(1\)/);
  assert.doesNotMatch(html, /class="icon icon-lyrics-selected"/);
  assert.doesNotMatch(html, /\.lyrics-btn\.is-active \.icon-lyrics[\s\S]*opacity:\s*0/);
});

test('lyrics viewport only enables scrollbars after measured overflow', () => {
  assert.match(html, /\.lyrics-viewport\s*\{[^}]*overflow-y:\s*hidden/);
  assert.match(html, /\.lyrics-viewport\.has-overflow\s*\{[^}]*overflow-y:\s*auto/);
});

test('mobile lyrics overlay keeps top breathing room compact', () => {
  const mobileOverlayMatch = html.match(
    /@media \(max-width:\s*520px\)[\s\S]*?\.lyrics-overlay\s*\{\s*padding:\s*(\d+)px 18px (\d+)px;/,
  );

  assert.ok(mobileOverlayMatch, 'Expected mobile lyrics overlay padding');
  assert.ok(Number(mobileOverlayMatch[1]) <= 48, 'Expected compact mobile top padding');
  assert.equal(Number(mobileOverlayMatch[2]), 0);
  assert.match(
    html,
    /@media \(max-width:\s*520px\)[\s\S]*?\.lyrics-viewport\s*\{[^}]*height:\s*calc\(100vh - 40px\)/,
  );
  assert.doesNotMatch(html, /@media \(max-width:\s*520px\)[\s\S]*padding:\s*76px 18px 64px/);
});

test('mobile lyrics type is slightly smaller than desktop', () => {
  assert.match(html, /\.lyrics-line\s*\{[^}]*font:\s*400 20px\/1\.18 "mendl-serif-dusk", sans-serif/);
  assert.match(
    html,
    /@media \(max-width:\s*520px\)[\s\S]*?\.lyrics-line\s*\{\s*font-size:\s*18px;\s*\}/,
  );
});

test('mobile overflowing lyrics fade progressively behind the controls', () => {
  assert.match(html, /\.lyrics-viewport\s*\{[^}]*--lyrics-viewport-fade:\s*24px/);
  assert.match(html, /\.lyrics-viewport\s*\{[^}]*--lyrics-viewport-fade-mid:\s*calc\(100% - 14px\)/);
  assert.match(html, /\.lyrics-viewport\s*\{[^}]*--lyrics-viewport-fade-soft:\s*calc\(100% - 6px\)/);
  assert.match(html, /\.lyrics-track\s*\{[^}]*padding-bottom:\s*var\(--lyrics-track-bottom-pad, 0\)/);
  assert.match(
    html,
    /\.lyrics-viewport\.has-overflow[\s\S]*-webkit-mask-image:\s*linear-gradient\([\s\S]*rgba\(0, 0, 0, 0\.84\) var\(--lyrics-viewport-fade-mid\)[\s\S]*rgba\(0, 0, 0, 0\.38\) var\(--lyrics-viewport-fade-soft\)[\s\S]*rgba\(0, 0, 0, 0\.12\) 100%/,
  );
  assert.match(
    html,
    /\.lyrics-viewport\.has-overflow[\s\S]*mask-image:\s*linear-gradient\([\s\S]*rgba\(0, 0, 0, 0\.84\) var\(--lyrics-viewport-fade-mid\)[\s\S]*rgba\(0, 0, 0, 0\.38\) var\(--lyrics-viewport-fade-soft\)[\s\S]*rgba\(0, 0, 0, 0\.12\) 100%/,
  );
  assert.match(
    html,
    /@media \(max-width:\s*520px\)[\s\S]*?\.lyrics-viewport\s*\{[^}]*--lyrics-viewport-fade:\s*96px[\s\S]*--lyrics-viewport-fade-mid:\s*calc\(100% - 56px\)[\s\S]*--lyrics-viewport-fade-soft:\s*calc\(100% - 20px\)[\s\S]*height:\s*calc\(100vh - 40px\)/,
  );
  assert.match(
    html,
    /@media \(max-width:\s*520px\)[\s\S]*?\.lyrics-track\s*\{[^}]*--lyrics-track-bottom-pad:\s*104px/,
  );
  assert.doesNotMatch(html, /@media \(max-width:\s*520px\)[\s\S]*--lyrics-viewport-fade:\s*6px/);
});

test('lyrics entrance suppresses temporary Firefox transform overflow', () => {
  assert.match(
    html,
    /\.lyrics-overlay\.is-open\.is-lyrics-entering \.lyrics-viewport\.has-overflow\s*\{[^}]*overflow-y:\s*hidden/,
  );
  assert.match(
    html,
    /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.lyrics-overlay\.is-open\.is-lyrics-entering \.lyrics-viewport\.has-overflow\s*\{[^}]*overflow-y:\s*auto/,
  );
  assert.match(html, /function finishLyricsTransition\(/);
  assert.match(html, /lyricsTrack\.addEventListener\('animationend', finishLyricsTransition\)/);
});

test('lyrics overlay uses the shader with the provided image as fallback', () => {
  assert.ok(fs.existsSync(lyricsBackgroundPath), 'Expected lyrics-bg.jpg asset');
  assert.ok(fs.statSync(lyricsBackgroundPath).size > 0, 'Expected lyrics-bg.jpg to be non-empty');
  assert.match(html, /class="lyrics-background"/);
  assert.match(html, /class="lyrics-background-image"/);
  assert.match(html, /id="lyricsShader" class="lyrics-background-shader"/);
  assert.match(html, /class="lyrics-background-wash"/);
  assert.match(html, /\.lyrics-overlay[\s\S]*background:\s*#120f0d/);
  assert.doesNotMatch(html, /\.lyrics-background-image[\s\S]*background-image:\s*url\('lyrics-bg\.jpg'\)/);
  assert.match(html, /background-image is set by JS only when the shader falls back/);
  assert.match(html, /if \(imageEl\) imageEl\.style\.backgroundImage = "url\('lyrics-bg\.jpg'\)"/);
  assert.match(html, /\.lyrics-background-image[\s\S]*background-size:\s*cover/);
  assert.match(html, /\.lyrics-background-image[\s\S]*filter:\s*blur\(28px\) saturate\(1\.12\)/);
  assert.match(html, /\.lyrics-background-image[\s\S]*opacity:\s*0\.96/);
  assert.match(html, /\.lyrics-background-image[\s\S]*transform:\s*scale\(1\.08\)/);
  assert.match(html, /\.lyrics-background-wash[\s\S]*--wash-top:\s*0/);
  assert.match(html, /\.lyrics-background-wash[\s\S]*--wash-bottom:\s*0/);
  assert.match(html, /\.lyrics-background-wash[\s\S]*--wash-edge:\s*0/);
  assert.match(html, /\.lyrics-background-wash[\s\S]*linear-gradient\(180deg, rgba\(0, 0, 0, var\(--wash-top\)\), rgba\(0, 0, 0, var\(--wash-bottom\)\)\)/);
  assert.match(html, /\.lyrics-background-wash[\s\S]*radial-gradient\(circle at 50% 32%, rgba\(255, 255, 255, 0\.05\), rgba\(0, 0, 0, 0\.05\) 44%, rgba\(0, 0, 0, var\(--wash-edge\)\) 100%\)/);
  assert.doesNotMatch(html, /backdrop-filter:\s*blur\(/);
  assert.doesNotMatch(html, /-webkit-backdrop-filter:\s*blur\(/);
  assert.match(html, /prefers-reduced-motion:\s*reduce/);
  assert.match(html, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.lyrics-background-image/);
  assert.match(html, /\.lyrics-overlay[\s\S]*padding:\s*72px 24px 72px/);
  assert.match(html, /\.lyrics-viewport[\s\S]*height:\s*calc\(100vh - 144px\)/);
  assert.match(html, /\.lyrics-viewport\s*\{[^}]*overflow-y:\s*hidden/);
  assert.match(html, /\.lyrics-viewport\.has-overflow\s*\{[^}]*overflow-y:\s*auto/);
  assert.match(html, /--lyrics-viewport-fade:\s*24px/);
  assert.match(html, /--lyrics-viewport-fade-mid:\s*calc\(100% - 14px\)/);
  assert.match(html, /--lyrics-viewport-fade-soft:\s*calc\(100% - 6px\)/);
  assert.match(html, /\.lyrics-viewport\.has-overflow[\s\S]*-webkit-mask-image:\s*linear-gradient\([\s\S]*rgba\(0, 0, 0, 0\.12\) 100%/);
  assert.match(html, /\.lyrics-viewport\.has-overflow[\s\S]*mask-image:\s*linear-gradient\([\s\S]*rgba\(0, 0, 0, 0\.12\) 100%/);
  assert.match(html, /@media \(max-width:\s*820px\)[\s\S]*\.lyrics-viewport[\s\S]*--lyrics-viewport-fade:\s*6px/);
  assert.match(html, /@media \(max-width:\s*820px\)[\s\S]*\.lyrics-viewport[\s\S]*height:\s*calc\(100vh - 144px\)/);
  assert.match(html, /@media \(max-width:\s*520px\)[\s\S]*\.lyrics-overlay[\s\S]*padding:\s*40px 18px 0px/);
  assert.match(html, /@media \(max-width:\s*520px\)[\s\S]*\.lyrics-viewport[\s\S]*height:\s*calc\(100vh - 40px\)/);
  assert.doesNotMatch(html, /padding:\s*76px 18px 104px/);
  assert.doesNotMatch(html, /height:\s*calc\(100vh - 96px\)/);
  assert.match(html, /function updateLyricsViewportOverflow\(\)/);
  assert.match(html, /function requestLyricsViewportOverflowUpdate\(\)/);
  assert.match(html, /window\.requestAnimationFrame\(updateLyricsViewportOverflow\)/);
  assert.match(html, /window\.setTimeout\(updateLyricsViewportOverflow, 250\)/);
  assert.match(html, /window\.setTimeout\(updateLyricsViewportOverflow, 700\)/);
  assert.match(html, /window\.setTimeout\(updateLyricsViewportOverflow, 1400\)/);
  assert.match(html, /new window\.ResizeObserver\(requestLyricsViewportOverflowUpdate\)/);
  assert.match(html, /lyricsResizeObserver\.observe\(lyricsViewport\)/);
  assert.match(html, /lyricsResizeObserver\.observe\(lyricsTrack\)/);
  assert.match(html, /lyricsTrack\.addEventListener\('animationend', finishLyricsTransition\)/);
  assert.match(html, /if \(hasOverflow\) lyricsViewport\.classList\.add\('has-overflow'\)/);
  assert.match(html, /else lyricsViewport\.classList\.remove\('has-overflow'\)/);
  assert.doesNotMatch(html, /classList\.toggle\('has-overflow', hasOverflow\)/);
  assert.match(html, /window\.addEventListener\('resize', function \(\) \{[\s\S]*updateLanguageUnderline\(\);[\s\S]*if \(lyricsOpen && getLyricsLayoutKey\(selectedLanguage\) !== renderedLyricsLayoutKey\) renderLyrics\(\);[\s\S]*else requestLyricsViewportOverflowUpdate\(\);[\s\S]*\}\)/);
  assert.doesNotMatch(html, /\.lyrics-line\.is-active/);
});

test('lyrics words stagger animate in when the overlay opens', () => {
  assert.match(html, /@keyframes lyricsTrackRise/);
  assert.match(html, /@keyframes lyricWordIn/);
  assert.match(html, /@keyframes lyricsLanguageSwitch/);
  assert.match(html, /<link rel="stylesheet" href="https:\/\/use\.typekit\.net\/qsr7tur\.css">/);
  assert.match(html, /\.lyrics-line[\s\S]*color:\s*#ffffff/);
  assert.match(html, /\.lyrics-line[\s\S]*font:\s*400 20px\/1\.18 "mendl-serif-dusk", sans-serif/);
  assert.match(html, /\.lyrics-line[\s\S]*font-style:\s*normal/);
  assert.doesNotMatch(html, /\.lyrics-line\s*\{[^}]*mix-blend-mode/);
  assert.match(html, /\.lyrics-line[\s\S]*-webkit-font-smoothing:\s*antialiased/);
  assert.match(html, /\.lyrics-line[\s\S]*-moz-osx-font-smoothing:\s*grayscale/);
  assert.match(html, /\.lyrics-line\.is-spacer[\s\S]*height:\s*24px/);
  assert.match(html, /\.lyrics-track[\s\S]*min-height:\s*100%/);
  assert.match(html, /\.lyrics-track[\s\S]*justify-content:\s*center/);
  assert.doesNotMatch(html, /font:\s*800 clamp/);
  assert.doesNotMatch(html, /font-size:\s*clamp\(19px, 6\.6vw, 28px\)/);
  assert.match(html, /\.lyrics-overlay\.is-open\.is-lyrics-entering \.lyrics-track[\s\S]*animation:\s*lyricsTrackRise 0\.48s cubic-bezier\(0\.22, 0\.61, 0\.36, 1\) both/);
  assert.match(html, /\.lyrics-word[\s\S]*display:\s*inline-block/);
  assert.match(html, /\.lyrics-overlay\.is-open\.is-lyrics-entering \.lyrics-word[\s\S]*animation:\s*lyricWordIn 0\.38s cubic-bezier\(0\.22, 0\.61, 0\.36, 1\) both/);
  assert.match(html, /\.lyrics-overlay\.is-open\.is-lyrics-entering \.lyrics-word[\s\S]*animation-delay:\s*calc\(var\(--word-index\) \* 6ms\)/);
  assert.doesNotMatch(html, /\.lyrics-overlay\.is-open\s+\.lyrics-word/);
  assert.match(html, /\.lyrics-overlay\.is-open\.is-language-switching \.lyrics-track[\s\S]*animation:\s*lyricsLanguageSwitch 0\.56s cubic-bezier\(0\.22, 0\.61, 0\.36, 1\) both/);
  assert.match(html, /@keyframes lyricsTrackRise[\s\S]*from\s*\{[\s\S]*transform:\s*translate3d\(0, 28px, 0\)/);
  assert.match(html, /@keyframes lyricsLanguageSwitch[\s\S]*from\s*\{[\s\S]*opacity:\s*0;[\s\S]*transform:\s*translate3d\(0, 24px, 0\)/);
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
    /var isControl = evt\.target && evt\.target\.closest && evt\.target\.closest\('\.control-btn'\);\s*if \(isControl\) return;\s*prepareAudioAnalysis\(\);\s*play\(\);\s*events\.forEach/s,
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
  assert.match(muteClickMatch[1], /muted = false;\s*audio\.muted = false;\s*cancelWaveCollapse\(\);\s*prepareAudioAnalysis\(\);\s*play\(\);\s*render\(\);\s*return;/);
  assert.match(muteClickMatch[1], /if \(!muted\) prepareAudioAnalysis\(\);\s*play\(\);/);
});

test('audio analysis is prepared inside playback gestures before media play', () => {
  const prepareMatch = html.match(/function prepareAudioAnalysis\(\) \{([\s\S]*?)\n        \}/);
  assert.ok(prepareMatch, 'Expected prepareAudioAnalysis function');
  assert.match(prepareMatch[1], /ensureAudioAnalysis\(\);\s*resumeAudioAnalysis\(\);/);

  const resumeMatch = html.match(/function resumeAudioAnalysis\(\) \{([\s\S]*?)\n        \}/);
  assert.ok(resumeMatch, 'Expected resumeAudioAnalysis function');
  assert.doesNotMatch(resumeMatch[1], /ensureAudioAnalysis\(\)/);
  assert.match(resumeMatch[1], /if \(!waveParams\.song \|\| !waveParams\.song\.reactive \|\| !audioContext\) return;/);

  assert.match(html, /if \(lyricsOpen\) \{\s*prepareAudioAnalysis\(\);\s*play\(\);\s*\}/);
});

test('local file playback keeps the anthem out of Web Audio routing', () => {
  let mediaSourceCalls = 0;
  function FakeAudioContext() {
    this.destination = {};
    this.state = 'running';
  }
  FakeAudioContext.prototype.createMediaElementSource = function () {
    mediaSourceCalls += 1;
    return { connect() {} };
  };
  FakeAudioContext.prototype.createAnalyser = function () {
    return {
      connect() {},
      fftSize: 0,
      frequencyBinCount: 8,
      getByteFrequencyData() {},
      smoothingTimeConstant: 0,
    };
  };

  const runtime = createLyricsRuntime({
    languages: ['nl-BE'],
    language: 'nl-BE',
    protocol: 'file:',
    AudioContext: FakeAudioContext,
  });

  runtime.audio.paused = true;
  click(runtime.muteBtn);

  assert.equal(runtime.audio.muted, false);
  assert.ok(runtime.playCalls >= 2);
  assert.equal(mediaSourceCalls, 0);
});

test('volume ring renders the A/B/C sampled finalist waveforms while anthem playback is active', () => {
  assert.match(html, /--volume-wave-duration:\s*1\.4s/);
  assert.match(html, /--control-ring-base-opacity:\s*0\.4/);
  assert.match(html, /--volume-wave-base-opacity:\s*var\(--control-ring-base-opacity\)/);
  assert.match(html, /<button id="muteBtn"[\s\S]*>\s*<span class="ring"><\/span>\s*<svg class="wave-ring" viewBox="0 0 44 44"/);
  assert.match(html, /id="muteWaveSamples" class="wave-samples"/);
  assert.match(html, /\.control-btn \.ring[\s\S]*border:\s*1px solid #ffffff;\s*border-radius:\s*50%;\s*opacity:\s*var\(--control-ring-base-opacity\);\s*mix-blend-mode:\s*plus-lighter/);
  assert.match(html, /\.mute-btn \.wave-ring[\s\S]*mix-blend-mode:\s*plus-lighter/);
  assert.match(html, /\.control-btn \.ring[\s\S]*transition:\s*transform 0\.2s ease,\s*opacity 0\.2s ease/);
  assert.match(html, /\.mute-btn\.is-playing \.ring\s*\{\s*opacity:\s*var\(--volume-wave-base-opacity\);\s*\}/);
  assert.match(html, /\.mute-btn\.is-wave-collapsing \.ring\s*\{\s*opacity:\s*var\(--volume-wave-base-opacity\);\s*\}/);
  assert.match(html, /\.mute-btn \.wave-sample[\s\S]*stroke-linecap:\s*round/);
  assert.match(html, /\.mute-btn \.wave-sample[\s\S]*transition:\s*opacity 0\.2s ease/);
  assert.doesNotMatch(html, /\.mute-btn \.wave-sample\s*\{[^}]*opacity:\s*0/);
  assert.doesNotMatch(html, /class="wave-base"/);
  assert.doesNotMatch(html, /wave-echo/);
  assert.doesNotMatch(html, /volumeRingEcho/);
  assert.doesNotMatch(html, /volumeWavePulse/);
  assert.match(html, /var WAVE_PRESETS = \{/);
  assert.match(html, /a:\s*\{[\s\S]*label:\s*'A - Sparse asymmetry'[\s\S]*count:\s*36/);
  assert.match(html, /b:\s*\{[\s\S]*label:\s*'B - Taller asymmetry'[\s\S]*count:\s*34/);
  assert.match(html, /b:\s*\{[\s\S]*label:\s*'B - Taller asymmetry'[\s\S]*maxHeight:\s*7\.2/);
  assert.match(html, /c:\s*\{[\s\S]*label:\s*'C - Very sparse duo'[\s\S]*count:\s*28/);
  assert.match(html, /var waveParams = \{[\s\S]*variant:\s*'b'[\s\S]*sensitivity:\s*1\.2/);
  assert.match(html, /function renderWaveSamples\(\)/);
  assert.match(html, /function ensureWaveSampleLines\(count\)/);
  assert.match(html, /function lobe\(angle, center, width\)/);
  assert.match(html, /function texture\(index, time, seed\)/);
  assert.match(html, /function tunedWavePreset\(basePreset, variant\)/);
  assert.match(html, /function ensureAudioAnalysis\(\)/);
  assert.match(html, /var AudioContextCtor = window\.AudioContext \|\| window\.webkitAudioContext/);
  assert.match(html, /audioContext\.createMediaElementSource\(audio\)/);
  assert.match(html, /audioContext\.createAnalyser\(\)/);
  assert.match(html, /audioAnalyser\.fftSize = 256/);
  assert.match(html, /audioAnalyser\.getByteFrequencyData\(audioFrequencyData\)/);
  assert.match(html, /function getAudioWaveScale\(\)/);
  assert.match(html, /var audioScale = getAudioWaveScale\(\)/);
  assert.match(html, /var collapseScale = getWaveCollapseScale\(\)/);
  assert.match(html, /var height = envelope \* \(activePreset\.minHeight \+ granular \* activePreset\.maxHeight \* breath\) \* audioScale \* collapseScale/);
  assert.match(html, /var from = point\(center, angle, activePreset\.inner \+ activePreset\.lineWidth \* 0\.5\)/);
  assert.match(html, /var to = point\(center, angle, activePreset\.inner \+ Math\.max\(height, activePreset\.lineWidth \* 0\.5\)\)/);
  assert.doesNotMatch(html, /activePreset\.inner - height \* activePreset\.inward/);
  assert.match(html, /var activePreset = tunedWavePreset\(basePreset, activeVariant\)/);
  assert.match(html, /waveAnimationFrame = window\.requestAnimationFrame\(updateWaveAnimation\)/);
  assert.match(html, /resumeAudioAnalysis\(\);\s*waveAnimationFrame = window\.requestAnimationFrame\(updateWaveAnimation\)/);
  const syncWaveAnimationMatch = html.match(/function syncWaveAnimation\(\) \{([\s\S]*?)\n        \}/);
  assert.ok(syncWaveAnimationMatch, 'Expected syncWaveAnimation function');
  assert.doesNotMatch(syncWaveAnimationMatch[1], /ensureAudioAnalysis\(\)/);
  assert.match(html, /function startWaveCollapse\(\)/);
  assert.match(html, /function getWaveCollapseScale\(\)/);
  assert.match(html, /return isWavePlaying\(\) \|\| isWaveCollapsing\(\)/);
  assert.match(html, /var shouldAnimateSound = !shouldShowSoundOff && !audio\.paused/);
  assert.doesNotMatch(html, /is-dialkit-previewing/);
  assert.match(html, /btn\.classList\.toggle\('is-wave-collapsing', isWaveCollapsing\(\)\)/);
  assert.match(html, /btn\.classList\.toggle\('is-playing', shouldAnimateSound\)/);
  assert.match(html, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.mute-btn\.is-playing \.wave-samples[\s\S]*filter:\s*none/);
});

test('soundwave tuning is baked into the page without DialKit controls', () => {
  assert.doesNotMatch(html, /<script type="importmap">/);
  assert.doesNotMatch(html, /dialkit/i);
  assert.doesNotMatch(html, /react-dom\/client/);
  assert.doesNotMatch(html, /useDialKit/);
  assert.doesNotMatch(html, /applySoundwaveParams/);
  assert.doesNotMatch(html, /wallonie:soundwave-dialkit/);
  assert.match(html, /variant:\s*'b'/);
  assert.match(html, /sensitivity:\s*1\.2/);
  assert.match(html, /strokeOpacity:\s*0\.72/);
  assert.match(html, /glowOpacity:\s*0\.18/);
  assert.match(html, /glowSize:\s*1/);
});

test('muting collapses the active waveform and restores the idle ring state', () => {
  const runtime = createLyricsRuntime({
    languages: ['nl-BE'],
    language: 'nl-BE',
  });

  assert.match(runtime.muteBtn.className, /\bis-playing\b/);

  click(runtime.muteBtn);

  assert.equal(runtime.audio.muted, true);
  assert.doesNotMatch(runtime.muteBtn.className, /\bis-playing\b/);
  assert.match(runtime.muteBtn.className, /\bis-wave-collapsing\b/);
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
  assert.match(html, /function setLyricsOpen\(open, syncUrl\)/);
  assert.match(html, /function setLanguage\(language, animateSwitch, syncUrl\)/);
  assert.match(html, /function renderLyrics\(\)/);
  assert.match(html, /lyricsBtn\.addEventListener\('click'/);
  assert.match(html, /document\.addEventListener\('keydown'/);
  assert.match(html, /lyricsOverlay\.removeAttribute\('inert'\)/);
  assert.match(html, /lyricsOverlay\.setAttribute\('inert', ''\)/);
});

test('first inline runtime script includes the flag cleanup and lyrics runtime', () => {
  const pageScript = extractPageScript();
  assert.match(pageScript, /flag\.addEventListener\('animationend'/);
  assert.match(pageScript, /lyricsBtn\.addEventListener\('click'/);
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

test('lyrics runtime uses a mobile-specific Dutch line layout only on mobile', () => {
  const desktopRuntime = createLyricsRuntime({
    language: 'nl-BE',
    languages: ['nl-BE'],
  });
  click(desktopRuntime.lyricsBtn);
  assert.deepEqual(renderedLyrics(desktopRuntime), expectedDutchLyrics);

  const mobileDutchRuntime = createLyricsRuntime({
    language: 'nl-BE',
    languages: ['nl-BE'],
    mobile: true,
  });
  click(mobileDutchRuntime.lyricsBtn);
  assert.deepEqual(renderedLyrics(mobileDutchRuntime), expectedDutchMobileLyrics);

  const mobileFrenchRuntime = createLyricsRuntime({
    language: 'fr-BE',
    languages: ['fr-BE'],
    mobile: true,
  });
  click(mobileFrenchRuntime.lyricsBtn);
  assert.deepEqual(renderedLyrics(mobileFrenchRuntime), expectedFrenchLyrics);
});

test('lyrics runtime uses a valid lang URL parameter without opening the overlay', () => {
  const runtime = createLyricsRuntime({
    language: 'nl-BE',
    languages: ['nl-BE'],
    search: '?lang=fr',
  });

  assert.equal(selectedLyricsLanguage(runtime), 'fr');
  assert.doesNotMatch(runtime.lyricsOverlay.className, /\bis-open\b/);

  click(runtime.lyricsBtn);

  assert.equal(selectedLyricsLanguage(runtime), 'fr');
  assert.deepEqual(renderedLyrics(runtime), expectedFrenchLyrics);
});

test('lyrics runtime opens from a shareable lyrics URL', () => {
  const runtime = createLyricsRuntime({
    language: 'fr-BE',
    languages: ['fr-BE'],
    search: '?lyrics=1&lang=de',
  });

  assert.match(runtime.lyricsOverlay.className, /\bis-open\b/);
  assert.equal(runtime.lyricsOverlay.getAttribute('aria-hidden'), 'false');
  assert.equal(selectedLyricsLanguage(runtime), 'de');
  assert.deepEqual(renderedLyrics(runtime), expectedGermanLyrics);
});

test('lyrics runtime keeps shareable URL parameters in sync', () => {
  const runtime = createLyricsRuntime({
    language: 'nl-BE',
    languages: ['nl-BE'],
    search: '?source=qr',
    hash: '#anthem',
  });

  click(runtime.lyricsBtn);
  let nextUrl = lastReplacedUrl(runtime);
  assert.equal(nextUrl.searchParams.get('source'), 'qr');
  assert.equal(nextUrl.searchParams.get('lyrics'), '1');
  assert.equal(nextUrl.searchParams.has('lang'), false);
  assert.equal(nextUrl.hash, '#anthem');

  const frenchButton = runtime.languageButtons.find(
    (button) => button.getAttribute('data-language') === 'fr',
  );
  click(frenchButton);
  nextUrl = lastReplacedUrl(runtime);
  assert.equal(nextUrl.searchParams.get('source'), 'qr');
  assert.equal(nextUrl.searchParams.get('lyrics'), '1');
  assert.equal(nextUrl.searchParams.get('lang'), 'fr');
  assert.equal(nextUrl.hash, '#anthem');

  click(runtime.lyricsBtn);
  nextUrl = lastReplacedUrl(runtime);
  assert.equal(nextUrl.searchParams.get('source'), 'qr');
  assert.equal(nextUrl.searchParams.has('lyrics'), false);
  assert.equal(nextUrl.searchParams.get('lang'), 'fr');
  assert.equal(nextUrl.hash, '#anthem');
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

test('lyrics runtime keeps entrance state until the final word animation completes', () => {
  const runtime = createLyricsRuntime({
    language: 'nl-BE',
    languages: ['nl-BE'],
  });
  Object.defineProperty(runtime.lyricsViewport, 'scrollHeight', { configurable: true, value: 200 });
  Object.defineProperty(runtime.lyricsViewport, 'clientHeight', { configurable: true, value: 100 });

  click(runtime.lyricsBtn);
  assert.match(runtime.lyricsOverlay.className, /\bis-lyrics-entering\b/);
  assert.match(runtime.lyricsViewport.className, /\bhas-overflow\b/);

  const lyricWords = runtime.lyricsTrack.children.flatMap((line) =>
    line.children.filter((child) => /\blyrics-word\b/.test(child.className)),
  );
  assert.ok(lyricWords.length > 1, 'Expected staggered lyric words');

  runtime.lyricsTrack.handlers.animationend({ target: runtime.lyricsTrack });
  assert.match(runtime.lyricsOverlay.className, /\bis-lyrics-entering\b/);
  assert.match(runtime.lyricsViewport.className, /\bhas-overflow\b/);

  runtime.lyricsTrack.handlers.animationend({ target: lyricWords[0] });
  assert.match(runtime.lyricsOverlay.className, /\bis-lyrics-entering\b/);

  runtime.lyricsTrack.handlers.animationend({ target: lyricWords[lyricWords.length - 1] });
  assert.doesNotMatch(runtime.lyricsOverlay.className, /\bis-lyrics-entering\b/);
  assert.match(runtime.lyricsViewport.className, /\bhas-overflow\b/);
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
  const setLyricsOpenMatch = html.match(/function setLyricsOpen\(open, syncUrl\) \{([\s\S]*?)\n        function setLanguage/);
  assert.ok(setLyricsOpenMatch, 'Expected setLyricsOpen function body');

  assert.match(setLyricsOpenMatch[1], /play\(\)/);
  assert.doesNotMatch(html, /var lyricsSyncFrame/);
  assert.doesNotMatch(html, /function findActiveLyricIndex/);
  assert.doesNotMatch(html, /function updateActiveLyric/);
  assert.doesNotMatch(html, /function startLyricsSync/);
  assert.doesNotMatch(html, /function stopLyricsSync/);
  assert.doesNotMatch(html, /function syncLyrics/);
  assert.doesNotMatch(html, /audio\.currentTime/);
  assert.doesNotMatch(html, /audio\.addEventListener\('timeupdate'/);
  assert.doesNotMatch(html, /classList\.toggle\('is-past'/);
  assert.doesNotMatch(setLyricsOpenMatch[1], /requestAnimationFrame\(syncLyrics\)/);
});
