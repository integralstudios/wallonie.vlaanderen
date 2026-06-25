# Show Lyrics Design

## Context

The site is a static single-page Belgian flag experience. The current player lives in
`index.html`, uses a local `audio#anthem`, and plays `belgium.mp3` or `belgium.ogg`
in a loop. Both audio files are 54.079 seconds long. There is no build system,
package manager, or frontend framework, so the lyrics feature should stay in plain
HTML, CSS, and JavaScript.

The existing shader worktree is out of scope. This feature targets the current
simple full-screen flag page on the `codex/show-lyrics` worktree.

## Goals

- Add an optional lyrics mode so visitors can sing along to the instrumental
  Brabanconne.
- Support three separate lyric languages for v1: Dutch, French, and German.
- Make the lyrics presentation feel close to Apple Music: immersive, synced,
  animated, and readable.
- Keep the flag and anthem experience intact when lyrics are disabled.
- Avoid external dependencies unless they remove real complexity.

## Non-Goals

- No mixed trilingual sing-along version in v1.
- No automatic audio-to-lyrics alignment.
- No word-by-word karaoke highlighting in v1.
- No framework migration or build tooling.
- No changes from the ignored shader worktree.

## Interaction Design

The page keeps the existing mute button. A new lyrics button appears as a sibling
fixed control. Activating it opens a full-screen lyrics overlay above the Belgian
flag. Audio keeps playing, and closing lyrics returns to the unchanged flag view.

The overlay uses a dark translucent wash plus background blur with
`backdrop-filter`, with a non-blur translucent fallback for browsers that do not
support it. The flag should remain visible as color and motion context underneath,
but text readability wins over background visibility.

Lyrics mode contains:

- A compact language switcher with `NL`, `FR`, and `DE`.
- A vertically centered synced lyric stack.
- A close or toggle affordance that returns to the flag view.

The active line is large, bright, and centered. Previous and upcoming lines remain
visible but dimmed. As playback advances, the active line fades and scales in, and
the lyrics stack scrolls smoothly so the current line remains near the visual
center. Reduced-motion users should get state changes without scroll/scale flourish.

Switching language preserves `audio.currentTime`. The UI re-renders to the line in
the newly selected language that corresponds to the current timestamp.

## Lyric Text Sources

Use Belgium.be as the source for the three v1 language texts:

- French: https://www.belgium.be/fr/la_belgique/connaitre_le_pays/la_belgique_en_bref/symboles/hymnes
- Dutch: https://www.belgium.be/nl/over_belgie/land/belgie_in_een_notendop/symbolen/hymnes
- German: https://www.belgium.be/de/ueber_belgien/land/belgien_auf_einen_nenner_gebracht/symbolen/hymne

The implementation should store the lyric lines directly in the page as structured
data. Since the page is static and the dataset is tiny, fetching sidecar files or
adding an LRC parser is unnecessary for v1.

## Timing Model

Use a hand-authored line-level timing table, conceptually similar to simple LRC.
Each entry has:

- `time`: seconds from the start of the 54.079 second audio file.
- `text`: the lyric line to show.

The active line is the last entry whose `time` is less than or equal to
`audio.currentTime`. The final line remains active until the loop restarts. On the
audio `timeupdate` event, on animation frames while lyrics are open, and on language
changes, the renderer recalculates the active line.

Initial timings can be estimated from the melody structure of the instrumental and
then manually tuned in-browser. The data structure should make timing adjustment
simple, because the first implementation will likely need a few listening passes.

## Architecture

Keep the feature local to `index.html`:

- CSS defines the lyrics button, overlay, blur/fallback, language switcher, lyric
  stack, active/inactive line states, responsive sizing, and reduced-motion behavior.
- HTML adds the lyrics button and overlay markup near the existing audio and mute
  controls.
- JavaScript keeps small state variables: `lyricsOpen`, `selectedLanguage`, and
  `activeLineIndex`.
- JavaScript defines `LYRICS` as a language-keyed object containing timed lines.
- Rendering functions update button state, overlay visibility, language selection,
  active line classes, and scroll position.

The existing playback and mute behavior should remain the source of truth for audio
state. Lyrics should read from the existing `audio` element rather than creating a
second player.

## Accessibility

- The lyrics button must expose state with `aria-pressed` and a clear label.
- The overlay should be reachable by keyboard and closable without a pointer.
- Language controls should communicate the selected language.
- The active lyric should be reflected visually without relying only on color.
- Text must fit on small screens without overlapping controls.
- `prefers-reduced-motion: reduce` should reduce or remove scale and smooth-scroll
  effects.

## Error Handling

If audio metadata is not loaded yet, lyrics mode can still open and show the first
line. If playback is blocked by browser autoplay rules, the first user interaction
with the page should continue to start playback as it does today. If backdrop blur
is unsupported, the overlay should fall back to a stronger translucent background.

## Testing

Manual verification should cover:

- Opening and closing lyrics mode on desktop and mobile widths.
- Mute/unmute behavior still works with lyrics open and closed.
- `NL`, `FR`, and `DE` switching preserves the current timestamp.
- Active lyric progression loops cleanly when the audio loops.
- The overlay has background blur where supported and readable fallback where not.
- Reduced-motion mode removes the more expressive animation.
- Keyboard focus can reach and operate lyrics controls.

Automated or scripted verification can be lightweight because this is a static page:
run a local static server, open the page in a browser, and inspect DOM state changes
after forcing representative `audio.currentTime` values where possible.
