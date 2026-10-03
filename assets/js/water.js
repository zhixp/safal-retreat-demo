/* ============================================================================
   HERO WATER - Three.js

   A slow refraction over the hero photograph, heaviest toward the bottom of
   the frame, as though the building were being seen across moving water.
   The property sits on the Upper Lake, which is the whole reason it exists.

   It also owns the crossfade between slides. One layer doing both is
   deliberate: a CSS crossfade underneath an opaque canvas would be invisible,
   and two layers each trying to dissolve the same photograph fight.

   None of this is the content. The <img> elements underneath are, and they
   carry their own CSS crossfade. The canvas starts at opacity 0 and is only
   faded in after a frame has actually been drawn, so if WebGL is missing, the
   CDN is blocked, the connection is metered or reduced motion is on, the page
   is complete and correct without it.
   ========================================================================= */

const canvas = document.getElementById("heroCanvas");
const slides = [...document.querySelectorAll(".hero__slide")];

if (canvas && slides.length) init();

async function init() {
  // Guard 1: the visitor asked for less motion. A moving surface is exactly
  // what that setting is about.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  // Guard 2: no WebGL, no canvas. Cheap to test, so test before the import.
  const probe = document.createElement("canvas");
  if (!(probe.getContext("webgl2") || probe.getContext("webgl"))) return;

  // Guard 3: a phone on a metered connection should spend its bytes on the
  // photograph, not on a shader drawn over it.
  const conn = navigator.connection;
  if (conn && (conn.saveData || /2g/.test(conn.effectiveType || ""))) return;

  let THREE;
  try {
    THREE = await import("https://unpkg.com/three@0.160.0/build/three.module.js");
  } catch {
    return; // CDN blocked. The photograph is already on screen.
  }

  const loader = new THREE.TextureLoader();
  const cache = new Map();

  // Textures come from the same files the <img> elements already decoded, so
  // this costs no extra download.
  const textureFor = (slide) => {
    const img = slide.querySelector("img");
    const src = img.currentSrc || img.src;
    if (!src || img.dataset.src) return null; // not loaded yet
    if (cache.has(src)) return cache.get(src);
    const tex = loader.load(src);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    cache.set(src, tex);
    return tex;
  };

  const first = textureFor(slides.find((s) => s.classList.contains("is-active")) || slides[0]);
  if (!first) return;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const uniforms = {
    uTexA: { value: first },
    uTexB: { value: first },
    uMix: { value: 0 },
    uTime: { value: 0 },
    uCoverA: { value: new THREE.Vector2(1, 1) },
    uCoverB: { value: new THREE.Vector2(1, 1) },
    uStrength: { value: 0 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      precision mediump float;

      uniform sampler2D uTexA;
      uniform sampler2D uTexB;
      uniform float uMix;
      uniform float uTime;
      uniform vec2  uCoverA;
      uniform vec2  uCoverB;
      uniform float uStrength;
      varying vec2  vUv;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      // Two octaves is enough for water at this scale and keeps the fragment
      // cost low enough for mid range Android.
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }

      // Reproduce object-fit: cover, so the canvas frames each photograph
      // exactly as the <img> beneath it does.
      vec2 cover(vec2 uv, vec2 c) { return (uv - 0.5) * c + 0.5; }

      void main() {
        // Ripple weight rises toward the bottom of the frame. The sky stays
        // still; the water does the moving.
        float depth = pow(1.0 - vUv.y, 2.2);

        float n1 = noise(vec2(vUv.x * 9.0,  vUv.y * 24.0 - uTime * 0.42));
        float n2 = noise(vec2(vUv.x * 17.0 + 4.0, vUv.y * 38.0 - uTime * 0.68));
        float wave = (n1 - 0.5) * 0.65 + (n2 - 0.5) * 0.35;

        // Half the amplitude the lake-only version used. These frames are
        // mostly architecture now, and architecture that ripples reads as a
        // broken image rather than as a reflection.
        vec2 offset = vec2(wave * 0.010, wave * 0.006) * depth * uStrength;

        vec2 uvA = cover(vUv, uCoverA) + offset;
        vec2 uvB = cover(vUv, uCoverB) + offset;

        // Sample the colour channels a hair apart. Water splits light, and at
        // this amount it reads as refraction rather than as a fault.
        vec3 a = vec3(
          texture2D(uTexA, uvA + offset * 0.06).r,
          texture2D(uTexA, uvA).g,
          texture2D(uTexA, uvA - offset * 0.06).b);
        vec3 b = vec3(
          texture2D(uTexB, uvB + offset * 0.06).r,
          texture2D(uTexB, uvB).g,
          texture2D(uTexB, uvB - offset * 0.06).b);

        vec3 col = mix(a, b, smoothstep(0.0, 1.0, uMix));

        // A slow sheen travelling across the ripple, so the surface catches
        // light the way the lake does at dusk.
        col += smoothstep(0.35, 1.0, wave + 0.5) * depth * 0.05 * uStrength;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));

  const coverFor = (tex, target) => {
    const img = tex?.image;
    if (!img || !img.width) return;
    const texAspect = img.width / img.height;
    const boxAspect = canvas.clientWidth / canvas.clientHeight;
    if (boxAspect > texAspect) target.set(1, texAspect / boxAspect);
    else target.set(boxAspect / texAspect, 1);
  };

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    coverFor(uniforms.uTexA.value, uniforms.uCoverA.value);
    coverFor(uniforms.uTexB.value, uniforms.uCoverB.value);
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  /* --- Slide changes --------------------------------------------------
     main.js dispatches hero:slide with the new index. The shader dissolves
     from the frame it is holding to the new one over the same duration the
     CSS crossfade uses, so the two agree if the canvas ever fails mid-life. */

  const FADE = 1.4;
  let fading = null;

  window.addEventListener("hero:slide", (e) => {
    const next = textureFor(slides[e.detail.index]);
    if (!next || next === uniforms.uTexA.value) return;
    uniforms.uTexB.value = next;
    coverFor(next, uniforms.uCoverB.value);
    fading = { from: performance.now(), tex: next };
  });

  // Stop drawing the moment the hero leaves the viewport. There is no reason
  // to run a shader behind six sections of text.
  let visible = true;
  new IntersectionObserver(
    ([entry]) => { visible = entry.isIntersecting; },
    { threshold: 0 }
  ).observe(canvas);

  let raf = 0;
  const started = performance.now();
  let revealed = false;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!visible) return;

    const elapsed = (now - started) / 1000;
    uniforms.uTime.value = elapsed;
    uniforms.uStrength.value = Math.min(elapsed / 1.5, 1);

    if (fading) {
      const t = Math.min((now - fading.from) / (FADE * 1000), 1);
      uniforms.uMix.value = t;
      if (t === 1) {
        // Land on the new frame and reset, so the next change starts clean.
        uniforms.uTexA.value = fading.tex;
        uniforms.uCoverA.value.copy(uniforms.uCoverB.value);
        uniforms.uMix.value = 0;
        fading = null;
      }
    }

    renderer.render(scene, camera);

    if (!revealed) {
      revealed = true;
      canvas.classList.add("is-live");
    }
  }
  raf = requestAnimationFrame(frame);

  // A visitor who turns reduced motion on mid-session should not have to
  // reload to be taken seriously.
  window.matchMedia("(prefers-reduced-motion: reduce)")
    .addEventListener("change", (e) => {
      if (!e.matches) return;
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.classList.remove("is-live");
      renderer.dispose();
      material.dispose();
      cache.forEach((t) => t.dispose());
    });
}
