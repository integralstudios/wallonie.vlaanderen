# Show Lyrics Design

## Context

The site is a static single-page Belgian flag experience. The player lives in
`index.html`, uses the existing `audio#anthem`, and loops `belgium.mp3` or
`belgium.ogg`. There is no build system, package manager, or frontend framework,
so the lyrics feature stays in plain HTML, CSS, and JavaScript.

The shader worktree is out of scope. This feature targets the simple full-screen
flag page on the `codex/show-lyrics` worktree.

## Goals

- Add an optional lyrics mode so visitors can sing along to the anthem.
- Present Dutch, French, and German lyric sheets.
- Keep the flag and anthem experience intact when lyrics are hidden.
- Use the custom `lyrics-bg.jpg` artwork as the full-screen lyrics background.
- Keep the shipped page dependency-free.

## Non-Goals

- No line-level timing or karaoke highlighting.
- No automatic audio-to-lyrics alignment.
- No mixed trilingual sing-along version.
- No framework migration or build tooling.
- No runtime tuning panels or DialKit controls in the shipped page.

## Interaction Design

The page keeps the existing volume button and adds a sibling lyrics button.
Activating the lyrics button opens a full-screen overlay above the Belgian flag.
Audio keeps playing, and closing lyrics returns to the unchanged flag view.

The overlay contains:

- A compact language switcher with `DE`, `FR`, and `NL`.
- A centered static lyric sheet for the selected language.
- The same lyrics button as the toggle affordance for hiding the overlay.

The initial language is chosen from `navigator.languages` when the overlay first
opens. If the browser preference is not Dutch, French, or German, Dutch is used.
After a visitor manually selects a language, that selection is kept for later
opens in the same page session.

## Visual Design

The lyrics overlay uses `lyrics-bg.jpg` as an enlarged full-screen background
layer. The image is blurred with `filter: blur(28px) saturate(1.12)`, scaled
slightly, and covered by a lighter vertical and radial wash. The overlay itself
keeps a dark `#120f0d` base color for readability while the image loads.

Lyrics use the Adobe Fonts Mendl Serif Dusk family at `20px` with `1.18` line
height, white text, and antialiased smoothing. The text does not use blend mode
or reduced opacity in the final version.

The language picker is fixed near the bottom center, aligned with the control
buttons. Active language text is white with a one-pixel underline. Inactive
languages are white at lower opacity and brighten on hover. The underline moves
smoothly between languages and sizes to the rendered text width.

## Motion

Opening the overlay uses a short track-rise animation plus word-by-word reveal.
Switching languages while the overlay is already open uses a lighter whole-sheet
move-up transition instead of replaying the word-by-word animation.

Reduced-motion users get the same state changes without the reveal, language
switch, hover scale, or waveform motion flourishes.

## Audio Controls

The volume button reflects autoplay blocking: if the browser prevents autoplay,
the control shows the sound-off state and clicking it retries playback.

When audio is playing, the volume button shows the finalized option-B waveform
ring. The waveform is driven by the existing anthem audio through Web Audio when
available, and falls back to the same visual rhythm when analysis is unavailable.
Muting collapses the waveform amplitude to zero and returns to the base ring.

## Lyric Text

The lyric sheets are stored directly in `index.html` as small arrays for:

- Dutch (`nl`)
- French (`fr`)
- German (`de`)

Blank strings represent stanza spacing. Repeated closing lines are included in
each language sheet so visitors can follow the full text without timed cues.

## Verification

The feature is covered by `tests/lyrics-contract.test.js`, a dependency-free
Node test file that checks:

- Control and overlay markup.
- Static lyric data for all three languages.
- Browser-language selection behavior.
- Static lyric-sheet rendering without timing metadata.
- Overlay background, typography, language picker, and reveal hooks.
- Autoplay-blocked audio state and waveform behavior.
- Absence of shipped DialKit controls.
