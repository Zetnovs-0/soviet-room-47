import * as THREE from 'three';
import { createSkyMaterial, createPrecipitation } from './shaders.js';

const BASE_Y = -2.6;
const VIEW_Z = 0.0;

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

function makeTree(rnd, mats, x, z, scale = 1) {
  const g = new THREE.Group();
  g.position.set(x, BASE_Y, z);
  const trunkH = (4.0 + rnd() * 1.7) * scale;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08 * scale, 0.17 * scale, trunkH, 7),
    mats.bark
  );
  trunk.position.y = trunkH / 2;
  trunk.castShadow = false;
  trunk.receiveShadow = true;
  g.add(trunk);

  const crownBase = trunkH * 0.5;
  const clusters = 6 + Math.floor(rnd() * 5);
  for (let i = 0; i < clusters; i++) {
    const rad = (0.54 + rnd() * 0.95) * scale;
    const leaf = new THREE.Mesh(
      new THREE.IcosahedronGeometry(rad, 1),
      mats.leaf[Math.floor(rnd() * mats.leaf.length)]
    );
    const a = rnd() * Math.PI * 2;
    const rr = (0.1 + rnd() * 0.55) * scale;
    leaf.position.set(Math.cos(a) * rr, crownBase + rnd() * trunkH * 0.62, Math.sin(a) * rr);
    leaf.scale.set(1, 0.78 + rnd() * 0.4, 1);
    leaf.rotation.set(rnd() * 2, rnd() * 2, rnd() * 2);
    leaf.castShadow = false;
    leaf.receiveShadow = true;
    g.add(leaf);
  }
  return g;
}

function makeSignTexture(text) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 112;
  const x = c.getContext('2d');
  x.fillStyle = '#314b4a';
  x.fillRect(0, 0, 512, 112);
  x.strokeStyle = '#e2d5b8';
  x.lineWidth = 5;
  x.strokeRect(9, 9, 494, 94);
  x.fillStyle = '#e8ddc5';
  x.font = '600 40px "Oswald", "Arial Narrow", sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(text, 256, 58);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function makeWindow(parent, x, y, z, w, h, mat, frameMat) {
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  pane.rotation.y = -Math.PI / 2;
  pane.position.set(x, y, z);
  parent.add(pane);
  const t = 0.035;
  // простая ПВХ-рама четырьмя полосами
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.04, t, w + t * 2), frameMat);
  top.position.set(x - 0.006, y + h / 2, z);
  parent.add(top);
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(0.04, t, w + t * 2), frameMat);
  bottom.position.set(x - 0.006, y - h / 2, z);
  parent.add(bottom);
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.04, h, t), frameMat);
  left.position.set(x - 0.006, y, z - w / 2);
  parent.add(left);
  const right = new THREE.Mesh(new THREE.BoxGeometry(0.04, h, t), frameMat);
  right.position.set(x - 0.006, y, z + w / 2);
  parent.add(right);
  return pane;
}

export function buildOutside(scene, T) {
  const outside = new THREE.Group();
  outside.name = 'outside';
  scene.add(outside);

  const rnd = mulberry(1977);

  /* ------------------------------- небо ---------------------------- */

  const skyMaterial = createSkyMaterial();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(80, 48, 28), skyMaterial);
  sky.renderOrder = -1000;
  sky.frustumCulled = false;
  outside.add(sky);

  /* ------------------------------ земля ---------------------------- */

  const groundMat = new THREE.MeshStandardMaterial({ color: 0x777547, roughness: 0.97, metalness: 0 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(170, 120), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(35, BASE_Y, 0);
  ground.receiveShadow = true;
  outside.add(ground);

  const snowMat = new THREE.MeshStandardMaterial({
    color: 0xdde3e3,
    roughness: 0.9,
    metalness: 0,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const snowGround = new THREE.Mesh(new THREE.PlaneGeometry(170, 120), snowMat);
  snowGround.rotation.x = -Math.PI / 2;
  snowGround.position.set(35, BASE_Y + 0.018, 0);
  snowGround.receiveShadow = true;
  outside.add(snowGround);

  // дорожка к детскому саду
  const pathMat = new THREE.MeshStandardMaterial({ color: 0x68645a, roughness: 0.95 });
  const path = new THREE.Mesh(new THREE.PlaneGeometry(5.7, 2.35), pathMat);
  path.rotation.x = -Math.PI / 2;
  path.position.set(5.05, BASE_Y + 0.025, VIEW_Z);
  path.receiveShadow = true;
  outside.add(path);

  const curbMat = new THREE.MeshStandardMaterial({ color: 0x7c786b, roughness: 0.95 });
  for (const z of [VIEW_Z - 1.26, VIEW_Z + 1.26]) {
    const curb = new THREE.Mesh(new THREE.BoxGeometry(5.7, 0.12, 0.14), curbMat);
    curb.position.set(5.05, BASE_Y + 0.06, z);
    curb.receiveShadow = true;
    outside.add(curb);
  }

  // опавшие листья у деревьев
  const fallenMat = new THREE.MeshStandardMaterial({ color: 0xb8862c, roughness: 0.96 });
  const fallenGeo = new THREE.CircleGeometry(0.22, 7);
  const fallen = new THREE.InstancedMesh(fallenGeo, fallenMat, 54);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 54; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 0.6 + rnd() * 2.6;
    const cx = [5.2, 6.6, 12.4, 14.5, 19.0][i % 5] + Math.cos(a) * r;
    const cz = [4.2, -4.0, 6.2, -7.2, 7.3][i % 5] + Math.sin(a) * r;
    dummy.position.set(cx, BASE_Y + 0.03, cz);
    dummy.rotation.set(-Math.PI / 2, 0, rnd() * Math.PI * 2);
    dummy.scale.setScalar(0.5 + rnd() * 0.8);
    dummy.updateMatrix();
    fallen.setMatrixAt(i, dummy.matrix);
  }
  fallen.instanceMatrix.needsUpdate = true;
  fallen.receiveShadow = true;
  outside.add(fallen);

  /* --------------------------- детский сад ------------------------- */

  const kindergarten = new THREE.Group();
  kindergarten.position.set(10.2, BASE_Y, VIEW_Z);
  outside.add(kindergarten);

  const kgMat = new THREE.MeshStandardMaterial({ color: 0xd6c6a4, roughness: 0.93, metalness: 0 });
  const kgBody = new THREE.Mesh(new THREE.BoxGeometry(4.6, 4.9, 8.4), kgMat);
  kgBody.position.y = 2.45;
  kgBody.castShadow = false;
  kgBody.receiveShadow = true;
  kindergarten.add(kgBody);

  const kgPlinth = new THREE.Mesh(
    new THREE.BoxGeometry(4.72, 0.35, 8.52),
    new THREE.MeshStandardMaterial({ color: 0x847c68, roughness: 0.96 })
  );
  kgPlinth.position.y = 0.175;
  kindergarten.add(kgPlinth);

  const kgRoof = new THREE.Mesh(
    new THREE.BoxGeometry(4.85, 0.22, 8.65),
    new THREE.MeshStandardMaterial({ color: 0x4d5049, roughness: 0.95 })
  );
  kgRoof.position.y = 4.98;
  kgRoof.castShadow = false;
  kindergarten.add(kgRoof);

  const kgParapet = new THREE.Mesh(new THREE.BoxGeometry(4.9, 0.32, 8.7), kgMat);
  kgParapet.position.y = 4.82;
  kindergarten.add(kgParapet);

  const kgWindowMat = new THREE.MeshStandardMaterial({
    color: 0x1c2a2e,
    roughness: 0.38,
    metalness: 0.12,
    emissive: new THREE.Color(0xffb96f),
    emissiveIntensity: 0.15,
  });
  const kgFrameMat = new THREE.MeshStandardMaterial({ color: 0xeee8d9, roughness: 0.5 });
  const facadeX = -2.31;
  const kgWindowZs = [-3.1, -2.05, -1.0, 1.0, 2.05, 3.1];
  for (const y of [0.92, 3.2]) {
    for (const z of kgWindowZs) {
      makeWindow(kindergarten, facadeX, y, z, 0.68, 1.12, kgWindowMat, kgFrameMat);
    }
  }
  // окна над входом
  makeWindow(kindergarten, facadeX, 3.2, 0, 0.74, 1.12, kgWindowMat, kgFrameMat);

  // вход
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x365153, roughness: 0.5, metalness: 0.1 });
  const entrance = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.4, 1.05), doorMat);
  entrance.position.set(facadeX - 0.01, 0.74, 0);
  kindergarten.add(entrance);
  const entranceGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 1.1),
    new THREE.MeshStandardMaterial({ color: 0x8ca6a5, roughness: 0.22, metalness: 0.15, transparent: true, opacity: 0.72 })
  );
  entranceGlass.rotation.y = -Math.PI / 2;
  entranceGlass.position.set(facadeX - 0.06, 0.87, 0);
  kindergarten.add(entranceGlass);
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.08, 1.7), kgFrameMat);
  canopy.position.set(facadeX - 0.38, 1.72, 0);
  kindergarten.add(canopy);
  for (const z of [-0.82, 0.82]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.7, 8), kgFrameMat);
    post.position.set(facadeX - 0.76, 0.86, z);
    kindergarten.add(post);
  }
  for (let i = 0; i < 3; i++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.12, 1.5 - i * 0.16), kgFrameMat);
    step.position.set(facadeX - 0.48 - i * 0.12, 0.06 + i * 0.12, 0);
    kindergarten.add(step);
  }

  // вывеска
  const signTex = makeSignTexture('ДЕТСКИЙ САД · 18');
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.57), new THREE.MeshBasicMaterial({ map: signTex }));
  sign.rotation.y = -Math.PI / 2;
  sign.position.set(facadeX - 0.04, 2.25, 0);
  kindergarten.add(sign);

  // вентиляция на крыше
  for (const z of [-2.4, 2.6]) {
    const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.5, 10), kgFrameMat);
    vent.position.set(0.9, 5.3, z);
    kindergarten.add(vent);
  }

  /* ------------------------ девятиэтажный дом ---------------------- */

  const panelMap = T.building.map.clone();
  const panelEmissive = T.building.emissive.clone();
  panelMap.needsUpdate = true;
  panelEmissive.needsUpdate = true;
  panelMap.wrapS = panelMap.wrapT = THREE.RepeatWrapping;
  panelEmissive.wrapS = panelEmissive.wrapT = THREE.RepeatWrapping;
  panelMap.repeat.set(2, 1);
  panelEmissive.repeat.copy(panelMap.repeat);
  const panelMat = new THREE.MeshStandardMaterial({
    map: panelMap,
    emissiveMap: panelEmissive,
    emissive: new THREE.Color(0xffc47c),
    emissiveIntensity: 0.2,
    roughness: 0.92,
    metalness: 0,
    color: 0xe2ded2,
  });
  const panelHouse = new THREE.Mesh(new THREE.BoxGeometry(6, 10.8, 13.2), panelMat);
  panelHouse.position.set(26.5, BASE_Y + 5.4, VIEW_Z);
  panelHouse.receiveShadow = true;
  panelHouse.castShadow = false;
  outside.add(panelHouse);

  const panelRoof = new THREE.Mesh(
    new THREE.BoxGeometry(6.3, 0.22, 13.5),
    new THREE.MeshStandardMaterial({ color: 0x3d403b, roughness: 0.95 })
  );
  panelRoof.position.set(26.5, BASE_Y + 10.9, VIEW_Z);
  outside.add(panelRoof);

  const lift = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 1.7, 3.2),
    new THREE.MeshStandardMaterial({ color: 0x8f9088, roughness: 0.9 })
  );
  lift.position.set(26.5, BASE_Y + 11.7, VIEW_Z - 2.5);
  outside.add(lift);

  const panelSnow = new THREE.Mesh(new THREE.BoxGeometry(6.35, 0.08, 13.55), snowMat);
  panelSnow.position.set(26.5, BASE_Y + 11.02, VIEW_Z);
  outside.add(panelSnow);

  /* ---------------------- круглая 18-этажка ------------------------ */

  const towerMap = T.tower.map.clone();
  const towerEmissive = T.tower.emissive.clone();
  towerMap.needsUpdate = true;
  towerEmissive.needsUpdate = true;
  towerMap.wrapS = towerMap.wrapT = THREE.RepeatWrapping;
  towerEmissive.wrapS = towerEmissive.wrapT = THREE.RepeatWrapping;
  towerMap.repeat.set(2, 1);
  towerEmissive.repeat.copy(towerMap.repeat);
  const towerMat = new THREE.MeshStandardMaterial({
    map: towerMap,
    emissiveMap: towerEmissive,
    emissive: new THREE.Color(0xffc47c),
    emissiveIntensity: 0.18,
    roughness: 0.9,
    metalness: 0,
    color: 0xefe9de,
  });
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.0, 17.5, 56, 1, false), towerMat);
  tower.position.set(36, BASE_Y + 8.75, VIEW_Z);
  tower.receiveShadow = true;
  tower.castShadow = false;
  outside.add(tower);

  const towerCap = new THREE.Mesh(
    new THREE.CylinderGeometry(3.2, 3.2, 0.25, 56),
    new THREE.MeshStandardMaterial({ color: 0x77776f, roughness: 0.9 })
  );
  towerCap.position.set(36, BASE_Y + 17.6, VIEW_Z);
  outside.add(towerCap);
  const towerRoof = new THREE.Mesh(
    new THREE.CylinderGeometry(2.45, 3.2, 0.8, 32),
    new THREE.MeshStandardMaterial({ color: 0x4e514b, roughness: 0.95 })
  );
  towerRoof.position.set(36, BASE_Y + 18.1, VIEW_Z);
  outside.add(towerRoof);
  const antenna = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.04, 2.2, 6),
    new THREE.MeshStandardMaterial({ color: 0x5d605a, roughness: 0.7, metalness: 0.4 })
  );
  antenna.position.set(36, BASE_Y + 19.6, VIEW_Z);
  outside.add(antenna);

  const towerSnow = new THREE.Mesh(new THREE.CylinderGeometry(3.22, 3.22, 0.07, 56), snowMat);
  towerSnow.position.set(36, BASE_Y + 17.75, VIEW_Z);
  outside.add(towerSnow);

  /* ----------------------------- деревья --------------------------- */

  const barkMat = new THREE.MeshStandardMaterial({ color: 0x4c4030, roughness: 0.98 });
  const leafBase = [new THREE.Color(0xb68125), new THREE.Color(0xcda63a), new THREE.Color(0x9a6e2d)];
  const leafMats = leafBase.map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true })
  );
  const treeMats = { bark: barkMat, leaf: leafMats };
  const trees = [
    [6.0, 5.5, 0.5],
    [7.2, -5.0, 0.62],
    [7.4, 2.2, 0.42],
    [7.8, -2.2, 0.45],
    [12.4, 7.0, 0.72],
    [15.5, -7.5, 0.85],
    [20.0, 8.5, 0.95],
    [25.0, -11.0, 1.1],
  ];
  for (const [x, z, s] of trees) {
    outside.add(makeTree(rnd, treeMats, x, z, s));
  }

  /* ------------------------- забор детсада ------------------------- */

  const fenceMat = new THREE.MeshStandardMaterial({ color: 0x9aa998, roughness: 0.72, metalness: 0.12 });
  const fence = new THREE.Group();
  fence.position.set(6.85, BASE_Y, VIEW_Z);
  outside.add(fence);
  for (let i = 0; i < 15; i++) {
    const z = -4.4 + i * 0.63;
    if (Math.abs(z) < 1.15) continue;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.82, 0.06), fenceMat);
    post.position.set(0, 0.41, z);
    fence.add(post);
    const picket = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.68, 0.08), fenceMat);
    picket.position.set(0, 0.36, z + 0.315);
    fence.add(picket);
  }
  for (const y of [0.18, 0.62]) {
    for (const [z0, z1] of [
      [-4.4, -1.15],
      [1.15, 4.42],
    ]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, z1 - z0), fenceMat);
      rail.position.set(0, y, (z0 + z1) / 2);
      fence.add(rail);
    }
  }

  // нехитрая песочница слева от входа
  const sandMat = new THREE.MeshStandardMaterial({ color: 0xb7a478, roughness: 1 });
  const sand = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.18, 1.8), sandMat);
  sand.position.set(6.3, BASE_Y + 0.09, 3.4);
  outside.add(sand);
  for (const [dx, dz, sx, sz] of [
    [0, -0.95, 1.98, 0.12],
    [0, 0.95, 1.98, 0.12],
    [-0.95, 0, 0.12, 1.98],
    [0.95, 0, 0.12, 1.98],
  ]) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.24, sz), fenceMat);
    board.position.set(6.3 + dx, BASE_Y + 0.12, 3.4 + dz);
    outside.add(board);
  }

  /* ----------------------------- фонарь ---------------------------- */

  const streetLamp = new THREE.Group();
  streetLamp.position.set(5.8, BASE_Y, -2.7);
  outside.add(streetLamp);
  const lampMetal = new THREE.MeshStandardMaterial({ color: 0x30332f, roughness: 0.55, metalness: 0.65 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.085, 4.9, 10), lampMetal);
  pole.position.y = 2.45;
  streetLamp.add(pole);
  const poleFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.3, 12), lampMetal);
  poleFoot.position.y = 0.15;
  streetLamp.add(poleFoot);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 4.8, 0),
    new THREE.Vector3(0.42, 5.05, 0),
    new THREE.Vector3(0.8, 4.98, 0),
  ]);
  const bracket = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.045, 6, false), lampMetal);
  streetLamp.add(bracket);
  const lampHead = new THREE.Mesh(new THREE.ConeGeometry(0.23, 0.26, 12, 1, true), lampMetal);
  lampHead.rotation.z = Math.PI;
  lampHead.position.set(0.84, 4.92, 0);
  streetLamp.add(lampHead);
  const lampGlassMat = new THREE.MeshStandardMaterial({
    color: 0xffe3b0,
    emissive: new THREE.Color(0xffb968),
    emissiveIntensity: 3.2,
    roughness: 0.3,
    toneMapped: false,
  });
  const lampGlobe = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), lampGlassMat);
  lampGlobe.scale.y = 0.7;
  lampGlobe.position.set(0.84, 4.8, 0);
  streetLamp.add(lampGlobe);
  const glowMat = new THREE.SpriteMaterial({
    map: T.glow,
    color: 0xffb163,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const glow = new THREE.Sprite(glowMat);
  glow.position.set(0.84, 4.8, 0);
  glow.scale.set(3.0, 3.0, 1);
  streetLamp.add(glow);

  const streetLight = new THREE.PointLight(0xffb264, 0, 5.5, 2.0);
  streetLight.position.set(6.5, 1.7, -2.7);
  outside.add(streetLight);

  /* ---------------------------- осадки ----------------------------- */

  const rain = createPrecipitation({ count: 2400, type: 'rain' });
  outside.add(rain);
  const snow = createPrecipitation({ count: 1700, type: 'snow' });
  outside.add(snow);

  const exteriorAmbient = new THREE.PointLight(0xaab9cf, 0.0, 24, 2);
  exteriorAmbient.position.set(8, 2.5, VIEW_Z);
  outside.add(exteriorAmbient);

  // локальная подсветка дальних фасадов; до комнаты свет не достаёт
  const panelFill = new THREE.PointLight(0xc7d9e2, 18, 11, 2);
  panelFill.position.set(19.0, 5.2, VIEW_Z);
  outside.add(panelFill);
  const towerFill = new THREE.PointLight(0xd0dee3, 10, 8.5, 2);
  towerFill.position.set(30.0, 10.0, VIEW_Z);
  outside.add(towerFill);

  return {
    outside,
    skyMaterial,
    buildingMats: [panelMat, towerMat, kgWindowMat],
    leafMats,
    leafBase: leafBase.map((c) => c.clone()),
    snowMat,
    pathMat,
    curbMat,
    rain,
    snow,
    streetLampLight: lampGlassMat,
    glowMat,
    streetLight,
    exteriorAmbient,
    panelFill,
    towerFill,
  };
}
