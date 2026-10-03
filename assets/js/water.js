/* ============================================================================
   HERO WATER - Three.js

   What this is for, in one sentence: the property's whole identity is that it
   sits on the Upper Lake, so the hero photograph is shown the way you would
   see the building from the water, with the ripple increasing toward the
   bottom of the frame.

   What this is NOT: decoration. If it cannot run, the <img> underneath is the
   hero and the page is complete without it. The canvas starts at opacity 0 and
   is only faded in once a frame has actually been drawn.
   ========================================================================= */

const canvas = document.getElementById("heroCanvas");
const image  = document.getElementById("heroImage");

if (canvas && image) init();

async function init() {
  // Guard 1: the visitor asked for less motion. A moving water surface is
  // exactly what that setting is about, so we never start.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  // Guard 2: no WebGL, no canvas. Cheap to test, so test before the import.
  const probe = document.createElement("canvas");
  const hasWebGL = !!(probe.getContext("webgl2") || probe.getContext("webgl"));
  if (!hasWebGL) return;

  // Guard 3: a phone on a slow connection should spend its bytes on the
  // photograph, not on a shader drawn over it.
  const conn = navigator.connection;
  if (conn && (conn.saveData || /2g/.test(conn.effectiveType || ""))) return;

  let THREE;
  try {
    THREE = await import("https://unpkg.com/three@0.160.0/build/three.module.js");
  } catch {
    return; // CDN blocked. The photograph is already on screen.
  }

  // The texture is the same file the <img> already decoded, so this costs no
  // extra download.
  const texture = await new Promise((resolve) => {
    const loader = new THREE.TextureLoader();
    loader.load(image.currentSrc || image.src, resolve, undefined, () => resolve(null));
  });
  if (!texture) return;

  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));

  const scene  = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const uniforms = {
    uTexture:  { value: texture },
    uTime:     { value: 0 },
    uCover:    { value: new THREE.Vector2(1, 1) },
    uStrength: { value: 0 },   // eased up from 0 on first frame, so it arrives
  };                           // rather than snapping on

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision mediump float;

      uniform sampler2D uTexture;
      uniform float uTime;
      uniform vec2  uCover;
      uniform float uStrength;
      varying vec2  vUv;

      // Cheap value noise. Two octaves is enough for water at this scale and
      // it keeps the fragment cost low enough for mid-range Android.
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }

      void main() {
        // Reproduce object-fit: cover, so the canvas frames the photograph
        // exactly as the <img> beneath it does.
        vec2 uv = (vUv - 0.5) * uCover + 0.5;

        // Ripple weight rises toward the bottom of the frame. The sky stays
        // still; the water does the moving.
        float depth = pow(1.0 - uv.y, 2.2);

        float n1 = noise(vec2(uv.x * 9.0, uv.y * 24.0 - uTime * 0.42));
        float n2 = noise(vec2(uv.x * 17.0 + 4.0, uv.y * 38.0 - uTime * 0.68));
        float wave = (n1 - 0.5) * 0.65 + (n2 - 0.5) * 0.35;

        vec2 offset = vec2(wave * 0.020, wave * 0.012) * depth * uStrength;

        // Sample the colour channels a hair apart. Water splits light, and at
        // this amount it reads as refraction rather than as a broken image.
        float r = texture2D(uTexture, uv + offset * 1.06).r;
        float g = texture2D(uTexture, uv + offset).g;
        float b = texture2D(uTexture, uv + offset * 0.94).b;
        vec3 col = vec3(r, g, b);

        // A slow sheen travelling across the ripple, so the surface catches
        // light the way the lake does at dusk.
        float sheen = smoothstep(0.35, 1.0, wave + 0.5) * depth * 0.07 * uStrength;
        col += sheen;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);

    // cover maths: shrink the UV range on the axis that has slack
    const img = texture.image;
    const texAspect = img.width / img.height;
    const boxAspect = w / h;
    if (boxAspect > texAspect) {
      uniforms.uCover.value.set(1, texAspect / boxAspect);
    } else {
      uniforms.uCover.value.set(boxAspect / texAspect, 1);
    }
  }

  // Stop drawing the moment the hero leaves the viewport. There is no reason
  // to run a shader behind six sections of text.
  let visible = true;
  new IntersectionObserver(
    ([entry]) => { visible = entry.isIntersecting; },
    { threshold: 0 }
  ).observe(canvas);

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  let raf = 0;
  const started = performance.now();
  let revealed = false;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!visible) return;

    const elapsed = (now - started) / 1000;
    uniforms.uTime.value = elapsed;

    // Ease the effect in over the first second and a half.
    uniforms.uStrength.value = Math.min(elapsed / 1.5, 1);

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
      texture.dispose();
    });
}
