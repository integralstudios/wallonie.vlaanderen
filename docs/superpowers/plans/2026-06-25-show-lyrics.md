# Show Lyrics Implementation Notes

## Final Direction

The lyrics feature ships as a static sheet overlay, not as timed karaoke. Earlier
timing experiments were removed because there is no official sung recording to
anchor reliable line timing across Dutch, French, and German. The final user goal
is still sing-along support: visitors can open lyrics, choose a language, and
follow the complete text while the anthem plays.

## Implemented Scope

- Added a lyrics button beside the existing volume control.
- Added a full-screen lyrics overlay with `lyrics-bg.jpg` as the blurred artwork
  background.
- Added Dutch, French, and German lyric sheets directly in `index.html`.
- Included stanza spacing and repeated closing lines for all three languages.
- Added browser-language detection for the initial overlay language.
- Preserved manual language choice for later opens in the same page session.
- Added the bottom-centered language picker with moving underline.
- Added word-by-word reveal on initial overlay open.
- Added a lighter move-up transition when switching languages while open.
- Added a conditional bottom fade when the static lyric sheet overflows.
- Updated the volume control for autoplay-blocked state handling.
- Replaced the old volume visuals with the finalized option-B reactive waveform.
- Removed all temporary DialKit tuning controls from the shipped page.

## Runtime Architecture

The page remains a single static document:

- `index.html` owns markup, CSS, and JavaScript.
- `lyrics-bg.jpg` is the only new runtime asset.
- `tests/lyrics-contract.test.js` provides dependency-free coverage using
  Node's built-in `node:test`, `assert`, and `vm` modules.

The lyrics data is represented as plain arrays keyed by language:

- `nl`
- `fr`
- `de`

Blank strings render as spacer lines. The renderer wraps non-empty words in
`span.lyrics-word` nodes only so the initial open animation can stagger words.
No timing metadata is stored or consumed.

## Background Treatment

The final overlay background is static:

- Overlay base: `#120f0d`
- Image: `lyrics-bg.jpg`
- Image filter: `blur(28px) saturate(1.12)`
- Image opacity: `0.96`
- Image transform: `scale(1.08)`
- Vertical wash: `rgba(0, 0, 0, 0.08)`, `0.24`, `0.46`
- Radial wash: `rgba(255, 255, 255, 0.05)`, `rgba(0, 0, 0, 0.05)`,
  `rgba(0, 0, 0, 0.3)`

There is no `backdrop-filter` dependency in the final version.

## Typography And Controls

Lyrics use:

- Font family: `"mendl-serif-dusk", sans-serif`
- Font size: `20px`
- Line height: `1.18`
- Font weight: `400`
- Color: `#ffffff`
- No text blend mode
- Antialiased font smoothing

The language picker uses `"mendl-sans-dusk", sans-serif`, `12px`, `1px`
tracking, `20px` item spacing, and a one-pixel underline sized from the rendered
text bounds.

The lyrics viewport detects overflow after render, resize, and font loading. If
content is taller than the viewport, it adds `.has-overflow` so CSS can apply a
short bottom mask fade instead of a hard cutoff. The overlay uses equal `72px`
top and bottom padding, and the lyrics viewport fills that available height so
the fade starts close to the bottom language picker instead of hiding the final
lyrics too early.

The volume and lyrics buttons use 36px circular controls with 16px imported
Sketch icons.

## Audio And Waveform Behavior

The page still attempts to autoplay the anthem. If autoplay is blocked, the
volume button presents the sound-off state and clicking the control retries
playback.

When playback is active, the volume button renders the option-B waveform ring.
If Web Audio analysis is available, the waveform amplitude reacts to the anthem.
When muted, the waveform collapses before the base ring returns.

## Validation

Run:

```bash
node --test tests/lyrics-contract.test.js
```

The contract tests cover the final static lyrics behavior, the absence of timing
machinery, the final overlay background settings, the overflow fade, the language
picker, the audio state handling, and the baked-in waveform configuration.
