# Show Lyrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional Apple Music-style synced lyrics overlay for the Belgian anthem with Dutch, French, and German language switching.

**Architecture:** Keep the runtime in the existing static `index.html`: CSS owns the full-screen blurred overlay and responsive lyric states, HTML adds controls and overlay structure, and JavaScript reads `audio.currentTime` from the existing `audio#anthem`. Add a tiny Node built-in contract test to validate expected static hooks without introducing packages or a build step.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript, local `audio` element, Node.js built-in `node:test` and `assert`.

---

## File Structure

- Modify `index.html`
  - Add a lyrics button next to the existing mute button.
  - Add a hidden full-screen lyrics overlay with language controls and a lyric stack.
  - Add CSS for the shared circular controls, Apple Music-style blur overlay, active/inactive lyrics, responsive sizing, and reduced-motion behavior.
  - Extend the existing JavaScript IIFE so lyrics read from `audio#anthem` and do not create another player.
- Create `tests/lyrics-contract.test.js`
  - Dependency-free static contract checks using Node built-ins.
  - Tests are intentionally lightweight: they verify the static page exposes the hooks, data, and CSS/JS functions the manual browser pass depends on.

## Task 1: Add Lyrics Shell And Overlay Styling

**Files:**
- Create: `tests/lyrics-contract.test.js`
- Modify: `index.html`

- [ ] **Step 1: Write the failing shell contract tests**

Create `tests/lyrics-contract.test.js` with:

```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('lyrics controls and overlay shell are present', () => {
  assert.match(html, /id="lyricsBtn"/);
  assert.match(html, /class="lyrics-btn control-btn"/);
  assert.match(html, /id="lyricsOverlay"/);
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
```

- [ ] **Step 2: Run the shell contract tests and verify they fail**

Run:

```bash
node --test tests/lyrics-contract.test.js
```

Expected: FAIL with at least one assertion mentioning `id="lyricsBtn"` because the lyrics shell has not been added.

- [ ] **Step 3: Add shared control and overlay CSS**

In `index.html`, update the existing `.mute-btn` control styles so the mute button and lyrics button share the circular control base. Replace the `.mute-btn`-specific button, ring, hover, focus, and icon base selectors with this structure:

```css
      body {
        margin: 0;
        overflow: hidden;
      }
      .control-btn {
        position: fixed;
        bottom: 32px;
        width: 64px;
        height: 64px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        border: 0;
        background: transparent;
        cursor: pointer;
        z-index: 20;
        -webkit-tap-highlight-color: transparent;
      }
      .mute-btn {
        right: 32px;
      }
      .lyrics-btn {
        right: 108px;
      }
      .control-btn .ring {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 48px;
        height: 48px;
        margin: -24px 0 0 -24px;
        border: 1px solid rgba(255, 255, 255, 0.5);
        border-radius: 50%;
        transition: transform 0.2s ease, background 0.2s ease;
      }
      .control-btn:hover .ring,
      .control-btn:focus-visible .ring,
      .lyrics-btn.is-active .ring {
        transform: scale(1.1);
        background: rgba(255, 255, 255, 0.12);
      }
      .control-btn:focus {
        outline: none;
      }
      .control-btn .icon {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 20px;
        height: 20px;
        margin: -10px 0 0 -10px;
        fill: #ffffff;
        transform-origin: center;
        transition: opacity 0.24s cubic-bezier(0.33, 1, 0.68, 1),
          transform 0.24s cubic-bezier(0.33, 1, 0.68, 1),
          filter 0.24s cubic-bezier(0.33, 1, 0.68, 1);
      }
      .lyrics-overlay {
        position: fixed;
        inset: 0;
        z-index: 15;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        padding: 72px 24px 116px;
        color: #ffffff;
        background: rgba(0, 0, 0, 0.42);
        backdrop-filter: blur(28px) saturate(1.2);
        -webkit-backdrop-filter: blur(28px) saturate(1.2);
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.32s cubic-bezier(0.33, 1, 0.68, 1);
      }
      .lyrics-overlay.is-open {
        opacity: 1;
        pointer-events: auto;
      }
      @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
        .lyrics-overlay {
          background: rgba(0, 0, 0, 0.76);
        }
      }
      .lyrics-language-switcher {
        position: fixed;
        top: 28px;
        left: 50%;
        z-index: 21;
        display: flex;
        gap: 8px;
        transform: translateX(-50%);
      }
      .lyrics-language {
        min-width: 48px;
        min-height: 36px;
        border: 1px solid rgba(255, 255, 255, 0.34);
        border-radius: 999px;
        color: rgba(255, 255, 255, 0.68);
        background: rgba(255, 255, 255, 0.08);
        font: 700 13px/1 Arial, Helvetica, sans-serif;
        letter-spacing: 0;
        cursor: pointer;
      }
      .lyrics-language.is-selected {
        color: #111111;
        background: rgba(255, 255, 255, 0.94);
      }
      .lyrics-viewport {
        width: min(880px, 100%);
        max-height: min(68vh, 560px);
        overflow: hidden;
      }
      .lyrics-track {
        display: flex;
        flex-direction: column;
        gap: 18px;
        transition: transform 0.46s cubic-bezier(0.33, 1, 0.68, 1);
      }
      .lyrics-line {
        margin: 0;
        color: rgba(255, 255, 255, 0.38);
        font: 800 clamp(26px, 6vw, 64px)/1.08 Arial, Helvetica, sans-serif;
        letter-spacing: 0;
        text-align: center;
        transform: scale(0.94);
        transition: color 0.28s ease, opacity 0.28s ease, transform 0.28s ease;
      }
      .lyrics-line.is-active {
        color: #ffffff;
        opacity: 1;
        transform: scale(1);
      }
      .lyrics-line.is-past {
        color: rgba(255, 255, 255, 0.24);
      }
      @media (max-width: 520px) {
        .control-btn {
          bottom: 20px;
        }
        .mute-btn {
          right: 20px;
        }
        .lyrics-btn {
          right: 88px;
        }
        .lyrics-overlay {
          padding: 76px 18px 104px;
        }
        .lyrics-line {
          font-size: clamp(24px, 9vw, 44px);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .lyrics-overlay,
        .lyrics-track,
        .lyrics-line {
          transition: none;
        }
        .lyrics-line,
        .lyrics-line.is-active {
          transform: none;
        }
      }
```

Keep the existing mute icon on/off CSS rules, but update their selectors to continue working under `.mute-btn`.

- [ ] **Step 4: Add the lyrics button and overlay HTML**

In `index.html`, keep the existing mute button but change its class to include `control-btn`:

```html
    <button id="muteBtn" class="mute-btn control-btn" type="button" aria-label="Mute" aria-pressed="false">
```

After the mute button, add:

```html
    <button id="lyricsBtn" class="lyrics-btn control-btn" type="button" aria-label="Show lyrics" aria-pressed="false">
      <span class="ring"></span>
      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 4.75C5 3.78 5.78 3 6.75 3h10.5c.97 0 1.75.78 1.75 1.75v14.5c0 .67-.38 1.28-.98 1.57-.6.3-1.31.22-1.83-.19L12 17.34l-4.19 3.29c-.52.41-1.23.49-1.83.19A1.75 1.75 0 0 1 5 19.25V4.75Zm2 0v14.06l4.07-3.2a1.5 1.5 0 0 1 1.86 0L17 18.81V4.75H7Zm2.25 3h5.5a.75.75 0 0 1 0 1.5h-5.5a.75.75 0 0 1 0-1.5Zm0 3h5.5a.75.75 0 0 1 0 1.5h-5.5a.75.75 0 0 1 0-1.5Z"></path>
      </svg>
    </button>
    <section id="lyricsOverlay" class="lyrics-overlay" aria-hidden="true" aria-label="Lyrics">
      <div class="lyrics-language-switcher" role="group" aria-label="Lyrics language">
        <button class="lyrics-language is-selected" type="button" data-language="nl" aria-pressed="true">NL</button>
        <button class="lyrics-language" type="button" data-language="fr" aria-pressed="false">FR</button>
        <button class="lyrics-language" type="button" data-language="de" aria-pressed="false">DE</button>
      </div>
      <div class="lyrics-viewport" aria-live="polite">
        <div id="lyricsTrack" class="lyrics-track"></div>
      </div>
    </section>
```

- [ ] **Step 5: Run the shell contract tests and verify they pass**

Run:

```bash
node --test tests/lyrics-contract.test.js
```

Expected: PASS with two passing tests.

- [ ] **Step 6: Commit the shell**

Run:

```bash
git add index.html tests/lyrics-contract.test.js
git commit -m "Add lyrics overlay shell"
```

## Task 2: Add Timed Lyric Data

**Files:**
- Modify: `tests/lyrics-contract.test.js`
- Modify: `index.html`

- [ ] **Step 1: Extend the contract test for the lyric data**

Append this test to `tests/lyrics-contract.test.js`:

```js
test('lyrics data includes timed Dutch, French, and German lines', () => {
  assert.match(html, /var LYRICS = \{/);
  assert.match(html, /nl:\s*\[/);
  assert.match(html, /fr:\s*\[/);
  assert.match(html, /de:\s*\[/);
  assert.match(html, /O dierbaar België/);
  assert.match(html, /O Belgique/);
  assert.match(html, /O liebes Land/);
  assert.match(html, /Liberté/);
  assert.match(html, /König/);
  assert.match(html, /time:\s*0/);
  assert.match(html, /time:\s*49\.2/);
});
```

- [ ] **Step 2: Run the lyric data test and verify it fails**

Run:

```bash
node --test tests/lyrics-contract.test.js
```

Expected: FAIL with an assertion mentioning `var LYRICS = {`.

- [ ] **Step 3: Add the `LYRICS` data inside the existing IIFE**

In the existing script, after `var muted = false;`, add:

```js
        var LYRICS = {
          nl: [
            { time: 0, text: "O dierbaar België" },
            { time: 4.2, text: "O heilig land der vaad'ren" },
            { time: 8.8, text: "Onze ziel en ons hart zijn u gewijd." },
            { time: 13.5, text: "Aanvaard ons kracht en het bloed van onze adren," },
            { time: 18.2, text: "Wees ons doel in arbeid en in strijd." },
            { time: 22.9, text: "Bloei, o land, in eendracht niet te breken;" },
            { time: 27.6, text: "Wees immer u zelf en ongeknecht," },
            { time: 32.3, text: "Het woord getrouw, dat ge onbevreesd moogt spreken:" },
            { time: 37, text: "Voor Vorst, voor Vrijheid en voor Recht." },
            { time: 41.7, text: "Het woord getrouw, dat ge onbevreesd moogt spreken:" },
            { time: 46.4, text: "Voor Vorst, voor Vrijheid en voor Recht." },
            { time: 49.2, text: "Voor Vorst, voor Vrijheid en voor Recht." }
          ],
          fr: [
            { time: 0, text: "O Belgique, ô mère chérie," },
            { time: 4.2, text: "A toi nos coeurs, à toi nos bras," },
            { time: 8.8, text: "A toi notre sang, ô Patrie !" },
            { time: 13.5, text: "Nous le jurons tous, tu vivras !" },
            { time: 18.2, text: "Tu vivras toujours grande et belle" },
            { time: 22.9, text: "Et ton invincible unité" },
            { time: 27.6, text: "Aura pour devise immortelle :" },
            { time: 32.3, text: "Le Roi, la Loi, la Liberté !" },
            { time: 37, text: "Le Roi, la Loi, la Liberté !" },
            { time: 41.7, text: "Le Roi, la Loi, la Liberté !" },
            { time: 46.4, text: "Le Roi, la Loi, la Liberté !" },
            { time: 49.2, text: "Le Roi, la Loi, la Liberté !" }
          ],
          de: [
            { time: 0, text: "O liebes Land, o Belgiens Erde," },
            { time: 4.2, text: "Dir unser Herz, Dir unsere Hand," },
            { time: 8.8, text: "Dir unser Blut, dem Heimatherde," },
            { time: 13.5, text: "wir schwören's Dir, o Vaterland!" },
            { time: 18.2, text: "So blühe froh in voller Schöne," },
            { time: 22.9, text: "zu der die Freiheit Dich erzog," },
            { time: 27.6, text: "und fortan singen Deine Söhne:" },
            { time: 32.3, text: "Gesetz und König und die Freiheit hoch!" },
            { time: 37, text: "Gesetz und König und die Freiheit hoch!" },
            { time: 41.7, text: "Gesetz und König und die Freiheit hoch!" },
            { time: 46.4, text: "Gesetz und König und die Freiheit hoch!" },
            { time: 49.2, text: "Gesetz und König und die Freiheit hoch!" }
          ]
        };
```

Use UTF-8 lyric strings because `index.html` already declares UTF-8 and the public-facing lyrics need language-specific accents.

- [ ] **Step 4: Run the lyric data test and verify it passes**

Run:

```bash
node --test tests/lyrics-contract.test.js
```

Expected: PASS with three passing tests.

- [ ] **Step 5: Commit the lyric data**

Run:

```bash
git add index.html tests/lyrics-contract.test.js
git commit -m "Add timed anthem lyric data"
```

## Task 3: Add Lyrics Open/Close And Language State

**Files:**
- Modify: `tests/lyrics-contract.test.js`
- Modify: `index.html`

- [ ] **Step 1: Extend the contract test for runtime state hooks**

Append this test to `tests/lyrics-contract.test.js`:

```js
test('lyrics runtime exposes open, close, language, and render hooks', () => {
  assert.match(html, /var lyricsOpen = false/);
  assert.match(html, /var selectedLanguage = 'nl'/);
  assert.match(html, /function setLyricsOpen\(open\)/);
  assert.match(html, /function setLanguage\(language\)/);
  assert.match(html, /function renderLyrics\(\)/);
  assert.match(html, /lyricsBtn\.addEventListener\('click'/);
  assert.match(html, /document\.addEventListener\('keydown'/);
});
```

- [ ] **Step 2: Run the runtime state test and verify it fails**

Run:

```bash
node --test tests/lyrics-contract.test.js
```

Expected: FAIL with an assertion mentioning `var lyricsOpen = false`.

- [ ] **Step 3: Add lyrics DOM references and state**

In the existing IIFE, after the `btn` reference, add:

```js
        var lyricsBtn = document.getElementById('lyricsBtn');
        var lyricsOverlay = document.getElementById('lyricsOverlay');
        var lyricsTrack = document.getElementById('lyricsTrack');
        var languageButtons = Array.prototype.slice.call(document.querySelectorAll('.lyrics-language'));
```

After `var muted = false;`, add:

```js
        var lyricsOpen = false;
        var selectedLanguage = 'nl';
        var activeLineIndex = -1;
```

- [ ] **Step 4: Add render and state functions**

In the existing IIFE, after the `play()` function, add:

```js
        function renderLyrics() {
          var lines = LYRICS[selectedLanguage];
          lyricsTrack.innerHTML = lines.map(function (line, index) {
            return '<p class="lyrics-line" data-index="' + index + '">' + line.text + '</p>';
          }).join('');
          activeLineIndex = 0;
          Array.prototype.forEach.call(lyricsTrack.children, function (lineNode, index) {
            lineNode.classList.toggle('is-active', index === activeLineIndex);
            lineNode.classList.toggle('is-past', false);
          });
        }

        function renderLyricsControls() {
          lyricsBtn.classList.toggle('is-active', lyricsOpen);
          lyricsBtn.setAttribute('aria-pressed', String(lyricsOpen));
          lyricsBtn.setAttribute('aria-label', lyricsOpen ? 'Hide lyrics' : 'Show lyrics');
          lyricsOverlay.classList.toggle('is-open', lyricsOpen);
          lyricsOverlay.setAttribute('aria-hidden', String(!lyricsOpen));
          languageButtons.forEach(function (languageButton) {
            var isSelected = languageButton.getAttribute('data-language') === selectedLanguage;
            languageButton.classList.toggle('is-selected', isSelected);
            languageButton.setAttribute('aria-pressed', String(isSelected));
          });
        }

        function setLyricsOpen(open) {
          lyricsOpen = open;
          if (lyricsOpen && !lyricsTrack.children.length) renderLyrics();
          renderLyricsControls();
          if (lyricsOpen) {
            play();
          }
        }

        function setLanguage(language) {
          if (!LYRICS[language] || selectedLanguage === language) return;
          selectedLanguage = language;
          renderLyrics();
          renderLyricsControls();
        }
```

- [ ] **Step 5: Add lyrics button, language, and keyboard listeners**

Before the mute button click listener, add:

```js
        lyricsBtn.addEventListener('click', function () {
          setLyricsOpen(!lyricsOpen);
        });

        languageButtons.forEach(function (languageButton) {
          languageButton.addEventListener('click', function () {
            setLanguage(languageButton.getAttribute('data-language'));
          });
        });

        document.addEventListener('keydown', function (evt) {
          if (evt.key === 'Escape' && lyricsOpen) setLyricsOpen(false);
        });
```

Before the final `render();`, add:

```js
        renderLyricsControls();
```

- [ ] **Step 6: Run the runtime state test and verify it passes**

Run:

```bash
node --test tests/lyrics-contract.test.js
```

Expected: PASS with four passing tests.

- [ ] **Step 7: Commit open/close and language state**

Run:

```bash
git add index.html tests/lyrics-contract.test.js
git commit -m "Wire lyrics overlay controls"
```

## Task 4: Sync Active Lyrics To Audio Time

**Files:**
- Modify: `tests/lyrics-contract.test.js`
- Modify: `index.html`

- [ ] **Step 1: Extend the contract test for sync hooks**

Append this test to `tests/lyrics-contract.test.js`:

```js
test('lyrics sync uses audio time, active classes, and animation frames', () => {
  assert.match(html, /function findActiveLyricIndex\(lines, currentTime\)/);
  assert.match(html, /function updateActiveLyric\(forceScroll\)/);
  assert.match(html, /function syncLyrics\(\)/);
  assert.match(html, /audio\.currentTime/);
  assert.match(html, /requestAnimationFrame\(syncLyrics\)/);
  assert.match(html, /audio\.addEventListener\('timeupdate'/);
  assert.match(html, /classList\.toggle\('is-active'/);
  assert.match(html, /classList\.toggle\('is-past'/);
});
```

- [ ] **Step 2: Run the sync test and verify it fails**

Run:

```bash
node --test tests/lyrics-contract.test.js
```

Expected: FAIL with an assertion mentioning `function findActiveLyricIndex(lines, currentTime)`.

- [ ] **Step 3: Add the active-line lookup and scroll logic**

In the existing IIFE, after `setLanguage(language)`, add:

```js
        function findActiveLyricIndex(lines, currentTime) {
          var index = 0;
          for (var i = 0; i < lines.length; i += 1) {
            if (currentTime >= lines[i].time) index = i;
            else break;
          }
          return index;
        }

        function updateActiveLyric(forceScroll) {
          if (!lyricsOpen || !lyricsTrack.children.length) return;
          var lines = LYRICS[selectedLanguage];
          var nextIndex = findActiveLyricIndex(lines, audio.currentTime || 0);
          if (nextIndex === activeLineIndex && !forceScroll) return;
          activeLineIndex = nextIndex;

          Array.prototype.forEach.call(lyricsTrack.children, function (lineNode, index) {
            lineNode.classList.toggle('is-active', index === activeLineIndex);
            lineNode.classList.toggle('is-past', index < activeLineIndex);
          });

          var activeNode = lyricsTrack.children[activeLineIndex];
          if (!activeNode) return;
          var viewport = lyricsTrack.parentNode;
          var offset = (viewport.clientHeight / 2) - activeNode.offsetTop - (activeNode.offsetHeight / 2);
          lyricsTrack.style.transform = 'translateY(' + offset + 'px)';
        }

        function syncLyrics() {
          updateActiveLyric(false);
          if (lyricsOpen) requestAnimationFrame(syncLyrics);
        }
```

- [ ] **Step 4: Start and refresh lyric sync from relevant events**

In `setLyricsOpen(open)`, update the open branch so it reads:

```js
          if (lyricsOpen) {
            play();
            updateActiveLyric(true);
            requestAnimationFrame(syncLyrics);
          }
```

In `setLanguage(language)`, update the function so it reads:

```js
        function setLanguage(language) {
          if (!LYRICS[language] || selectedLanguage === language) return;
          selectedLanguage = language;
          renderLyrics();
          renderLyricsControls();
          updateActiveLyric(true);
        }
```

After the `document.addEventListener('keydown', ...)` listener, add:

```js
        audio.addEventListener('timeupdate', function () {
          updateActiveLyric(false);
        });

        audio.addEventListener('seeked', function () {
          updateActiveLyric(true);
        });

        audio.addEventListener('loadedmetadata', function () {
          updateActiveLyric(true);
        });
```

- [ ] **Step 5: Run the sync contract test and verify it passes**

Run:

```bash
node --test tests/lyrics-contract.test.js
```

Expected: PASS with five passing tests.

- [ ] **Step 6: Commit active lyric sync**

Run:

```bash
git add index.html tests/lyrics-contract.test.js
git commit -m "Sync lyrics to anthem playback"
```

## Task 5: Manual Browser Verification And Timing Tune

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Start a local static server**

Run:

```bash
python3 -m http.server 8000
```

Expected: terminal prints `Serving HTTP on :: port 8000` or `Serving HTTP on 0.0.0.0 port 8000`.

- [ ] **Step 2: Open the page and verify the static experience**

Open:

```text
http://localhost:8000/
```

Expected:

- The page shows the full-screen Belgian flag.
- The mute button remains at bottom-right.
- The lyrics button appears to the left of the mute button.
- Clicking outside controls still starts playback when browser autoplay blocks initial playback.

- [ ] **Step 3: Verify lyrics overlay behavior**

In the browser:

1. Click the lyrics button.
2. Confirm the overlay covers the viewport.
3. Confirm the flag is visible behind a dark translucent blur.
4. Confirm the lyrics button label/state changes to the active state.
5. Press `Escape`.
6. Confirm the overlay closes and the flag-only view returns.

- [ ] **Step 4: Verify language switching**

In the browser:

1. Open lyrics.
2. Let the anthem play past the first line.
3. Click `FR`.
4. Confirm the visible lyric language changes to French without restarting audio.
5. Click `DE`.
6. Confirm the visible lyric language changes to German without restarting audio.
7. Click `NL`.
8. Confirm the visible lyric language returns to Dutch without restarting audio.

- [ ] **Step 5: Tune line timings by listening**

Edit only the numeric `time` values in `LYRICS` inside `index.html`. Keep the same lyric lines and keys. Use this first adjustment set if the initial pass feels late on the current instrumental:

```js
0, 3.9, 8.5, 13.2, 17.9, 22.6, 27.3, 32, 36.7, 41.4, 46.1, 49
```

Use this first adjustment set if the initial pass feels early on the current instrumental:

```js
0, 4.5, 9.1, 13.8, 18.5, 23.2, 27.9, 32.6, 37.3, 42, 46.7, 49.4
```

Expected: the highlighted line changes slightly before the visitor would naturally start singing that phrase.

- [ ] **Step 6: Verify mobile sizing**

Open browser responsive mode at `390x844`.

Expected:

- The lyrics and controls do not overlap.
- The longest German line wraps cleanly.
- The active line remains readable.
- Bottom controls remain reachable.

- [ ] **Step 7: Verify reduced motion**

In browser devtools, emulate `prefers-reduced-motion: reduce`.

Expected:

- The mute icon still toggles.
- Lyrics still update.
- The expressive scale/scroll flourish is reduced according to the CSS media query.

- [ ] **Step 8: Run the contract tests after timing changes**

Run:

```bash
node --test tests/lyrics-contract.test.js
```

Expected: PASS with five passing tests.

- [ ] **Step 9: Commit the tuned browser-verified feature**

Run:

```bash
git add index.html tests/lyrics-contract.test.js
git commit -m "Polish lyrics overlay timing"
```

## Self-Review Notes

- Spec coverage:
  - Optional lyrics mode: Tasks 1, 3, and 4.
  - Dutch, French, German switching: Tasks 1, 2, 3, and 5.
  - Apple Music-style blurred overlay: Tasks 1 and 5.
  - Current audio source of truth: Tasks 3 and 4.
  - Line-level timing table: Tasks 2, 4, and 5.
  - Reduced motion and accessibility hooks: Tasks 1, 3, and 5.
  - Static site and no dependency approach: all tasks keep to `index.html` plus one Node built-in test file.
- The plan intentionally does not include the mixed trilingual version, automatic lyric alignment, word-level highlighting, framework migration, or shader work.
- Commands are dependency-free except for `python3`, `node`, and `git`, which are already consistent with this workspace.
