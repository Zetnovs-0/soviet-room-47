import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildRoom } from './room.js';
import { buildOutside } from './outside.js';
import {
  TIME_ORDER,
  WEATHER_ORDER,
  TIMES,
  WEATHERS,
  buildLook,
  cloneLook,
  mixLook,
  applySkyUniforms,
} from './presets.js';
import * as TX from './textures.js';

/* ------------------------------------------------------------------ */
/*  Комната 47 · сборка сцены, свет, погода и интерфейс                 */
/* ------------------------------------------------------------------ */

const UI_ACCENT = {
  morning: '#e3b080',
  day: '#d7ddd4',
  sunset: '#e98d4f',
  night: '#93abd0',
};

const $ = (selector) => document.querySelector(selector);
const clamp = THREE.MathUtils.clamp;

function boot() {
  const canvas = $('#scene');
  const loader = $('#loader');
  const lede = $('#lede');
  const statusLine = $('#status-line');
  const timeButtons = [...document.querySelectorAll('[data-time]')];
  const weatherButtons = [...document.querySelectorAll('[data-weather]')];
  const lampToggle = $('#lamp-toggle');
  const tvToggle = $('#tv-toggle');
  const aboutDialog = $('#about');
  const aboutToggle = $('#about-toggle');
  const aboutClose = $('#about-close');
  const themeMeta = document.querySelector('meta[name="theme-color"]');

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const compact = () => window.innerWidth <= 900;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      stencil: false,
      powerPreference: 'high-performance',
    });
  } catch (error) {
    fatal(error);
    return;
  }

  renderer.setClearColor(0x0b100d, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  /* ----------------------------- текстуры ----------------------------- */

  const T = {
    wall: TX.wallTexture(),
    ceiling: TX.ceilingTexture(),
    parquet: TX.parquetTexture(),
    rug: TX.rugTexture(),
    woodDark: TX.woodTexture('#4b2d1a', '#241207', '#7d5232', 11),
    woodMid: TX.woodTexture('#6e4527', '#3a200f', '#a06d41', 17),
    woodBeech: TX.woodTexture('#9b6c41', '#603d22', '#c99a68', 23),
    fabricMustard: TX.fabricTexture('#a4803e', 'rgba(70,48,18,.25)', 2),
    fabricCream: TX.fabricTexture('#c9b693', 'rgba(104,86,64,.2)', 5),
    fabricRust: TX.fabricTexture('#8f4b37', 'rgba(62,25,18,.28)', 9),
    fabricShade: TX.fabricTexture('#d9bc8c', 'rgba(112,81,49,.18)', 13),
    pillow: TX.pillowTexture(),
    tablecloth: TX.tableclothTexture(),
    building: TX.buildingTextures(),
    clockFace: TX.clockTexture(),
    landscape: TX.landscapeTexture(),
    stillLife: TX.stillLifeTexture(),
    plate: TX.plateTexture(),
    news: TX.newspaperTexture(),
    glow: TX.glowTexture(),
    shadow: TX.shadowTexture(),
  };

  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  for (const value of Object.values(T)) {
    if (!value) continue;
    if (value.isTexture) {
      value.anisotropy = anisotropy;
    } else if (value.map && value.emissive) {
      value.map.anisotropy = anisotropy;
      value.emissive.anisotropy = anisotropy;
    }
  }

  /* ------------------------------ сцена ------------------------------- */

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0b100d');
  scene.fog = new THREE.FogExp2(0x9a8069, 0.008);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.05, 180);
  camera.position.set(0.78, 1.7, 2.32);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0.02, 1.4, -0.6);
  controls.enableDamping = !reduceMotion;
  controls.dampingFactor = 0.075;
  controls.enablePan = false;
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.7;
  controls.minDistance = 1.15;
  controls.maxDistance = 3.02;
  controls.minPolarAngle = 1.02;
  controls.maxPolarAngle = 1.57;
  controls.update();

  // процедурное окружение для металла и лакированного паркета
  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environmentScene = new RoomEnvironment();
    scene.environment = pmrem.fromScene(environmentScene, 0.04).texture;
    scene.environmentIntensity = 0.26;
    if (typeof environmentScene.dispose === 'function') environmentScene.dispose();
    pmrem.dispose();
  } catch (error) {
    console.warn('Комната 47: окружение недоступно', error);
  }

  /* ------------------------------- свет ------------------------------- */

  const hemi = new THREE.HemisphereLight(0xd1e1ec, 0x5e5542, 0.9);
  scene.add(hemi);

  const ambient = new THREE.AmbientLight(0x918a79, 0.28);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xfff2da, 3.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(compact() ? 1024 : 2048, compact() ? 1024 : 2048);
  sun.shadow.camera.left = -6.2;
  sun.shadow.camera.right = 6.2;
  sun.shadow.camera.top = 6.2;
  sun.shadow.camera.bottom = -6.2;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 64;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.035;
  sun.target.position.set(-0.5, 1.1, -0.9);
  scene.add(sun);
  scene.add(sun.target);

  /* ---------------------------- дом и двор ---------------------------- */

  const room = buildRoom(scene, T);
  const outside = buildOutside(scene, T);

  /* ------------------------- время и погода --------------------------- */

  const params = new URLSearchParams(window.location.search);
  const initialTime = TIME_ORDER.includes(params.get('t')) ? params.get('t') : 'sunset';
  const initialWeather = WEATHER_ORDER.includes(params.get('w')) ? params.get('w') : 'clear';

  const state = {
    time: initialTime,
    weather: initialWeather,
    lamp: params.has('lamp') ? params.get('lamp') !== '0' : ['sunset', 'night'].includes(initialTime),
    tv: params.get('tv') === '1',
  };
  let lampAuto = !params.has('lamp');

  let targetLook = buildLook(state.time, state.weather);
  const look = cloneLook(targetLook);

  let lampLevel = state.lamp ? 1 : 0;
  let lampTarget = lampLevel;
  let tvLevel = state.tv ? 1 : 0;
  let tvTarget = tvLevel;
  let ledeTimer = 0;

  const WHITE = new THREE.Color(0xffffff);
  const SNOW_LEAF = new THREE.Color('#cad6d5');
  const PATH_DRY = new THREE.Color(0x68645a);
  const PATH_WET = new THREE.Color(0x46443f);
  const CURB_DRY = new THREE.Color(0x7c786b);
  const CURB_WET = new THREE.Color(0x55534b);
  const glassTint = new THREE.Color();

  applyLook(look, 0);
  room.setLampLevel(lampLevel);
  syncUI(false);
  updateParticlesScale();

  /* --------------------------- применение ----------------------------- */

  function applyLook(current, time) {
    applySkyUniforms(outside.skyMaterial, current);
    outside.skyMaterial.uniforms.uTime.value = time;

    renderer.toneMappingExposure = current.exposure;
    const daylight = clamp(current.lightIntensity / 3.4, 0, 1);
    scene.environmentIntensity = 0.03 + daylight * 0.16 + current.hemiIntensity * 0.02;

    scene.fog.color.copy(current.fogColor);
    scene.fog.density = current.fogDensity;

    sun.color.copy(current.dirColor);
    sun.intensity = current.lightIntensity;
    sun.position.copy(current.lightPos).normalize().multiplyScalar(22);

    hemi.color.copy(current.hemiSky);
    hemi.groundColor.copy(current.hemiGround);
    hemi.intensity = current.hemiIntensity;

    ambient.color.copy(current.ambientColor);
    ambient.intensity = current.ambientIntensity;

    for (const material of outside.buildingMats) {
      material.emissiveIntensity = 0.02 + current.buildingGlow * 0.78;
    }

    outside.streetLampLight.emissiveIntensity = 0.04 + current.streetGlow * 3.2;
    outside.glowMat.opacity = Math.min(0.95, current.streetGlow * 0.8);
    outside.streetLight.intensity = current.streetGlow * 2.8;
    outside.exteriorAmbient.intensity = 0.12 + current.hemiIntensity * 0.22;
    outside.exteriorAmbient.color.copy(current.hemiSky).lerp(WHITE, 0.25);

    outside.snowMat.opacity = clamp(current.snowGround, 0, 1);

    for (let i = 0; i < outside.leafMats.length; i++) {
      outside.leafMats[i].color.copy(outside.leafBase[i]).lerp(SNOW_LEAF, current.treeSnow * 0.62);
    }

    outside.pathMat.color.copy(PATH_DRY).lerp(PATH_WET, current.wet * 0.75);
    outside.curbMat.color.copy(CURB_DRY).lerp(CURB_WET, current.wet * 0.5);

    outside.rain.material.uniforms.uTime.value = time;
    outside.rain.material.uniforms.uIntensity.value = current.rain;
    outside.snow.material.uniforms.uTime.value = time;
    outside.snow.material.uniforms.uIntensity.value = current.snow;

    const glass = room.glassMaterial.uniforms;
    glass.uTime.value = time;
    glass.uWet.value = current.wet;
    glass.uFrost.value = current.frost;
    glassTint.copy(current.horizon).lerp(WHITE, 0.72);
    glass.uTint.value.copy(glassTint);

    room.setClock(current.clock[0], current.clock[1]);
    room.setSecond(time % 60);
  }

  /* ----------------------------- интерфейс ---------------------------- */

  function syncUI(animateCopy) {
    for (const button of timeButtons) {
      button.setAttribute('aria-pressed', String(button.dataset.time === state.time));
    }
    for (const button of weatherButtons) {
      button.setAttribute('aria-pressed', String(button.dataset.weather === state.weather));
    }
    lampToggle.setAttribute('aria-pressed', String(state.lamp));
    tvToggle.setAttribute('aria-pressed', String(state.tv));

    const time = TIMES[state.time];
    const weather = WEATHERS[state.weather];

    statusLine.textContent = `${time.timeLabel} · ${weather.description}`;
    document.title = `Комната 47 — ${time.label.toLowerCase()} · ${weather.label.toLowerCase()}`;
    document.documentElement.style.setProperty('--accent', UI_ACCENT[state.time]);
    if (themeMeta) themeMeta.setAttribute('content', time.skyHorizon);

    window.clearTimeout(ledeTimer);
    if (!animateCopy || reduceMotion) {
      lede.textContent = time.lede;
      lede.classList.remove('is-fading');
      return;
    }

    lede.classList.add('is-fading');
    ledeTimer = window.setTimeout(() => {
      lede.textContent = time.lede;
      lede.classList.remove('is-fading');
    }, 180);
  }

  function syncUrl() {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('t', state.time);
      url.searchParams.set('w', state.weather);
      if (lampAuto) {
        url.searchParams.delete('lamp');
      } else if (state.lamp) {
        url.searchParams.delete('lamp');
      } else {
        url.searchParams.set('lamp', '0');
      }
      if (state.tv) url.searchParams.set('tv', '1');
      else url.searchParams.delete('tv');
      window.history.replaceState(null, '', url);
    } catch {
      /* локальный файл — адрес просто не обновится */
    }
  }

  function setTime(key) {
    if (!TIME_ORDER.includes(key) || key === state.time) return;
    state.time = key;
    if (lampAuto) {
      state.lamp = key === 'sunset' || key === 'night';
      lampTarget = state.lamp ? 1 : 0;
    }
    targetLook = buildLook(state.time, state.weather);
    syncUI(true);
    syncUrl();
  }

  function setWeather(key) {
    if (!WEATHER_ORDER.includes(key) || key === state.weather) return;
    state.weather = key;
    targetLook = buildLook(state.time, state.weather);
    syncUI(true);
    syncUrl();
  }

  function setLamp(on) {
    lampAuto = false;
    state.lamp = Boolean(on);
    lampTarget = state.lamp ? 1 : 0;
    syncUI(false);
    syncUrl();
  }

  function setTv(on) {
    state.tv = Boolean(on);
    tvTarget = state.tv ? 1 : 0;
    syncUI(false);
    syncUrl();
  }

  for (const button of timeButtons) {
    button.addEventListener('click', () => setTime(button.dataset.time));
  }
  for (const button of weatherButtons) {
    button.addEventListener('click', () => setWeather(button.dataset.weather));
  }
  lampToggle.addEventListener('click', () => setLamp(!state.lamp));
  tvToggle.addEventListener('click', () => setTv(!state.tv));

  aboutToggle.addEventListener('click', () => {
    if (typeof aboutDialog.showModal === 'function') aboutDialog.showModal();
    else aboutDialog.setAttribute('open', '');
  });
  aboutClose.addEventListener('click', () => aboutDialog.close());
  aboutDialog.addEventListener('click', (event) => {
    if (event.target !== aboutDialog) return;
    const rect = aboutDialog.getBoundingClientRect();
    const inside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    if (!inside) aboutDialog.close();
  });

  window.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (aboutDialog.open) return;
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;

    const key = event.key.toLowerCase();
    const timeIndex = ['1', '2', '3', '4'].indexOf(key);
    const weatherIndex = ['q', 'w', 'e', 'r'].indexOf(key);

    if (timeIndex !== -1) {
      event.preventDefault();
      setTime(TIME_ORDER[timeIndex]);
    } else if (weatherIndex !== -1) {
      event.preventDefault();
      setWeather(WEATHER_ORDER[weatherIndex]);
    } else if (key === 'l') {
      event.preventDefault();
      setLamp(!state.lamp);
    } else if (key === 't') {
      event.preventDefault();
      setTv(!state.tv);
    }
  });

  /* ------------------------------ размеры ----------------------------- */

  const CAMERA_BOUNDS = {
    minX: -2.55,
    maxX: 2.32,
    minY: 0.88,
    maxY: 2.6,
    minZ: -2.38,
    maxZ: 2.5,
  };

  function updateParticlesScale() {
    const scale = clamp((window.innerHeight * renderer.getPixelRatio()) / 900, 0.65, 2.4);
    outside.rain.material.uniforms.uScale.value = scale;
    outside.snow.material.uniforms.uScale.value = scale;
    room.dust.material.uniforms.uScale.value = scale;
  }

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / height;

    camera.aspect = aspect;
    camera.fov = aspect < 0.75 ? 82 : aspect < 1.1 ? 72 : 58;
    camera.updateProjectionMatrix();

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact() ? 1.6 : 2));
    renderer.setSize(width, height, false);
    updateParticlesScale();
  }

  window.addEventListener('resize', resize);
  resize();

  function constrainCamera() {
    camera.position.x = clamp(camera.position.x, CAMERA_BOUNDS.minX, CAMERA_BOUNDS.maxX);
    camera.position.y = clamp(camera.position.y, CAMERA_BOUNDS.minY, CAMERA_BOUNDS.maxY);
    camera.position.z = clamp(camera.position.z, CAMERA_BOUNDS.minZ, CAMERA_BOUNDS.maxZ);
  }

  /* ------------------------------- анимация --------------------------- */

  const clock = new THREE.Clock();
  let elapsed = 0;
  let revealed = false;

  function reveal() {
    if (revealed) return;
    revealed = true;
    document.body.classList.add('is-ready');
    window.setTimeout(() => {
      loader.classList.add('is-hidden');
      window.setTimeout(() => loader.remove(), 950);
    }, reduceMotion ? 40 : 300);
  }

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;

    const blend = 1 - Math.exp(-dt * (reduceMotion ? 9 : 1.9));
    mixLook(look, targetLook, blend);
    applyLook(look, elapsed);

    const lampEase = 1 - Math.exp(-dt * 7.5);
    lampLevel += (lampTarget - lampLevel) * lampEase;
    if (Math.abs(lampTarget - lampLevel) < 0.001) lampLevel = lampTarget;
    room.setLampLevel(lampLevel);

    const tvEase = 1 - Math.exp(-dt * 6);
    tvLevel += (tvTarget - tvLevel) * tvEase;
    if (Math.abs(tvTarget - tvLevel) < 0.001) tvLevel = tvTarget;

    room.tvMaterial.uniforms.uTime.value = elapsed;
    room.tvMaterial.uniforms.uOn.value = tvLevel;
    const tvFlicker =
      0.78 + 0.14 * Math.sin(elapsed * 13.7) + 0.08 * Math.sin(elapsed * 47.3 + 1.7);
    room.tvLight.intensity = room.tvLight.userData.baseIntensity * tvLevel * tvFlicker;

    const dust = room.dust.material.uniforms;
    dust.uTime.value = elapsed;
    dust.uOpacity.value = 0.05 + lampLevel * 0.11 + clamp(1 - look.cloud, 0, 1) * 0.05;

    controls.update();
    constrainCamera();

    renderer.render(scene, camera);
    reveal();

    window.requestAnimationFrame(frame);
  }

  renderer.render(scene, camera);
  reveal();
  window.requestAnimationFrame(frame);

  if (params.has('debug')) {
    window.__room47 = { THREE, scene, camera, renderer, controls, room, outside, state };
  }

  function fatal(error) {
    console.error('Комната 47:', error);
    if (!loader) return;
    loader.classList.add('is-error');
    const title = loader.querySelector('.loader-title');
    const sub = loader.querySelector('.loader-sub');
    const line = loader.querySelector('.loader-line');
    if (title) title.textContent = 'Сцена недоступна';
    if (sub) sub.textContent = 'нужен браузер с поддержкой WebGL 2';
    if (line) line.style.display = 'none';
  }
}

try {
  boot();
} catch (error) {
  console.error('Комната 47:', error);
  const loader = document.querySelector('#loader');
  if (loader) {
    loader.classList.add('is-error');
    const title = loader.querySelector('.loader-title');
    const sub = loader.querySelector('.loader-sub');
    const line = loader.querySelector('.loader-line');
    if (title) title.textContent = 'Сцена недоступна';
    if (sub) sub.textContent = 'не удалось собрать комнату — нужен WebGL 2';
    if (line) line.style.display = 'none';
  }
}
