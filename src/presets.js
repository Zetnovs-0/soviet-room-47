import * as THREE from 'three';

/* ------------------------------------------------------------------ */
/*  Время суток × погода. Всё сводится в один набор параметров сцены  */
/* ------------------------------------------------------------------ */

export const TIME_ORDER = ['morning', 'day', 'sunset', 'night'];
export const WEATHER_ORDER = ['clear', 'cloudy', 'rain', 'snow'];

export const TIMES = {
  morning: {
    label: 'Утро',
    timeLabel: '08:10',
    clock: [8, 10],
    lede: 'Раннее утро. Светло-изумрудные обои ловят мягкий свет, а за окном желтеют деревья.',
    skyTop: '#7697b2',
    skyHorizon: '#e9c7a1',
    skyBottom: '#9a8069',
    overcast: '#a9ada8',
    cloudColor: '#d8c2ab',
    sunColor: '#ffc38a',
    sunPos: [10.5, 3.0, 4.4],
    sunIntensity: 2.45,
    sunGlow: 1.0,
    moon: 0,
    moonPos: [9.0, 6.4, 3.0],
    hemiSky: '#b9c8cf',
    hemiGround: '#524939',
    hemiIntensity: 0.62,
    ambient: '#847b6a',
    ambientIntensity: 0.24,
    exposure: 1.08,
    stars: 0,
    windowGlow: 0.18,
    streetGlow: 0.12,
    buildingGlow: 0.22,
    fog: 0.0085,
  },
  day: {
    label: 'День',
    timeLabel: '13:20',
    clock: [13, 20],
    lede: 'Полдень. Осеннее солнце простреливает комнату, и линолеум становится медовым.',
    skyTop: '#6f9ec5',
    skyHorizon: '#d5e1e4',
    skyBottom: '#929286',
    overcast: '#b7bcba',
    cloudColor: '#e9e6dc',
    sunColor: '#fff2da',
    sunPos: [9.4, 4.6, 1.8],
    sunIntensity: 4.0,
    sunGlow: 1.1,
    moon: 0,
    moonPos: [8.0, 7.1, 1.0],
    hemiSky: '#d1e1ec',
    hemiGround: '#5e5542',
    hemiIntensity: 1.35,
    ambient: '#918a79',
    ambientIntensity: 0.36,
    exposure: 1.0,
    stars: 0,
    windowGlow: 0.06,
    streetGlow: 0.0,
    buildingGlow: 0.05,
    fog: 0.0065,
  },
  sunset: {
    label: 'Закат',
    timeLabel: '19:40',
    clock: [19, 40],
    lede: 'Закат. Жёлтые деревья за окном светятся, а зелёный потолок темнеет.',
    skyTop: '#4b587c',
    skyHorizon: '#ff9f60',
    skyBottom: '#72584f',
    overcast: '#8e7f79',
    cloudColor: '#a98273',
    sunColor: '#ff9b58',
    sunPos: [8.2, 2.5, -3.4],
    sunIntensity: 2.75,
    sunGlow: 1.35,
    moon: 0,
    moonPos: [7.7, 6.2, -2.0],
    hemiSky: '#c3a795',
    hemiGround: '#4d3a34',
    hemiIntensity: 0.55,
    ambient: '#7d6255',
    ambientIntensity: 0.21,
    exposure: 1.13,
    stars: 0.12,
    windowGlow: 0.6,
    streetGlow: 0.55,
    buildingGlow: 0.8,
    fog: 0.008,
  },
  night: {
    label: 'Ночь',
    timeLabel: '23:15',
    clock: [23, 15],
    lede: 'Поздний вечер. Люстра-НЛО рисует тёплые круги, а за окном горят окна девятиэтажки.',
    skyTop: '#070f1a',
    skyHorizon: '#172333',
    skyBottom: '#090d13',
    overcast: '#10161d',
    cloudColor: '#20242b',
    sunColor: '#ffb869',
    sunPos: [9.0, -4.0, -1.0],
    sunIntensity: 0,
    sunGlow: 0.03,
    moon: 1,
    moonPos: [8.5, 6.8, 0.5],
    hemiSky: '#334568',
    hemiGround: '#131922',
    hemiIntensity: 0.25,
    ambient: '#1d2837',
    ambientIntensity: 0.13,
    exposure: 1.16,
    stars: 1,
    windowGlow: 1,
    streetGlow: 1,
    buildingGlow: 2.1,
    fog: 0.0105,
  },
};

export const WEATHERS = {
  clear: {
    label: 'Ясно',
    icon: 'clear',
    overcast: 0.06,
    cloud: 0.08,
    cloudSpeed: 0.55,
    skyDark: 1,
    sunMul: 1,
    hemiMul: 1,
    ambientMul: 0.95,
    exposureMul: 1,
    rain: 0,
    snow: 0,
    wet: 0,
    frost: 0,
    starsMul: 1,
    windowMul: 0.9,
    streetMul: 0.9,
    buildingMul: 0.85,
    fogMul: 0.95,
    snowGround: 0,
    treeSnow: 0,
    description: 'ясно',
  },
  cloudy: {
    label: 'Облачно',
    icon: 'cloudy',
    overcast: 0.72,
    cloud: 0.78,
    cloudSpeed: 1.1,
    skyDark: 0.92,
    sunMul: 0.32,
    hemiMul: 1.12,
    ambientMul: 1.22,
    exposureMul: 0.97,
    rain: 0,
    snow: 0,
    wet: 0,
    frost: 0,
    starsMul: 0.05,
    windowMul: 1.15,
    streetMul: 1,
    buildingMul: 1.1,
    fogMul: 1.2,
    snowGround: 0,
    treeSnow: 0,
    description: 'облачно',
  },
  rain: {
    label: 'Дождь',
    icon: 'rain',
    overcast: 0.9,
    cloud: 0.96,
    cloudSpeed: 2.2,
    skyDark: 0.68,
    sunMul: 0.13,
    hemiMul: 0.92,
    ambientMul: 1.02,
    exposureMul: 0.9,
    rain: 1,
    snow: 0,
    wet: 1,
    frost: 0,
    starsMul: 0,
    windowMul: 1.35,
    streetMul: 1.15,
    buildingMul: 1.25,
    fogMul: 1.55,
    snowGround: 0,
    treeSnow: 0,
    description: 'дождь',
  },
  snow: {
    label: 'Снег',
    icon: 'snow',
    overcast: 0.74,
    cloud: 0.83,
    cloudSpeed: 1.35,
    skyDark: 0.98,
    sunMul: 0.3,
    hemiMul: 1.45,
    ambientMul: 1.45,
    exposureMul: 1.03,
    rain: 0,
    snow: 1,
    wet: 0,
    frost: 1,
    starsMul: 0,
    windowMul: 1.25,
    streetMul: 1.1,
    buildingMul: 1.15,
    fogMul: 1.35,
    snowGround: 0.95,
    treeSnow: 1,
    description: 'снег',
  },
};

export function buildLook(timeKey, weatherKey) {
  const t = TIMES[timeKey];
  const w = WEATHERS[weatherKey];
  const isNight = timeKey === 'night';

  const overcast = new THREE.Color(t.overcast);
  const top = new THREE.Color(t.skyTop).lerp(overcast, w.overcast * 0.72);
  const horizon = new THREE.Color(t.skyHorizon).lerp(overcast, w.overcast * 0.52);
  const bottom = new THREE.Color(t.skyBottom).lerp(overcast, w.overcast * 0.62);
  const brightness = w.skyDark;
  top.multiplyScalar(brightness * (isNight ? 1 : 1.02));
  horizon.multiplyScalar(brightness);
  bottom.multiplyScalar(brightness);

  const cloudColor = new THREE.Color(t.cloudColor).lerp(overcast, w.overcast * 0.48);
  cloudColor.multiplyScalar(w.skyDark);

  const sunColor = new THREE.Color(t.sunColor);
  const sunPos = new THREE.Vector3(...t.sunPos);
  const moonPos = new THREE.Vector3(...t.moonPos);
  const sunDir = sunPos.clone().normalize();
  const moonDir = moonPos.clone().normalize();

  const lightPos = isNight ? moonPos : sunPos;
  const lightColor = isNight ? new THREE.Color('#a8c2ff') : sunColor.clone();
  const lightIntensity = isNight ? 0.5 * (0.35 + (1 - w.overcast) * 0.65) : t.sunIntensity * w.sunMul;
  const dirColor = lightColor;

  const hemiSky = new THREE.Color(t.hemiSky).lerp(overcast, w.overcast * 0.42);
  const hemiGround = new THREE.Color(t.hemiGround);
  const ambient = new THREE.Color(t.ambient).lerp(overcast, w.overcast * 0.35);

  const fogColor = new THREE.Color(t.skyHorizon).lerp(overcast, w.overcast * 0.62).multiplyScalar(w.skyDark * 0.9);

  const buildingGlow = t.buildingGlow * w.buildingMul;
  const streetGlow = t.streetGlow * w.streetMul;
  const windowGlow = THREE.MathUtils.clamp(t.windowGlow * w.windowMul, 0, 1);

  const sunGlow = t.sunGlow * (isNight ? 1 : 0.6 + w.sunMul * 0.6);

  return {
    top,
    horizon,
    bottom,
    cloudColor,
    sunColor,
    moonColor: new THREE.Color('#b9ccff'),
    sunDir,
    moonDir,
    lightPos,
    dirColor,
    lightIntensity,
    hemiSky,
    hemiGround,
    hemiIntensity: t.hemiIntensity * w.hemiMul,
    ambientColor: ambient,
    ambientIntensity: t.ambientIntensity * w.ambientMul,
    exposure: t.exposure * w.exposureMul,
    sunGlow,
    stars: t.stars * w.starsMul * (1 - w.cloud * 0.85),
    moon: isNight ? 1 : 0,
    cloud: w.cloud,
    cloudSpeed: w.cloudSpeed,
    fogColor,
    fogDensity: t.fog * w.fogMul,
    rain: w.rain,
    snow: w.snow,
    wet: w.wet,
    frost: w.frost,
    buildingGlow,
    streetGlow,
    windowGlow,
    snowGround: w.snowGround,
    treeSnow: w.treeSnow,
    clock: t.clock,
    timeLabel: t.timeLabel,
    timeName: t.label,
    weatherName: w.label,
    lede: t.lede,
    status: `${t.timeLabel} · ${w.description}`,
  };
}

export function mixLook(current, target, alpha) {
  // числа
  for (const key of [
    'lightIntensity', 'hemiIntensity', 'ambientIntensity', 'exposure', 'sunGlow', 'stars', 'moon',
    'cloud', 'cloudSpeed', 'fogDensity', 'rain', 'snow', 'wet', 'frost', 'buildingGlow',
    'streetGlow', 'windowGlow', 'snowGround', 'treeSnow',
  ]) {
    current[key] = THREE.MathUtils.lerp(current[key] ?? target[key], target[key], alpha);
  }
  // цвета
  for (const key of ['top', 'horizon', 'bottom', 'cloudColor', 'sunColor', 'moonColor', 'dirColor', 'hemiSky', 'hemiGround', 'ambientColor', 'fogColor']) {
    current[key].lerp(target[key], alpha);
  }
  // направления и позиция
  current.sunDir.lerp(target.sunDir, alpha).normalize();
  current.moonDir.lerp(target.moonDir, alpha).normalize();
  current.lightPos.lerp(target.lightPos, alpha);
  current.clock = current.clock ?? [...target.clock];
  for (let i = 0; i < 2; i++) current.clock[i] = THREE.MathUtils.lerp(current.clock[i], target.clock[i], alpha);
  current.timeLabel = target.timeLabel;
  current.timeName = target.timeName;
  current.weatherName = target.weatherName;
  current.lede = target.lede;
  current.status = target.status;
  return current;
}

export function cloneLook(look) {
  const copy = { ...look };
  for (const key of ['top', 'horizon', 'bottom', 'cloudColor', 'sunColor', 'moonColor', 'dirColor', 'hemiSky', 'hemiGround', 'ambientColor', 'fogColor']) {
    copy[key] = look[key].clone();
  }
  copy.sunDir = look.sunDir.clone();
  copy.moonDir = look.moonDir.clone();
  copy.lightPos = look.lightPos.clone();
  copy.clock = [...look.clock];
  return copy;
}

export function applySkyUniforms(mat, look) {
  const u = mat.uniforms;
  u.uTop.value.copy(look.top);
  u.uHorizon.value.copy(look.horizon);
  u.uBottom.value.copy(look.bottom);
  u.uCloudColor.value.copy(look.cloudColor);
  u.uSunColor.value.copy(look.sunColor);
  u.uMoonColor.value.copy(look.moonColor);
  u.uSunDir.value.copy(look.sunDir);
  u.uMoonDir.value.copy(look.moonDir);
  u.uCloud.value = look.cloud;
  u.uCloudSpeed.value = look.cloudSpeed;
  u.uSunGlow.value = look.sunGlow;
  u.uStars.value = look.stars;
  u.uMoon.value = look.moon;
}
