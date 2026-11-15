import * as THREE from 'three';
import { createSkyMaterial, createPrecipitation } from './shaders.js';

const BASE_Y = -3.5;

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
  const trunkH = (4.1 + rnd() * 1.8) * scale;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09 * scale, 0.18 * scale, trunkH, 7),
    mats.bark
  );
  trunk.position.y = trunkH / 2;
  trunk.castShadow = false;
  trunk.receiveShadow = true;
  g.add(trunk);

  const crownBase = trunkH * 0.55;
  const clusters = 5 + Math.floor(rnd() * 4);
  for (let i = 0; i < clusters; i++) {
    const rad = (0.55 + rnd() * 1.0) * scale;
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(rad, 1), mats.leaf[(i + Math.floor(rnd() * 2)) % 2]);
    const a = rnd() * Math.PI * 2;
    const rr = (0.1 + rnd() * 0.45) * scale;
    leaf.position.set(Math.cos(a) * rr, crownBase + rnd() * trunkH * 0.6, Math.sin(a) * rr);
    leaf.scale.set(1, 0.8 + rnd() * 0.35, 1);
    leaf.rotation.set(rnd() * 2, rnd() * 2, rnd() * 2);
    leaf.castShadow = false;
    leaf.receiveShadow = true;
    g.add(leaf);
  }
  return g;
}

export function buildOutside(scene, T) {
  const outside = new THREE.Group();
  outside.name = 'outside';
  scene.add(outside);

  /* ------------------------------- небо ---------------------------- */

  const skyMaterial = createSkyMaterial();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(70, 48, 28), skyMaterial);
  sky.renderOrder = -1000;
  sky.frustumCulled = false;
  outside.add(sky);

  /* ------------------------------ земля ---------------------------- */

  const groundMat = new THREE.MeshStandardMaterial({ color: 0x4a4a42, roughness: 0.95, metalness: 0 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(130, 72), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, BASE_Y, -28);
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
  const snowGround = new THREE.Mesh(new THREE.PlaneGeometry(130, 72), snowMat);
  snowGround.rotation.x = -Math.PI / 2;
  snowGround.position.set(0, BASE_Y + 0.02, -28);
  snowGround.receiveShadow = true;
  outside.add(snowGround);

  // дорожка во дворе
  const pathMat = new THREE.MeshStandardMaterial({ color: 0x68645a, roughness: 0.95 });
  const path = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 22), pathMat);
  path.rotation.x = -Math.PI / 2;
  path.position.set(1.2, BASE_Y + 0.03, -13);
  path.receiveShadow = true;
  outside.add(path);

  // бордюр
  const curbMat = new THREE.MeshStandardMaterial({ color: 0x7c786b, roughness: 0.95 });
  for (const x of [-0.05, 2.45]) {
    const curb = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.13, 22), curbMat);
    curb.position.set(x, BASE_Y + 0.06, -13);
    curb.receiveShadow = true;
    outside.add(curb);
  }

  /* ----------------------------- дома ------------------------------ */

  const buildingMats = [];
  const buildings = [
    { x: -5.8, z: -24, w: 10.5, h: 7, d: 6, seed: 3 },
    { x: 2.0, z: -20, w: 6.2, h: 6, d: 4.5, seed: 8 },
    { x: 9.8, z: -30, w: 13, h: 10, d: 7, seed: 12 },
    { x: -16, z: -32, w: 14, h: 6, d: 6, seed: 18 },
    { x: 18, z: -27, w: 10, h: 8, d: 5.5, seed: 23 },
    { x: -7.5, z: -40, w: 7.5, h: 6.5, d: 5, seed: 29 },
  ];

  for (const b of buildings) {
    const map = T.building.map.clone();
    const emissiveMap = T.building.emissive.clone();
    map.needsUpdate = true;
    emissiveMap.needsUpdate = true;
    map.repeat.set(Math.max(1, b.w / 7), Math.max(1, b.h / 14));
    emissiveMap.repeat.copy(map.repeat);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    emissiveMap.wrapS = emissiveMap.wrapT = THREE.RepeatWrapping;
    const material = new THREE.MeshStandardMaterial({
      map,
      emissiveMap,
      emissive: new THREE.Color(0xffc47c),
      emissiveIntensity: 0.3,
      roughness: 0.92,
      metalness: 0,
      color: 0xa6a69c,
    });
    buildingMats.push(material);
    const building = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), material);
    building.position.set(b.x, BASE_Y + b.h / 2, b.z);
    building.receiveShadow = true;
    building.castShadow = false;
    outside.add(building);

    const roofSnow = new THREE.Mesh(
      new THREE.BoxGeometry(b.w + 0.2, 0.1, b.d + 0.2),
      snowMat
    );
    roofSnow.position.set(b.x, BASE_Y + b.h + 0.04, b.z);
    roofSnow.castShadow = false;
    roofSnow.receiveShadow = true;
    outside.add(roofSnow);

    // тёмная крыша и вентиляция
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(b.w * 0.92, 0.18, b.d * 0.92),
      new THREE.MeshStandardMaterial({ color: 0x343630, roughness: 0.95 })
    );
    roof.position.set(b.x, BASE_Y + b.h + 0.13, b.z);
    outside.add(roof);
  }

  // дальние силуэты
  const farMat = new THREE.MeshStandardMaterial({ color: 0x5b625f, roughness: 1 });
  for (const [x, z, w, h] of [
    [-32, -44, 20, 6],
    [-10, -50, 22, 7],
    [15, -47, 24, 6],
    [36, -52, 28, 9],
  ]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 5), farMat);
    b.position.set(x, BASE_Y + h / 2, z);
    outside.add(b);
  }

  /* ----------------------------- деревья --------------------------- */

  const barkMat = new THREE.MeshStandardMaterial({ color: 0x4a4032, roughness: 0.98 });
  const leafBaseA = new THREE.Color(0x2f4934);
  const leafBaseB = new THREE.Color(0x3d5939);
  const leafMats = [
    new THREE.MeshStandardMaterial({ color: leafBaseA, roughness: 0.92, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: leafBaseB, roughness: 0.92, flatShading: true }),
  ];
  const treeMats = { bark: barkMat, leaf: leafMats };
  const rnd = mulberry(1977);
  const trees = [
    [-5.2, -7.6, 1.15],
    [4.7, -8.4, 0.95],
    [-8.8, -11.5, 1.3],
    [8.6, -13.2, 1.12],
    [-2.7, -13.7, 0.86],
    [12.5, -18, 1.2],
    [-13.2, -20, 1.35],
  ];
  for (const [x, z, s] of trees) {
    outside.add(makeTree(rnd, treeMats, x, z, s));
  }

  /* ------------------------------ забор ---------------------------- */

  const fenceMat = new THREE.MeshStandardMaterial({ color: 0x454a42, roughness: 0.82, metalness: 0.35 });
  const fence = new THREE.Group();
  fence.position.set(0, BASE_Y, -5.2);
  outside.add(fence);
  for (let i = 0; i < 22; i++) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.055, 1.7, 0.055), fenceMat);
    post.position.set(-8.5 + i * 0.82, 0.85, 0);
    fence.add(post);
  }
  for (const y of [0.3, 1.42]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(17.4, 0.045, 0.045), fenceMat);
    rail.position.set(0, y, 0);
    fence.add(rail);
  }

  /* ----------------------------- фонарь ---------------------------- */

  const streetLamp = new THREE.Group();
  streetLamp.position.set(-3.85, BASE_Y, -6.3);
  outside.add(streetLamp);
  const lampMetal = new THREE.MeshStandardMaterial({ color: 0x30332f, roughness: 0.55, metalness: 0.65 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.085, 5.35, 10), lampMetal);
  pole.position.y = 2.675;
  streetLamp.add(pole);
  const poleFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.32, 12), lampMetal);
  poleFoot.position.y = 0.16;
  streetLamp.add(poleFoot);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 5.28, 0),
    new THREE.Vector3(0.45, 5.52, 0),
    new THREE.Vector3(0.88, 5.45, 0),
  ]);
  const bracket = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.045, 6, false), lampMetal);
  streetLamp.add(bracket);
  const lampHead = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.28, 12, 1, true), lampMetal);
  lampHead.rotation.z = Math.PI;
  lampHead.position.set(0.92, 5.39, 0);
  streetLamp.add(lampHead);
  const lampGlassMat = new THREE.MeshStandardMaterial({
    color: 0xffe3b0,
    emissive: new THREE.Color(0xffb968),
    emissiveIntensity: 3.2,
    roughness: 0.3,
    toneMapped: false,
  });
  const lampGlobe = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), lampGlassMat);
  lampGlobe.scale.y = 0.7;
  lampGlobe.position.set(0.92, 5.25, 0);
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
  glow.position.set(0.92, 5.25, 0);
  glow.scale.set(3.2, 3.2, 1);
  streetLamp.add(glow);

  const streetLight = new THREE.PointLight(0xffb264, 0, 5.5, 2.0);
  streetLight.position.set(-2.95, 1.75, -6.3);
  outside.add(streetLight);

  // провода, уходящие в темноту
  const wireMat = new THREE.LineBasicMaterial({ color: 0x232723, transparent: true, opacity: 0.7 });
  for (const off of [0, 0.55, 1.1]) {
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      pts.push(new THREE.Vector3(-3.9 + t * 17, 1.6 + Math.sin(t * Math.PI) * -0.65 + off * 0.12, -6.2 - t * 15));
    }
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    outside.add(new THREE.Line(g, wireMat));
  }

  /* ---------------------------- осадки ----------------------------- */

  const rain = createPrecipitation({ count: 2400, type: 'rain' });
  outside.add(rain);
  const snow = createPrecipitation({ count: 1700, type: 'snow' });
  outside.add(snow);

  // подсветка переднего плана, чтобы деревья не были чёрными
  const exteriorAmbient = new THREE.PointLight(0xaab9cf, 0.0, 20, 2);
  exteriorAmbient.position.set(0, 3, -5);
  outside.add(exteriorAmbient);

  return {
    outside,
    skyMaterial,
    buildingMats,
    leafMats,
    leafBase: [leafBaseA.clone(), leafBaseB.clone()],
    snowMat,
    pathMat,
    curbMat,
    rain,
    snow,
    streetLampLight: lampGlassMat,
    glowMat,
    streetLight,
    exteriorAmbient,
  };
}
