# Flag Fabric — animated gradient background shader

A from-scratch, zero-dependency WebGL2 reproduction of the **Apple Sports** app's
team-colour "waving fabric" background, reverse-engineered from a screen
recording (the original source was never used — this reproduces the *observed
behaviour* only).

```
flag-fabric/
├── flag-fabric.js   # the engine: WebGL2 + embedded GLSL, presets, live params
├── index.html       # tuning harness (canvas + auto-generated sliders/colour pickers)
└── README.md
```

## Run it

It's a static page — no build step.

- **Easiest:** open `index.html` over a local server, e.g.
  `python3 -m http.server` from this folder, then visit
  `http://127.0.0.1:8000/` (or whatever port). `file://` also works.
- Drag the sliders / colour pickers to tune. **H** toggles the panel.
  **Copy params** dumps the current settings as JSON (also logged to the console).

## Re-opening the tuning panel

The control panel is **not shown in normal use** — the shipped values live in the
`belgium` preset. To bring the panel back and tweak the shader again:

- **On the live lyrics overlay (in-context):** open the site with **`?tune=1`**,
  e.g. `…/index.html?tune=1`, then open the lyrics overlay. A panel appears
  top-right (shader controls + a **Wash (overlay dim)** group for the readability
  overlay). It's gated entirely behind that query param, so production stays clean.
- **Standalone harness:** open `flag-fabric/index.html` — same controls on a
  full-page canvas (no lyrics), with `green` / `red` / `belgium` presets.

When you've dialed in a look, hit **Copy params** and update the `belgium` preset
in `flag-fabric.js` (and the wash CSS vars in the site's `index.html` if changed).

## Tuning log

- **2026-06-26** — applied the hand-tuned `belgium` defaults (in-context via
  `?tune=1`): warmer stripes `#000000 / #fdc326 / #ff1a29`, `colorSoft 0.4`,
  `chromaBoost 1`, `roll 1`, `foldAngleDeg -37`, `foldDir -1` (reversed),
  `warp 0.095`, `vignette 0.2`. Wash turned **off** (`top/bottom/edge = 0`) —
  the shader provides its own contrast; raise the wash vars to re-dim.

## What the recording showed (Step 1 analysis)

The background is **not** a simple top-bright gradient. It's built from layers:

| Layer | Observation in the recording | How it's reproduced |
|------|------------------------------|---------------------|
| Base | Dark, near-neutral; saturated team hue only appears where it's bright | dark vertical gradient `colMid → colLo` |
| Hero glow | A large soft **team-colour hotspot** in the upper area that **slowly migrates** over ~10 s (no visible loop seam) | a gaussian glow whose centre wanders via low-frequency noise |
| Folds | The glow is **stretched diagonally** and broken into soft bands → reads as fabric folds | rotate + anisotropic squash of the sample space, modulated by fractal (value-noise) `fbm` |
| Grain | Fine per-pixel "tooth" over everything (revealed by contrast-boosting the source) | observed, but intentionally **not** reproduced — removed to keep the look clean |
| Edges | Corners/bottom fall to near-black | radial vignette |

Two states appear in the clip: a **green** landing ("My Teams") and, after a
navigation push, a **red** Belgium-match detail. They're the same shader with a
different palette + glow placement, so each ships as a full-parameter **preset**.
Colours were sampled directly from the source frames (e.g. red sheen ≈ `#9f2931`,
green top ≈ `#196221`, darks ≈ near-black).

**Ruled out:** chromatic aberration (no colour fringing), metaballs (no discrete
blobs), fresnel/edge glow (whole-screen, no rim), turbulent flow fields (motion
is a smooth drift). A SwiftUI `MeshGradient` could fake the big colour regions
but not the seamless drift, and is far harder to tune — hence noise-based.

## Why WebGL2 (and not WebGPU/Metal)

The original is iOS/Metal, but the goal is the website, so this targets the web.
**WebGL2 + GLSL ES** has universal browser support and no build step — it drops
straight into a static site and onto GitHub Pages. WebGPU/WGSL is the newer API
but Safari support is still uneven for a public site; the math is identical, so
WebGL2 is the pragmatic choice. Porting the `FRAG` string to WGSL later is
mechanical if you ever want it.

## Parameters

All live-editable in the panel and stored on `fab.params`.

- **Palette** — `colHi` (glow / team colour), `colMid` (base top), `colLo` (base bottom)
- **Base gradient** — `gradShift` (move the dark base up/down), `gradPow` (ramp gamma)
- **Hero glow** — `glowAmp`, `glowSize`, `glowPosX`/`glowPosY` (rest position), `glowDrift` (wander distance)
- **Folds / fabric** — `foldAngleDeg` (diagonal direction), `aniso` (elongation: 1 = round blob, higher = streaky fold), `foldScale` (fold frequency), `foldDetail` (how much folds break up the glow), `foldSpeed` (animation speed), `foldContrast` (glow falloff sharpness)
- **Edges** — `vignette`

## Two modes

- **Background** (`flag: 0`) — the reverse-engineered Apple Sports look: dark base
  + drifting team-colour glow. Presets `green`, `red`.
- **Flag** (`flag: 1`) — a soft colour gradient on a waving cloth. Modelled on a
  closer look at the source: the **fabric stays anchored** (it does *not* scroll);
  a **traveling wave** warps it locally and drives **moving light/shadow
  highlights**, so it reads as waving without the texture sliding across. Colours
  are a **soft** left→middle→right gradient (no hard stripe cutoffs). Preset
  `belgium` (black → yellow → red). Params:
  - `stripe0/1/2` — left / middle / right colours
  - `colorSoft` — transition softness (0 = hard edges, high = full gradient)
  - `colorWarp` — how much the colour boundaries ripple with the wave
  - `gradSpace` — interpolation space: `0` sRGB, `1` OKLab, `2` OKLCH (default).
    OKLab/OKLCH avoid the muddy/olive midpoints of sRGB; OKLCH keeps chroma high
    around the hue arc → a vivid orange between yellow and red. Black's missing
    hue is carried from the adjacent stop so it doesn't detour (the caveat
    oklch.fyi warns about).
  - `chromaBoost` (OKLCH only) — lifts chroma through the middle of each leg so
    dark transitions stay vivid. The black→yellow leg is otherwise an olive/mud
    dip (a dark, low-chroma yellow *is* olive); boosting turns it into gold.
    `0` = none, `~0.55` = default, `1` = mid-chroma matches the brighter stop.
  - `warp` — local fabric ripple amplitude · `shadeDepth` — light/shadow depth
  - `sheenAmt` — satin highlight on crests · `roll` — 2nd-harmonic (organic folds)
  - shared: `foldAngleDeg` (wave direction), `foldScale` (fold count),
    `foldSpeed` (wave travel speed), `foldContrast` (highlight sharpness),
    `aniso` (vertical stretch)

## Use it on a page

```html
<canvas id="bg" style="position:fixed;inset:0;width:100%;height:100%"></canvas>
<script src="flag-fabric.js"></script>
<script>
  const fab = new FlagFabric(document.getElementById('bg'), FlagFabric.PRESETS.belgium);
  fab.start();
  // background look instead: FlagFabric.PRESETS.red
  // tweak live: fab.setParams({ shadeDepth: 0.5, foldSpeed: 0.1 });
</script>
```

The site's `../index.html` already does this with the `belgium` preset, on top of a
flat CSS tricolour that shows if WebGL2 is unavailable.

## Reproduce the comparison frames (Step 4)

The harness supports query params for deterministic capture:

- `?preset=green` / `?preset=red` — pick a preset
- `?ui=0` — hide the panel
- `?t=2.0` — freeze a single frame at t = 2 s (so a screenshot is reproducible)

Source frames were extracted with
`ffmpeg -i recording.mp4 -vf "fps=5,scale=480:-1" out_%03d.png`; the analysis
frames live under `../analysis/` (overview, crops, palette samples, side-by-sides).

## Honest match assessment

**Matches well:** layered structure (dark base + migrating team-colour glow +
diagonal folds), palette, slow seamless drift, the green↔red two-state look.

**Not fully matched / known gaps:**
- The source red sheen sits a touch more **upper-right** and reads slightly more
  **diagonal** than the default preset (nudge `glowPosX` up and `aniso` up).
- The reproduction is marginally more **saturated** than the source in the bright
  zones (the recording is HEVC-compressed, so its colour is slightly muddied —
  pull `glowAmp`/`colHi` down to taste).
- Exact drift **path/speed** can't be recovered from one 11 s clip; `foldSpeed`
  and `glowDrift` approximate the feel rather than the precise trajectory.
- Source banding in dark areas is HEVC compression, **not** part of the effect —
  intentionally not reproduced.
