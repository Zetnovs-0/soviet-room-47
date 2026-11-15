import * as THREE from 'three';

/* ------------------------------------------------------------------ */
/*  Процедурные текстуры: ни одного внешнего изображения               */
/* ------------------------------------------------------------------ */

const TAU = Math.PI * 2;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas2d(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, x: c.getContext('2d') };
}

function tex(canvas, { repeatX = 1, repeatY = 1, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}

function grain(x, w, h, amount = 8, alpha = 1) {
  const img = x.getImageData(0, 0, w, h);
  const d = img.data;
  const rnd = mulberry32(w * 131 + h * 17);
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * amount;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
    if (alpha !== 1) d[i + 3] *= alpha;
  }
  x.putImageData(img, 0, 0);
}

function softBlotches(x, w, h, count, colors, rnd, rMin, rMax) {
  for (let i = 0; i < count; i++) {
    const cx = rnd() * w;
    const cy = rnd() * h;
    const r = rMin + rnd() * (rMax - rMin);
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    const col = colors[Math.floor(rnd() * colors.length)];
    g.addColorStop(0, col);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
}

/* ------------------------------- стены ---------------------------- */

export function wallTexture() {
  const w = 512;
  const { c, x } = canvas2d(w, w);
  const rnd = mulberry32(4711);
  x.fillStyle = '#4e6a55';
  x.fillRect(0, 0, w, w);
  softBlotches(x, w, w, 26, ['rgba(92,120,96,.22)', 'rgba(45,64,49,.24)', 'rgba(115,137,104,.13)'], rnd, 40, 150);

  for (let i = 0; i < 230; i++) {
    const bx = rnd() * w;
    const by = rnd() * w;
    const len = 20 + rnd() * 150;
    const tilt = (rnd() - 0.5) * 0.12;
    x.strokeStyle = rnd() > 0.48 ? `rgba(175,190,160,${0.012 + rnd() * 0.035})` : `rgba(20,35,23,${0.012 + rnd() * 0.04})`;
    x.lineWidth = 0.6 + rnd() * 2.3;
    x.beginPath();
    x.moveTo(bx, by);
    x.lineTo(bx + Math.sin(tilt) * len, by - Math.cos(tilt) * len);
    x.stroke();
  }
  // редкие мазки кистью
  for (let i = 0; i < 18; i++) {
    const bx = rnd() * w;
    const by = rnd() * w;
    x.fillStyle = `rgba(190,203,176,${0.012 + rnd() * 0.02})`;
    x.beginPath();
    x.ellipse(bx, by, 12 + rnd() * 40, 2 + rnd() * 6, rnd() * 0.4, 0, TAU);
    x.fill();
  }
  grain(x, w, w, 5);
  return tex(c);
}

export function ceilingTexture() {
  const w = 512;
  const { c, x } = canvas2d(w, w);
  const rnd = mulberry32(1979);
  x.fillStyle = '#ddd6c5';
  x.fillRect(0, 0, w, w);
  softBlotches(x, w, w, 20, ['rgba(199,191,173,.2)', 'rgba(245,241,228,.24)'], rnd, 30, 120);
  for (let i = 0; i < 40; i++) {
    x.strokeStyle = `rgba(120,110,92,${0.02 + rnd() * 0.025})`;
    x.lineWidth = 0.6 + rnd() * 1.3;
    x.beginPath();
    x.arc(rnd() * w, rnd() * w, 3 + rnd() * 22, 0, TAU);
    x.stroke();
  }
  grain(x, w, w, 4);
  return tex(c);
}

/* ------------------------------ паркет ---------------------------- */

export function parquetTexture() {
  const S = 1024;
  const u = S / (4 * Math.SQRT2); // период рисунка
  const { c, x } = canvas2d(S, S);
  const rnd = mulberry32(24051979);

  x.fillStyle = '#1b0f08';
  x.fillRect(0, 0, S, S);
  x.save();
  x.translate(S / 2, S / 2);
  x.rotate(Math.PI / 4);

  const palette = ['#8b5a31', '#946438', '#7d4d2a', '#a06c3d', '#87552f', '#9b6638', '#714424', '#a87344'];
  const tones = ['rgba(44,23,10,.18)', 'rgba(255,224,181,.1)', 'rgba(92,53,25,.18)', 'rgba(28,14,5,.2)'];

  const range = 7;
  for (let j = -range; j <= range; j++) {
    for (let i = -range; i <= range; i++) {
      const s = ((i + j) % 4 + 4) % 4;
      let px, py, pw, ph, vertical = false;
      if (s === 0) {
        px = i * u;
        py = j * u;
        pw = 2 * u;
        ph = u;
      } else if (s === 2) {
        px = i * u;
        py = j * u;
        pw = u;
        ph = 2 * u;
        vertical = true;
      } else continue;

      const pad = 2.3;
      const x0 = px + pad;
      const y0 = py + pad;
      const ww = pw - pad * 2;
      const hh = ph - pad * 2;
      const r = mulberry32((i + 31) * 3389 + (j + 17) * 7919 + 5);
      const base = palette[Math.floor(r() * palette.length)];
      const g = vertical
        ? x.createLinearGradient(x0, 0, x0 + ww, 0)
        : x.createLinearGradient(0, y0, 0, y0 + hh);
      g.addColorStop(0, base);
      g.addColorStop(0.48, palette[Math.floor(r() * palette.length)]);
      g.addColorStop(1, base);
      x.fillStyle = g;
      x.fillRect(x0, y0, ww, hh);

      x.save();
      x.beginPath();
      x.rect(x0, y0, ww, hh);
      x.clip();
      // продольные волокна
      const along = vertical ? hh : ww;
      const across = vertical ? ww : hh;
      for (let k = 0; k < 26; k++) {
        const off = r() * across;
        const amp = 1 + r() * 3.5;
        const freq = 0.01 + r() * 0.025;
        const phase = r() * TAU;
        x.strokeStyle = tones[Math.floor(r() * tones.length)];
        x.lineWidth = 0.45 + r() * 1.15;
        x.beginPath();
        for (let d = -12; d <= along + 12; d += 9) {
          const wob = Math.sin(d * freq + phase) * amp;
          if (vertical) {
            const xx = x0 + off + wob;
            const yy = y0 + d;
            d === -12 ? x.moveTo(xx, yy) : x.lineTo(xx, yy);
          } else {
            const xx = x0 + d;
            const yy = y0 + off + wob;
            d === -12 ? x.moveTo(xx, yy) : x.lineTo(xx, yy);
          }
        }
        x.stroke();
      }
      // редкий сучок
      if (r() < 0.16) {
        const kx = x0 + (0.2 + r() * 0.6) * ww;
        const ky = y0 + (0.2 + r() * 0.6) * hh;
        x.strokeStyle = 'rgba(43,22,9,.3)';
        x.lineWidth = 1;
        for (let q = 0; q < 4; q++) {
          x.beginPath();
          x.ellipse(kx, ky, 2 + q * 2.4, 1 + q * 1.6, r() * 0.4, 0, TAU);
          x.stroke();
        }
      }
      x.restore();

      x.strokeStyle = 'rgba(25,12,5,.72)';
      x.lineWidth = 2;
      x.strokeRect(x0, y0, ww, hh);
      x.strokeStyle = 'rgba(255,220,173,.11)';
      x.lineWidth = 1;
      x.strokeRect(x0 + 2.5, y0 + 2.5, ww - 5, hh - 5);
    }
  }
  x.restore();
  return tex(c, { repeatX: 5, repeatY: 4.3 });
}

/* ------------------------------- ковёр ---------------------------- */

function diamond(x, cx, cy, rx, ry, fill, stroke, lw = 2) {
  x.beginPath();
  x.moveTo(cx, cy - ry);
  x.lineTo(cx + rx, cy);
  x.lineTo(cx, cy + ry);
  x.lineTo(cx - rx, cy);
  x.closePath();
  if (fill) {
    x.fillStyle = fill;
    x.fill();
  }
  if (stroke) {
    x.strokeStyle = stroke;
    x.lineWidth = lw;
    x.stroke();
  }
}

export function rugTexture() {
  const W = 1024;
  const H = 720;
  const { c, x } = canvas2d(W, H);
  const rnd = mulberry32(1961);
  const red = '#78281f';
  const deep = '#571b17';
  const navy = '#17252d';
  const cream = '#d8c39c';
  const gold = '#b2854e';
  const rust = '#a3472e';

  x.fillStyle = deep;
  x.fillRect(0, 0, W, H);
  x.fillStyle = red;
  x.fillRect(38, 38, W - 76, H - 76);

  // орнаментальная рамка
  x.strokeStyle = navy;
  x.lineWidth = 28;
  x.strokeRect(26, 26, W - 52, H - 52);
  x.strokeStyle = cream;
  x.lineWidth = 3;
  x.strokeRect(49, 49, W - 98, H - 98);
  x.strokeStyle = gold;
  x.lineWidth = 2;
  x.strokeRect(60, 60, W - 120, H - 120);
  x.strokeStyle = navy;
  x.lineWidth = 10;
  x.strokeRect(79, 79, W - 158, H - 158);

  // мотивы по рамке
  const borderDiamond = (cx, cy, r) => {
    diamond(x, cx, cy, r, r * 1.45, navy, cream, 2);
    diamond(x, cx, cy, r * 0.45, r * 0.72, cream, null);
    x.fillStyle = rust;
    x.fillRect(cx - 2, cy - r * 0.85, 4, r * 0.55);
  };
  for (let i = 0; i < 13; i++) {
    borderDiamond(72 + i * 73, 72, 15);
    borderDiamond(72 + i * 73, H - 72, 15);
  }
  for (let i = 0; i < 9; i++) {
    borderDiamond(72, 132 + i * 58, 15);
    borderDiamond(W - 72, 132 + i * 58, 15);
  }

  // угловые розетки
  const corner = (cx, cy, sx, sy) => {
    x.save();
    x.translate(cx, cy);
    x.scale(sx, sy);
    for (let k = 0; k < 3; k++) {
      diamond(x, 0, 0, 92 - k * 22, 110 - k * 27, k === 1 ? navy : null, k === 1 ? cream : gold, 3);
    }
    x.fillStyle = navy;
    x.beginPath();
    x.arc(0, 0, 18, 0, TAU);
    x.fill();
    x.fillStyle = cream;
    x.beginPath();
    x.arc(0, 0, 8, 0, TAU);
    x.fill();
    x.restore();
  };
  corner(150, 160, 1, 1);
  corner(W - 150, 160, -1, 1);
  corner(150, H - 160, 1, -1);
  corner(W - 150, H - 160, -1, -1);

  // поле: мелкий повторяющийся узор
  x.save();
  x.globalAlpha = 0.95;
  for (let gy = 0; gy < 5; gy++) {
    for (let gx = 0; gx < 7; gx++) {
      const cx = 205 + gx * 102;
      const cy = 238 + gy * 82;
      const inCenter = Math.abs(cx - W / 2) < 200 && Math.abs(cy - H / 2) < 130;
      if (inCenter) continue;
      diamond(x, cx, cy, 25, 34, null, navy, 3);
      diamond(x, cx, cy, 13, 20, rust, cream, 1.4);
      x.strokeStyle = cream;
      x.lineWidth = 1.2;
      x.beginPath();
      x.moveTo(cx - 20, cy);
      x.lineTo(cx - 8, cy);
      x.moveTo(cx + 8, cy);
      x.lineTo(cx + 20, cy);
      x.moveTo(cx, cy - 27);
      x.lineTo(cx, cy - 15);
      x.moveTo(cx, cy + 15);
      x.lineTo(cx, cy + 27);
      x.stroke();
    }
  }
  x.restore();

  // центральный медальон
  x.save();
  x.translate(W / 2, H / 2);
  diamond(x, 0, 0, 224, 155, navy, gold, 5);
  diamond(x, 0, 0, 198, 134, cream, navy, 3);
  diamond(x, 0, 0, 182, 121, red, gold, 2);
  diamond(x, 0, 0, 136, 92, navy, cream, 3);
  diamond(x, 0, 0, 118, 78, null, gold, 2);
  diamond(x, 0, 0, 55, 47, cream, navy, 3);
  diamond(x, 0, 0, 34, 28, rust, null);
  x.strokeStyle = cream;
  x.lineWidth = 3;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    x.beginPath();
    x.moveTo(Math.cos(a) * 80, Math.sin(a) * 58);
    x.lineTo(Math.cos(a) * 110, Math.sin(a) * 78);
    x.stroke();
    x.fillStyle = gold;
    x.beginPath();
    x.arc(Math.cos(a + 0.15) * 100, Math.sin(a + 0.15) * 70, 5, 0, TAU);
    x.fill();
  }
  // четыре стороны медальона
  for (let i = 0; i < 4; i++) {
    x.save();
    x.rotate((i * Math.PI) / 2);
    x.fillStyle = cream;
    x.beginPath();
    x.moveTo(0, -185);
    x.lineTo(18, -152);
    x.lineTo(0, -126);
    x.lineTo(-18, -152);
    x.closePath();
    x.fill();
    x.fillStyle = navy;
    x.beginPath();
    x.arc(0, -152, 8, 0, TAU);
    x.fill();
    x.restore();
  }
  x.restore();

  // тканевая фактура
  for (let i = 0; i < 9000; i++) {
    const xx = rnd() * W;
    const yy = rnd() * H;
    x.fillStyle = rnd() > 0.5 ? 'rgba(255,230,195,.032)' : 'rgba(0,0,0,.045)';
    x.fillRect(xx, yy, 1 + rnd() * 2, 1);
  }
  x.fillStyle = 'rgba(0,0,0,.08)';
  for (let yy = 0; yy < H; yy += 4) x.fillRect(0, yy, W, 1);
  grain(x, W, H, 7);
  return tex(c);
}

/* ---------------------------- дерево ------------------------------ */

export function woodTexture(base = '#6d4328', dark = '#3a2112', light = '#a77448', seed = 7) {
  const S = 512;
  const { c, x } = canvas2d(S, S);
  const rnd = mulberry32(seed);
  x.fillStyle = base;
  x.fillRect(0, 0, S, S);
  x.save();
  x.globalAlpha = 0.5;
  for (let i = 0; i < 120; i++) {
    const gx = rnd() * S;
    const wdt = 3 + rnd() * 30;
    x.fillStyle = rnd() > 0.5 ? light : dark;
    x.globalAlpha = 0.025 + rnd() * 0.07;
    x.beginPath();
    for (let y = -20; y < S + 20; y += 14) {
      const wob = Math.sin(y * 0.018 + i * 1.7) * (2 + rnd() * 5);
      if (y === -20) x.moveTo(gx + wob, y);
      else x.lineTo(gx + wob, y);
    }
    x.lineWidth = wdt;
    x.strokeStyle = x.fillStyle;
    x.stroke();
  }
  x.restore();

  for (let i = 0; i < 160; i++) {
    const gx = rnd() * S;
    const amp = 1 + rnd() * 3;
    x.strokeStyle = rnd() > 0.45 ? `rgba(30,15,6,${0.04 + rnd() * 0.12})` : `rgba(255,218,170,${0.025 + rnd() * 0.08})`;
    x.lineWidth = 0.4 + rnd() * 1.1;
    x.beginPath();
    for (let y = -8; y < S + 8; y += 5) {
      const xx = gx + Math.sin(y * (0.01 + rnd() * 0.006) + i) * amp + Math.sin(y * 0.07) * 0.4;
      y === -8 ? x.moveTo(xx, y) : x.lineTo(xx, y);
    }
    x.stroke();
  }
  // сучки
  for (let k = 0; k < 3; k++) {
    const kx = rnd() * S;
    const ky = rnd() * S;
    for (let i = 0; i < 5; i++) {
      x.strokeStyle = `rgba(34,17,7,${0.16 - i * 0.025})`;
      x.lineWidth = 1.2;
      x.beginPath();
      x.ellipse(kx, ky, 3 + i * 4, 5 + i * 7, 0.2, 0, TAU);
      x.stroke();
    }
  }
  grain(x, S, S, 5);
  return tex(c);
}

/* ----------------------------- ткань ------------------------------ */

export function fabricTexture(base = '#9b7347', weave = 'rgba(61,37,17,.2)', seed = 2) {
  const S = 256;
  const { c, x } = canvas2d(S, S);
  const rnd = mulberry32(seed);
  x.fillStyle = base;
  x.fillRect(0, 0, S, S);
  for (let i = 0; i < S; i += 2) {
    x.fillStyle = i % 4 === 0 ? weave : 'rgba(255,240,210,.05)';
    x.fillRect(0, i, S, 1);
    x.fillRect(i, 0, 1, S);
  }
  for (let i = 0; i < 1600; i++) {
    x.fillStyle = rnd() > 0.5 ? 'rgba(255,235,200,.08)' : 'rgba(40,23,10,.09)';
    x.fillRect(rnd() * S, rnd() * S, 1, 1);
  }
  softBlotches(x, S, S, 7, ['rgba(255,240,210,.08)', 'rgba(20,10,4,.07)'], rnd, 25, 75);
  grain(x, S, S, 5);
  return tex(c, { repeatX: 2, repeatY: 2 });
}

export function pillowTexture() {
  const S = 512;
  const { c, x } = canvas2d(S, S);
  const rnd = mulberry32(92);
  x.fillStyle = '#a24a33';
  x.fillRect(0, 0, S, S);
  for (let i = 0; i < S; i += 3) {
    x.fillStyle = i % 6 === 0 ? 'rgba(60,22,12,.07)' : 'rgba(255,220,180,.035)';
    x.fillRect(0, i, S, 1);
  }
  x.strokeStyle = '#d8bd8e';
  x.lineWidth = 7;
  x.strokeRect(46, 46, S - 92, S - 92);
  x.strokeStyle = '#772f22';
  x.lineWidth = 3;
  x.strokeRect(62, 62, S - 124, S - 124);
  const step = 64;
  for (let gy = step; gy < S - 40; gy += step) {
    for (let gx = step; gx < S - 40; gx += step) {
      const cx = gx + (gy / step % 2) * step / 2;
      const cy = gy;
      diamond(x, cx, cy, 16, 22, null, '#d8bd8e', 2.5);
      x.fillStyle = '#60271d';
      x.beginPath();
      x.arc(cx, cy, 4, 0, TAU);
      x.fill();
    }
  }
  for (let i = 0; i < 500; i++) {
    x.fillStyle = rnd() > 0.5 ? 'rgba(255,240,210,.05)' : 'rgba(30,12,6,.05)';
    x.fillRect(rnd() * S, rnd() * S, 1, 1);
  }
  grain(x, S, S, 6);
  return tex(c);
}

/* --------------------------- скатерть ----------------------------- */

export function tableclothTexture() {
  const S = 512;
  const { c, x } = canvas2d(S, S);
  const rnd = mulberry32(33);
  x.fillStyle = '#eee4cf';
  x.fillRect(0, 0, S, S);
  for (let i = 0; i < S; i += 2) {
    x.fillStyle = i % 4 === 0 ? 'rgba(120,95,65,.045)' : 'rgba(255,255,245,.07)';
    x.fillRect(0, i, S, 1);
    x.fillRect(i, 0, 1, S);
  }
  // вышитая кайма
  x.strokeStyle = '#a0533d';
  x.lineWidth = 8;
  x.strokeRect(34, 34, S - 68, S - 68);
  x.strokeStyle = '#c8a35e';
  x.lineWidth = 2;
  x.strokeRect(50, 50, S - 100, S - 100);
  x.strokeStyle = '#a0533d';
  x.lineWidth = 2;
  for (let i = 62; i < S - 62; i += 28) {
    const side = i;
    x.beginPath();
    x.moveTo(side, 60);
    x.lineTo(side + 10, 70);
    x.lineTo(side, 80);
    x.lineTo(side - 10, 70);
    x.closePath();
    x.stroke();
    x.beginPath();
    x.moveTo(side, S - 60);
    x.lineTo(side + 10, S - 70);
    x.lineTo(side, S - 80);
    x.lineTo(side - 10, S - 70);
    x.closePath();
    x.stroke();
  }
  for (let i = 62; i < S - 62; i += 28) {
    x.beginPath();
    x.moveTo(60, i);
    x.lineTo(70, i + 10);
    x.lineTo(80, i);
    x.lineTo(70, i - 10);
    x.closePath();
    x.stroke();
    x.beginPath();
    x.moveTo(S - 60, i);
    x.lineTo(S - 70, i + 10);
    x.lineTo(S - 80, i);
    x.lineTo(S - 70, i - 10);
    x.closePath();
    x.stroke();
  }
  for (let i = 0; i < 3500; i++) {
    x.fillStyle = rnd() > 0.5 ? 'rgba(255,255,245,.06)' : 'rgba(80,55,30,.045)';
    x.fillRect(rnd() * S, rnd() * S, 1 + rnd() * 2, 1);
  }
  softBlotches(x, S, S, 8, ['rgba(120,90,50,.05)', 'rgba(255,255,255,.1)'], rnd, 30, 80);
  grain(x, S, S, 4);
  return tex(c);
}

/* -------------------------- фасад дома ---------------------------- */

export function buildingTextures() {
  const W = 512;
  const H = 1024;
  const mapC = canvas2d(W, H);
  const emC = canvas2d(W, H);
  const { c, x } = mapC;
  const { c: ce, x: xe } = emC;
  const rnd = mulberry32(1984);

  x.fillStyle = '#656864';
  x.fillRect(0, 0, W, H);
  xe.fillStyle = '#000';
  xe.fillRect(0, 0, W, H);

  // панельные швы
  for (let y = 0; y <= H; y += 82) {
    x.fillStyle = 'rgba(35,38,36,.4)';
    x.fillRect(0, y, W, 3);
    x.fillStyle = 'rgba(210,208,196,.15)';
    x.fillRect(0, y + 3, W, 1);
  }
  for (let i = 0; i < 9; i++) {
    x.fillStyle = 'rgba(40,42,40,.22)';
    x.fillRect(rnd() * W, 0, 2, H);
  }
  softBlotches(x, W, H, 45, ['rgba(120,120,110,.12)', 'rgba(40,42,40,.13)'], rnd, 25, 120);
  grain(x, W, H, 5);

  const cols = 4;
  const rows = 9;
  const marginX = 36;
  const marginY = 54;
  const gapX = (W - marginX * 2) / cols;
  const gapY = (H - marginY * 2) / rows;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const wx = marginX + col * gapX + 8;
      const wy = marginY + r * gapY + 12;
      const ww = gapX - 18;
      const wh = gapY - 28;
      const lit = rnd() < 0.3;
      const cool = rnd() < 0.12;

      // окно в цветовой карте
      const g = x.createLinearGradient(wx, wy, wx + ww, wy + wh);
      g.addColorStop(0, '#1c252c');
      g.addColorStop(0.55, '#10171c');
      g.addColorStop(1, '#26323a');
      x.fillStyle = g;
      x.fillRect(wx, wy, ww, wh);
      x.fillStyle = 'rgba(255,255,255,.06)';
      x.fillRect(wx + 4, wy + 4, ww - 8, 4);
      // рама
      x.strokeStyle = 'rgba(200,197,185,.34)';
      x.lineWidth = 3;
      x.strokeRect(wx, wy, ww, wh);
      x.beginPath();
      x.moveTo(wx + ww / 2, wy);
      x.lineTo(wx + ww / 2, wy + wh);
      x.stroke();

      if (lit) {
        xe.fillStyle = cool ? 'rgba(150,190,255,.8)' : 'rgba(255,185,110,.9)';
        xe.fillRect(wx + 4, wy + 4, ww - 8, wh - 8);
        xe.fillStyle = 'rgba(0,0,0,.55)';
        xe.fillRect(wx + ww / 2 - 1, wy, 3, wh);
        xe.fillRect(wx, wy + wh * 0.6, ww, 3);
        if (rnd() < 0.5) {
          xe.fillStyle = 'rgba(0,0,0,.6)';
          xe.fillRect(wx + 6, wy + wh * 0.62, ww - 12, wh * 0.32);
        }
      }
    }
    // балкон
    if (r % 2 === 0) {
      const bx = marginX - 6;
      const by = marginY + r * gapY + gapY - 15;
      x.fillStyle = 'rgba(54,55,50,.7)';
      x.fillRect(bx, by, W - marginX * 2 + 12, 15);
      x.fillStyle = 'rgba(120,120,110,.55)';
      x.fillRect(bx, by - 2, W - marginX * 2 + 12, 4);
    }
  }

  // случайные тёмные потёки
  for (let i = 0; i < 38; i++) {
    const sx = rnd() * W;
    const sy = rnd() * H;
    x.fillStyle = `rgba(30,32,30,${0.025 + rnd() * 0.07})`;
    x.fillRect(sx, sy, 1 + rnd() * 3, 10 + rnd() * 100);
  }

  return {
    map: tex(c),
    emissive: tex(ce),
  };
}

/* ------------------------------ часы ------------------------------ */

export function clockTexture() {
  const S = 512;
  const { c, x } = canvas2d(S, S);
  x.clearRect(0, 0, S, S);
  x.fillStyle = '#e9dfc6';
  x.beginPath();
  x.arc(256, 256, 244, 0, TAU);
  x.fill();
  x.strokeStyle = '#5d4b32';
  x.lineWidth = 12;
  x.stroke();
  x.strokeStyle = '#b08a53';
  x.lineWidth = 4;
  x.beginPath();
  x.arc(256, 256, 225, 0, TAU);
  x.stroke();
  x.strokeStyle = '#3d3428';
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * TAU - Math.PI / 2;
    const r0 = i % 5 === 0 ? 194 : 208;
    x.lineWidth = i % 5 === 0 ? 6 : 2.2;
    x.beginPath();
    x.moveTo(256 + Math.cos(a) * r0, 256 + Math.sin(a) * r0);
    x.lineTo(256 + Math.cos(a) * 220, 256 + Math.sin(a) * 220);
    x.stroke();
  }
  x.fillStyle = '#3a3126';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.font = '600 46px Georgia, serif';
  x.fillText('12', 256, 118);
  x.fillText('3', 394, 260);
  x.fillText('6', 256, 400);
  x.fillText('9', 118, 260);
  x.font = '500 17px "Oswald", sans-serif';
  x.fillStyle = '#6d5a3d';
  x.fillText('ЯНТАРЬ', 256, 314);
  x.font = '500 12px "Oswald", sans-serif';
  x.fillText('СССР · 2 КЛАСС', 256, 334);
  x.fillStyle = 'rgba(90,60,30,.2)';
  for (let i = 0; i < 300; i++) x.fillRect(rndAt(i) * S, rndAt(i + 999) * S, 1, 1);
  return tex(c);
}
function rndAt(n) {
  const v = Math.sin(n * 12.9898) * 43758.5453;
  return v - Math.floor(v);
}

/* ---------------------------- картина ----------------------------- */

export function landscapeTexture() {
  const W = 512;
  const H = 360;
  const { c, x } = canvas2d(W, H);
  const rnd = mulberry32(1952);
  const sky = x.createLinearGradient(0, 0, 0, H * 0.62);
  sky.addColorStop(0, '#8aa1ad');
  sky.addColorStop(0.55, '#c8c0ab');
  sky.addColorStop(1, '#e5d3b3');
  x.fillStyle = sky;
  x.fillRect(0, 0, W, H * 0.64);
  x.fillStyle = '#687f5d';
  x.beginPath();
  x.moveTo(0, 232);
  for (let i = 0; i <= 10; i++) {
    x.lineTo((i / 10) * W, 210 + Math.sin(i * 1.3) * 12);
  }
  x.lineTo(W, H);
  x.lineTo(0, H);
  x.closePath();
  x.fill();
  x.fillStyle = '#4d6648';
  x.beginPath();
  x.moveTo(0, 276);
  for (let i = 0; i <= 8; i++) x.lineTo((i / 8) * W, 255 + Math.sin(i * 2.1) * 10);
  x.lineTo(W, H);
  x.lineTo(0, H);
  x.closePath();
  x.fill();
  // река
  x.fillStyle = '#b8b6a4';
  x.beginPath();
  x.moveTo(280, 238);
  x.bezierCurveTo(250, 270, 350, 288, 300, 335);
  x.bezierCurveTo(340, 320, 380, 300, 360, 250);
  x.closePath();
  x.fill();
  x.fillStyle = 'rgba(255,245,220,.32)';
  x.fillRect(285, 270, 40, 3);
  x.fillRect(300, 292, 50, 2);
  // берёзы
  const birch = (bx, by, h, lean) => {
    x.strokeStyle = '#d9d3c2';
    x.lineWidth = 5;
    x.beginPath();
    x.moveTo(bx, by);
    x.quadraticCurveTo(bx + lean, by - h * 0.5, bx + lean * 1.6, by - h);
    x.stroke();
    x.strokeStyle = '#403b31';
    x.lineWidth = 1;
    for (let k = 0; k < 7; k++) {
      const t = 0.12 + k * 0.12;
      x.beginPath();
      x.moveTo(bx + lean * t, by - h * t);
      x.lineTo(bx + lean * t + 7, by - h * t - 1);
      x.stroke();
    }
    x.fillStyle = 'rgba(90,105,68,.8)';
    for (let k = 0; k < 9; k++) {
      x.beginPath();
      x.ellipse(bx + lean * 1.2 + (rnd() - 0.5) * 80, by - h * 0.85 + (rnd() - 0.5) * 60, 20, 9, rnd(), 0, TAU);
      x.fill();
    }
  };
  birch(105, 300, 165, -18);
  birch(395, 288, 130, 13);
  birch(170, 265, 90, 8);
  // трава
  for (let i = 0; i < 160; i++) {
    x.strokeStyle = `rgba(${70 + rnd() * 30},${80 + rnd() * 40},50,${0.2 + rnd() * 0.4})`;
    x.lineWidth = 1;
    x.beginPath();
    const gx = rnd() * W;
    const gy = 260 + rnd() * 100;
    x.moveTo(gx, gy);
    x.lineTo(gx + (rnd() - 0.5) * 10, gy - 6 - rnd() * 15);
    x.stroke();
  }
  grain(x, W, H, 6);
  return tex(c);
}

export function stillLifeTexture() {
  const W = 420;
  const H = 520;
  const { c, x } = canvas2d(W, H);
  const rnd = mulberry32(88);
  x.fillStyle = '#3f3a2d';
  x.fillRect(0, 0, W, H);
  const glow = x.createRadialGradient(W * 0.45, H * 0.45, 20, W * 0.45, H * 0.45, W * 0.8);
  glow.addColorStop(0, 'rgba(190,165,115,.38)');
  glow.addColorStop(1, 'rgba(20,18,12,0)');
  x.fillStyle = glow;
  x.fillRect(0, 0, W, H);
  x.fillStyle = '#5c4d33';
  x.fillRect(0, 370, W, 150);
  x.fillStyle = '#6f5b3d';
  x.fillRect(0, 370, W, 8);
  // ваза
  x.fillStyle = '#b9a06e';
  x.beginPath();
  x.moveTo(190, 350);
  x.bezierCurveTo(150, 320, 165, 250, 195, 238);
  x.bezierCurveTo(220, 230, 245, 255, 242, 300);
  x.bezierCurveTo(240, 330, 228, 345, 228, 350);
  x.closePath();
  x.fill();
  x.strokeStyle = 'rgba(70,50,25,.5)';
  x.lineWidth = 3;
  x.stroke();
  // цветы
  const cols = ['#a34e3c', '#d4b06d', '#baa4a0', '#8e3b30', '#c58b4f'];
  for (let i = 0; i < 12; i++) {
    const a = -Math.PI / 2 + (rnd() - 0.5) * 1.9;
    const len = 70 + rnd() * 120;
    const bx = 210;
    const by = 245;
    const fx = bx + Math.cos(a) * len;
    const fy = by + Math.sin(a) * len;
    x.strokeStyle = 'rgba(100,115,65,.9)';
    x.lineWidth = 3;
    x.beginPath();
    x.moveTo(bx, by);
    x.quadraticCurveTo(bx + (fx - bx) * 0.2, by - 40, fx, fy);
    x.stroke();
    x.fillStyle = cols[i % cols.length];
    for (let p = 0; p < 6; p++) {
      const pa = (p / 6) * TAU;
      x.beginPath();
      x.ellipse(fx + Math.cos(pa) * 10, fy + Math.sin(pa) * 8, 9, 5, pa, 0, TAU);
      x.fill();
    }
    x.fillStyle = '#d7b863';
    x.beginPath();
    x.arc(fx, fy, 6, 0, TAU);
    x.fill();
  }
  // яблоко и груша
  x.fillStyle = '#8c3b2d';
  x.beginPath();
  x.ellipse(108, 430, 42, 34, -0.2, 0, TAU);
  x.fill();
  x.fillStyle = '#697a3a';
  x.beginPath();
  x.ellipse(330, 432, 35, 45, 0.12, 0, TAU);
  x.fill();
  x.fillStyle = 'rgba(240,220,160,.3)';
  x.beginPath();
  x.ellipse(94, 418, 12, 7, -0.4, 0, TAU);
  x.fill();
  for (let i = 0; i < 800; i++) {
    x.fillStyle = rnd() > 0.5 ? 'rgba(255,240,190,.035)' : 'rgba(0,0,0,.05)';
    x.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 2, 1);
  }
  grain(x, W, H, 7);
  return tex(c);
}

export function plateTexture() {
  const S = 512;
  const { c, x } = canvas2d(S, S);
  x.clearRect(0, 0, S, S);
  x.fillStyle = '#ecebe4';
  x.beginPath();
  x.arc(256, 256, 250, 0, TAU);
  x.fill();
  x.strokeStyle = '#335f8f';
  x.lineWidth = 9;
  x.beginPath();
  x.arc(256, 256, 236, 0, TAU);
  x.stroke();
  x.strokeStyle = 'rgba(51,95,143,.7)';
  x.lineWidth = 2;
  x.beginPath();
  x.arc(256, 256, 205, 0, TAU);
  x.stroke();
  // растительный узор
  x.strokeStyle = '#2f5f92';
  x.fillStyle = '#2f5f92';
  x.lineWidth = 4;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    x.save();
    x.translate(256 + Math.cos(a) * 145, 256 + Math.sin(a) * 145);
    x.rotate(a + Math.PI / 2);
    x.beginPath();
    x.moveTo(0, 26);
    x.bezierCurveTo(24, 6, 24, -20, 0, -34);
    x.bezierCurveTo(-24, -20, -24, 6, 0, 26);
    x.fill();
    x.strokeStyle = '#e8eceb';
    x.lineWidth = 2;
    x.beginPath();
    x.moveTo(0, 20);
    x.lineTo(0, -26);
    x.stroke();
    x.restore();
  }
  x.strokeStyle = '#2f5f92';
  x.lineWidth = 3;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    x.beginPath();
    x.moveTo(256 + Math.cos(a) * 214, 256 + Math.sin(a) * 214);
    x.lineTo(256 + Math.cos(a + 0.16) * 224, 256 + Math.sin(a + 0.16) * 224);
    x.stroke();
  }
  x.fillStyle = '#2f5f92';
  x.beginPath();
  x.arc(256, 256, 28, 0, TAU);
  x.fill();
  x.fillStyle = '#ecebe4';
  x.beginPath();
  x.arc(256, 256, 15, 0, TAU);
  x.fill();
  return tex(c);
}

/* ---------------------------- газета ------------------------------ */

export function newspaperTexture() {
  const W = 512;
  const H = 380;
  const { c, x } = canvas2d(W, H);
  const rnd = mulberry32(77);
  x.fillStyle = '#d8cdb4';
  x.fillRect(0, 0, W, H);
  x.fillStyle = '#35352e';
  x.textAlign = 'center';
  x.font = '700 36px "Playfair Display", Georgia, serif';
  x.fillText('ВЕЧЕРНИЙ ЛЕНИНГРАД', W / 2, 48);
  x.strokeStyle = '#4b4a40';
  x.lineWidth = 2;
  x.beginPath();
  x.moveTo(28, 60);
  x.lineTo(W - 28, 60);
  x.moveTo(28, 90);
  x.lineTo(W - 28, 90);
  x.stroke();
  x.font = '14px "Oswald", sans-serif';
  x.fillText('ПЯТНИЦА, 12 ОКТЯБРЯ 1979 ГОДА · ЦЕНА 3 КОПЕЙКИ', W / 2, 80);
  // фото
  x.fillStyle = '#8e8979';
  x.fillRect(30, 108, 200, 126);
  x.fillStyle = '#5d5b4f';
  x.beginPath();
  x.moveTo(30, 234);
  x.lineTo(80, 160);
  x.lineTo(125, 205);
  x.lineTo(160, 170);
  x.lineTo(230, 234);
  x.closePath();
  x.fill();
  x.fillStyle = '#c7c0ad';
  x.beginPath();
  x.arc(180, 135, 18, 0, TAU);
  x.fill();
  x.fillStyle = '#3e3d36';
  x.font = '600 15px "Oswald", sans-serif';
  x.textAlign = 'left';
  x.fillText('ГОРОД ЖДЁТ ТЕПЛА', 30, 262);
  x.font = '11px Georgia, serif';
  const lines = [
    [30, 286, 200], [30, 302, 190], [30, 318, 200], [30, 334, 160],
    [256, 110, 226], [256, 126, 210], [256, 142, 224], [256, 158, 200],
    [256, 174, 226], [256, 190, 215], [256, 206, 180], [256, 222, 226],
    [256, 238, 205], [256, 254, 218], [256, 270, 190], [256, 286, 220],
    [256, 302, 210], [256, 318, 225], [256, 334, 150],
  ];
  x.fillStyle = '#5b594d';
  for (const [lx, ly, lw] of lines) x.fillRect(lx, ly, lw, 3);
  for (let i = 0; i < 900; i++) {
    x.fillStyle = rnd() > 0.5 ? 'rgba(90,75,50,.06)' : 'rgba(255,250,235,.08)';
    x.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 2, 1);
  }
  grain(x, W, H, 5);
  return tex(c);
}

/* ---------------------------- свечение ---------------------------- */

export function glowTexture() {
  const S = 256;
  const { c, x } = canvas2d(S, S);
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,235,190,1)');
  g.addColorStop(0.18, 'rgba(255,205,130,.8)');
  g.addColorStop(0.5, 'rgba(255,170,85,.22)');
  g.addColorStop(1, 'rgba(255,150,60,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  return tex(c);
}

export function shadowTexture() {
  const S = 256;
  const { c, x } = canvas2d(S, S);
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(0,0,0,.5)');
  g.addColorStop(0.55, 'rgba(0,0,0,.25)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  return tex(c);
}
