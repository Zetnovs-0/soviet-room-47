import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createWindowGlassMaterial, createDust } from './shaders.js';

export const ROOM = {
  w: 4.2,
  d: 4.8,
  h: 2.72,
  back: -2.4,
  front: 2.4,
  left: -2.1,
  right: 2.1,
  window: { z0: -0.75, z1: 0.75, y0: 0.9, y1: 2.4, cz: 0.0, cy: 1.65 },
  door: { x: -1.52, w: 0.94, h: 2.08 },
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

function cloneTex(texture, repeatX, repeatY) {
  const t = texture.clone();
  t.needsUpdate = true;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  return t;
}

function normalizeShapeUV(geometry, minX, maxX, minY, maxY) {
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  const dx = maxX - minX || 1;
  const dy = maxY - minY || 1;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) - minX) / dx, (pos.getY(i) - minY) / dy);
  }
  uv.needsUpdate = true;
}

function makeWavyBlind(width, height, folds) {
  const geo = new THREE.PlaneGeometry(width, height, 2, 44);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const v = y / height + 0.5;
    const fold = 0.012 + Math.abs(Math.sin(v * Math.PI * folds)) * 0.022;
    const edge = 1 - Math.abs(pos.getX(i) / (width * 0.5)) * 0.08;
    pos.setZ(i, fold * edge);
  }
  geo.computeVertexNormals();
  return geo;
}

function makeOvalMirror(glassMaterial) {
  const group = new THREE.Group();

  const back = mesh(new THREE.CircleGeometry(0.25, 48), mat({ color: 0x5b422d, roughness: 0.62 }), false, false);
  back.scale.y = 1.42;
  group.add(back);

  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.218, 48), glassMaterial);
  glass.scale.y = 1.42;
  glass.position.z = 0.012;
  glass.name = 'oval-mirror-glass';
  group.add(glass);

  const frame = new THREE.Mesh(
    new THREE.TorusGeometry(0.238, 0.021, 10, 64),
    mat({ color: 0x8a6037, roughness: 0.46, metalness: 0.05 })
  );
  frame.scale.y = 1.42;
  frame.position.z = 0.018;
  frame.castShadow = true;
  group.add(frame);

  const inner = new THREE.Mesh(
    new THREE.TorusGeometry(0.219, 0.005, 6, 64),
    mat({ color: 0xc7a36a, roughness: 0.36, metalness: 0.45 })
  );
  inner.scale.y = 1.42;
  inner.position.z = 0.02;
  group.add(inner);

  return group;
}

export function buildRoom(scene, T) {
  const group = new THREE.Group();
  group.name = 'room';
  scene.add(group);

  const lampMaterials = [];
  const lampLights = [];
  const lampGlowMaterials = [];
  const lampSprites = [];
  const lampBacks = [];

  const registerLamp = (material, base) => {
    material.userData.lampBase = base;
    lampMaterials.push(material);
    return material;
  };

  const addGlowSprite = (parent, color, x, y, z, size, opacity, base) => {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: T.glow,
        color,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      })
    );
    sprite.scale.set(size, size, 1);
    sprite.position.set(x, y, z);
    sprite.material.userData.baseOpacity = opacity;
    sprite.userData.base = base ?? 1;
    parent.add(sprite);
    lampGlowMaterials.push(sprite.material);
    lampSprites.push(sprite);
    return sprite;
  };

  /* --------------------------- материалы --------------------------- */

  const wall1Map = cloneTex(T.wallLight, 6.0, 3.4);
  const wall2Map = cloneTex(T.wallEmerald, 8.0, 4.4);
  const wall3Map = cloneTex(T.wallBrown, 2.3, 1.6);
  const wall4Map = cloneTex(T.wallStripe, 6.0, 3.3);

  const wall1Mat = mat({ map: wall1Map, roughness: 0.88, envMapIntensity: 0.16 });
  const wall2Mat = mat({ map: wall2Map, roughness: 0.88, envMapIntensity: 0.16 });
  const wall3Mat = mat({ map: wall3Map, roughness: 0.87, envMapIntensity: 0.16 });
  const wall4Mat = mat({ map: wall4Map, roughness: 0.89, envMapIntensity: 0.16 });

  const ceilingMat = mat({
    map: cloneTex(T.ceilingGreen, 2.1, 2.2),
    roughness: 0.92,
    envMapIntensity: 0.1,
  });

  const floorMap = cloneTex(T.linoleum, 1.85, 2.15);
  const floorMat = new THREE.MeshPhysicalMaterial({
    map: floorMap,
    roughness: 0.5,
    metalness: 0,
    clearcoat: 0.12,
    clearcoatRoughness: 0.55,
    envMapIntensity: 0.45,
  });

  const paint = mat({ color: 0xe9e2d2, roughness: 0.68, metalness: 0.01, envMapIntensity: 0.25 });
  const trimMat = mat({ color: 0xeee7d7, roughness: 0.6, metalness: 0.01, envMapIntensity: 0.3 });
  const revealMat = mat({ color: 0xf0ebdf, roughness: 0.64, metalness: 0.01, envMapIntensity: 0.26 });
  const oakMat = mat({ map: T.woodOak, roughness: 0.48, metalness: 0.02, envMapIntensity: 0.5 });
  const oakDarkMat = mat({ map: T.woodOak, color: 0x9a7a59, roughness: 0.52, metalness: 0.02, envMapIntensity: 0.45 });
  const woodMidMat = mat({ map: T.woodMid, roughness: 0.54, metalness: 0.02, envMapIntensity: 0.45 });
  const woodDarkMat = mat({ map: T.woodDark, roughness: 0.58, metalness: 0.02, envMapIntensity: 0.4 });
  const woodBeechMat = mat({ map: T.woodBeech, roughness: 0.52, metalness: 0.02, envMapIntensity: 0.48 });
  const carvedTrimMat = mat({ color: 0x9b6b42, roughness: 0.5, metalness: 0.04, envMapIntensity: 0.45 });
  const brownTrimMat = mat({ color: 0x6e4b31, roughness: 0.56, metalness: 0.03, envMapIntensity: 0.35 });

  const ironMat = mat({ color: 0x2b2c29, roughness: 0.46, metalness: 0.7, envMapIntensity: 0.9 });
  const chromeMat = mat({ color: 0xc8ccc8, roughness: 0.18, metalness: 1, envMapIntensity: 1.3 });
  const brassMat = mat({ color: 0xb38a50, roughness: 0.3, metalness: 0.9, envMapIntensity: 1.2 });
  const blackMat = mat({ color: 0x171713, roughness: 0.5, metalness: 0.1 });
  const whitePlastic = mat({ color: 0xf2efe6, roughness: 0.36, metalness: 0.02, envMapIntensity: 0.5 });
  const radiatorMat = mat({ color: 0xe8e5da, roughness: 0.46, metalness: 0.08, envMapIntensity: 0.45 });
  const beddingMat = new THREE.MeshPhysicalMaterial({
    map: T.fabricCream,
    roughness: 0.94,
    metalness: 0,
    sheen: 0.25,
    sheenRoughness: 0.8,
    sheenColor: new THREE.Color(0xf6eedf),
    envMapIntensity: 0.1,
  });
  const blanketMat = new THREE.MeshPhysicalMaterial({
    map: T.fabricBlanket,
    roughness: 0.94,
    metalness: 0,
    sheen: 0.35,
    sheenRoughness: 0.76,
    sheenColor: new THREE.Color(0xc9d2c9),
    envMapIntensity: 0.12,
  });
  const blindMat = new THREE.MeshPhysicalMaterial({
    map: T.fabricGreen,
    roughness: 0.94,
    metalness: 0,
    side: THREE.DoubleSide,
    sheen: 0.55,
    sheenRoughness: 0.72,
    sheenColor: new THREE.Color(0xa9c0a5),
    envMapIntensity: 0.16,
  });
  const mirrorMat = new THREE.MeshStandardMaterial({
    map: T.mirror,
    emissiveMap: T.mirror,
    emissive: 0xffffff,
    emissiveIntensity: 0.42,
    color: 0xf2f6f1,
    roughness: 0.22,
    metalness: 0.04,
    envMapIntensity: 1.0,
    side: THREE.DoubleSide,
  });

  const portholeMat = new THREE.MeshStandardMaterial({
    color: 0xffe8bb,
    emissive: new THREE.Color(0xffb45f),
    emissiveIntensity: 2.8,
    roughness: 0.18,
    metalness: 0.1,
    transparent: true,
    opacity: 0.94,
  });
  registerLamp(portholeMat, 2.8);

  const diffuserMat = new THREE.MeshStandardMaterial({
    color: 0xfff2d5,
    emissive: new THREE.Color(0xffc278),
    emissiveIntensity: 1.45,
    roughness: 0.48,
    metalness: 0,
    transparent: true,
    opacity: 0.94,
    side: THREE.DoubleSide,
  });
  registerLamp(diffuserMat, 1.45);

  const sconceGlassMat = new THREE.MeshStandardMaterial({
    color: 0xfff0d2,
    emissive: new THREE.Color(0xffbd75),
    emissiveIntensity: 1.25,
    roughness: 0.36,
    metalness: 0,
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide,
  });
  registerLamp(sconceGlassMat, 1.25);

  /* ----------------------------- стены ----------------------------- */

  const wall1 = mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.h), wall1Mat, false, true);
  wall1.position.set(0, ROOM.h / 2, ROOM.back + 0.002);
  group.add(wall1);

  const wall3 = mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.h), wall3Mat, false, true);
  wall3.position.set(0, ROOM.h / 2, ROOM.front - 0.002);
  wall3.rotation.y = Math.PI;
  group.add(wall3);

  const wall4 = mesh(new THREE.PlaneGeometry(ROOM.d, ROOM.h), wall4Mat, false, true);
  wall4.position.set(ROOM.left + 0.002, ROOM.h / 2, 0);
  wall4.rotation.y = Math.PI / 2;
  group.add(wall4);

  // Стена с окном: цельный лист обоев с прямоугольным вырезом.
  const wallShape = new THREE.Shape();
  wallShape.moveTo(ROOM.back, 0);
  wallShape.lineTo(ROOM.front, 0);
  wallShape.lineTo(ROOM.front, ROOM.h);
  wallShape.lineTo(ROOM.back, ROOM.h);
  wallShape.closePath();
  const win = ROOM.window;
  const windowHole = new THREE.Path();
  windowHole.moveTo(win.z0, win.y0);
  windowHole.lineTo(win.z0, win.y1);
  windowHole.lineTo(win.z1, win.y1);
  windowHole.lineTo(win.z1, win.y0);
  windowHole.closePath();
  wallShape.holes.push(windowHole);
  const wall2Geo = new THREE.ShapeGeometry(wallShape, 4);
  normalizeShapeUV(wall2Geo, ROOM.back, ROOM.front, 0, ROOM.h);
  const wall2 = mesh(wall2Geo, wall2Mat, false, true);
  wall2.rotation.y = -Math.PI / 2;
  wall2.position.x = ROOM.right - 0.002;
  group.add(wall2);

  // конструктивная толща правой стены вокруг окна
  const addRightChunk = (y0, y1, z0, z1) => {
    const b = box(0.12, y1 - y0, z1 - z0, revealMat, false, true);
    b.position.set(ROOM.right + 0.06, (y0 + y1) / 2, (z0 + z1) / 2);
    group.add(b);
  };
  addRightChunk(0, win.y0, ROOM.back, ROOM.front);
  addRightChunk(win.y1, ROOM.h, ROOM.back, ROOM.front);
  addRightChunk(win.y0, win.y1, ROOM.back, win.z0);
  addRightChunk(win.y0, win.y1, win.z1, ROOM.front);

  // откосы окна
  const revealDepth = 0.16;
  const revealX = ROOM.right + 0.035;
  const jambA = box(revealDepth, win.y1 - win.y0, 0.035, revealMat);
  jambA.position.set(revealX, win.cy, win.z0 + 0.017);
  group.add(jambA);
  const jambB = box(revealDepth, win.y1 - win.y0, 0.035, revealMat);
  jambB.position.set(revealX, win.cy, win.z1 - 0.017);
  group.add(jambB);
  const jambTop = box(revealDepth, 0.035, win.z1 - win.z0, revealMat);
  jambTop.position.set(revealX, win.y1 - 0.017, win.cz);
  group.add(jambTop);
  const jambBottom = box(revealDepth, 0.035, win.z1 - win.z0, revealMat);
  jambBottom.position.set(revealX, win.y0 + 0.017, win.cz);
  group.add(jambBottom);

  const floor = mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), floorMat, false, true, 'floor');
  floor.rotation.x = -Math.PI / 2;
  group.add(floor);

  const ceiling = mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), ceilingMat, false, true);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = ROOM.h;
  group.add(ceiling);

  // плинтусы
  const baseH = 0.13;
  const baseD = 0.038;
  const addBase = (w, d, x, z, rotY = 0) => {
    const b = box(w, baseH, d, trimMat, false, true);
    b.position.set(x, baseH / 2, z);
    b.rotation.y = rotY;
    group.add(b);
  };
  addBase(ROOM.w, baseD, 0, ROOM.back + baseD / 2);
  addBase(ROOM.w, baseD, 0, ROOM.front - baseD / 2);
  addBase(ROOM.d, baseD, ROOM.left + baseD / 2, 0, Math.PI / 2);
  addBase(ROOM.d, baseD, ROOM.right - baseD / 2, 0, Math.PI / 2);

  // узкий карниз
  const crownH = 0.055;
  const addCrown = (w, d, x, z, rotY = 0) => {
    const b = box(w, crownH, d, trimMat, false, true);
    b.position.set(x, ROOM.h - crownH / 2, z);
    b.rotation.y = rotY;
    group.add(b);
  };
  addCrown(ROOM.w, 0.038, 0, ROOM.back + 0.019);
  addCrown(ROOM.w, 0.038, 0, ROOM.front - 0.019);
  addCrown(ROOM.d, 0.038, ROOM.left + 0.019, 0, Math.PI / 2);
  addCrown(ROOM.d, 0.038, ROOM.right - 0.019, 0, Math.PI / 2);

  /* ----------------------------- окно ------------------------------ */

  const windowGroup = new THREE.Group();
  group.add(windowGroup);

  const frameMat = whitePlastic;
  const frameX = ROOM.right - 0.035;
  const frameDepth = 0.07;
  const sideW = 0.065;

  const addFrame = (h, zWidth, y, z) => {
    const m = box(frameDepth, h, zWidth, frameMat);
    m.position.set(frameX, y, z);
    windowGroup.add(m);
  };

  addFrame(win.y1 - win.y0, sideW, win.cy, win.z0 + sideW / 2);
  addFrame(win.y1 - win.y0, sideW, win.cy, win.z1 - sideW / 2);
  addFrame(sideW, win.z1 - win.z0, win.y1 - sideW / 2, win.cz);
  addFrame(sideW, win.z1 - win.z0, win.y0 + sideW / 2, win.cz);
  addFrame(win.y1 - win.y0 - 0.12, 0.055, win.cy, win.cz);

  // створки: вторая, вертикальная, чуть утоплена
  const sashW = win.z1 - win.z0 - 0.13;
  const sashH = win.y1 - win.y0 - 0.13;
  const sashZ = win.cz + 0.035;
  const sashFrame = 0.035;
  for (const [h, zw, y, z] of [
    [sashH, sashFrame, win.cy, sashZ - sashW / 2],
    [sashH, sashFrame, win.cy, sashZ + sashW / 2],
    [sashFrame, sashW, win.cy + sashH / 2, sashZ],
    [sashFrame, sashW, win.cy - sashH / 2, sashZ],
  ]) {
    const m = box(frameDepth + 0.008, h, zw, frameMat);
    m.position.set(frameX - 0.005, y, z);
    windowGroup.add(m);
  }

  // уплотнители
  const gasketMat = mat({ color: 0x2d302c, roughness: 0.8 });
  for (const [h, zw, y, z] of [
    [sashH - 0.02, 0.008, win.cy, sashZ - sashW / 2 + 0.021],
    [sashH - 0.02, 0.008, win.cy, sashZ + sashW / 2 - 0.021],
  ]) {
    const m = box(0.008, h, zw, gasketMat, false, false);
    m.position.set(frameX - 0.03, y, z);
    windowGroup.add(m);
  }

  // ручка вертикальной створки
  const handleBase = cylinder(0.018, 0.018, 0.02, whitePlastic, 12, false);
  handleBase.rotation.z = Math.PI / 2;
  handleBase.position.set(frameX - 0.055, 1.53, win.cz - 0.07);
  windowGroup.add(handleBase);
  const handle = box(0.022, 0.11, 0.028, whitePlastic, false, true);
  handle.position.set(frameX - 0.065, 1.49, win.cz - 0.07);
  windowGroup.add(handle);

  // подоконник
  const sill = box(0.33, 0.055, win.z1 - win.z0 + 0.24, paint);
  sill.position.set(ROOM.right - 0.145, win.y0 - 0.015, win.cz);
  windowGroup.add(sill);
  const sillLip = box(0.045, 0.035, win.z1 - win.z0 + 0.27, trimMat);
  sillLip.position.set(ROOM.right - 0.3, win.y0 - 0.035, win.cz);
  windowGroup.add(sillLip);

  // стекло
  const glassMaterial = createWindowGlassMaterial();
  const windowGlass = mesh(
    new THREE.PlaneGeometry(win.z1 - win.z0 - 0.09, win.y1 - win.y0 - 0.09),
    glassMaterial,
    false,
    false
  );
  windowGlass.rotation.y = -Math.PI / 2;
  windowGlass.position.set(ROOM.right + 0.02, win.cy, win.cz);
  windowGlass.renderOrder = 4;
  windowGroup.add(windowGlass);

  // зелёные римские шторы
  const blindWidth = win.z1 - win.z0 + 0.16;
  const blindHeight = 0.3;
  const blind = new THREE.Group();
  blind.position.set(ROOM.right - 0.052, win.y1 + 0.305 - blindHeight / 2, win.cz);
  blind.rotation.y = -Math.PI / 2;
  windowGroup.add(blind);
  const blindCanvas = mesh(makeWavyBlind(blindWidth, blindHeight, 4), blindMat, false, true);
  blind.add(blindCanvas);
  const blindValance = box(blindWidth + 0.04, 0.055, 0.045, blindMat, false, true);
  blindValance.position.set(0, blindHeight / 2 - 0.01, 0.018);
  blind.add(blindValance);
  const blindBar = cylinder(0.008, 0.008, blindWidth, carvedTrimMat, 10, false);
  blindBar.rotation.z = Math.PI / 2;
  blindBar.position.set(0, -blindHeight / 2 + 0.012, 0.03);
  blind.add(blindBar);
  for (const x of [blindWidth / 2 - 0.09, -blindWidth / 2 + 0.09]) {
    const cord = cylinder(0.0025, 0.0025, blindHeight + 0.04, carvedTrimMat, 6, false);
    cord.position.set(x, -0.02, 0.035);
    blind.add(cord);
    const acorn = mesh(new THREE.SphereGeometry(0.012, 8, 6), carvedTrimMat, false, true);
    acorn.scale.y = 1.35;
    acorn.position.set(x, -blindHeight / 2 + 0.01, 0.035);
    blind.add(acorn);
  }

  // радиатор
  const radiator = new THREE.Group();
  radiator.position.set(ROOM.right - 0.055, 0.49, win.cz);
  group.add(radiator);
  const radPanel = box(0.075, 0.43, 0.72, radiatorMat);
  radiator.add(radPanel);
  for (let i = 0; i < 9; i++) {
    const rib = box(0.012, 0.4, 0.05, radiatorMat, false, true);
    rib.position.set(-0.043, 0, -0.31 + i * 0.0775);
    radiator.add(rib);
  }
  const radTop = box(0.085, 0.025, 0.76, radiatorMat, false, true);
  radTop.position.y = 0.222;
  radiator.add(radTop);
  for (const z of [-0.28, 0.28]) {
    const pipe = cylinder(0.012, 0.012, 0.22, radiatorMat, 8, false);
    pipe.position.set(-0.01, -0.34, z);
    radiator.add(pipe);
  }
  const valve = cylinder(0.026, 0.026, 0.05, brassMat, 10, false);
  valve.rotation.x = Math.PI / 2;
  valve.position.set(-0.02, -0.2, 0.38);
  radiator.add(valve);

  /* ------------------------ термометр у окна ----------------------- */

  const thermo = new THREE.Group();
  const thermoCase = box(0.17, 0.115, 0.018, mat({ color: 0xdcd8cb, roughness: 0.5 }), false, true);
  thermo.add(thermoCase);
  const thermoFace = mesh(
    new THREE.PlaneGeometry(0.145, 0.09),
    mat({ map: T.thermometer, roughness: 0.42, metalness: 0.02, emissive: 0x9db29a, emissiveMap: T.thermometer, emissiveIntensity: 0.24 }),
    false,
    false
  );
  thermoFace.position.z = 0.011;
  thermo.add(thermoFace);
  for (let i = 0; i < 2; i++) {
    const b = cylinder(0.008, 0.008, 0.006, mat({ color: 0x77766c, roughness: 0.7 }), 8, false);
    b.rotation.x = Math.PI / 2;
    b.position.set(0.035 + i * 0.027, -0.033, 0.012);
    thermo.add(b);
  }
  thermo.position.set(ROOM.right - 0.012, 1.66, win.z0 - 0.13);
  thermo.rotation.y = -Math.PI / 2;
  group.add(thermo);

  /* ----------------------- дверь, выключатели ---------------------- */

  const doorGroup = new THREE.Group();
  doorGroup.position.set(ROOM.door.x, 0, ROOM.back + 0.035);
  doorGroup.rotation.y = Math.PI;
  group.add(doorGroup);

  const leaf = box(ROOM.door.w, ROOM.door.h, 0.055, oakMat);
  leaf.position.set(0, ROOM.door.h / 2, 0);
  doorGroup.add(leaf);

  for (const [y, h] of [[1.56, 0.62], [0.68, 0.66]]) {
    const panel = box(0.66, h, 0.014, oakDarkMat, false, true);
    panel.position.set(0, y, -0.036);
    doorGroup.add(panel);
    const inset = box(0.57, h - 0.1, 0.012, oakMat, false, true);
    inset.position.set(0, y, -0.045);
    doorGroup.add(inset);
    const top = box(0.54, 0.022, 0.01, carvedTrimMat, false, true);
    top.position.set(0, y + h / 2 - 0.05, -0.052);
    doorGroup.add(top);
    const bottom = box(0.54, 0.022, 0.01, carvedTrimMat, false, true);
    bottom.position.set(0, y - h / 2 + 0.05, -0.052);
    doorGroup.add(bottom);
  }

  // наличники двери
  const casing = (w, h, x, y) => {
    const c = box(w, h, 0.045, trimMat);
    c.position.set(x, y, 0.015);
    doorGroup.add(c);
  };
  casing(0.085, ROOM.door.h + 0.13, -ROOM.door.w / 2 - 0.045, ROOM.door.h / 2 + 0.015);
  casing(0.085, ROOM.door.h + 0.13, ROOM.door.w / 2 + 0.045, ROOM.door.h / 2 + 0.015);
  casing(ROOM.door.w + 0.175, 0.085, 0, ROOM.door.h + 0.06);

  const threshold = box(ROOM.door.w + 0.06, 0.025, 0.15, woodDarkMat, false, true);
  threshold.position.set(0, 0.0125, -0.015);
  doorGroup.add(threshold);

  const doorRose = cylinder(0.028, 0.028, 0.012, brassMat, 16, false);
  doorRose.rotation.x = Math.PI / 2;
  doorRose.position.set(0.34, 1.02, -0.07);
  doorGroup.add(doorRose);
  const lever = box(0.12, 0.022, 0.024, brassMat, false, true);
  lever.position.set(0.28, 1.02, -0.083);
  doorGroup.add(lever);
  const peephole = mesh(new THREE.SphereGeometry(0.018, 14, 10), brassMat, false, true);
  peephole.position.set(0, 1.55, -0.045);
  doorGroup.add(peephole);
  const keyhole = box(
    0.022,
    0.045,
    0.008,
    mat({ color: 0x17130e, roughness: 0.65, metalness: 0.2 }),
    false,
    true
  );
  keyhole.position.set(0.34, 0.94, -0.062);
  doorGroup.add(keyhole);

  // круглая вентиляционная решётка над дверью
  const vent = new THREE.Group();
  const ventBack = mesh(new THREE.CircleGeometry(0.083, 32), mat({ color: 0x4d4b42, roughness: 0.82 }), false, false);
  vent.add(ventBack);
  const ventRing = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.009, 6, 32), whitePlastic);
  ventRing.position.z = 0.008;
  vent.add(ventRing);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const spoke = box(0.012, 0.065, 0.008, trimMat, false, false);
    spoke.position.set(Math.cos(a) * 0.03, Math.sin(a) * 0.03, 0.005);
    spoke.rotation.z = a;
    vent.add(spoke);
  }
  const ventCenter = cylinder(0.012, 0.012, 0.008, whitePlastic, 10, false);
  ventCenter.rotation.x = Math.PI / 2;
  ventCenter.position.z = 0.012;
  vent.add(ventCenter);
  vent.position.set(ROOM.door.x, 2.39, ROOM.back + 0.012);
  group.add(vent);

  /* ------------------------ розетки и выключатели ------------------ */

  function makeSwitch() {
    const g = new THREE.Group();
    const plate = box(0.082, 0.12, 0.012, trimMat, false, true);
    plate.position.z = 0.006;
    g.add(plate);
    const rocker = box(0.031, 0.05, 0.013, whitePlastic, false, true);
    rocker.position.set(0, 0.004, 0.018);
    rocker.rotation.x = -0.07;
    g.add(rocker);
    for (const y of [-0.043, 0.043]) {
      const screw = mesh(new THREE.SphereGeometry(0.0035, 6, 4), chromeMat, false, false);
      screw.position.set(0, y, 0.014);
      g.add(screw);
    }
    return g;
  }

  function makeSocket(count = 2) {
    const g = new THREE.Group();
    const w = 0.036 + count * 0.061;
    const plate = box(w, 0.096, 0.012, trimMat, false, true);
    plate.position.z = 0.006;
    g.add(plate);
    for (let i = 0; i < count; i++) {
      const cx = (i - (count - 1) / 2) * 0.061;
      const hole = mesh(new THREE.CircleGeometry(0.018, 18), mat({ color: 0x35342d, roughness: 0.72 }), false, false);
      hole.position.set(cx, 0, 0.013);
      g.add(hole);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.019, 0.0035, 5, 18), trimMat);
      ring.position.set(cx, 0, 0.014);
      g.add(ring);
      for (const dx of [-0.006, 0.006]) {
        const contact = mesh(new THREE.CircleGeometry(0.0026, 8), chromeMat, false, false);
        contact.position.set(cx + dx, 0.002, 0.018);
        g.add(contact);
      }
    }
    for (const x of [-w / 2 + 0.009, w / 2 - 0.009]) {
      const screw = mesh(new THREE.SphereGeometry(0.0035, 6, 4), chromeMat, false, false);
      screw.position.set(x, 0.032, 0.014);
      g.add(screw);
    }
    return g;
  }

  function placeOnWall(obj, wall, along, y, offset = 0.012) {
    if (wall === 'front') {
      obj.position.set(along, y, ROOM.front - offset);
      obj.rotation.y = Math.PI;
    } else if (wall === 'back') {
      obj.position.set(along, y, ROOM.back + offset);
    } else if (wall === 'left') {
      obj.position.set(ROOM.left + offset, y, along);
      obj.rotation.y = Math.PI / 2;
    } else {
      obj.position.set(ROOM.right - offset, y, along);
      obj.rotation.y = -Math.PI / 2;
    }
    group.add(obj);
    return obj;
  }

  placeOnWall(makeSwitch(), 'back', -0.48, 1.27);
  placeOnWall(makeSocket(2), 'back', -0.48, 0.38);
  placeOnWall(makeSocket(1), 'back', 0.36, 0.38);

  placeOnWall(makeSocket(1), 'left', 1.82, 0.86);
  placeOnWall(makeSocket(1), 'left', 1.08, 0.86);

  /* ----------------------------- зеркало --------------------------- */

  const oval = makeOvalMirror(mirrorMat);
  oval.position.set(1.54, 1.78, ROOM.back + 0.012);
  oval.scale.set(1.15, 1.15, 1);
  group.add(oval);

  /* ------------------------------ стол ----------------------------- */

  const desk = new THREE.Group();
  group.add(desk);
  const deskShape = new THREE.Shape();
  deskShape.moveTo(2.06, 0.85);
  deskShape.lineTo(2.06, 2.34);
  deskShape.lineTo(0.68, 2.34);
  deskShape.lineTo(0.68, 1.78);
  deskShape.lineTo(1.34, 1.78);
  deskShape.quadraticCurveTo(1.88, 1.56, 1.63, 0.85);
  deskShape.closePath();
  const deskGeo = new THREE.ExtrudeGeometry(deskShape, { depth: 0.045, bevelEnabled: false, steps: 1 });
  const deskTop = mesh(deskGeo, woodMidMat);
  deskTop.rotation.x = Math.PI / 2;
  deskTop.position.y = 0.75;
  desk.add(deskTop);

  const deskLegs = [
    [1.86, 0.98],
    [1.86, 1.7],
    [1.86, 2.18],
    [0.78, 2.18],
    [1.44, 1.84],
  ];
  for (const [x, z] of deskLegs) {
    const leg = cylinder(0.025, 0.031, 0.75, woodMidMat, 10, true);
    leg.position.set(x, 0.375, z);
    desk.add(leg);
    const foot = cylinder(0.032, 0.032, 0.012, blackMat, 10, false);
    foot.position.set(x, 0.006, z);
    desk.add(foot);
  }
  // тонкие царги под столешницей
  for (const [x0, z0, x1, z1] of [
    [0.72, 2.24, 2.0, 2.24],
    [1.96, 0.98, 1.96, 2.24],
  ]) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const beam = box(0.035, 0.06, len, woodDarkMat, false, true);
    beam.position.set((x0 + x1) / 2, 0.7, (z0 + z1) / 2);
    beam.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    desk.add(beam);
  }

  /* --------------------------- высокий стул ------------------------- */

  const chair = new THREE.Group();
  chair.position.set(1.16, 0, 1.5);
  chair.rotation.y = Math.PI / 2;
  group.add(chair);
  const seat = mesh(new RoundedBoxGeometry(0.52, 0.055, 0.48, 2, 0.018), woodBeechMat);
  seat.position.y = 0.47;
  chair.add(seat);
  for (const x of [-0.215, 0.215]) {
    for (const z of [-0.195, 0.195]) {
      const leg = box(0.038, 0.47, 0.038, woodBeechMat);
      leg.position.set(x, 0.235, z);
      chair.add(leg);
    }
  }
  for (const z of [-0.195, 0.195]) {
    const stretcher = box(0.4, 0.025, 0.025, woodBeechMat, false, true);
    stretcher.position.set(0, 0.18, z);
    chair.add(stretcher);
  }
  // высокая спинка
  for (const x of [-0.225, 0.225]) {
    const post = box(0.045, 0.82, 0.045, woodBeechMat);
    post.position.set(x, 0.88, -0.215);
    chair.add(post);
    const finial = mesh(new THREE.SphereGeometry(0.02, 8, 6), woodBeechMat, false, true);
    finial.position.set(x, 1.3, -0.215);
    chair.add(finial);
  }
  const backRail = box(0.51, 0.07, 0.05, woodBeechMat);
  backRail.position.set(0, 1.26, -0.22);
  chair.add(backRail);
  const backPanel = box(0.45, 0.55, 0.035, woodBeechMat);
  backPanel.position.set(0, 0.93, -0.225);
  chair.add(backPanel);
  const backInset = box(0.34, 0.42, 0.012, carvedTrimMat, false, true);
  backInset.position.set(0, 0.93, -0.247);
  chair.add(backInset);
  const backBottom = box(0.47, 0.055, 0.04, woodBeechMat);
  backBottom.position.set(0, 0.63, -0.222);
  chair.add(backBottom);

  /* ------------------------------ шкаф ----------------------------- */

  const cabinet = new THREE.Group();
  cabinet.position.set(0.0, 0, ROOM.front - 0.012);
  cabinet.rotation.y = Math.PI;
  group.add(cabinet);
  const cabW = 1.0;
  const cabD = 0.36;
  const cabH = 1.94;

  // нижняя тумба и каркас
  const cabBase = box(cabW, 0.84, cabD, woodDarkMat);
  cabBase.position.set(0, 0.42, cabD / 2);
  cabinet.add(cabBase);
  const cabPlinth = box(cabW - 0.03, 0.07, cabD - 0.025, blackMat);
  cabPlinth.position.set(0, 0.035, cabD / 2);
  cabinet.add(cabPlinth);

  for (const x of [-cabW / 2 + 0.035, cabW / 2 - 0.035]) {
    const side = box(0.07, 1.09, cabD, woodDarkMat);
    side.position.set(x, 1.385, cabD / 2);
    cabinet.add(side);
  }
  const cabTop = box(cabW + 0.06, 0.085, cabD + 0.035, woodDarkMat);
  cabTop.position.set(0, 1.8575, cabD / 2);
  cabinet.add(cabTop);
  const cornice = box(cabW + 0.1, 0.055, cabD + 0.065, carvedTrimMat);
  cornice.position.set(0, 1.9275, cabD / 2);
  cabinet.add(cornice);
  const cabBack = box(cabW - 0.04, cabH - 0.12, 0.025, woodMidMat);
  cabBack.position.set(0, 0.92, 0.035);
  cabinet.add(cabBack);

  // нижние дверцы
  const addDoor = (x, y, w, h, frontZ = cabD + 0.005) => {
    const d = box(w, h, 0.026, woodMidMat);
    d.position.set(x, y, frontZ);
    cabinet.add(d);
    const inner = box(w - 0.085, h - 0.1, 0.012, woodDarkMat, false, true);
    inner.position.set(x, y, frontZ + 0.012);
    cabinet.add(inner);
    const trimW = 0.032;
    const trimD = 0.013;
    const trimZ = frontZ + 0.02;
    const top = box(w - 0.06, trimW, trimD, carvedTrimMat, false, true);
    top.position.set(x, y + h / 2 - 0.05, trimZ);
    cabinet.add(top);
    const bottom = box(w - 0.06, trimW, trimD, carvedTrimMat, false, true);
    bottom.position.set(x, y - h / 2 + 0.05, trimZ);
    cabinet.add(bottom);
    const left = box(trimW, h - 0.07, trimD, carvedTrimMat, false, true);
    left.position.set(x - w / 2 + 0.05, y, trimZ);
    cabinet.add(left);
    const right = box(trimW, h - 0.07, trimD, carvedTrimMat, false, true);
    right.position.set(x + w / 2 - 0.05, y, trimZ);
    cabinet.add(right);
    // завитки по углам наличника
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const curl = new THREE.Mesh(
          new THREE.TorusGeometry(0.021, 0.005, 5, 12, Math.PI * 1.35),
          carvedTrimMat
        );
        curl.position.set(x + sx * (w / 2 - 0.036), y + sy * (h / 2 - 0.036), trimZ + 0.004);
        curl.rotation.z = sx * sy > 0 ? 0.4 : Math.PI - 0.4;
        cabinet.add(curl);
      }
    }
    const knob = mesh(new THREE.SphereGeometry(0.017, 10, 8), brassMat, false, true);
    knob.position.set(x + (x < 0 ? w / 2 - 0.055 : -w / 2 + 0.055), y, frontZ + 0.035);
    cabinet.add(knob);
  };

  addDoor(-0.245, 0.49, 0.44, 0.72);
  addDoor(0.245, 0.49, 0.44, 0.72);

  // верхние боковые дверцы
  addDoor(-0.365, 1.37, 0.19, 0.78);
  addDoor(0.365, 1.37, 0.19, 0.78);

  // открытая ниша с зеркалом в глубине
  const nicheW = 0.55;
  const nicheY0 = 0.9;
  const nicheY1 = 1.84;
  const nicheZ = 0.1;
  const nicheMirror = mesh(new THREE.PlaneGeometry(nicheW - 0.02, nicheY1 - nicheY0 - 0.03), mirrorMat, false, false);
  nicheMirror.position.set(0, (nicheY0 + nicheY1) / 2, nicheZ);
  nicheMirror.rotation.y = Math.PI;
  nicheMirror.name = 'cabinet-mirror';
  cabinet.add(nicheMirror);
  const nicheShelf = box(nicheW, 0.032, 0.27, woodMidMat);
  nicheShelf.position.set(0, 1.35, cabD - 0.02);
  cabinet.add(nicheShelf);
  const nicheTrimTop = box(nicheW + 0.04, 0.04, 0.05, carvedTrimMat, false, true);
  nicheTrimTop.position.set(0, nicheY1 + 0.01, cabD + 0.002);
  cabinet.add(nicheTrimTop);
  const nicheTrimBottom = box(nicheW + 0.04, 0.04, 0.05, carvedTrimMat, false, true);
  nicheTrimBottom.position.set(0, nicheY0 - 0.01, cabD + 0.002);
  cabinet.add(nicheTrimBottom);
  for (const x of [-nicheW / 2, nicheW / 2]) {
    const sideTrim = box(0.04, nicheY1 - nicheY0, 0.05, carvedTrimMat, false, true);
    sideTrim.position.set(x, (nicheY0 + nicheY1) / 2, cabD + 0.002);
    cabinet.add(sideTrim);
  }
  // пара книг на полке
  for (let i = 0; i < 3; i++) {
    const book = box(0.028, 0.18 + i * 0.015, 0.15, mat({ color: [0x5c3b2d, 0x354b40, 0x7c6338][i], roughness: 0.8 }));
    book.position.set(-0.17 + i * 0.04, 1.36 + 0.09 + i * 0.008, cabD - 0.04);
    book.rotation.z = (i - 1) * 0.04;
    cabinet.add(book);
  }

  /* ------------------------------ кровать -------------------------- */

  const bed = new THREE.Group();
  bed.position.set(-1.44, 0, 1.37);
  bed.rotation.y = Math.PI;
  group.add(bed);

  const bedHalfW = 0.6;
  const bedHalfL = 0.95;
  const headZ = -bedHalfL;
  const footZ = bedHalfL;

  // каркас
  for (const x of [-bedHalfW + 0.03, bedHalfW - 0.03]) {
    for (const z of [headZ, footZ]) {
      const post = cylinder(0.022, 0.024, z === headZ ? 1.06 : 0.7, ironMat, 10, true);
      post.position.set(x, z === headZ ? 0.53 : 0.35, z);
      bed.add(post);
      const cap = mesh(new THREE.SphereGeometry(0.028, 10, 8), ironMat, false, true);
      cap.position.set(x, z === headZ ? 1.06 : 0.7, z);
      bed.add(cap);
    }
  }
  for (const z of [headZ, footZ]) {
    bed.add(rod(new V(-bedHalfW, 0.36, z), new V(bedHalfW, 0.36, z), 0.017, ironMat, 0.017, 0.017, 8));
  }
  for (const x of [-bedHalfW, bedHalfW]) {
    bed.add(rod(new V(x, 0.37, headZ), new V(x, 0.37, footZ), 0.017, ironMat));
  }
  // спинка у изголовья
  bed.add(rod(new V(-bedHalfW, 1.02, headZ), new V(bedHalfW, 1.02, headZ), 0.02, ironMat, 0.02, 0.02, 10));
  for (let i = 0; i < 7; i++) {
    const x = -bedHalfW + 0.08 + i * ((bedHalfW * 2 - 0.16) / 6);
    bed.add(rod(new V(x, 0.38, headZ), new V(x, 1.01, headZ), 0.011, ironMat, 0.011, 0.011, 6));
  }
  // низкая спинка в ногах
  bed.add(rod(new V(-bedHalfW, 0.67, footZ), new V(bedHalfW, 0.67, footZ), 0.018, ironMat, 0.018, 0.018, 8));
  for (let i = 0; i < 7; i++) {
    const x = -bedHalfW + 0.08 + i * ((bedHalfW * 2 - 0.16) / 6);
    bed.add(rod(new V(x, 0.38, footZ), new V(x, 0.66, footZ), 0.01, ironMat, 0.01, 0.01, 6));
  }

  // матрас и постель
  const mattress = mesh(new RoundedBoxGeometry(1.16, 0.18, 1.84, 2, 0.055), beddingMat);
  mattress.position.set(0, 0.47, 0);
  bed.add(mattress);

  const blanket = mesh(new RoundedBoxGeometry(1.18, 0.055, 1.15, 2, 0.025), blanketMat);
  blanket.position.set(0, 0.575, 0.31);
  bed.add(blanket);
  const blanketFold = mesh(new RoundedBoxGeometry(1.18, 0.045, 0.22, 2, 0.02), blanketMat);
  blanketFold.position.set(0, 0.6, -0.23);
  blanketFold.rotation.x = 0.12;
  bed.add(blanketFold);

  const pillow = mesh(new RoundedBoxGeometry(0.53, 0.12, 0.32, 3, 0.055), beddingMat);
  pillow.position.set(0, 0.62, -0.66);
  pillow.rotation.x = -0.08;
  pillow.rotation.z = 0.015;
  bed.add(pillow);
  const pillow2 = mesh(new RoundedBoxGeometry(0.47, 0.1, 0.28, 3, 0.05), beddingMat);
  pillow2.position.set(-0.03, 0.6, -0.38);
  pillow2.rotation.x = 0.05;
  pillow2.rotation.y = 0.08;
  bed.add(pillow2);

  /* -------------------------- светильник у кровати ------------------ */

  const sconce = new THREE.Group();
  sconce.position.set(ROOM.left + 0.012, 2.16, 1.37);
  sconce.rotation.y = Math.PI / 2;
  group.add(sconce);
  const sconcePlate = cylinder(0.085, 0.09, 0.028, brassMat, 28, false);
  sconcePlate.rotation.x = Math.PI / 2;
  sconcePlate.position.z = 0.014;
  sconce.add(sconcePlate);
  const sconceRing = new THREE.Mesh(new THREE.TorusGeometry(0.091, 0.008, 6, 32), brassMat);
  sconceRing.position.z = 0.032;
  sconce.add(sconceRing);
  const sconceGlass = mesh(new THREE.CircleGeometry(0.077, 32), sconceGlassMat, false, false);
  sconceGlass.position.z = 0.031;
  sconce.add(sconceGlass);
  const sconceDome = mesh(
    new THREE.SphereGeometry(0.077, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    sconceGlassMat,
    false,
    false
  );
  sconceDome.rotation.x = Math.PI / 2;
  sconceDome.scale.z = 0.62;
  sconceDome.position.z = 0.031;
  sconce.add(sconceDome);
  const sconceGlow = addGlowSprite(sconce, 0xffc07b, 0, 0, 0.055, 0.55, 0.36);
  sconceGlow.position.z = 0.07;

  const sconceLight = new THREE.PointLight(0xffb870, 2.6, 3.4, 2.0);
  sconceLight.position.set(ROOM.left + 0.24, 2.1, 1.37);
  sconceLight.userData.baseIntensity = 2.6;
  group.add(sconceLight);
  lampLights.push(sconceLight);

  /* ----------------------------- люстра ---------------------------- */

  const chandelier = new THREE.Group();
  chandelier.position.set(0, ROOM.h, 0.0);
  group.add(chandelier);

  const canopy = cylinder(0.085, 0.11, 0.035, chromeMat, 28, false);
  canopy.position.y = -0.018;
  chandelier.add(canopy);
  const canopyRing = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.007, 6, 28), chromeMat);
  canopyRing.rotation.x = Math.PI / 2;
  canopyRing.position.y = -0.038;
  chandelier.add(canopyRing);
  const stem = cylinder(0.012, 0.012, 0.34, chromeMat, 10, false);
  stem.position.y = -0.19;
  chandelier.add(stem);
  const stemBead = mesh(new THREE.SphereGeometry(0.03, 14, 10), chromeMat, false, true);
  stemBead.position.y = -0.38;
  chandelier.add(stemBead);

  const ufoBodyMat = mat({ color: 0xe8e1cf, roughness: 0.3, metalness: 0.38, envMapIntensity: 0.95 });
  const ufo = mesh(new THREE.CylinderGeometry(0.23, 0.38, 0.23, 64, 1, false), ufoBodyMat);
  ufo.position.y = -0.51;
  chandelier.add(ufo);
  const ufoTop = mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.018, 64), ufoBodyMat, false, true);
  ufoTop.position.y = -0.393;
  chandelier.add(ufoTop);
  const ufoTopRing = new THREE.Mesh(new THREE.TorusGeometry(0.232, 0.008, 6, 48), chromeMat);
  ufoTopRing.rotation.x = Math.PI / 2;
  ufoTopRing.position.y = -0.384;
  chandelier.add(ufoTopRing);
  const ufoBottomRing = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.012, 8, 64), chromeMat);
  ufoBottomRing.rotation.x = Math.PI / 2;
  ufoBottomRing.position.y = -0.625;
  chandelier.add(ufoBottomRing);

  const diffuser = mesh(new THREE.CylinderGeometry(0.335, 0.335, 0.018, 64, 1), diffuserMat, false, false);
  diffuser.position.y = -0.635;
  chandelier.add(diffuser);
  const bottomGlow = addGlowSprite(chandelier, 0xffc27b, 0, -0.645, 0, 0.95, 0.3);

  // иллюминаторы по окружности
  const portholeCount = 10;
  for (let i = 0; i < portholeCount; i++) {
    const a = (i / portholeCount) * Math.PI * 2;
    const r = 0.342;
    const p = new THREE.Group();
    p.position.set(Math.cos(a) * r, -0.56, Math.sin(a) * r);
    p.rotation.y = Math.PI / 2 - a;
    chandelier.add(p);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.0085, 6, 24), chromeMat);
    ring.position.z = 0.006;
    p.add(ring);
    const glass = mesh(new THREE.CircleGeometry(0.049, 24), portholeMat, false, false);
    glass.position.z = 0.003;
    p.add(glass);
    const back = mesh(
      new THREE.CircleGeometry(0.058, 22),
      mat({ color: 0x302a20, roughness: 0.8, transparent: true, opacity: 1, depthWrite: false }),
      false,
      false
    );
    back.position.z = -0.004;
    p.add(back);
    lampBacks.push(back.material);
    if (i % 2 === 0) {
      const sprite = addGlowSprite(p, 0xffc777, 0, 0, 0.045, 0.145, 0.34);
      sprite.userData.base = 0.7;
    }
  }

  const chandelierLight = new THREE.PointLight(0xffc47f, 16, 7.2, 2.0);
  chandelierLight.position.y = -0.61;
  chandelierLight.castShadow = true;
  chandelierLight.shadow.mapSize.set(1024, 1024);
  chandelierLight.shadow.bias = -0.002;
  chandelierLight.shadow.normalBias = 0.02;
  chandelierLight.shadow.camera.near = 0.1;
  chandelierLight.shadow.camera.far = 8;
  chandelierLight.userData.baseIntensity = 16;
  chandelier.add(chandelierLight);
  lampLights.push(chandelierLight);

  // корпус люстры не должен затенять собственный свет
  chandelier.traverse((child) => {
    if (child.isMesh) child.castShadow = false;
  });

  // пыль
  const dust = createDust({ count: 180 });
  group.add(dust);

  /* --------------------------- табурет ----------------------------- */

  const stool = new THREE.Group();
  stool.position.set(0.18, 0, 0.35);
  group.add(stool);
  const stoolMat = mat({ map: T.woodOak, color: 0xcbb08b, roughness: 0.56, metalness: 0.02, envMapIntensity: 0.42 });
  const stoolSeat = mesh(new RoundedBoxGeometry(0.35, 0.045, 0.31, 2, 0.012), stoolMat);
  stoolSeat.position.y = 0.43;
  stool.add(stoolSeat);
  for (const x of [-0.14, 0.14]) {
    for (const z of [-0.115, 0.115]) {
      const leg = box(0.034, 0.43, 0.034, stoolMat);
      leg.position.set(x, 0.215, z);
      stool.add(leg);
    }
  }
  for (const y of [0.16, 0.32]) {
    for (const z of [-0.115, 0.115]) {
      const rail = box(0.29, 0.02, 0.02, stoolMat, false, true);
      rail.position.set(0, y, z);
      stool.add(rail);
    }
  }

  return {
    group,
    lampMaterials,
    lampLights,
    lampGlowMaterials,
    lampSprites,
    lampBacks,
    chandelierLight,
    sconceLight,
    windowGlass,
    dust,
    glassMaterial,
    setLampState(on) {
      for (const m of lampMaterials) m.emissiveIntensity = on ? m.userData.lampBase : 0;
      for (const m of lampBacks) m.opacity = on ? 0 : 1;
      for (const l of lampLights) l.intensity = on ? l.userData.baseIntensity : 0;
      for (const s of lampSprites) {
        s.material.opacity = on ? (s.material.userData.baseOpacity ?? 0) * (s.userData.base ?? 1) : 0;
      }
    },
    setLampLevel(level) {
      for (const m of lampMaterials) m.emissiveIntensity = m.userData.lampBase * level;
      for (const m of lampBacks) m.opacity = 1 - level;
      for (const l of lampLights) l.intensity = l.userData.baseIntensity * level;
      for (const s of lampSprites) {
        s.material.opacity = (s.material.userData.baseOpacity ?? 0) * (s.userData.base ?? 1) * level;
      }
    },
  };
}
