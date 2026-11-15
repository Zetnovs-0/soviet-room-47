import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createWindowGlassMaterial, createDust, createTvMaterial } from './shaders.js';

export const ROOM = {
  w: 6.2,
  d: 5.4,
  h: 2.85,
  back: -2.7,
  front: 2.7,
  left: -3.1,
  right: 3.1,
  window: { x0: -1.9, x1: 0.1, y0: 0.9, y1: 2.5, cx: -0.9, cy: 1.7 },
};

const V = THREE.Vector3;

function mat(opts) {
  return new THREE.MeshStandardMaterial(opts);
}

function mesh(geo, material, cast = true, receive = true, name = '') {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = cast;
  m.receiveShadow = receive;
  if (name) m.name = name;
  return m;
}

function box(w, h, d, material, cast = true, receive = true) {
  return mesh(new THREE.BoxGeometry(w, h, d), material, cast, receive);
}

function cylinder(rTop, rBottom, h, material, seg = 20, cast = true) {
  return mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg), material, cast, true);
}

function rod(a, b, radius, material, rTop = radius, rBottom = radius, radial = 8) {
  const dir = new V().subVectors(b, a);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(rTop, rBottom, len, radial);
  const m = mesh(g, material, true, true);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new V(0, 1, 0), dir.normalize());
  return m;
}

function makeClockDialTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  x.clearRect(0, 0, 256, 256);
  x.fillStyle = '#1c1a16';
  x.beginPath();
  x.arc(128, 128, 120, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = '#d8d2bd';
  x.beginPath();
  x.arc(128, 128, 93, 0, Math.PI * 2);
  x.fill();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const px = 128 + Math.cos(a) * 67;
    const py = 128 + Math.sin(a) * 67;
    x.fillStyle = '#20201c';
    x.beginPath();
    x.arc(px, py, 13, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = '#d8d2bd';
    x.beginPath();
    x.arc(px, py, 8, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = '#24221d';
    x.font = '600 13px Arial';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(String((i + 1) % 10), px, py + 0.5);
  }
  x.fillStyle = '#292620';
  x.beginPath();
  x.arc(128, 128, 22, 0, Math.PI * 2);
  x.fill();
  x.strokeStyle = '#a19b88';
  x.lineWidth = 3;
  x.beginPath();
  x.arc(128, 128, 100, 0, Math.PI * 2);
  x.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function makeWavyCurtain(width, height, folds, amp, flare = 0) {
  const segX = 52;
  const segY = 12;
  const geo = new THREE.PlaneGeometry(width, height, segX, segY);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const u = x / width + 0.5;
    const v = y / height + 0.5;
    const fold = Math.sin(u * Math.PI * folds * 2.0) * amp;
    const drape = Math.sin(v * Math.PI * 1.05) * amp * 0.35;
    pos.setZ(i, fold + drape);
    const spread = 1 + flare * (1 - v) * (u - 0.5);
    pos.setX(i, x * spread);
  }
  geo.computeVertexNormals();
  return geo;
}

function leafGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.045, 0.03, 0.058, 0.11, 0.02, 0.21);
  shape.bezierCurveTo(0.012, 0.24, 0.004, 0.25, 0, 0.26);
  shape.bezierCurveTo(-0.004, 0.25, -0.012, 0.24, -0.02, 0.21);
  shape.bezierCurveTo(-0.058, 0.11, -0.045, 0.03, 0, 0);
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.006, bevelEnabled: false, steps: 1 });
  g.center();
  return g;
}

export function buildRoom(scene, T) {
  const group = new THREE.Group();
  group.name = 'room';
  scene.add(group);

  const lampMaterials = [];
  const lampLights = [];
  const lampGlowMaterials = [];
  const lampSprites = [];

  const registerLamp = (material, base) => {
    material.userData.lampBase = base;
    lampMaterials.push(material);
    return material;
  };

  /* --------------------------- материалы --------------------------- */

  const wallMap = T.wall;
  wallMap.repeat.set(1.8, 1.35);
  const wallMat = mat({
    map: wallMap,
    bumpMap: wallMap,
    bumpScale: 0.008,
    color: 0xffffff,
    roughness: 0.84,
    metalness: 0,
    envMapIntensity: 0.28,
  });

  const ceilingMat = mat({ map: T.ceiling, color: 0xf2ecde, roughness: 0.92, envMapIntensity: 0.15 });
  const creamPaint = mat({ color: 0xded6c3, roughness: 0.62, metalness: 0.02, envMapIntensity: 0.4 });
  const warmWhitePaint = mat({ color: 0xe8e1d0, roughness: 0.56, metalness: 0.02, envMapIntensity: 0.4 });
  const floorMat = new THREE.MeshPhysicalMaterial({
    map: T.parquet,
    roughness: 0.43,
    metalness: 0,
    clearcoat: 0.22,
    clearcoatRoughness: 0.38,
    envMapIntensity: 0.7,
  });

  const rugMat = mat({ map: T.rug, roughness: 0.97, metalness: 0, bumpMap: T.rug, bumpScale: 0.018 });
  const woodDarkMat = mat({ map: T.woodDark, roughness: 0.56, metalness: 0.02, envMapIntensity: 0.5 });
  const woodMidMat = mat({ map: T.woodMid, roughness: 0.52, metalness: 0.03, envMapIntensity: 0.5 });
  const woodBeechMat = mat({ map: T.woodBeech, roughness: 0.5, metalness: 0.02, envMapIntensity: 0.55 });
  const woodTrimMat = mat({ color: 0x4b2e1c, roughness: 0.55, envMapIntensity: 0.4 });

  const brassMat = mat({ color: 0xb38a4c, roughness: 0.29, metalness: 0.92, envMapIntensity: 1.25 });
  const darkBrassMat = mat({ color: 0x7c6135, roughness: 0.38, metalness: 0.85, envMapIntensity: 1.1 });
  const chromeMat = mat({ color: 0xc5c9c6, roughness: 0.2, metalness: 1, envMapIntensity: 1.2 });
  const blackMat = mat({ color: 0x15130f, roughness: 0.48, metalness: 0.08 });
  const darkPlasticMat = mat({ color: 0x25221c, roughness: 0.66, metalness: 0.05 });
  const porcelainMat = new THREE.MeshPhysicalMaterial({
    color: 0xf2efe4,
    roughness: 0.19,
    metalness: 0,
    clearcoat: 0.65,
    clearcoatRoughness: 0.16,
    envMapIntensity: 0.9,
  });
  const cobaltMat = mat({ color: 0x2b527f, roughness: 0.24, metalness: 0.05, envMapIntensity: 0.7 });
  const terracottaMat = mat({ color: 0x9b5438, roughness: 0.82, metalness: 0 });
  const leafMat = mat({ color: 0x365233, roughness: 0.78, metalness: 0, side: THREE.DoubleSide });
  const leafLightMat = mat({ color: 0x4e6d3c, roughness: 0.78, metalness: 0, side: THREE.DoubleSide });
  const stemMat = mat({ color: 0x4d5b31, roughness: 0.85 });
  const paperMat = mat({ color: 0xe1d7bf, roughness: 0.92, metalness: 0 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xf4f0dc,
    roughness: 0.06,
    metalness: 0,
    transmission: 0.55,
    thickness: 0.06,
    transparent: true,
    opacity: 0.62,
    envMapIntensity: 1.5,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  registerLamp(glassMat, 0.22);
  glassMat.emissive = new THREE.Color(0xffd39a);
  glassMat.emissiveIntensity = 0.22;

  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xfff0cf,
    emissive: new THREE.Color(0xffbd70),
    emissiveIntensity: 6,
    roughness: 0.3,
    toneMapped: false,
  });
  registerLamp(bulbMat, 6);

  const fabricSofa = new THREE.MeshPhysicalMaterial({
    map: T.fabricMustard,
    roughness: 0.92,
    metalness: 0,
    sheen: 0.5,
    sheenRoughness: 0.72,
    sheenColor: new THREE.Color(0xc59d68),
    envMapIntensity: 0.18,
  });
  const fabricCream = new THREE.MeshPhysicalMaterial({
    map: T.fabricCream,
    roughness: 0.94,
    metalness: 0,
    sheen: 0.35,
    sheenRoughness: 0.8,
    sheenColor: new THREE.Color(0xf1e3c9),
    envMapIntensity: 0.14,
  });
  const curtainMat = new THREE.MeshPhysicalMaterial({
    map: T.fabricRust,
    roughness: 0.94,
    metalness: 0,
    side: THREE.DoubleSide,
    sheen: 0.6,
    sheenRoughness: 0.7,
    sheenColor: new THREE.Color(0xce9270),
    envMapIntensity: 0.18,
  });
  const tulleMat = new THREE.MeshPhysicalMaterial({
    color: 0xf5f1e6,
    transparent: true,
    opacity: 0.25,
    roughness: 0.9,
    metalness: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
    envMapIntensity: 0.2,
  });
  const shadeMat = mat({
    map: T.fabricShade,
    color: 0xffe6c0,
    roughness: 0.86,
    metalness: 0,
    side: THREE.DoubleSide,
    emissive: new THREE.Color(0xffb86b),
    emissiveIntensity: 0.55,
    envMapIntensity: 0.2,
  });
  registerLamp(shadeMat, 0.55);

  const rugWallMat = mat({ map: T.rug, roughness: 0.98, metalness: 0, side: THREE.DoubleSide });
  const porcelainBlue = mat({ map: T.plate, roughness: 0.3, metalness: 0.02, side: THREE.DoubleSide });

  /* ----------------------------- стены ----------------------------- */

  const backZ = ROOM.back - 0.06;
  const wallDepth = 0.12;
  const win = ROOM.window;

  const backLeft = box(win.x0 - ROOM.left, ROOM.h, wallDepth, wallMat);
  backLeft.position.set((ROOM.left + win.x0) / 2, ROOM.h / 2, backZ);
  group.add(backLeft);

  const backRight = box(ROOM.right - win.x1, ROOM.h, wallDepth, wallMat);
  backRight.position.set((win.x1 + ROOM.right) / 2, ROOM.h / 2, backZ);
  group.add(backRight);

  const backTop = box(win.x1 - win.x0, ROOM.h - win.y1, wallDepth, wallMat);
  backTop.position.set(win.cx, (win.y1 + ROOM.h) / 2, backZ);
  group.add(backTop);

  const backBottom = box(win.x1 - win.x0, win.y0, wallDepth, wallMat);
  backBottom.position.set(win.cx, win.y0 / 2, backZ);
  group.add(backBottom);

  const leftWall = box(0.12, ROOM.h, ROOM.d + 0.12, wallMat);
  leftWall.position.set(ROOM.left - 0.06, ROOM.h / 2, 0);
  group.add(leftWall);

  const rightWall = box(0.12, ROOM.h, ROOM.d + 0.12, wallMat);
  rightWall.position.set(ROOM.right + 0.06, ROOM.h / 2, 0);
  group.add(rightWall);

  const frontWall = box(ROOM.w, ROOM.h, 0.12, wallMat);
  frontWall.position.set(0, ROOM.h / 2, ROOM.front + 0.06);
  group.add(frontWall);

  const floor = mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), floorMat, false, true, 'floor');
  floor.rotation.x = -Math.PI / 2;
  group.add(floor);

  const ceiling = mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), ceilingMat, false, true);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = ROOM.h;
  group.add(ceiling);

  // плинтусы и карнизы
  const baseH = 0.14;
  const baseD = 0.045;
  const addBase = (w, d, x, z, rotY = 0) => {
    const b = box(w, baseH, d, creamPaint, false, true);
    b.position.set(x, baseH / 2, z);
    b.rotation.y = rotY;
    group.add(b);
  };
  addBase(ROOM.w, baseD, 0, ROOM.back + baseD / 2);
  addBase(ROOM.w, baseD, 0, ROOM.front - baseD / 2);
  addBase(ROOM.d, baseD, ROOM.left + baseD / 2, 0, Math.PI / 2);
  addBase(ROOM.d, baseD, ROOM.right - baseD / 2, 0, Math.PI / 2);

  const crownH = 0.075;
  const addCrown = (w, d, x, z, rotY = 0) => {
    const b = box(w, crownH, d, creamPaint, false, true);
    b.position.set(x, ROOM.h - crownH / 2, z);
    b.rotation.y = rotY;
    group.add(b);
  };
  addCrown(ROOM.w, 0.05, 0, ROOM.back + 0.025);
  addCrown(ROOM.w, 0.05, 0, ROOM.front - 0.025);
  addCrown(ROOM.d, 0.05, ROOM.left + 0.025, 0, Math.PI / 2);
  addCrown(ROOM.d, 0.05, ROOM.right - 0.025, 0, Math.PI / 2);

  /* ------------------------- потолочная розетка -------------------- */

  const medallion = cylinder(0.31, 0.33, 0.025, creamPaint, 48, false);
  medallion.position.set(0, ROOM.h - 0.013, 0.0);
  group.add(medallion);
  const medRing = mesh(new THREE.TorusGeometry(0.25, 0.014, 8, 48), creamPaint, false, true);
  medRing.rotation.x = Math.PI / 2;
  medRing.position.set(0, ROOM.h - 0.029, 0);
  group.add(medRing);

  /* ----------------------------- окно ------------------------------ */

  const windowGroup = new THREE.Group();
  group.add(windowGroup);

  // откосы
  const revealMat = warmWhitePaint;
  const jambL = box(0.07, win.y1 - win.y0, 0.2, revealMat);
  jambL.position.set(win.x0 + 0.035, win.cy, ROOM.back + 0.015);
  windowGroup.add(jambL);
  const jambR = box(0.07, win.y1 - win.y0, 0.2, revealMat);
  jambR.position.set(win.x1 - 0.035, win.cy, ROOM.back + 0.015);
  windowGroup.add(jambR);
  const jambTop = box(win.x1 - win.x0, 0.07, 0.2, revealMat);
  jambTop.position.set(win.cx, win.y1 - 0.035, ROOM.back + 0.015);
  windowGroup.add(jambTop);
  const jambBottom = box(win.x1 - win.x0, 0.07, 0.2, revealMat);
  jambBottom.position.set(win.cx, win.y0 + 0.035, ROOM.back + 0.015);
  windowGroup.add(jambBottom);

  // рамы
  const frameMat = warmWhitePaint;
  const frameZ = ROOM.back + 0.035;
  const sideW = 0.075;
  const addFrame = (w, h, x, y) => {
    const m = box(w, h, 0.065, frameMat);
    m.position.set(x, y, frameZ);
    windowGroup.add(m);
  };
  addFrame(sideW, win.y1 - win.y0, win.x0 + sideW / 2, win.cy);
  addFrame(sideW, win.y1 - win.y0, win.x1 - sideW / 2, win.cy);
  addFrame(win.x1 - win.x0, sideW, win.cx, win.y1 - sideW / 2);
  addFrame(win.x1 - win.x0, sideW, win.cx, win.y0 + sideW / 2);
  addFrame(0.065, win.y1 - win.y0, win.cx, win.cy);
  addFrame(win.x1 - win.x0, 0.055, win.cx, 2.04);
  // горизонтальный импост по центру створок
  addFrame(win.x1 - win.x0, 0.05, win.cx, 1.48);

  // ручки
  for (const x of [win.cx - 0.11, win.cx + 0.11]) {
    const handle = box(0.018, 0.075, 0.035, brassMat, false, true);
    handle.position.set(x, 1.49, frameZ + 0.05);
    windowGroup.add(handle);
    const hb = cylinder(0.012, 0.012, 0.04, brassMat, 8, false);
    hb.rotation.z = Math.PI / 2;
    hb.position.set(x, 1.49, frameZ + 0.03);
    windowGroup.add(hb);
  }

  // подоконник
  const sill = box(win.x1 - win.x0 + 0.32, 0.06, 0.34, creamPaint);
  sill.position.set(win.cx, win.y0 - 0.01, ROOM.back + 0.16);
  windowGroup.add(sill);
  const sillEdge = box(win.x1 - win.x0 + 0.35, 0.035, 0.045, woodDarkMat);
  sillEdge.position.set(win.cx, win.y0 - 0.025, ROOM.back + 0.335);
  windowGroup.add(sillEdge);

  // стекло (шейдер капель и инея)
  const glassMaterial = createWindowGlassMaterial();
  const windowGlass = mesh(new THREE.PlaneGeometry(win.x1 - win.x0 - 0.1, win.y1 - win.y0 - 0.1), glassMaterial, false, false);
  windowGlass.position.set(win.cx, win.cy, ROOM.back + 0.055);
  windowGlass.renderOrder = 4;
  windowGroup.add(windowGlass);

  // тюль
  const tulleGeo = makeWavyCurtain(2.14, 1.78, 10, 0.032, 0.08);
  const tulle = mesh(tulleGeo, tulleMat, false, false);
  tulle.position.set(win.cx, win.cy + 0.02, ROOM.back + 0.2);
  tulle.renderOrder = 3;
  windowGroup.add(tulle);

  // тяжёлые шторы
  const curtainLGeo = makeWavyCurtain(0.56, 2.12, 6, 0.052, 0.35);
  const curtainL = mesh(curtainLGeo, curtainMat, true, true);
  curtainL.position.set(win.x0 - 0.12, 1.62, ROOM.back + 0.22);
  windowGroup.add(curtainL);
  const curtainRGeo = makeWavyCurtain(0.56, 2.12, 6, 0.052, 0.35);
  const curtainR = mesh(curtainRGeo, curtainMat, true, true);
  curtainR.position.set(win.x1 + 0.12, 1.62, ROOM.back + 0.22);
  windowGroup.add(curtainR);

  // карниз с кольцами
  const rodMesh = cylinder(0.016, 0.016, 2.85, brassMat, 12, false);
  rodMesh.rotation.z = Math.PI / 2;
  rodMesh.position.set(win.cx, 2.68, ROOM.back + 0.22);
  windowGroup.add(rodMesh);
  for (const ex of [-1.48, 1.48]) {
    const finial = mesh(new THREE.SphereGeometry(0.042, 16, 12), brassMat, false, true);
    finial.position.set(win.cx + ex, 2.68, ROOM.back + 0.22);
    windowGroup.add(finial);
  }
  for (let i = 0; i < 21; i++) {
    const ring = mesh(new THREE.TorusGeometry(0.031, 0.0055, 6, 14), darkBrassMat, false, true);
    ring.position.set(win.cx - 1.35 + i * 0.135, 2.675, ROOM.back + 0.22);
    windowGroup.add(ring);
  }

  // радиатор
  const radiator = new THREE.Group();
  radiator.position.set(win.cx, 0, ROOM.back + 0.18);
  group.add(radiator);
  const radiatorMat = mat({ color: 0xd8d1bf, roughness: 0.42, metalness: 0.16, envMapIntensity: 0.6 });
  const capGeo = new THREE.CapsuleGeometry(0.052, 0.28, 4, 10);
  for (let i = 0; i < 13; i++) {
    const cap = mesh(capGeo, radiatorMat, true, true);
    cap.position.set(-0.78 + i * 0.13, 0.43, 0);
    radiator.add(cap);
  }
  for (const y of [0.27, 0.59]) {
    const pipe = cylinder(0.019, 0.019, 1.64, radiatorMat, 10, true);
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(0, y, 0.02);
    radiator.add(pipe);
  }
  const valve = cylinder(0.03, 0.03, 0.06, brassMat, 10, true);
  valve.rotation.z = Math.PI / 2;
  valve.position.set(0.86, 0.27, 0.03);
  radiator.add(valve);

  /* --------------------- тюль и герань на окне --------------------- */

  const potGroup = new THREE.Group();
  potGroup.position.set(win.x0 + 0.28, win.y0 + 0.02, ROOM.back + 0.18);
  group.add(potGroup);
  const saucer = cylinder(0.115, 0.105, 0.022, terracottaMat, 20, true);
  saucer.position.y = 0.011;
  potGroup.add(saucer);
  const pot = cylinder(0.095, 0.075, 0.145, terracottaMat, 20, true);
  pot.position.y = 0.09;
  potGroup.add(pot);
  const soil = cylinder(0.086, 0.086, 0.012, mat({ color: 0x2d2014, roughness: 1 }), 18, false);
  soil.position.y = 0.161;
  potGroup.add(soil);
  const geranium = new THREE.Group();
  geranium.position.y = 0.16;
  potGroup.add(geranium);
  const gerSeed = 41;
  let gerR = gerSeed;
  const grnd = () => {
    gerR = (gerR * 16807) % 2147483647;
    return gerR / 2147483647;
  };
  for (let i = 0; i < 10; i++) {
    const a = grnd() * Math.PI * 2;
    const rad = 0.03 + grnd() * 0.1;
    const h = 0.12 + grnd() * 0.18;
    const stem = rod(
      new V(0, 0, 0),
      new V(Math.cos(a) * rad * 0.55, h, Math.sin(a) * rad * 0.55),
      0.006,
      stemMat,
      0.004,
      0.006,
      5
    );
    geranium.add(stem);
    const leaf = mesh(new THREE.SphereGeometry(0.055, 10, 6), grnd() > 0.5 ? leafMat : leafLightMat, true, true);
    leaf.scale.set(1, 0.45, 0.9);
    leaf.position.set(Math.cos(a) * rad, h, Math.sin(a) * rad);
    leaf.rotation.set(0.3, a, 0.25);
    geranium.add(leaf);
    if (i % 2 === 0) {
      const flower = mesh(new THREE.SphereGeometry(0.035, 8, 6), mat({ color: 0xa34031, roughness: 0.7 }), true, true);
      flower.position.set(Math.cos(a) * rad * 1.05, h + 0.1, Math.sin(a) * rad * 1.05);
      flower.scale.y = 0.7;
      geranium.add(flower);
    }
  }

  // фикус в углу
  const ficus = new THREE.Group();
  ficus.position.set(-2.66, 0, -2.2);
  group.add(ficus);
  const ficusPot = cylinder(0.17, 0.13, 0.28, mat({ color: 0x7c5a3d, roughness: 0.8 }), 20, true);
  ficusPot.position.y = 0.14;
  ficus.add(ficusPot);
  const ficusSoil = cylinder(0.155, 0.155, 0.01, mat({ color: 0x281c11, roughness: 1 }), 18, false);
  ficusSoil.position.y = 0.285;
  ficus.add(ficusSoil);
  const ficusTrunk = rod(new V(0, 0.28, 0), new V(0.04, 1.15, -0.02), 0.028, woodDarkMat, 0.02, 0.035, 7);
  ficus.add(ficusTrunk);
  let fr = 99;
  const frand = () => {
    fr = (fr * 48271) % 2147483647;
    return fr / 2147483647;
  };
  for (let i = 0; i < 28; i++) {
    const a = frand() * Math.PI * 2;
    const rad = 0.12 + frand() * 0.42;
    const h = 0.95 + frand() * 0.75;
    const branch = rod(
      new V(0.02, h - frand() * 0.18, 0),
      new V(Math.cos(a) * rad, h + 0.04, Math.sin(a) * rad),
      0.008,
      woodDarkMat,
      0.004,
      0.008,
      5
    );
    ficus.add(branch);
    const leaf = mesh(new THREE.SphereGeometry(0.11, 10, 7), i % 3 === 0 ? leafLightMat : leafMat, true, true);
    leaf.scale.set(0.85, 0.26, 0.46);
    leaf.position.set(Math.cos(a) * rad, h + 0.04, Math.sin(a) * rad);
    leaf.rotation.set(0.2, -a, 0.25 + frand() * 0.35);
    ficus.add(leaf);
  }

  /* --------------------------- пол и ковёр ------------------------- */

  const rugBase = mesh(new THREE.PlaneGeometry(3.25, 2.2), rugMat, false, true);
  rugBase.rotation.x = -Math.PI / 2;
  rugBase.position.set(0.18, 0.007, 0.14);
  group.add(rugBase);

  const fringeMat = mat({ color: 0xd3c29f, roughness: 0.95 });
  const fringeGeo = new THREE.BoxGeometry(0.012, 0.003, 0.105);
  const fringe = new THREE.InstancedMesh(fringeGeo, fringeMat, 82);
  let fi = 0;
  const dummy = new THREE.Object3D();
  for (const zEnd of [-0.97, 1.25]) {
    for (let i = 0; i < 41; i++) {
      dummy.position.set(-1.38 + i * 0.077, 0.007, zEnd);
      dummy.rotation.y = 0;
      dummy.updateMatrix();
      fringe.setMatrixAt(fi++, dummy.matrix);
    }
  }
  fringe.instanceMatrix.needsUpdate = true;
  fringe.castShadow = false;
  fringe.receiveShadow = true;
  group.add(fringe);

  /* ----------------------------- диван ----------------------------- */

  const sofa = new THREE.Group();
  sofa.position.set(-2.54, 0, 0.0);
  group.add(sofa);
  const sofaBase = box(0.78, 0.26, 2.28, fabricSofa);
  sofaBase.position.set(0, 0.27, 0);
  sofa.add(sofaBase);
  const sofaBack = box(0.2, 0.7, 2.28, fabricSofa);
  sofaBack.position.set(-0.33, 0.7, 0);
  sofa.add(sofaBack);
  for (const z of [-0.54, 0.54]) {
    const seat = mesh(new RoundedBoxGeometry(0.66, 0.17, 1.04, 2, 0.06), fabricSofa);
    seat.position.set(0.04, 0.485, z);
    sofa.add(seat);
    const backCushion = mesh(new RoundedBoxGeometry(0.18, 0.52, 1.02, 2, 0.055), fabricSofa);
    backCushion.position.set(-0.205, 0.75, z);
    backCushion.rotation.z = -0.08;
    sofa.add(backCushion);
  }
  for (const z of [-1.19, 1.19]) {
    const sidePanel = box(0.78, 0.27, 0.16, fabricSofa);
    sidePanel.position.set(0, 0.34, z);
    sofa.add(sidePanel);
    const arm = mesh(new RoundedBoxGeometry(0.8, 0.1, 0.15, 2, 0.035), woodMidMat);
    arm.position.set(0.01, 0.79, z);
    sofa.add(arm);
    sofa.add(rod(new V(0.29, 0.31, z), new V(0.29, 0.75, z), 0.022, woodMidMat, 0.018, 0.028, 8));
    sofa.add(rod(new V(-0.29, 0.31, z), new V(-0.29, 0.75, z), 0.022, woodMidMat, 0.018, 0.028, 8));
  }
  for (const x of [-0.28, 0.28]) {
    for (const z of [-1.02, 1.02]) {
      const leg = cylinder(0.026, 0.033, 0.14, woodTrimMat, 10, true);
      leg.position.set(x, 0.07, z);
      sofa.add(leg);
    }
  }
  const pillowTex1 = new THREE.MeshPhysicalMaterial({ map: T.pillow, roughness: 0.9, metalness: 0, sheen: 0.25 });
  const pillow1 = mesh(new RoundedBoxGeometry(0.46, 0.46, 0.14, 3, 0.09), pillowTex1);
  pillow1.position.set(-0.13, 0.75, -0.66);
  pillow1.rotation.set(0.02, -0.18, -0.1);
  sofa.add(pillow1);
  const pillow2 = mesh(new RoundedBoxGeometry(0.42, 0.42, 0.14, 3, 0.08), fabricCream);
  pillow2.position.set(-0.1, 0.73, 0.75);
  pillow2.rotation.set(0.04, 0.16, 0.12);
  sofa.add(pillow2);

  // ковёр на стене за диваном
  const wallCarpet = mesh(new THREE.PlaneGeometry(2.4, 1.56), rugWallMat, false, true);
  wallCarpet.rotation.y = Math.PI / 2;
  wallCarpet.position.set(ROOM.left + 0.015, 1.94, 0.0);
  group.add(wallCarpet);
  const carpetRod = cylinder(0.012, 0.012, 2.5, darkBrassMat, 8, false);
  carpetRod.rotation.x = Math.PI / 2;
  carpetRod.position.set(ROOM.left + 0.035, 2.73, 0);
  group.add(carpetRod);

  /* ------------------------- торшер у дивана ----------------------- */

  const floorLamp = new THREE.Group();
  floorLamp.position.set(-2.64, 0, 1.72);
  group.add(floorLamp);
  const flBase = cylinder(0.19, 0.22, 0.045, darkBrassMat, 24, true);
  flBase.position.y = 0.025;
  floorLamp.add(flBase);
  const flStem = cylinder(0.014, 0.014, 1.28, brassMat, 12, true);
  flStem.position.y = 0.68;
  floorLamp.add(flStem);
  const flKnuckle = mesh(new THREE.SphereGeometry(0.035, 14, 10), brassMat, false, true);
  flKnuckle.position.y = 1.31;
  floorLamp.add(flKnuckle);
  const flShadeGeo = new THREE.CylinderGeometry(0.15, 0.285, 0.36, 32, 1, true);
  const flShade = mesh(flShadeGeo, shadeMat, true, true);
  flShade.position.y = 1.48;
  floorLamp.add(flShade);
  const flShadeTop = mesh(new THREE.TorusGeometry(0.15, 0.008, 6, 28), brassMat, false, true);
  flShadeTop.rotation.x = Math.PI / 2;
  flShadeTop.position.y = 1.66;
  floorLamp.add(flShadeTop);
  const flShadeBottom = mesh(new THREE.TorusGeometry(0.285, 0.009, 6, 32), brassMat, false, true);
  flShadeBottom.rotation.x = Math.PI / 2;
  flShadeBottom.position.y = 1.3;
  floorLamp.add(flShadeBottom);
  const flBulb = mesh(new THREE.SphereGeometry(0.045, 12, 10), bulbMat, false, false);
  flBulb.position.y = 1.45;
  floorLamp.add(flBulb);
  const floorLampLight = new THREE.PointLight(0xffb872, 5.0, 4.0, 2.0);
  floorLampLight.position.set(0, 1.45, 0);
  floorLampLight.userData.baseIntensity = 5.0;
  floorLamp.add(floorLampLight);
  lampLights.push(floorLampLight);
  const flSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: T.glow,
      color: 0xffbe7d,
      transparent: true,
      opacity: 0.38,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    })
  );
  flSprite.scale.set(0.85, 0.85, 1);
  flSprite.position.y = 1.46;
  flSprite.material.userData.baseOpacity = flSprite.material.opacity;
  floorLamp.add(flSprite);
  lampGlowMaterials.push(flSprite.material);
  lampSprites.push(flSprite);

  /* ---------------------------- стол и стулья --------------------- */

  const table = new THREE.Group();
  table.position.set(0.24, 0, 0.13);
  group.add(table);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const leg = cylinder(0.025, 0.036, 0.48, woodMidMat, 8, true);
    leg.position.set(Math.cos(a) * 0.46, 0.24, Math.sin(a) * 0.46);
    leg.rotation.z = Math.cos(a) * 0.08;
    leg.rotation.x = -Math.sin(a) * 0.08;
    table.add(leg);
  }
  const underTop = cylinder(0.7, 0.7, 0.035, woodDarkMat, 32, true);
  underTop.position.y = 0.715;
  table.add(underTop);

  const clothPts = [
    new THREE.Vector2(0.001, 0.745),
    new THREE.Vector2(0.76, 0.745),
    new THREE.Vector2(0.795, 0.73),
    new THREE.Vector2(0.8, 0.5),
    new THREE.Vector2(0.78, 0.44),
  ];
  const clothGeo = new THREE.LatheGeometry(clothPts, 64);
  const cloth = mesh(clothGeo, fabricCream, false, true);
  cloth.position.y = 0.0;
  table.add(cloth);
  const clothTop = mesh(new THREE.CircleGeometry(0.762, 64), mat({ map: T.tablecloth, roughness: 0.92, side: THREE.DoubleSide }), false, true);
  clothTop.rotation.x = -Math.PI / 2;
  clothTop.position.y = 0.748;
  table.add(clothTop);

  // сервиз
  const tea = new THREE.Group();
  tea.position.set(0, 0.75, 0);
  table.add(tea);
  const teapot = new THREE.Group();
  teapot.position.set(-0.2, 0.02, -0.12);
  tea.add(teapot);
  const potBody = mesh(new THREE.SphereGeometry(0.125, 24, 16), porcelainMat, true, true);
  potBody.scale.set(1, 0.84, 1);
  potBody.position.y = 0.115;
  teapot.add(potBody);
  const potLid = mesh(new THREE.CylinderGeometry(0.07, 0.095, 0.028, 24), porcelainMat, true, true);
  potLid.position.y = 0.222;
  teapot.add(potLid);
  const potKnob = mesh(new THREE.SphereGeometry(0.024, 12, 8), cobaltMat, true, true);
  potKnob.position.y = 0.248;
  teapot.add(potKnob);
  const spoutCurve = new THREE.CatmullRomCurve3([
    new V(0.105, 0.13, 0),
    new V(0.17, 0.16, 0.01),
    new V(0.2, 0.23, 0.03),
  ]);
  const spout = mesh(new THREE.TubeGeometry(spoutCurve, 16, 0.025, 8, false), porcelainMat, true, true);
  teapot.add(spout);
  const handleCurve = new THREE.CatmullRomCurve3([
    new V(-0.11, 0.08, 0),
    new V(-0.22, 0.13, 0),
    new V(-0.18, 0.22, 0),
    new V(-0.08, 0.19, 0),
  ]);
  const hnd = mesh(new THREE.TubeGeometry(handleCurve, 20, 0.017, 6, false), porcelainMat, true, true);
  teapot.add(hnd);
  const band = mesh(new THREE.TorusGeometry(0.103, 0.006, 6, 30), cobaltMat, false, true);
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.16;
  teapot.add(band);

  const cupProfile = [
    new THREE.Vector2(0.0, 0),
    new THREE.Vector2(0.045, 0),
    new THREE.Vector2(0.048, 0.008),
    new THREE.Vector2(0.026, 0.028),
    new THREE.Vector2(0.028, 0.06),
    new THREE.Vector2(0.055, 0.086),
    new THREE.Vector2(0.057, 0.09),
  ];
  const cupGeo = new THREE.LatheGeometry(cupProfile, 24);
  const addCup = (x, z, rot) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    tea.add(g);
    const saucer = mesh(new THREE.CylinderGeometry(0.085, 0.075, 0.01, 28), porcelainMat, true, true);
    saucer.position.y = 0.006;
    g.add(saucer);
    const cup = mesh(cupGeo, porcelainMat, true, true);
    cup.position.y = 0.016;
    g.add(cup);
    const rim = mesh(new THREE.TorusGeometry(0.056, 0.0028, 5, 24), cobaltMat, false, true);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.105;
    g.add(rim);
    const ch = mesh(new THREE.TorusGeometry(0.036, 0.007, 5, 18, Math.PI * 1.35), porcelainMat, true, true);
    ch.position.set(0.058, 0.06, 0);
    ch.rotation.set(Math.PI / 2, 0, -0.4);
    g.add(ch);
  };
  addCup(0.19, 0.2, -0.4);
  addCup(0.43, -0.16, 0.9);
  addCup(-0.36, 0.34, 0.3);

  // ваза с яблоками
  const bowl = new THREE.Group();
  bowl.position.set(0.1, 0.02, 0.16);
  tea.add(bowl);
  const bowlGlass = mesh(
    new THREE.SphereGeometry(0.13, 24, 12, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5),
    glassMat,
    true,
    true
  );
  bowlGlass.scale.y = 0.55;
  bowlGlass.position.y = 0.13;
  bowl.add(bowlGlass);
  const bowlFoot = mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.025, 20), glassMat, false, true);
  bowlFoot.position.y = 0.015;
  bowl.add(bowlFoot);
  for (let i = 0; i < 3; i++) {
    const apple = mesh(new THREE.SphereGeometry(0.05, 12, 10), mat({ color: [0x8e3c2f, 0x9a7433, 0x6d7f3c][i], roughness: 0.6 }), true, true);
    apple.scale.y = 0.92;
    apple.position.set((i - 1) * 0.052, 0.065, (i % 2) * 0.04 - 0.02);
    bowl.add(apple);
  }

  // тарелка с пирожками
  const plate = mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.012, 32), porcelainMat, true, true);
  plate.position.set(-0.4, 0.008, -0.27);
  tea.add(plate);
  for (let i = 0; i < 3; i++) {
    const pirozhok = mesh(new THREE.SphereGeometry(0.043, 10, 6), mat({ color: 0xb47a3d, roughness: 0.8 }), true, true);
    pirozhok.scale.set(1.35, 0.6, 0.8);
    pirozhok.rotation.y = i * 0.9;
    pirozhok.position.set(-0.4 + (i - 1) * 0.056, 0.032, -0.27 + (i % 2) * 0.05);
    tea.add(pirozhok);
  }

  // газета
  const paper = mesh(new THREE.PlaneGeometry(0.42, 0.31), mat({ map: T.news, roughness: 0.95, side: THREE.DoubleSide }), false, true);
  paper.rotation.x = -Math.PI / 2;
  paper.rotation.z = 0.28;
  paper.position.set(0.27, 0.753, 0.38);
  table.add(paper);

  // стулья
  const makeChair = () => {
    const g = new THREE.Group();
    const seat = mesh(new RoundedBoxGeometry(0.47, 0.055, 0.44, 2, 0.025), woodBeechMat);
    seat.position.y = 0.45;
    g.add(seat);
    for (const x of [-0.19, 0.19]) {
      const front = rod(new V(x, 0, 0.17), new V(x, 0.45, 0.17), 0.019, woodBeechMat, 0.016, 0.025, 8);
      g.add(front);
      const backPost = rod(new V(x, 0, -0.17), new V(x * 0.88, 1.04, -0.19), 0.019, woodBeechMat, 0.015, 0.025, 8);
      g.add(backPost);
    }
    const railCurve = new THREE.CatmullRomCurve3([
      new V(-0.21, 1.015, -0.19),
      new V(0, 1.075, -0.23),
      new V(0.21, 1.015, -0.19),
    ]);
    g.add(mesh(new THREE.TubeGeometry(railCurve, 16, 0.02, 7, false), woodBeechMat, true, true));
    const splat = mesh(new RoundedBoxGeometry(0.29, 0.17, 0.022, 2, 0.012), woodBeechMat);
    splat.position.set(0, 0.82, -0.215);
    g.add(splat);
    for (const z of [0.17, -0.17]) {
      g.add(rod(new V(-0.19, 0.18, z), new V(0.19, 0.18, z), 0.009, woodBeechMat, 0.007, 0.007, 6));
    }
    for (const x of [-0.19, 0.19]) {
      g.add(rod(new V(x, 0.18, 0.17), new V(x, 0.18, -0.17), 0.009, woodBeechMat, 0.007, 0.007, 6));
    }
    return g;
  };
  const chair1 = makeChair();
  chair1.position.set(0.3, 0, 1.2);
  chair1.rotation.y = Math.PI;
  group.add(chair1);
  const chair2 = makeChair();
  chair2.position.set(1.23, 0, 0.06);
  chair2.rotation.y = -Math.PI / 2;
  group.add(chair2);

  /* ----------------------------- люстра ---------------------------- */

  const chandelier = new THREE.Group();
  chandelier.position.set(0, ROOM.h, 0.0);
  group.add(chandelier);

  const canopy = cylinder(0.12, 0.14, 0.038, brassMat, 24, false);
  canopy.position.y = -0.02;
  chandelier.add(canopy);
  const canopyRing = mesh(new THREE.TorusGeometry(0.135, 0.01, 6, 28), darkBrassMat, false, true);
  canopyRing.rotation.x = Math.PI / 2;
  canopyRing.position.y = -0.04;
  chandelier.add(canopyRing);
  const stem = cylinder(0.016, 0.016, 0.2, brassMat, 10, false);
  stem.position.y = -0.135;
  chandelier.add(stem);
  const stemBead = mesh(new THREE.SphereGeometry(0.045, 16, 12), glassMat, false, true);
  stemBead.position.y = -0.24;
  chandelier.add(stemBead);
  const hub = mesh(new THREE.SphereGeometry(0.075, 20, 14), brassMat, false, true);
  hub.position.y = -0.32;
  chandelier.add(hub);

  const armCount = 6;
  const cupProfileC = [
    new THREE.Vector2(0.0, 0),
    new THREE.Vector2(0.035, 0),
    new THREE.Vector2(0.045, 0.015),
    new THREE.Vector2(0.075, 0.075),
    new THREE.Vector2(0.088, 0.09),
    new THREE.Vector2(0.085, 0.095),
  ];
  const cupGeo2 = new THREE.LatheGeometry(cupProfileC, 18);
  const petalGeo = leafGeometry();
  const candleMat = mat({ color: 0xf0e6ca, roughness: 0.7 });
  const bulbSprites = [];

  for (let i = 0; i < armCount; i++) {
    const a = (i / armCount) * Math.PI * 2;
    const armCurve = new THREE.CatmullRomCurve3([
      new V(Math.cos(a) * 0.055, -0.31, Math.sin(a) * 0.055),
      new V(Math.cos(a) * 0.26, -0.43, Math.sin(a) * 0.26),
      new V(Math.cos(a) * 0.47, -0.38, Math.sin(a) * 0.47),
      new V(Math.cos(a) * 0.55, -0.26, Math.sin(a) * 0.55),
    ]);
    const arm = mesh(new THREE.TubeGeometry(armCurve, 28, 0.015, 7, false), brassMat, true, true);
    chandelier.add(arm);

    const cup = mesh(cupGeo2, glassMat, false, true);
    cup.position.set(Math.cos(a) * 0.55, -0.265, Math.sin(a) * 0.55);
    chandelier.add(cup);
    const cupBase = mesh(new THREE.CylinderGeometry(0.05, 0.065, 0.02, 16), brassMat, false, true);
    cupBase.position.set(Math.cos(a) * 0.55, -0.265, Math.sin(a) * 0.55);
    chandelier.add(cupBase);
    const candle = cylinder(0.018, 0.02, 0.075, candleMat, 12, false);
    candle.position.set(Math.cos(a) * 0.55, -0.22, Math.sin(a) * 0.55);
    chandelier.add(candle);
    const bulb = mesh(new THREE.SphereGeometry(0.021, 10, 8), bulbMat, false, false);
    bulb.scale.y = 1.35;
    bulb.position.set(Math.cos(a) * 0.55, -0.168, Math.sin(a) * 0.55);
    chandelier.add(bulb);

    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: T.glow,
        color: 0xffc987,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      })
    );
    sprite.scale.set(0.19, 0.19, 1);
    sprite.position.copy(bulb.position);
    sprite.material.userData.baseOpacity = sprite.material.opacity;
    chandelier.add(sprite);
    bulbSprites.push(sprite);

    // стеклянные лепестки
    for (let k = 0; k < 2; k++) {
      const petal = mesh(petalGeo, glassMat, false, true);
      const pr = 0.36 + k * 0.12;
      petal.position.set(Math.cos(a + (k - 0.5) * 0.2) * pr, -0.34 + k * 0.015, Math.sin(a + (k - 0.5) * 0.2) * pr);
      petal.rotation.set(0.25 + k * 0.15, -a + 0.5, 0.5 + k * 0.35);
      petal.scale.setScalar(0.8);
      chandelier.add(petal);
    }

    // подвеска
    const wire = rod(
      new V(Math.cos(a) * 0.52, -0.28, Math.sin(a) * 0.52),
      new V(Math.cos(a) * 0.52, -0.38, Math.sin(a) * 0.52),
      0.003,
      brassMat,
      0.002,
      0.002,
      4
    );
    chandelier.add(wire);
    const drop = mesh(new THREE.OctahedronGeometry(0.05, 0), glassMat, false, true);
    drop.scale.set(0.42, 1.25, 0.42);
    drop.position.set(Math.cos(a) * 0.52, -0.43, Math.sin(a) * 0.52);
    chandelier.add(drop);
  }
  const spGlassMat = bulbSprites[0].material;
  lampGlowMaterials.push(spGlassMat);
  lampSprites.push(...bulbSprites);

  // центральная чаша
  const bowlPts = [
    new THREE.Vector2(0.001, 0.02),
    new THREE.Vector2(0.09, 0.015),
    new THREE.Vector2(0.135, -0.02),
    new THREE.Vector2(0.125, -0.09),
    new THREE.Vector2(0.07, -0.12),
    new THREE.Vector2(0.001, -0.1),
  ];
  const centralBowl = mesh(new THREE.LatheGeometry(bowlPts, 32), glassMat, false, true);
  centralBowl.position.y = -0.5;
  chandelier.add(centralBowl);
  const finial = mesh(new THREE.OctahedronGeometry(0.055, 0), glassMat, false, true);
  finial.scale.set(0.55, 1.5, 0.55);
  finial.position.y = -0.66;
  chandelier.add(finial);
  const finialWire = cylinder(0.004, 0.004, 0.1, brassMat, 4, false);
  finialWire.position.y = -0.58;
  chandelier.add(finialWire);

  const chandelierLight = new THREE.PointLight(0xffc179, 16, 7.5, 2.0);
  chandelierLight.position.y = -0.45;
  chandelierLight.castShadow = true;
  chandelierLight.shadow.mapSize.set(1024, 1024);
  chandelierLight.shadow.bias = -0.002;
  chandelierLight.shadow.normalBias = 0.02;
  chandelierLight.shadow.camera.near = 0.1;
  chandelierLight.shadow.camera.far = 8;
  chandelierLight.userData.baseIntensity = 16;
  chandelier.add(chandelierLight);

  // люстра не отбрасывает собственных жёстких теней на потолок;
  // её свет всё ещё рисует тени мебели
  chandelier.traverse((child) => {
    if (child.isMesh) child.castShadow = false;
  });
  lampLights.push(chandelierLight);

  /* ----------------------------- стенка ---------------------------- */

  const unit = new THREE.Group();
  group.add(unit);
  const ux = 2.79; // центр глубины (от 2.54 до 3.04)
  const unitBack = 3.04;
  const unitFront = 2.54;

  const unitBase = box(0.5, 0.78, 3.52, woodDarkMat);
  unitBase.position.set(ux, 0.4, -0.2);
  unit.add(unitBase);
  const plinth = box(0.46, 0.08, 3.48, blackMat);
  plinth.position.set(ux - 0.012, 0.04, -0.2);
  unit.add(plinth);
  const baseTop = box(0.53, 0.03, 3.56, woodMidMat);
  baseTop.position.set(ux, 0.805, -0.2);
  unit.add(baseTop);

  // дверцы нижней тумбы
  for (let i = 0; i < 3; i++) {
    const z = -1.36 + i * 1.12;
    const door = box(0.025, 0.6, 1.03, woodDarkMat);
    door.position.set(unitFront + 0.012, 0.4, z);
    unit.add(door);
    const panel = box(0.012, 0.44, 0.84, woodMidMat);
    panel.position.set(unitFront - 0.002, 0.4, z);
    unit.add(panel);
    const knob = mesh(new THREE.SphereGeometry(0.018, 10, 8), brassMat, false, true);
    knob.position.set(unitFront - 0.02, 0.45, z + 0.44);
    unit.add(knob);
  }

  // боковины и полки верхней части
  const unitSideMat = woodDarkMat;
  for (const z of [-1.98, 1.58]) {
    const side = box(0.4, 1.68, 0.055, unitSideMat);
    side.position.set(2.84, 1.65, z);
    unit.add(side);
  }
  const unitBackPanel = box(0.03, 1.68, 3.56, woodMidMat);
  unitBackPanel.position.set(unitBack, 1.65, -0.2);
  unit.add(unitBackPanel);
  const unitTop = box(0.48, 0.055, 3.62, woodDarkMat);
  unitTop.position.set(2.82, 2.5, -0.2);
  unit.add(unitTop);
  const unitTopTrim = box(0.05, 0.08, 3.66, woodMidMat);
  unitTopTrim.position.set(unitFront + 0.01, 2.44, -0.2);
  unit.add(unitTopTrim);
  for (const y of [1.72, 2.12]) {
    const shelf = box(0.42, 0.035, 3.45, woodMidMat);
    shelf.position.set(2.84, y, -0.2);
    unit.add(shelf);
  }
  for (const z of [-0.73, 0.76]) {
    const divider = box(0.4, 1.62, 0.035, woodMidMat);
    divider.position.set(2.84, 1.63, z);
    unit.add(divider);
  }
  // задние стенки ниши ТВ
  const tvNicheBack = box(0.02, 0.85, 1.5, woodMidMat);
  tvNicheBack.position.set(unitBack - 0.04, 1.22, 0);
  unit.add(tvNicheBack);

  // книги
  const bookPalette = [0x6b392f, 0x2d4a3f, 0x7a6436, 0x33465c, 0x89452d, 0x53382d, 0xa89b78, 0x764244, 0x3d5247];
  const bookMats = bookPalette.map((c) => mat({ color: c, roughness: 0.78, metalness: 0.02 }));
  const goldMat = mat({ color: 0xc1a163, roughness: 0.38, metalness: 0.68 });
  const addBookRow = (zStart, zEnd, yBase, seed, count, depth = 0.15) => {
    let r = seed;
    const rr = () => {
      r = (r * 1664525 + 1013904223) % 4294967296;
      return r / 4294967296;
    };
    let z = zStart;
    for (let i = 0; i < count && z < zEnd; i++) {
      const th = 0.022 + rr() * 0.035;
      const h = 0.18 + rr() * 0.1;
      if (z + th > zEnd) break;
      const b = box(depth, h, th, bookMats[Math.floor(rr() * bookMats.length)]);
      b.position.set(2.88, yBase + h / 2, z + th / 2);
      b.rotation.z = (rr() - 0.5) * 0.02;
      unit.add(b);
      if (rr() > 0.55) {
        const band = box(0.002, 0.012, th * 0.82, goldMat);
        band.position.set(2.88 - depth / 2 - 0.002, yBase + h * 0.67, z + th / 2);
        band.castShadow = false;
        unit.add(band);
      }
      z += th + 0.004;
    }
  };
  addBookRow(-1.85, -1.18, 1.745, 11, 14);
  addBookRow(-1.85, -1.25, 2.145, 23, 12);
  addBookRow(0.86, 1.46, 1.745, 37, 14);
  addBookRow(0.92, 1.44, 2.145, 53, 12);
  addBookRow(0.92, 1.48, 2.47, 67, 10);

  // стопка книг
  for (let i = 0; i < 3; i++) {
    const b = box(0.24, 0.035, 0.18, bookMats[(i + 2) % bookMats.length]);
    b.position.set(2.84, 2.15 + i * 0.035, -1.36 + i * 0.01);
    b.rotation.y = (i - 1) * 0.08;
    unit.add(b);
    const pages = box(0.235, 0.025, 0.173, paperMat);
    pages.position.copy(b.position);
    pages.position.y -= 0.004;
    unit.add(pages);
  }

  // хрусталь
  const gobletProfile = [
    new THREE.Vector2(0.0, 0),
    new THREE.Vector2(0.03, 0),
    new THREE.Vector2(0.03, 0.008),
    new THREE.Vector2(0.008, 0.02),
    new THREE.Vector2(0.008, 0.085),
    new THREE.Vector2(0.042, 0.115),
    new THREE.Vector2(0.05, 0.17),
    new THREE.Vector2(0.048, 0.18),
  ];
  const gobletGeo = new THREE.LatheGeometry(gobletProfile, 20);
  for (let i = 0; i < 4; i++) {
    const g = mesh(gobletGeo, glassMat, false, true);
    g.position.set(2.85 + (i % 2) * 0.06, 1.74, -1.58 + Math.floor(i / 2) * 0.12);
    g.scale.setScalar(1.15);
    unit.add(g);
  }
  const crystalVase = mesh(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.0, 0),
        new THREE.Vector2(0.06, 0),
        new THREE.Vector2(0.085, 0.05),
        new THREE.Vector2(0.075, 0.14),
        new THREE.Vector2(0.04, 0.2),
        new THREE.Vector2(0.05, 0.24),
      ],
      24
    ),
    glassMat,
    false,
    true
  );
  crystalVase.position.set(2.82, 1.745, -1.74);
  unit.add(crystalVase);

  // радио
  const radio = new THREE.Group();
  radio.position.set(2.82, 1.745, -1.34);
  unit.add(radio);
  const radioBody = box(0.19, 0.23, 0.38, woodMidMat);
  radioBody.position.y = 0.115;
  radio.add(radioBody);
  const radioFace = box(0.01, 0.19, 0.33, mat({ color: 0x2c2922, roughness: 0.8 }));
  radioFace.position.set(-0.1, 0.125, 0);
  radio.add(radioFace);
  const speakerCloth = box(0.006, 0.105, 0.19, mat({ color: 0x917a55, roughness: 0.95 }));
  speakerCloth.position.set(-0.107, 0.12, -0.075);
  radio.add(speakerCloth);
  for (let i = 0; i < 5; i++) {
    const slat = box(0.003, 0.003, 0.17, darkBrassMat);
    slat.position.set(-0.112, 0.075 + i * 0.021, -0.075);
    slat.castShadow = false;
    radio.add(slat);
  }
  const radioDial = box(0.004, 0.045, 0.13, mat({ color: 0x2f2312, emissive: 0x6e4a17, emissiveIntensity: 0.45, roughness: 0.5 }));
  radioDial.position.set(-0.107, 0.185, 0.085);
  radio.add(radioDial);
  for (let i = 0; i < 2; i++) {
    const knob = cylinder(0.017, 0.017, 0.02, darkBrassMat, 12, false);
    knob.rotation.z = Math.PI / 2;
    knob.position.set(-0.112, 0.15 - i * 0.045, 0.17);
    radio.add(knob);
  }
  const radioAntenna = rod(new V(0.03, 0.23, 0.08), new V(0.09, 0.46, 0.16), 0.003, chromeMat, 0.002, 0.003, 5);
  radio.add(radioAntenna);

  // телевизор
  const tv = new THREE.Group();
  tv.position.set(2.7, 0.82, -0.02);
  unit.add(tv);
  const tvBody = box(0.48, 0.58, 0.78, woodDarkMat);
  tvBody.position.y = 0.29;
  tv.add(tvBody);
  const tvFront = box(0.02, 0.53, 0.73, mat({ color: 0x211f1a, roughness: 0.55 }));
  tvFront.position.set(-0.247, 0.3, 0);
  tv.add(tvFront);
  const tvScreenMat = createTvMaterial();
  const tvScreen = mesh(new THREE.PlaneGeometry(0.57, 0.405), tvScreenMat, false, false);
  tvScreen.rotation.y = -Math.PI / 2;
  tvScreen.position.set(-0.26, 0.32, -0.06);
  tv.add(tvScreen);
  const tvBezel = box(0.015, 0.47, 0.64, mat({ color: 0x0d0d0b, roughness: 0.4 }));
  tvBezel.position.set(-0.258, 0.32, -0.06);
  tv.add(tvBezel);
  const controlPanel = box(0.012, 0.48, 0.11, mat({ color: 0x3a3025, roughness: 0.6 }));
  controlPanel.position.set(-0.26, 0.3, 0.33);
  tv.add(controlPanel);
  for (let i = 0; i < 2; i++) {
    const knob = cylinder(0.022, 0.022, 0.026, chromeMat, 12, false);
    knob.rotation.z = Math.PI / 2;
    knob.position.set(-0.278, 0.37 - i * 0.09, 0.33);
    tv.add(knob);
  }
  for (let i = 0; i < 6; i++) {
    const slot = box(0.002, 0.006, 0.065, blackMat);
    slot.position.set(-0.267, 0.19 + i * 0.018, 0.315);
    slot.castShadow = false;
    tv.add(slot);
  }
  const brand = box(0.003, 0.016, 0.14, brassMat);
  brand.position.set(-0.268, 0.53, 0.24);
  brand.castShadow = false;
  tv.add(brand);
  const legL = box(0.08, 0.035, 0.08, blackMat);
  legL.position.set(0, -0.017, -0.27);
  tv.add(legL);
  const legR = legL.clone();
  legR.position.z = 0.27;
  tv.add(legR);
  // антенна
  const antA = rod(new V(0.03, 0.58, 0.08), new V(-0.17, 1.02, 0.28), 0.004, chromeMat, 0.002, 0.005, 5);
  tv.add(antA);
  const antB = rod(new V(0.03, 0.58, -0.02), new V(-0.14, 1.0, -0.3), 0.004, chromeMat, 0.002, 0.005, 5);
  tv.add(antB);
  const antTipA = mesh(new THREE.SphereGeometry(0.01, 8, 6), chromeMat, false, true);
  antTipA.position.set(-0.17, 1.02, 0.28);
  tv.add(antTipA);
  const antTipB = antTipA.clone();
  antTipB.position.set(-0.14, 1.0, -0.3);
  tv.add(antTipB);

  const tvLight = new THREE.PointLight(0x7fa9d9, 1.6, 2.2, 2.0);
  tvLight.position.set(-0.45, 0.35, -0.06);
  tvLight.userData.baseIntensity = 1.6;
  tv.add(tvLight);

  // провод
  const cableCurve = new THREE.CatmullRomCurve3([
    new V(2.9, 0.8, -0.3),
    new V(2.96, 0.6, -0.5),
    new V(3.02, 0.25, -0.7),
    new V(3.05, 0.1, -1.0),
  ]);
  const cable = mesh(new THREE.TubeGeometry(cableCurve, 20, 0.007, 5, false), blackMat, false, false);
  unit.add(cable);

  // проигрыватель пластинок на тумбе
  const deck = new THREE.Group();
  deck.position.set(2.79, 0.82, 0.92);
  unit.add(deck);
  const deckBase = box(0.44, 0.07, 0.43, woodMidMat);
  deckBase.position.y = 0.035;
  deck.add(deckBase);
  const platter = cylinder(0.155, 0.155, 0.015, darkPlasticMat, 28, false);
  platter.position.y = 0.082;
  deck.add(platter);
  const record = cylinder(0.15, 0.15, 0.004, mat({ color: 0x0c0b0a, roughness: 0.35, metalness: 0.1 }), 32, false);
  record.position.y = 0.093;
  deck.add(record);
  const label = cylinder(0.045, 0.045, 0.0045, mat({ color: 0xa14232, roughness: 0.65 }), 24, false);
  label.position.y = 0.095;
  deck.add(label);
  const armBase = cylinder(0.02, 0.02, 0.02, chromeMat, 10, false);
  armBase.position.set(0.16, 0.1, -0.12);
  deck.add(armBase);
  const toneArm = rod(new V(0.16, 0.12, -0.12), new V(-0.02, 0.11, 0.1), 0.006, chromeMat, 0.004, 0.007, 5);
  deck.add(toneArm);
  const deckKnob = cylinder(0.016, 0.016, 0.02, darkBrassMat, 10, false);
  deckKnob.position.set(0.16, 0.09, 0.02);
  deck.add(deckKnob);

  // коробка пластинок
  const recBox = box(0.34, 0.15, 0.2, mat({ color: 0x6b5140, roughness: 0.85 }));
  recBox.position.set(2.83, 0.895, 1.3);
  unit.add(recBox);

  // фото на полке
  const shelfPhoto = new THREE.Group();
  shelfPhoto.position.set(2.82, 2.16, -0.32);
  shelfPhoto.rotation.y = -Math.PI / 2;
  unit.add(shelfPhoto);
  const photoFrame = box(0.23, 0.17, 0.018, woodMidMat);
  shelfPhoto.add(photoFrame);
  const photoImg = mesh(new THREE.PlaneGeometry(0.19, 0.13), mat({ map: T.stillLife, roughness: 0.65 }), false, false);
  photoImg.position.z = 0.011;
  shelfPhoto.add(photoImg);

  /* ---------------------------- часы ------------------------------ */

  const clock = new THREE.Group();
  clock.position.set(1.08, 2.13, ROOM.back + 0.072);
  group.add(clock);
  const clockBack = mesh(new THREE.CylinderGeometry(0.195, 0.195, 0.04, 40), woodDarkMat, false, true);
  clockBack.rotation.x = Math.PI / 2;
  clock.add(clockBack);
  const clockFace = mesh(new THREE.CircleGeometry(0.178, 48), mat({ map: T.clockFace, roughness: 0.42, metalness: 0.05 }), false, true);
  clockFace.position.z = 0.023;
  clock.add(clockFace);
  const clockRim = mesh(new THREE.TorusGeometry(0.183, 0.014, 8, 48), brassMat, false, true);
  clockRim.position.z = 0.028;
  clock.add(clockRim);
  const hourPivot = new THREE.Group();
  hourPivot.position.z = 0.036;
  clock.add(hourPivot);
  const hourHand = mesh(new THREE.BoxGeometry(0.011, 0.09, 0.004), blackMat, false, false);
  hourHand.position.y = 0.04;
  hourPivot.add(hourHand);
  const minutePivot = new THREE.Group();
  minutePivot.position.z = 0.04;
  clock.add(minutePivot);
  const minuteHand = mesh(new THREE.BoxGeometry(0.007, 0.135, 0.004), blackMat, false, false);
  minuteHand.position.y = 0.06;
  minutePivot.add(minuteHand);
  const secondPivot = new THREE.Group();
  secondPivot.position.z = 0.044;
  clock.add(secondPivot);
  const secondHand = mesh(new THREE.BoxGeometry(0.003, 0.155, 0.002), mat({ color: 0xa13f2f, roughness: 0.5 }), false, false);
  secondHand.position.y = 0.07;
  secondPivot.add(secondHand);
  const clockCenter = mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.006, 12), brassMat, false, false);
  clockCenter.rotation.x = Math.PI / 2;
  clockCenter.position.z = 0.047;
  clock.add(clockCenter);

  /* --------------------------- телефон ---------------------------- */

  const phone = new THREE.Group();
  phone.position.set(0.66, 1.44, ROOM.back + 0.082);
  group.add(phone);
  const phoneBack = box(0.25, 0.36, 0.045, blackMat);
  phone.add(phoneBack);
  const phoneBody = mesh(new RoundedBoxGeometry(0.235, 0.31, 0.075, 2, 0.02), blackMat);
  phoneBody.position.z = 0.065;
  phone.add(phoneBody);
  const dialTex = makeClockDialTexture();
  const dial = mesh(new THREE.CircleGeometry(0.085, 32), mat({ map: dialTex, roughness: 0.45 }), false, true);
  dial.position.set(0, -0.05, 0.105);
  phone.add(dial);
  const handset = new THREE.Group();
  handset.position.set(0, 0.17, 0.12);
  phone.add(handset);
  const handBar = mesh(new THREE.CapsuleGeometry(0.021, 0.13, 4, 8), blackMat, false, true);
  handBar.rotation.z = Math.PI / 2;
  handset.add(handBar);
  for (const x of [-0.087, 0.087]) {
    const cup = mesh(new THREE.SphereGeometry(0.04, 12, 8), blackMat, false, true);
    cup.scale.set(1, 0.62, 0.8);
    cup.position.x = x;
    handset.add(cup);
  }
  const cordCurve = new THREE.CatmullRomCurve3([
    new V(-0.08, -0.14, 0.06),
    new V(0.02, -0.43, 0.05),
    new V(0.2, -0.55, 0.03),
    new V(0.23, -0.68, 0.01),
  ]);
  const cord = mesh(new THREE.TubeGeometry(cordCurve, 24, 0.007, 5, false), blackMat, false, false);
  phone.add(cord);
  const phoneHook = box(0.18, 0.015, 0.03, brassMat);
  phoneHook.position.set(0, 0.122, 0.055);
  phone.add(phoneHook);

  /* --------------------------- картина ----------------------------- */

  const addFramedArt = (tex, w, h, x, y, z, rotY = 0, frameColor = 0x5c3b24) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    group.add(g);
    const framemat = mat({ color: frameColor, roughness: 0.55, metalness: 0.02 });
    const frame = box(w + 0.075, h + 0.075, 0.035, framemat, false, true);
    g.add(frame);
    const canvasImg = mesh(new THREE.PlaneGeometry(w, h), mat({ map: tex, roughness: 0.82 }), false, false);
    canvasImg.position.z = 0.0205;
    g.add(canvasImg);
    const inner = box(w + 0.045, h + 0.045, 0.002, mat({ color: 0xd6c9aa, roughness: 0.8 }), false, false);
    inner.position.z = 0.0192;
    g.add(inner);
    return g;
  };
  addFramedArt(T.landscape, 0.72, 0.49, 2.2, 1.95, ROOM.back + 0.08, 0, 0x5e4028);
  addFramedArt(T.stillLife, 0.34, 0.42, -2.55, 1.84, ROOM.back + 0.08, 0, 0x4d3421);

  /* ------------------------- дверь и шкаф -------------------------- */

  // дверное полотно
  const doorGroup = new THREE.Group();
  doorGroup.position.set(1.92, 0, ROOM.front - 0.05);
  group.add(doorGroup);
  const doorFace = box(0.92, 2.08, 0.055, warmWhitePaint);
  doorFace.position.y = 1.04;
  doorFace.castShadow = true;
  doorGroup.add(doorFace);
  for (const p of [
    [0, 1.58, 0.68, 0.58],
    [0, 0.68, 0.68, 0.6],
  ]) {
    const panel = box(p[2], p[3], 0.016, creamPaint, false, true);
    panel.position.set(p[0], p[1], 0.035);
    doorGroup.add(panel);
    const innerPanel = box(p[2] - 0.12, p[3] - 0.12, 0.009, warmWhitePaint, false, true);
    innerPanel.position.set(p[0], p[1], 0.044);
    doorGroup.add(innerPanel);
  }
  const doorHandle = mesh(new THREE.SphereGeometry(0.035, 14, 10), brassMat, false, true);
  doorHandle.position.set(-0.34, 1.02, 0.09);
  doorGroup.add(doorHandle);
  const doorPlate = box(0.05, 0.12, 0.012, brassMat, false, true);
  doorPlate.position.set(-0.34, 1.02, 0.035);
  doorGroup.add(doorPlate);
  const doorFrameMat = creamPaint;
  for (const x of [-0.52, 0.52]) {
    const jamb = box(0.09, 2.18, 0.12, doorFrameMat);
    jamb.position.set(x, 1.09, 0.06);
    doorGroup.add(jamb);
  }
  const header = box(1.13, 0.09, 0.12, doorFrameMat);
  header.position.set(0, 2.2, 0.06);
  doorGroup.add(header);
  const threshold = box(0.99, 0.035, 0.16, woodDarkMat);
  threshold.position.set(0, 0.018, 0.02);
  doorGroup.add(threshold);

  // выключатель рядом с дверью
  const switchPlate = box(0.075, 0.115, 0.012, creamPaint, false, false);
  switchPlate.position.set(1.25, 1.26, ROOM.front - 0.012);
  group.add(switchPlate);
  const toggleSwitch = box(0.018, 0.045, 0.018, brassMat, false, false);
  toggleSwitch.position.set(1.25, 1.265, ROOM.front - 0.024);
  group.add(toggleSwitch);

  // шкаф
  const wardrobe = new THREE.Group();
  wardrobe.position.set(-2.48, 0, 2.38);
  group.add(wardrobe);
  const wBody = box(1.22, 2.1, 0.58, woodDarkMat);
  wBody.position.y = 1.08;
  wardrobe.add(wBody);
  const wTop = box(1.28, 0.07, 0.64, woodMidMat);
  wTop.position.y = 2.165;
  wardrobe.add(wTop);
  const wPlinth = box(1.18, 0.08, 0.54, blackMat);
  wPlinth.position.y = 0.04;
  wardrobe.add(wPlinth);
  for (const x of [-0.3, 0.3]) {
    const wDoor = box(0.56, 1.84, 0.025, woodMidMat);
    wDoor.position.set(x, 1.1, -0.3);
    wardrobe.add(wDoor);
    const wPanel = box(0.43, 1.55, 0.012, woodDarkMat);
    wPanel.position.set(x, 1.1, -0.318);
    wardrobe.add(wPanel);
    const wHandle = mesh(new THREE.SphereGeometry(0.018, 10, 8), brassMat, false, true);
    wHandle.position.set(x > 0 ? x - 0.23 : x + 0.23, 1.1, -0.34);
    wardrobe.add(wHandle);
    const key = cylinder(0.006, 0.006, 0.02, brassMat, 8, false);
    key.rotation.x = Math.PI / 2;
    key.position.set(x + (x > 0 ? -0.15 : 0.15), 1.02, -0.325);
    wardrobe.add(key);
  }

  // зонт у двери
  const umbrella = new THREE.Group();
  umbrella.position.set(0.92, 0, 2.35);
  group.add(umbrella);
  const umbPot = cylinder(0.08, 0.1, 0.35, mat({ color: 0x4b4b45, roughness: 0.8 }), 16, true);
  umbPot.position.y = 0.175;
  umbrella.add(umbPot);
  const umbStick = rod(new V(-0.02, 0.2, 0), new V(-0.05, 1.0, 0.02), 0.012, woodDarkMat, 0.01, 0.014, 6);
  umbrella.add(umbStick);
  const canopyU = mesh(new THREE.ConeGeometry(0.1, 0.55, 12, 1, true), mat({ color: 0x2d3b37, roughness: 0.8, side: THREE.DoubleSide }), true, true);
  canopyU.position.set(-0.045, 0.82, 0.015);
  umbrella.add(canopyU);
  const handle = mesh(new THREE.TorusGeometry(0.04, 0.011, 6, 16, Math.PI * 1.1), woodDarkMat, false, true);
  handle.rotation.z = Math.PI * 0.5;
  handle.position.set(-0.035, 1.015, 0.025);
  umbrella.add(handle);

  // верхняя одежда на крючке
  const coatHook = new THREE.Group();
  coatHook.position.set(0.12, 1.82, ROOM.front - 0.1);
  group.add(coatHook);
  const hookBase = box(0.08, 0.16, 0.035, woodMidMat, false, true);
  coatHook.add(hookBase);
  const coatHookRing = mesh(new THREE.TorusGeometry(0.05, 0.008, 6, 16, Math.PI * 1.1), brassMat, false, true);
  coatHookRing.rotation.z = 0.5;
  coatHookRing.position.set(0, 0.04, -0.055);
  coatHook.add(coatHookRing);
  const coat = new THREE.Group();
  coat.position.set(0.18, 1.55, ROOM.front - 0.28);
  group.add(coat);
  const coatBody = mesh(new RoundedBoxGeometry(0.42, 0.77, 0.18, 2, 0.07), mat({ color: 0x5b4233, roughness: 0.95 }));
  coatBody.position.y = -0.24;
  coat.add(coatBody);
  const coatCollar = mesh(new RoundedBoxGeometry(0.32, 0.13, 0.2, 2, 0.05), mat({ color: 0x4a352a, roughness: 0.95 }));
  coatCollar.position.y = 0.16;
  coat.add(coatCollar);
  for (const x of [-0.23, 0.23]) {
    const sleeve = mesh(new RoundedBoxGeometry(0.1, 0.59, 0.16, 2, 0.045), mat({ color: 0x5b4233, roughness: 0.95 }));
    sleeve.position.set(x, -0.26, 0.0);
    sleeve.rotation.z = x > 0 ? -0.08 : 0.08;
    coat.add(sleeve);
  }

  /* ------------------------- мелочи на стенах ---------------------- */

  // настенная тарелка над диваном, слева
  const plateGroup = new THREE.Group();
  plateGroup.position.set(ROOM.left + 0.02, 1.17, -1.78);
  plateGroup.rotation.y = Math.PI / 2;
  group.add(plateGroup);
  const wallPlate = mesh(new THREE.CircleGeometry(0.17, 40), porcelainBlue, false, false);
  wallPlate.position.z = 0.014;
  plateGroup.add(wallPlate);
  const wallPlateRim = mesh(new THREE.TorusGeometry(0.168, 0.012, 6, 40), porcelainBlue, false, false);
  plateGroup.add(wallPlateRim);

  /* --------------------------- пыль -------------------------------- */

  const dust = createDust({ count: 260 });
  group.add(dust);

  /* ----------------------- ссылки для main ------------------------ */

  const tvMaterial = tvScreenMat;

  return {
    group,
    lampMaterials,
    lampLights,
    lampGlowMaterials,
    lampSprites,
    chandelierLight,
    floorLampLight,
    tvLight,
    tvMaterial,
    windowGlass,
    dust,
    glassMaterial,
    clockHands: { hourPivot, minutePivot, secondPivot },
    setLampState(on) {
      for (const m of lampMaterials) {
        m.emissiveIntensity = on ? m.userData.lampBase : 0;
      }
      for (const l of lampLights) l.intensity = on ? l.userData.baseIntensity : 0;
      for (const s of lampSprites) {
        s.material.opacity = on ? (s.material.userData.baseOpacity ?? 0) : 0;
      }
    },
    setLampLevel(level) {
      for (const m of lampMaterials) m.emissiveIntensity = m.userData.lampBase * level;
      for (const l of lampLights) l.intensity = l.userData.baseIntensity * level;
      for (const s of lampSprites) s.material.opacity = (s.material.userData.baseOpacity ?? 0) * level;
    },
    setClock(hours, minutes) {
      const h = ((hours % 12) + minutes / 60) / 12;
      const m = (minutes % 60) / 60;
      hourPivot.rotation.z = -h * Math.PI * 2;
      minutePivot.rotation.z = -m * Math.PI * 2;
    },
    setSecond(seconds) {
      secondPivot.rotation.z = -(seconds / 60) * Math.PI * 2;
    },
  };
}
