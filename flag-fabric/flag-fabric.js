/*
 * flag-fabric.js — a self-contained, zero-dependency WebGL2 engine that renders
 * an animated "waving flag fabric" gradient background.
 *
 * Reverse-engineered from the Apple Sports app team-colour backgrounds. Two modes
 * share one fabric look (folds + satin sheen):
 *
 *   • BACKGROUND mode (default) — a dark base with a bright, drifting, diagonally
 *     elongated "hero glow" broken up by fabric folds. Presets: green, red.
 *
 *   • FLAG mode (params.flag = 1) — N vertical colour stripes (e.g. the Belgian
 *     black/yellow/red tricolour) rendered as one continuous waving cloth: the
 *     fold light/shadow runs across the whole flag, the stripe edges ripple, and
 *     a satin highlight rides the crests. Preset: belgium.
 *
 * Usage:
 *   const fab = new FlagFabric(canvas, FlagFabric.PRESETS.belgium);
 *   fab.start();                      // animation loop
 *   fab.setParams({ shadeDepth: 0.5 });
 *   fab.renderAt(2.0);                // one frozen frame at t=2s (capture)
 *
 * No bundler, no imports — attaches `FlagFabric` to the global scope so it loads
 * with a plain <script src> tag, including over file://.
 */
(function (global) {
  "use strict";

  // ---- colour helpers (shader works in plain sRGB; recording is sRGB) -------
  function hexToRgb(hex) {
    const h = hex.replace("#", "");
    const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  // ---- shaders --------------------------------------------------------------
  const VERT = `#version 300 es
  void main() {
    vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
    gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
  }`;

  const FRAG = `#version 300 es
  precision highp float;
  out vec4 fragColor;

  uniform vec2  u_res;
  uniform float u_time;

  // shared fabric controls
  uniform float u_foldAngle;    // diagonal direction (radians)
  uniform float u_aniso;        // elongation along the diagonal
  uniform float u_foldScale;    // fold frequency
  uniform float u_foldSpeed;    // animation speed
  uniform float u_foldContrast; // fold falloff sharpness
  uniform float u_foldDir;      // wave travel direction (+1 / 0 freeze / -1)
  uniform float u_vignette;

  // background mode (hero glow)
  uniform vec3  u_colHi, u_colMid, u_colLo;
  uniform float u_gradShift, u_gradPow;
  uniform float u_glowAmp, u_glowSize, u_glowDrift;
  uniform vec2  u_glowPos;

  // flag mode (tricolour cloth)
  uniform float u_flag;         // 0 = background, 1 = flag
  uniform vec3  u_stripe0, u_stripe1, u_stripe2;  // left, middle, right
  uniform float u_warp;         // local fabric ripple amplitude
  uniform float u_shadeDepth;   // depth of fold light/shadow
  uniform float u_sheenAmt;     // satin highlight on fold crests
  uniform float u_roll;         // 2nd-harmonic strength (organic folds)
  uniform float u_colorSoft;    // colour transition softness (half-width)
  uniform float u_colorWarp;    // how much the colour boundaries ripple
  uniform float u_gradSpace;    // 0 = sRGB, 1 = OKLab, 2 = OKLCH
  uniform float u_chromaBoost;  // OKLCH: lift mid-transition chroma (un-muddy darks)

  // --- value noise -----------------------------------------------------------
  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21(i), b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  float fbm(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.0; a *= 0.5; }
    return s;
  }

  // --- colour spaces: sRGB <-> linear <-> OKLab (Björn Ottosson) --------------
  vec3 srgb2lin(vec3 c) {
    return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
  }
  vec3 lin2srgb(vec3 c) {
    return mix(c * 12.92, 1.055 * pow(max(c, 0.0), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
  }
  vec3 linToOklab(vec3 c) {
    float l = 0.4122214708*c.r + 0.5363325363*c.g + 0.0514459929*c.b;
    float m = 0.2119034982*c.r + 0.6806995451*c.g + 0.1073969566*c.b;
    float s = 0.0883024619*c.r + 0.2817188376*c.g + 0.6299787005*c.b;
    l = pow(l, 1.0/3.0); m = pow(m, 1.0/3.0); s = pow(s, 1.0/3.0);
    return vec3(0.2104542553*l + 0.7936177850*m - 0.0040720468*s,
                1.9779984951*l - 2.4285922050*m + 0.4505937099*s,
                0.0259040371*l + 0.7827717662*m - 0.8086757660*s);
  }
  vec3 oklabToLin(vec3 lab) {
    float l_ = lab.x + 0.3963377774*lab.y + 0.2158037573*lab.z;
    float m_ = lab.x - 0.1055613458*lab.y - 0.0638541728*lab.z;
    float s_ = lab.x - 0.0894841775*lab.y - 1.2914855480*lab.z;
    float l = l_*l_*l_, m = m_*m_*m_, s = s_*s_*s_;
    return vec3( 4.0767416621*l - 3.3077115913*m + 0.2309699292*s,
                -1.2684380046*l + 2.6097574011*m - 0.3413193965*s,
                -0.0041960863*l - 0.7034186147*m + 1.7076147010*s);
  }
  // OKLCH interpolation: polar (L, C, h) with shortest-path hue + hue-carry for
  // near-achromatic endpoints (so black/white don't inject a bogus hue).
  vec3 mixOklch(vec3 a, vec3 b, float t) {
    float Ca = length(a.yz), Cb = length(b.yz);
    float ha = atan(a.z, a.y), hb = atan(b.z, b.y);
    if (Ca < 1e-4) ha = hb;
    if (Cb < 1e-4) hb = ha;
    float dh = hb - ha;
    if (dh >  3.14159265) dh -= 6.28318531;
    if (dh < -3.14159265) dh += 6.28318531;
    float L = mix(a.x, b.x, t), C = mix(Ca, Cb, t), h = ha + dh * t;
    // Lift chroma through the middle of the leg so dark transitions stay vivid
    // (e.g. black→yellow becomes gold, not olive mud) instead of dipping.
    C = mix(C, max(Ca, Cb), sin(3.14159265 * t) * u_chromaBoost);
    return vec3(L, C * cos(h), C * sin(h));
  }
  // Soft 3-stop gradient (left/mid/right) interpolated in the chosen space:
  // u_gradSpace 0 = sRGB, 1 = OKLab (straight line), 2 = OKLCH (polar hue).
  vec3 flagGradient(float cx, float s) {
    float w1 = smoothstep(0.3333 - s, 0.3333 + s, cx);
    float w2 = smoothstep(0.6666 - s, 0.6666 + s, cx);
    if (u_gradSpace < 0.5) {
      vec3 c = mix(u_stripe0, u_stripe1, w1);
      return mix(c, u_stripe2, w2);
    }
    vec3 a = linToOklab(srgb2lin(u_stripe0));
    vec3 b = linToOklab(srgb2lin(u_stripe1));
    vec3 d = linToOklab(srgb2lin(u_stripe2));
    vec3 lab = (u_gradSpace < 1.5)
      ? mix(mix(a, b, w1), d, w2)            // OKLab
      : mixOklch(mixOklch(a, b, w1), d, w2); // OKLCH
    return clamp(lin2srgb(oklabToLin(lab)), 0.0, 1.0);
  }

  // --- BACKGROUND: dark base + drifting hero glow ----------------------------
  vec3 renderBackground(vec2 uv, vec2 p, float t, mat2 R) {
    float vg = pow(clamp(uv.y + u_gradShift, 0.0, 1.0), u_gradPow);
    vec3 base = mix(u_colMid, u_colLo, vg);

    vec2 wander = u_glowDrift * vec2(fbm(vec2(t * 0.6, 11.0)) - 0.5,
                                     fbm(vec2(t * 0.5, 23.0)) - 0.5);
    vec2 center = vec2((u_glowPos.x - 0.5) * (u_res.x / u_res.y), u_glowPos.y - 0.5) + wander;
    vec2 r = R * (p - center);
    float dist = length(vec2(r.x / (u_glowSize * u_aniso), r.y / u_glowSize));
    float glow = exp(-dist * dist);

    vec2 sp = R * p; sp.y /= u_aniso; sp *= u_foldScale;
    float folds = fbm(sp + vec2(0.0, t));
    glow *= mix(1.0, 0.35 + 1.3 * folds, 0.5);
    glow = pow(clamp(glow, 0.0, 1.0), u_foldContrast) * u_glowAmp;
    return base + (u_colHi - base) * clamp(glow, 0.0, 1.0);
  }

  // --- FLAG: soft tricolour on a waving cloth --------------------------------
  // The fabric texture stays ANCHORED in place; a traveling wave warps it locally
  // and drives moving light/shadow highlights — so the cloth reads as "waving"
  // without the texture ever scrolling across the screen.
  vec3 renderFlag(vec2 uv, vec2 p, float t, mat2 R) {
    // Traveling wave sweeping across the flag (direction from u_foldAngle).
    vec2 dir  = vec2(cos(u_foldAngle), sin(u_foldAngle));
    vec2 perp = vec2(-dir.y, dir.x);
    float k = u_foldScale * 8.0;                    // spatial frequency of folds
    float ph  = dot(p, dir) * k + t * 6.0 * u_foldDir; // phase travels with time (signed direction)
    float ph2 = dot(p, perp) * (k * 0.35);         // perpendicular undulation
    float wave = sin(ph + ph2) + u_roll * 0.5 * sin(2.0 * ph - ph2 + 1.7);

    // Local displacement: ripples the texture + colour IN PLACE (no scrolling).
    vec2 disp = dir * (wave * u_warp);

    // Anchored cloth weave — note: NO time term, so it stays put; only the
    // traveling disp makes it ripple where the wave currently is.
    vec2 fc = p + disp; fc.y /= u_aniso; fc *= u_foldScale * 3.0;
    float weave = fbm(fc) - 0.5;

    // Traveling highlight: bright on the wave crests, dark in the troughs.
    float light = pow(0.5 + 0.5 * sin(ph + ph2), u_foldContrast);

    // Soft black -> yellow -> red across x (transitions at 1/3 & 2/3, not hard
    // cutoffs); the boundaries ripple slightly with the wave. Interpolation runs
    // in sRGB / OKLab / OKLCH per u_gradSpace (OKLab avoids muddy midpoints).
    float cx = uv.x + disp.x * u_colorWarp;
    vec3 base = flagGradient(cx, max(u_colorSoft, 0.001));

    // Shade: traveling light (multiplicative) + subtle cloth + satin sheen on crests.
    float shade = mix(1.0 - u_shadeDepth, 1.0 + u_shadeDepth * 0.4, light) + weave * 0.2;
    return base * shade + u_sheenAmt * pow(light, 3.0);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_res;
    uv.y = 1.0 - uv.y;                          // y = 0 at the TOP
    float aspect = u_res.x / u_res.y;
    vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
    float t = u_time * u_foldSpeed;
    float ca = cos(u_foldAngle), sa = sin(u_foldAngle);
    mat2 R = mat2(ca, -sa, sa, ca);

    vec3 col = (u_flag > 0.5) ? renderFlag(uv, p, t, R)
                              : renderBackground(uv, p, t, R);

    // vignette (shared)
    col *= clamp(1.0 - u_vignette * dot(p, p) * 1.6, 0.0, 1.0);

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }`;

  // ---- parameter schema (drives defaults + the auto-generated UI) -----------
  const SCHEMA = [
    { group: "Flag (tricolor)" },
    { key: "flag",    label: "Flag mode", type: "bool" },
    { key: "stripe0", label: "Left",      type: "color" },
    { key: "stripe1", label: "Middle",    type: "color" },
    { key: "stripe2", label: "Right",     type: "color" },
    { key: "warp",       label: "Ripple",      type: "range", min: 0.0, max: 0.25, step: 0.005 },
    { key: "shadeDepth", label: "Fold depth",  type: "range", min: 0.0, max: 0.9,  step: 0.01 },
    { key: "sheenAmt",   label: "Sheen",       type: "range", min: 0.0, max: 0.5,  step: 0.01 },
    { key: "roll",       label: "Harmonic",    type: "range", min: 0.0, max: 1.0,  step: 0.01 },
    { key: "colorSoft",  label: "Blend",       type: "range", min: 0.0, max: 0.4,  step: 0.005 },
    { key: "colorWarp",  label: "Edge ripple", type: "range", min: 0.0, max: 1.0,  step: 0.01 },
    { key: "gradSpace",  label: "Space 0sRGB/1Lab/2LCH", type: "range", min: 0, max: 2, step: 1 },
    { key: "chromaBoost", label: "Chroma boost", type: "range", min: 0, max: 1, step: 0.01 },
    { group: "Folds / fabric (shared)" },
    { key: "foldAngleDeg", label: "Angle°",   type: "range", min: -90, max: 90,  step: 1 },
    { key: "aniso",        label: "Elongate", type: "range", min: 1.0, max: 8.0, step: 0.05 },
    { key: "foldScale",    label: "Scale",    type: "range", min: 0.3, max: 6.0, step: 0.01 },
    { key: "foldSpeed",    label: "Speed",    type: "range", min: 0.0, max: 0.5, step: 0.005 },
    { key: "foldDir",      label: "Direction (-1/0/1)", type: "range", min: -1, max: 1, step: 1 },
    { key: "foldContrast", label: "Contrast", type: "range", min: 0.4, max: 3.0, step: 0.01 },
    { group: "Edges" },
    { key: "vignette",    label: "Vignette", type: "range", min: 0.0, max: 1.2, step: 0.01 },
    { group: "Background glow (presets: green / red)" },
    { key: "colHi",  label: "Glow",     type: "color" },
    { key: "colMid", label: "Base top", type: "color" },
    { key: "colLo",  label: "Base low", type: "color" },
    { key: "gradShift", label: "Grad shift", type: "range", min: -0.6, max: 0.6, step: 0.01 },
    { key: "gradPow",   label: "Grad gamma", type: "range", min: 0.3,  max: 3.0, step: 0.01 },
    { key: "glowAmp",   label: "Glow amt",   type: "range", min: 0.0, max: 2.0, step: 0.01 },
    { key: "glowSize",  label: "Glow size",  type: "range", min: 0.1, max: 1.2, step: 0.01 },
    { key: "glowPosX",  label: "Glow X",     type: "range", min: 0.0, max: 1.0, step: 0.01 },
    { key: "glowPosY",  label: "Glow Y",     type: "range", min: 0.0, max: 1.0, step: 0.01 },
    { key: "glowDrift", label: "Glow drift", type: "range", min: 0.0, max: 0.8, step: 0.01 },
  ];

  // Sensible defaults for every key (so any preset can omit unrelated keys).
  const DEFAULTS = {
    flag: 0, stripe0: "#000000", stripe1: "#FDDA24", stripe2: "#EF3340",
    warp: 0.06, shadeDepth: 0.45, sheenAmt: 0.12, roll: 0.35, colorSoft: 0.16, colorWarp: 0.25, gradSpace: 1, chromaBoost: 0.0,
    foldAngleDeg: -32, aniso: 2.3, foldScale: 2.2, foldSpeed: 0.06, foldDir: 1, foldContrast: 1.2,
    vignette: 0.30,
    colHi: "#1c7128", colMid: "#073a11", colLo: "#020c06",
    gradShift: -0.05, gradPow: 1.3,
    glowAmp: 0.95, glowSize: 0.7, glowPosX: 0.5, glowPosY: 0.16, glowDrift: 0.12,
  };

  const PRESETS = {
    green: Object.assign({}, DEFAULTS, {
      flag: 0,
      colHi: "#1c7128", colMid: "#073a11", colLo: "#020c06",
      gradShift: -0.05, gradPow: 1.3,
      glowAmp: 0.95, glowSize: 0.7, glowPosX: 0.5, glowPosY: 0.16, glowDrift: 0.12,
      foldAngleDeg: -32, aniso: 2.3, foldScale: 2.2, foldSpeed: 0.06, foldContrast: 1.2,
      vignette: 0.30,
    }),
    red: Object.assign({}, DEFAULTS, {
      flag: 0,
      colHi: "#b8303a", colMid: "#2a1416", colLo: "#0b0909",
      gradShift: -0.1, gradPow: 1.1,
      glowAmp: 1.15, glowSize: 0.5, glowPosX: 0.56, glowPosY: 0.22, glowDrift: 0.18,
      foldAngleDeg: -38, aniso: 2.6, foldScale: 1.9, foldSpeed: 0.06, foldContrast: 1.35,
      vignette: 0.5,
    }),
    // Belgian tricolour as waving cloth. Values hand-tuned in the control panel
    // (see flag-fabric/README.md → "Tuning log").
    belgium: Object.assign({}, DEFAULTS, {
      flag: 1,
      stripe0: "#000000", stripe1: "#fdc326", stripe2: "#ff1a29",
      warp: 0.095, shadeDepth: 0.3, sheenAmt: 0.1, roll: 1, colorSoft: 0.4, colorWarp: 0.21, gradSpace: 2, chromaBoost: 1,
      foldAngleDeg: -37, aniso: 2.5, foldScale: 0.8, foldSpeed: 0.1, foldDir: -1, foldContrast: 1, vignette: 0.2,
    }),
  };

  // ---- engine ---------------------------------------------------------------
  class FlagFabric {
    constructor(canvas, params) {
      this.canvas = canvas;
      this.params = Object.assign({}, DEFAULTS, params || {});
      this._running = false;
      this._frozenTime = null;
      this._syncColors();
      this._initGL();
    }

    // Parse the hex colour params once (on change) instead of every frame.
    _syncColors() {
      const p = this.params;
      this._rgb = {
        colHi: hexToRgb(p.colHi), colMid: hexToRgb(p.colMid), colLo: hexToRgb(p.colLo),
        stripe0: hexToRgb(p.stripe0), stripe1: hexToRgb(p.stripe1), stripe2: hexToRgb(p.stripe2),
      };
    }

    _initGL() {
      const gl = this.canvas.getContext("webgl2", { antialias: false, alpha: false, preserveDrawingBuffer: true });
      if (!gl) throw new Error("WebGL2 not available");
      this.gl = gl;
      this.prog = this._link(VERT, FRAG);
      gl.useProgram(this.prog);
      this.vao = gl.createVertexArray();
      this.u = {};
      const names = ["u_res","u_time","u_foldAngle","u_aniso","u_foldScale","u_foldSpeed",
        "u_foldContrast","u_foldDir","u_vignette",
        "u_colHi","u_colMid","u_colLo","u_gradShift","u_gradPow","u_glowAmp","u_glowSize",
        "u_glowPos","u_glowDrift","u_flag","u_stripe0","u_stripe1","u_stripe2","u_warp",
        "u_shadeDepth","u_sheenAmt","u_roll","u_colorSoft","u_colorWarp","u_gradSpace","u_chromaBoost"];
      for (const n of names) this.u[n] = gl.getUniformLocation(this.prog, n);
    }

    _compile(type, src) {
      const gl = this.gl, sh = gl.createShader(type);
      gl.shaderSource(sh, src.trim());
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS))
        throw new Error("Shader compile error:\n" + gl.getShaderInfoLog(sh));
      return sh;
    }
    _link(vs, fs) {
      const gl = this.gl, p = gl.createProgram();
      gl.attachShader(p, this._compile(gl.VERTEX_SHADER, vs));
      gl.attachShader(p, this._compile(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS))
        throw new Error("Program link error:\n" + gl.getProgramInfoLog(p));
      return p;
    }

    setParams(partial) { Object.assign(this.params, partial); this._syncColors(); if (!this._running) this._draw(this._frozenTime ?? 0); }

    _resize() {
      const dpr = Math.min(global.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
      if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
      this.gl.viewport(0, 0, w, h);
    }

    _draw(timeSeconds) {
      const gl = this.gl, p = this.params, u = this.u, c = this._rgb;
      this._resize();
      gl.useProgram(this.prog);
      gl.bindVertexArray(this.vao);
      gl.uniform2f(u.u_res, this.canvas.width, this.canvas.height);
      gl.uniform1f(u.u_time, timeSeconds);
      // shared fabric
      gl.uniform1f(u.u_foldAngle, (p.foldAngleDeg * Math.PI) / 180);
      gl.uniform1f(u.u_aniso, p.aniso);
      gl.uniform1f(u.u_foldScale, p.foldScale);
      gl.uniform1f(u.u_foldSpeed, p.foldSpeed);
      gl.uniform1f(u.u_foldContrast, p.foldContrast);
      gl.uniform1f(u.u_foldDir, p.foldDir);
      gl.uniform1f(u.u_vignette, p.vignette);
      // background glow
      gl.uniform3fv(u.u_colHi, c.colHi);
      gl.uniform3fv(u.u_colMid, c.colMid);
      gl.uniform3fv(u.u_colLo, c.colLo);
      gl.uniform1f(u.u_gradShift, p.gradShift);
      gl.uniform1f(u.u_gradPow, p.gradPow);
      gl.uniform1f(u.u_glowAmp, p.glowAmp);
      gl.uniform1f(u.u_glowSize, p.glowSize);
      gl.uniform2f(u.u_glowPos, p.glowPosX, p.glowPosY);
      gl.uniform1f(u.u_glowDrift, p.glowDrift);
      // flag
      gl.uniform1f(u.u_flag, p.flag ? 1 : 0);
      gl.uniform3fv(u.u_stripe0, c.stripe0);
      gl.uniform3fv(u.u_stripe1, c.stripe1);
      gl.uniform3fv(u.u_stripe2, c.stripe2);
      gl.uniform1f(u.u_warp, p.warp);
      gl.uniform1f(u.u_shadeDepth, p.shadeDepth);
      gl.uniform1f(u.u_sheenAmt, p.sheenAmt);
      gl.uniform1f(u.u_roll, p.roll);
      gl.uniform1f(u.u_colorSoft, p.colorSoft);
      gl.uniform1f(u.u_colorWarp, p.colorWarp);
      gl.uniform1f(u.u_gradSpace, p.gradSpace);
      gl.uniform1f(u.u_chromaBoost, p.chromaBoost);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    start() {
      if (this._running) return;
      this._running = true; this._frozenTime = null;
      const t0 = performance.now();
      const loop = () => { if (!this._running) return; this._draw((performance.now() - t0) / 1000); this._raf = requestAnimationFrame(loop); };
      this._raf = requestAnimationFrame(loop);
    }
    stop() { this._running = false; if (this._raf) cancelAnimationFrame(this._raf); }
    renderAt(timeSeconds) { this.stop(); this._frozenTime = timeSeconds; this._draw(timeSeconds); }
  }

  FlagFabric.PRESETS = PRESETS;
  FlagFabric.DEFAULTS = DEFAULTS;
  FlagFabric.SCHEMA = SCHEMA;

  // ---- reusable tuning panel ------------------------------------------------
  // Builds a self-contained, SCHEMA-driven control panel (presets + sliders +
  // colour pickers + copy-params) wired to a FlagFabric instance. Self-styling,
  // so it drops onto any page (the harness and the lyrics overlay both use it).
  FlagFabric.mountPanel = function (fab, opts) {
    opts = opts || {};
    const doc = document;
    if (!doc.getElementById("ff-panel-style")) {
      const st = doc.createElement("style");
      st.id = "ff-panel-style";
      st.textContent =
        ".ff-panel{position:fixed;top:12px;right:12px;width:250px;max-height:calc(100% - 24px);overflow-y:auto;" +
        "padding:10px 12px 14px;z-index:2147483000;background:rgba(18,18,20,.86);backdrop-filter:blur(12px);" +
        "border:1px solid rgba(255,255,255,.14);border-radius:12px;font:11px/1.4 ui-monospace,Menlo,monospace;" +
        "color:#e8e8ea;-webkit-user-select:none;user-select:none}" +
        ".ff-panel h1{font-size:11px;margin:0 0 8px;letter-spacing:.05em;text-transform:uppercase;opacity:.7}" +
        ".ff-presets{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px}" +
        ".ff-panel button{flex:1;min-width:54px;padding:5px 6px;cursor:pointer;color:#e8e8ea;" +
        "background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);border-radius:7px;font:inherit}" +
        ".ff-panel button:hover{background:rgba(255,255,255,.18)}" +
        ".ff-grp{margin:10px 0 3px;font-size:9px;letter-spacing:.08em;text-transform:uppercase;opacity:.5}" +
        ".ff-row{display:grid;grid-template-columns:78px 1fr 38px;align-items:center;gap:7px;margin:4px 0}" +
        ".ff-row input[type=range]{width:100%}" +
        ".ff-row input[type=color]{width:100%;height:20px;padding:0;border:0;background:none;grid-column:2/span 2}" +
        ".ff-val{text-align:right;opacity:.65;font-variant-numeric:tabular-nums}" +
        ".ff-actions{display:flex;gap:5px;margin-top:10px}";
      doc.head.appendChild(st);
    }
    const inputs = {};
    const kv = (k, v) => { const o = {}; o[k] = v; return o; };
    function sync() {
      for (const it of SCHEMA) {
        if (it.group || !inputs[it.key]) continue;
        const el = inputs[it.key], v = fab.params[it.key];
        if (it.type === "bool") el.checked = !!v;
        else { el.value = v; if (el.nextSibling && el.nextSibling.className === "ff-val") el.nextSibling.textContent = (+v).toFixed(2); }
      }
    }
    const panel = doc.createElement("div");
    panel.className = "ff-panel";
    const h1 = doc.createElement("h1"); h1.textContent = opts.title || "Flag Fabric"; panel.appendChild(h1);
    const pres = doc.createElement("div"); pres.className = "ff-presets";
    for (const name of Object.keys(PRESETS)) {
      const b = doc.createElement("button"); b.textContent = name;
      b.onclick = () => { fab.setParams(Object.assign({}, PRESETS[name])); sync(); applyMode(); };
      pres.appendChild(b);
    }
    panel.appendChild(pres);
    // Track which mode each control belongs to so the panel can hide the
    // irrelevant half (flag controls vs background-glow controls).
    const sections = { flag: [], bg: [], shared: [] };
    let section = "shared";
    for (const it of SCHEMA) {
      if (it.group) {
        section = /Background/.test(it.group) ? "bg" : /Flag/.test(it.group) ? "flag" : "shared";
        const g = doc.createElement("div"); g.className = "ff-grp"; g.textContent = it.group;
        panel.appendChild(g);
        sections[section === "flag" ? "shared" : section].push(g); // keep Flag header (labels the mode toggle)
        continue;
      }
      const row = doc.createElement("div"); row.className = "ff-row";
      const lab = doc.createElement("label"); lab.textContent = it.label; row.appendChild(lab);
      const v = fab.params[it.key];
      if (it.type === "color") {
        const i = doc.createElement("input"); i.type = "color"; i.value = v;
        i.oninput = () => fab.setParams(kv(it.key, i.value)); row.appendChild(i); inputs[it.key] = i;
      } else if (it.type === "bool") {
        const i = doc.createElement("input"); i.type = "checkbox"; i.checked = !!v;
        i.onchange = () => fab.setParams(kv(it.key, i.checked)); row.appendChild(i); row.appendChild(doc.createElement("span")); inputs[it.key] = i;
      } else {
        const i = doc.createElement("input"); i.type = "range"; i.min = it.min; i.max = it.max; i.step = it.step; i.value = v;
        const out = doc.createElement("span"); out.className = "ff-val"; out.textContent = (+v).toFixed(2);
        i.oninput = () => { fab.setParams(kv(it.key, +i.value)); out.textContent = (+i.value).toFixed(2); };
        row.appendChild(i); row.appendChild(out); inputs[it.key] = i;
      }
      panel.appendChild(row);
      sections[it.key === "flag" ? "shared" : section].push(row); // flag-mode toggle stays visible in both modes
    }
    function applyMode() {
      const isFlag = !!fab.params.flag;
      sections.flag.forEach((el) => { el.style.display = isFlag ? "" : "none"; });
      sections.bg.forEach((el) => { el.style.display = isFlag ? "none" : ""; });
    }
    panel.addEventListener("input", applyMode);
    panel.addEventListener("change", applyMode);
    applyMode();
    // Optional page-specific controls (e.g. the lyrics overlay's wash). Each is
    // { group } or { label, min, max, step, get(), set(v) } — wired to the
    // page's own state rather than to fab.params.
    if (opts.extras) {
      for (const it of opts.extras) {
        if (it.group) { const g = doc.createElement("div"); g.className = "ff-grp"; g.textContent = it.group; panel.appendChild(g); continue; }
        const row = doc.createElement("div"); row.className = "ff-row";
        const lab = doc.createElement("label"); lab.textContent = it.label; row.appendChild(lab);
        const i = doc.createElement("input"); i.type = "range"; i.min = it.min; i.max = it.max; i.step = it.step; i.value = it.get();
        const out = doc.createElement("span"); out.className = "ff-val"; out.textContent = (+i.value).toFixed(2);
        i.oninput = () => { it.set(+i.value); out.textContent = (+i.value).toFixed(2); };
        row.appendChild(i); row.appendChild(out); panel.appendChild(row);
      }
    }
    const act = doc.createElement("div"); act.className = "ff-actions";
    const copy = doc.createElement("button"); copy.textContent = "Copy params";
    copy.onclick = () => { const j = JSON.stringify(fab.params, null, 2); if (navigator.clipboard) navigator.clipboard.writeText(j).catch(() => {}); console.log(j); };
    const hide = doc.createElement("button"); hide.textContent = "Hide";
    hide.onclick = () => { panel.style.display = "none"; };
    act.appendChild(copy); act.appendChild(hide); panel.appendChild(act);
    (opts.host || doc.body).appendChild(panel);
    return panel;
  };

  global.FlagFabric = FlagFabric;
})(typeof window !== "undefined" ? window : this);
