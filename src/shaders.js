import * as THREE from 'three';

/* ------------------------------------------------------------------ */
/*  Небольшие авторские шейдеры: небо, осадки, стекло и пыль          */
/* ------------------------------------------------------------------ */

const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const skyFragment = /* glsl */ `
  precision highp float;
  varying vec3 vDir;

  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uBottom;
  uniform vec3 uSunColor;
  uniform vec3 uMoonColor;
  uniform vec3 uCloudColor;
  uniform vec3 uSunDir;
  uniform vec3 uMoonDir;
  uniform float uTime;
  uniform float uCloud;
  uniform float uStars;
  uniform float uMoon;
  uniform float uSunGlow;
  uniform float uCloudSpeed;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p = rot * p * 2.03;
      a *= 0.52;
    }
    return v;
  }

  void main() {
    vec3 dir = normalize(vDir);
    float y = dir.y;
    float up = clamp(y, 0.0, 1.0);

    vec3 col = mix(uHorizon, uTop, pow(up, 0.58));
    col = mix(col, uBottom, smoothstep(0.04, -0.35, y));

    // солнечный диск и мягкое свечение
    float sd = max(dot(dir, normalize(uSunDir)), 0.0);
    float disc = smoothstep(0.99962, 0.99986, sd);
    float glow = pow(sd, 18.0) * 0.16 + pow(sd, 180.0) * 0.22;
    col += uSunColor * (disc * 2.6 + glow) * uSunGlow;

    // луна
    float md = max(dot(dir, normalize(uMoonDir)), 0.0);
    float moonDisc = smoothstep(0.99952, 0.99980, md);
    float moonHalo = pow(md, 60.0) * 0.1;
    col += uMoonColor * (moonDisc * 1.8 + moonHalo) * uMoon;

    // звёзды по сферическим координатам
    vec3 ad = abs(dir);
    vec2 suv;
    if (ad.y > max(ad.x, ad.z)) suv = dir.xz / max(ad.y, 0.001);
    else if (ad.x > ad.z) suv = dir.zy / max(ad.x, 0.001);
    else suv = dir.xy / max(ad.z, 0.001);
    vec2 starCell = floor(suv * 340.0);
    float sh = hash21(starCell);
    float star = smoothstep(0.9979, 1.0, sh);
    star *= smoothstep(0.02, 0.16, y);
    star *= 0.55 + 0.45 * sin(uTime * 1.7 + sh * 83.0);
    col += vec3(0.75, 0.84, 1.0) * star * uStars * (1.0 - uCloud * 0.85);

    // облака
    float az = atan(dir.z, dir.x) / 6.2831853 + 0.5;
    float el = asin(clamp(dir.y, -1.0, 1.0)) / 3.1415926 + 0.5;
    vec2 cuv = vec2(az * 4.0, el * 5.6);
    vec2 drift = vec2(uTime * 0.004 * uCloudSpeed, uTime * 0.0008 * uCloudSpeed);
    float n1 = fbm(cuv * 2.3 + drift);
    float n2 = fbm(cuv * 5.1 - drift * 1.7 + 17.0);
    float clouds = smoothstep(0.52 - uCloud * 0.32, 0.78, n1 + n2 * 0.32);
    clouds *= smoothstep(-0.02, 0.13, y);
    clouds *= mix(0.25, 1.0, smoothstep(0.0, 0.5, uCloud));
    vec3 cloudLit = uCloudColor * (0.78 + 0.32 * pow(sd, 3.0));
    col = mix(col, cloudLit, clouds * clamp(uCloud * 1.15 + 0.08, 0.0, 1.0));

    // лёгкая дымка у горизонта
    col = mix(col, uHorizon * 1.04, smoothstep(0.14, 0.0, y) * 0.5);

    // дизеринг от бандинга
    col += (hash21(gl_FragCoord.xy) - 0.5) * 0.006;
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createSkyMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: skyVertex,
    fragmentShader: skyFragment,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: new THREE.Color('#34536f') },
      uHorizon: { value: new THREE.Color('#c9a37d') },
      uBottom: { value: new THREE.Color('#5b4c40') },
      uSunColor: { value: new THREE.Color('#ffd2a0') },
      uMoonColor: { value: new THREE.Color('#b9cbff') },
      uCloudColor: { value: new THREE.Color('#8f8a80') },
      uSunDir: { value: new THREE.Vector3(-0.5, 0.35, -0.8) },
      uMoonDir: { value: new THREE.Vector3(-0.45, 0.55, -0.7) },
      uTime: { value: 0 },
      uCloud: { value: 0.1 },
      uStars: { value: 0 },
      uMoon: { value: 0 },
      uSunGlow: { value: 1 },
      uCloudSpeed: { value: 1 },
    },
  });
}

/* ----------------------------- осадки ------------------------------ */

const precipVertex = /* glsl */ `
  precision highp float;
  attribute float aSeed;
  attribute float aSpeed;
  uniform float uTime;
  uniform float uIntensity;
  uniform float uSize;
  uniform float uSpeed;
  uniform float uWind;
  uniform float uScale;
  uniform float uYMin;
  uniform float uYMax;
  varying float vSeed;
  varying float vIntensity;

  void main() {
    vec3 p = position;
    float range = uYMax - uYMin;
    float fall = uTime * uSpeed * aSpeed;
    p.y = mod(p.y - fall - uYMin, range) + uYMin;
    p.x += uWind * (p.y - uYMin) * 0.55;
    p.x += sin(uTime * 0.55 + aSeed * 31.0) * 0.22 * step(1.8, uSpeed);
    p.z += cos(uTime * 0.33 + aSeed * 17.0) * 0.12 * step(1.8, uSpeed);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(uSize * uScale * (120.0 / max(0.4, -mv.z)), 1.0, 28.0);
    vSeed = aSeed;
    vIntensity = uIntensity;
  }
`;

const rainFragment = /* glsl */ `
  precision highp float;
  varying float vSeed;
  varying float vIntensity;
  uniform vec3 uColor;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float line = smoothstep(0.14, 0.0, abs(c.x)) * smoothstep(0.5, 0.0, abs(c.y));
    float head = smoothstep(0.18, 0.0, length((c - vec2(0.0, 0.36)) * vec2(2.4, 1.4)));
    float a = (line * 0.62 + head * 0.5) * vIntensity;
    if (a < 0.008) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

const snowFragment = /* glsl */ `
  precision highp float;
  varying float vSeed;
  varying float vIntensity;
  uniform vec3 uColor;
  void main() {
    vec2 c = (gl_PointCoord - 0.5) * 2.0;
    float d = length(c);
    float flake = smoothstep(1.0, 0.15, d);
    flake += smoothstep(0.07, 0.0, abs(c.x)) * smoothstep(0.55, 0.0, abs(c.y)) * 0.3;
    flake += smoothstep(0.07, 0.0, abs(c.y)) * smoothstep(0.55, 0.0, abs(c.x)) * 0.3;
    float a = flake * (0.55 + 0.45 * fract(vSeed * 7.31)) * vIntensity;
    if (a < 0.006) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

const precipRange = { yMin: -3.4, yMax: 9.0 };

export function createPrecipitation({ count = 2200, type = 'rain' } = {}) {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const speeds = new Float32Array(count);
  const rnd = mulberry(9917 + (type === 'snow' ? 13 : 3));
  for (let i = 0; i < count; i++) {
    positions[i * 3] = 3.2 + rnd() * 16.5;
    positions[i * 3 + 1] = precipRange.yMin + rnd() * (precipRange.yMax - precipRange.yMin);
    positions[i * 3 + 2] = -13 + rnd() * 26;
    seeds[i] = rnd();
    speeds[i] = 0.7 + rnd() * 0.65;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));

  const isSnow = type === 'snow';
  const material = new THREE.ShaderMaterial({
    vertexShader: precipVertex,
    fragmentShader: isSnow ? snowFragment : rainFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 0 },
      uSize: { value: isSnow ? 0.6 : 0.72 },
      uSpeed: { value: isSnow ? 0.75 : 9.0 },
      uWind: { value: isSnow ? -0.11 : -0.045 },
      uScale: { value: 1 },
      uYMin: { value: precipRange.yMin },
      uYMax: { value: precipRange.yMax },
      uColor: { value: new THREE.Color(isSnow ? '#eef5ff' : '#b9cee2') },
    },
  });
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  points.renderOrder = 2;
  points.userData.type = type;
  points.userData.isPrecipitation = true;
  return points;
}

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* --------------------------- стекло окна --------------------------- */

const glassFragment = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uWet;
  uniform float uFrost;
  uniform vec3 uTint;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i), b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p *= 2.08;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    vec3 col = uTint;
    float alpha = 0.022;

    // лёгкие разводы на стекле
    float smudge = smoothstep(0.45, 0.8, fbm(uv * vec2(7.0, 10.0) + uTime * 0.005));
    alpha += smudge * 0.018;

    // капли дождя, ползущие вниз
    vec2 grid = vec2(26.0, 36.0);
    vec2 gv = uv * grid;
    vec2 id = floor(gv);
    vec2 f = fract(gv);
    float h = hash21(id);
    float dropActive = step(0.70, h);
    float speed = 0.04 + 0.13 * fract(h * 17.3);
    float y = fract(f.y + uTime * speed + h * 8.0);
    float cx = 0.5 + (fract(h * 5.71) - 0.5) * 0.6;
    vec2 center = vec2(cx, y);
    float drop = smoothstep(0.15, 0.0, length((f - center) * vec2(1.0, 1.1))) * dropActive;
    float tail = smoothstep(0.022, 0.0, abs(f.x - cx)) * smoothstep(0.0, 0.45, y) * dropActive * 0.35;
    drop *= smoothstep(0.0, 0.08, y) * smoothstep(1.0, 0.88, y);
    alpha += (drop * 0.55 + tail * 0.16) * uWet;
    col += vec3(0.16, 0.22, 0.26) * drop * uWet;

    // морозный узор у краёв
    float edge = smoothstep(0.42, 0.06, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
    float frostNoise = fbm(uv * vec2(22.0, 16.0) + 3.0);
    float frost = smoothstep(0.42, 0.74, frostNoise) * (0.18 + edge * 1.15);
    alpha += frost * uFrost * 0.6;
    col = mix(col, vec3(0.94, 0.97, 1.0), clamp(frost * uFrost, 0.0, 1.0) * 0.8);

    // тонкие блики
    float sheen = smoothstep(0.55, 0.0, abs(uv.x - uv.y * 0.55 - 0.2));
    alpha += sheen * 0.012;

    alpha = clamp(alpha, 0.0, 0.82);
    gl_FragColor = vec4(col, alpha);
  }
`;

export function createWindowGlassMaterial() {
  const material = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: glassFragment,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uWet: { value: 0 },
      uFrost: { value: 0 },
      uTint: { value: new THREE.Color('#cfe0e8') },
    },
  });
  return material;
}

/* ------------------------------- пыль ------------------------------ */

const dustVertex = /* glsl */ `
  precision highp float;
  attribute float aSeed;
  uniform float uTime;
  uniform float uScale;
  uniform float uOpacity;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    p.x += sin(uTime * 0.075 + aSeed * 33.0) * 0.24;
    p.y += sin(uTime * 0.05 + aSeed * 19.0) * 0.12;
    p.z += cos(uTime * 0.06 + aSeed * 23.0) * 0.2;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float size = mix(0.7, 3.2, fract(aSeed * 9.17));
    gl_PointSize = clamp(size * uScale * (90.0 / max(0.4, -mv.z)), 1.0, 10.0);
    vAlpha = uOpacity * (0.45 + 0.55 * fract(aSeed * 5.31));
  }
`;
const dustFragment = /* glsl */ `
  precision highp float;
  varying float vAlpha;
  uniform vec3 uColor;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float a = smoothstep(0.5, 0.05, length(c)) * vAlpha;
    if (a < 0.005) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

export function createDust({ count = 240 } = {}) {
  const pos = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  let r = 7431;
  const rand = () => {
    r = (r * 16807) % 2147483647;
    return r / 2147483647;
  };
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (rand() - 0.5) * 3.9;
    pos[i * 3 + 1] = 0.2 + rand() * 2.45;
    pos[i * 3 + 2] = -2.15 + rand() * 4.3;
    seeds[i] = rand();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  const mat = new THREE.ShaderMaterial({
    vertexShader: dustVertex,
    fragmentShader: dustFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uScale: { value: 1 },
      uOpacity: { value: 0.35 },
      uColor: { value: new THREE.Color('#ffe0ad') },
    },
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 5;
  return points;
}
