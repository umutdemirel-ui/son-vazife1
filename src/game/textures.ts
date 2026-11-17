import * as THREE from 'three';

export interface ProceduralTextureSet {
  marble: THREE.CanvasTexture;
  marbleNormal: THREE.CanvasTexture;
  tile: THREE.CanvasTexture;
  tileNormal: THREE.CanvasTexture;
  tileRoughness: THREE.CanvasTexture;
  stone: THREE.CanvasTexture;
  stoneNormal: THREE.CanvasTexture;
  plaster: THREE.CanvasTexture;
  plasterNormal: THREE.CanvasTexture;
  timber: THREE.CanvasTexture;
  timberNormal: THREE.CanvasTexture;
  roof: THREE.CanvasTexture;
  roofNormal: THREE.CanvasTexture;
  kilim: THREE.CanvasTexture;
  road: THREE.CanvasTexture;
  roadNormal: THREE.CanvasTexture;
  roadRoughness: THREE.CanvasTexture;
  ground: THREE.CanvasTexture;
  groundNormal: THREE.CanvasTexture;
  photo: THREE.CanvasTexture;
  sign: THREE.CanvasTexture;
  mistSprite: THREE.CanvasTexture;
  disposeAll: () => void;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

function finalizeColorTex(
  canvas: HTMLCanvasElement,
  maxAnisotropy: number,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.needsUpdate = true;
  return tex;
}

function finalizeDataTex(
  canvas: HTMLCanvasElement,
  maxAnisotropy: number,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  // Data maps (normal, roughness) MUST stay in linear NoColorSpace
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates a tangent-space normal map from a grayscale height canvas using a 3x3 Sobel kernel.
 */
function buildNormalFromHeight(
  heightCanvas: HTMLCanvasElement,
  strength: number,
  maxAnisotropy: number,
  repeatX: number,
  repeatY: number,
): THREE.CanvasTexture {
  const w = heightCanvas.width;
  const h = heightCanvas.height;
  const srcCtx = heightCanvas.getContext('2d')!;
  const src = srcCtx.getImageData(0, 0, w, h).data;

  const [outCanvas, outCtx] = makeCanvas(w, h);
  const outImg = outCtx.createImageData(w, h);
  const dst = outImg.data;

  const sample = (x: number, y: number): number => {
    const wx = ((x % w) + w) % w;
    const wy = ((y % h) + h) % h;
    return src[(wy * w + wx) * 4] / 255;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tl = sample(x - 1, y - 1);
      const t = sample(x, y - 1);
      const tr = sample(x + 1, y - 1);
      const l = sample(x - 1, y);
      const r = sample(x + 1, y);
      const bl = sample(x - 1, y + 1);
      const b = sample(x, y + 1);
      const br = sample(x + 1, y + 1);

      const dx = (tr + 2 * r + br - (tl + 2 * l + bl)) * strength;
      const dy = (bl + 2 * b + br - (tl + 2 * t + tr)) * strength;
      const dz = 1.0;
      const len = Math.hypot(dx, dy, dz) || 1;

      const idx = (y * w + x) * 4;
      dst[idx] = Math.round(((-dx / len) * 0.5 + 0.5) * 255);
      dst[idx + 1] = Math.round(((-dy / len) * 0.5 + 0.5) * 255);
      dst[idx + 2] = Math.round(((dz / len) * 0.5 + 0.5) * 255);
      dst[idx + 3] = 255;
    }
  }
  outCtx.putImageData(outImg, 0, 0);
  return finalizeDataTex(outCanvas, maxAnisotropy, repeatX, repeatY);
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextureSet {
  // 1. Marble + Subtle Veining Normal Map
  const [cMarble, ctxM] = makeCanvas(512, 512);
  const [cMarbleH, ctxMH] = makeCanvas(512, 512);
  ctxM.fillStyle = '#d9d6ce';
  ctxM.fillRect(0, 0, 512, 512);
  ctxMH.fillStyle = '#c8c8c8';
  ctxMH.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 48; i++) {
    ctxM.strokeStyle = i % 2 === 0 ? 'rgba(98,104,110,0.25)' : 'rgba(255,255,255,0.34)';
    ctxM.lineWidth = 1 + (i % 4);
    ctxMH.strokeStyle = i % 2 === 0 ? 'rgba(110,110,110,0.3)' : 'rgba(215,215,215,0.25)';
    ctxMH.lineWidth = 1 + (i % 3);
    ctxM.beginPath();
    ctxMH.beginPath();
    let x = Math.random() * 512;
    let y = 0;
    ctxM.moveTo(x, y);
    ctxMH.moveTo(x, y);
    while (y < 512) {
      y += 24;
      x += (Math.random() - 0.5) * 44;
      ctxM.lineTo(x, y);
      ctxMH.lineTo(x, y);
    }
    ctxM.stroke();
    ctxMH.stroke();
  }
  const marble = finalizeColorTex(cMarble, maxAnisotropy, 1, 1);
  const marbleNormal = buildNormalFromHeight(cMarbleH, 1.4, maxAnisotropy, 1, 1);

  // 2. Ceramic Tiles + Tile Grout Normal & Wet Roughness Maps
  const [cTile, ctxT] = makeCanvas(512, 512);
  const [cTileH, ctxTH] = makeCanvas(512, 512);
  const [cTileR, ctxTR] = makeCanvas(512, 512);
  ctxT.fillStyle = '#9aa19b';
  ctxT.fillRect(0, 0, 512, 512);
  ctxTH.fillStyle = '#e5e5e5';
  ctxTH.fillRect(0, 0, 512, 512);
  ctxTR.fillStyle = '#585858'; // glossy ceramic tile
  ctxTR.fillRect(0, 0, 512, 512);

  const cells = 8;
  const step = 512 / cells;
  for (let r = 0; r < cells; r++) {
    for (let col = 0; col < cells; col++) {
      const shade = 148 + Math.floor((Math.sin(r * 7 + col * 13) * 0.5 + 0.5) * 18);
      ctxT.fillStyle = `rgb(${shade},${shade + 4},${shade - 2})`;
      ctxT.fillRect(col * step + 3, r * step + 3, step - 6, step - 6);
      if ((r + col) % 3 === 0) {
        ctxT.fillStyle = 'rgba(38, 44, 36, 0.14)';
        ctxT.fillRect(col * step + 6, r * step + 6, step - 12, step - 12);
        // damp gloss patches
        ctxTR.fillStyle = '#323232';
        ctxTR.fillRect(col * step + 6, r * step + 6, step - 12, step - 12);
      }
    }
  }
  ctxT.strokeStyle = '#474c48';
  ctxT.lineWidth = 3;
  ctxTH.strokeStyle = '#303030';
  ctxTH.lineWidth = 5;
  ctxTR.strokeStyle = '#e0e0e0'; // matte rough grout
  ctxTR.lineWidth = 5;
  for (let i = 0; i <= cells; i++) {
    [ctxT, ctxTH, ctxTR].forEach((c) => {
      c.beginPath();
      c.moveTo(i * step, 0);
      c.lineTo(i * step, 512);
      c.stroke();
      c.beginPath();
      c.moveTo(0, i * step);
      c.lineTo(512, i * step);
      c.stroke();
    });
  }
  const tile = finalizeColorTex(cTile, maxAnisotropy, 3, 2);
  const tileNormal = buildNormalFromHeight(cTileH, 2.5, maxAnisotropy, 3, 2);
  const tileRoughness = finalizeDataTex(cTileR, maxAnisotropy, 3, 2);

  // 3. Fieldstone Wall + Stone Relief Normal Map
  const [cStone, ctxS] = makeCanvas(512, 512);
  const [cStoneH, ctxSH] = makeCanvas(512, 512);
  ctxS.fillStyle = '#4c4943';
  ctxS.fillRect(0, 0, 512, 512);
  ctxSH.fillStyle = '#282828';
  ctxSH.fillRect(0, 0, 512, 512);
  for (let row = 0; row < 10; row++) {
    const y = row * 51.2;
    let x = (row % 2) * -28;
    while (x < 512) {
      const w = 52 + ((row * 19 + Math.floor(x)) % 46);
      const tone = 78 + ((row * 31 + Math.floor(x * 0.7)) % 36);
      ctxS.fillStyle = `rgb(${tone + 4},${tone},${tone - 6})`;
      ctxS.fillRect(x + 3, y + 3, w - 6, 45);
      ctxS.fillStyle = 'rgba(20, 22, 18, 0.25)';
      ctxS.fillRect(x + 3, y + 40, w - 6, 8);

      const hVal = 175 + ((row * 23 + Math.floor(x)) % 60);
      ctxSH.fillStyle = `rgb(${hVal},${hVal},${hVal})`;
      ctxSH.fillRect(x + 4, y + 4, w - 8, 43);
      x += w;
    }
  }
  const stone = finalizeColorTex(cStone, maxAnisotropy, 2, 2);
  const stoneNormal = buildNormalFromHeight(cStoneH, 2.8, maxAnisotropy, 2, 2);

  // 4. Weathered Lime Plaster + Water Streaks & Normal Map
  const [cPlaster, ctxP] = makeCanvas(512, 512);
  const [cPlasterH, ctxPH] = makeCanvas(512, 512);
  ctxP.fillStyle = '#b9b19f';
  ctxP.fillRect(0, 0, 512, 512);
  ctxPH.fillStyle = '#828282';
  ctxPH.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 240; i++) {
    const px = Math.random() * 512;
    const py = Math.random() * 512;
    const rad = 10 + Math.random() * 44;
    ctxP.fillStyle = i % 3 === 0 ? 'rgba(65,58,46,0.11)' : 'rgba(225,220,208,0.08)';
    ctxP.beginPath();
    ctxP.arc(px, py, rad, 0, Math.PI * 2);
    ctxP.fill();

    const hShade = i % 2 === 0 ? 115 : 145;
    ctxPH.fillStyle = `rgba(${hShade},${hShade},${hShade},0.22)`;
    ctxPH.beginPath();
    ctxPH.arc(px, py, rad * 0.7, 0, Math.PI * 2);
    ctxPH.fill();
  }
  // Rain damp streaks from eaves
  for (let s = 0; s < 22; s++) {
    const sx = Math.random() * 512;
    const len = 70 + Math.random() * 190;
    const grad = ctxP.createLinearGradient(sx, 0, sx, len);
    grad.addColorStop(0, 'rgba(34, 32, 26, 0.24)');
    grad.addColorStop(1, 'rgba(34, 32, 26, 0.0)');
    ctxP.fillStyle = grad;
    ctxP.fillRect(sx, 0, 4 + Math.random() * 10, len);
  }
  const plaster = finalizeColorTex(cPlaster, maxAnisotropy, 2, 2);
  const plasterNormal = buildNormalFromHeight(cPlasterH, 1.45, maxAnisotropy, 2, 2);

  // 5. Timber Planks + Wood Grain Normal Map
  const [cTimber, ctxW] = makeCanvas(512, 512);
  const [cTimberH, ctxWH] = makeCanvas(512, 512);
  ctxW.fillStyle = '#3d2c20';
  ctxW.fillRect(0, 0, 512, 512);
  ctxWH.fillStyle = '#383838';
  ctxWH.fillRect(0, 0, 512, 512);
  for (let p = 0; p < 8; p++) {
    const y = p * 64;
    const base = 46 + (p % 3) * 10;
    ctxW.fillStyle = `rgb(${base + 14},${base},${base - 12})`;
    ctxW.fillRect(0, y + 2, 512, 60);
    ctxWH.fillStyle = '#b8b8b8';
    ctxWH.fillRect(0, y + 3, 512, 58);

    ctxW.strokeStyle = 'rgba(22,14,9,0.45)';
    ctxW.lineWidth = 2;
    ctxWH.strokeStyle = 'rgba(70,70,70,0.6)';
    ctxWH.lineWidth = 2;
    for (let g = 0; g < 6; g++) {
      [ctxW, ctxWH].forEach((c) => {
        c.beginPath();
        c.moveTo(0, y + 10 + g * 8);
        c.bezierCurveTo(170, y + 6 + g * 8, 340, y + 14 + g * 8, 512, y + 10 + g * 8);
        c.stroke();
      });
    }
  }
  const timber = finalizeColorTex(cTimber, maxAnisotropy, 2, 2);
  const timberNormal = buildNormalFromHeight(cTimberH, 2.2, maxAnisotropy, 2, 2);

  // 5b. Anatolian Terracotta Kiremit Roof Tiles + Normal Map
  const [cRoof, ctxRf] = makeCanvas(512, 512);
  const [cRoofH, ctxRfH] = makeCanvas(512, 512);
  ctxRf.fillStyle = '#472a21';
  ctxRf.fillRect(0, 0, 512, 512);
  ctxRfH.fillStyle = '#303030';
  ctxRfH.fillRect(0, 0, 512, 512);

  const roofRows = 12;
  const roofCols = 14;
  const rStepY = 512 / roofRows;
  const rStepX = 512 / roofCols;
  for (let row = 0; row < roofRows; row++) {
    const ry = row * rStepY;
    for (let col = 0; col < roofCols; col++) {
      const rx = col * rStepX + (row % 2) * (rStepX * 0.15);
      const tone = ((row * 17 + col * 31) % 24) - 12;
      const rCol = 88 + tone;
      const gCol = 46 + Math.floor(tone * 0.6);
      const bCol = 36 + Math.floor(tone * 0.4);
      ctxRf.fillStyle = `rgb(${rCol},${gCol},${bCol})`;
      ctxRf.fillRect(rx + 2, ry + 2, rStepX - 4, rStepY - 4);

      // Highlight ridge of arched alaturka tile
      ctxRf.fillStyle = 'rgba(178, 118, 92, 0.2)';
      ctxRf.fillRect(rx + 5, ry + 3, rStepX * 0.45, rStepY - 7);

      // Occasional dark moss & damp soot patch
      if ((row * 7 + col * 11) % 9 === 0) {
        ctxRf.fillStyle = 'rgba(34, 48, 28, 0.42)';
        ctxRf.fillRect(rx + 4, ry + 6, rStepX - 8, rStepY - 10);
      }

      const hTile = 165 + ((row * 13 + col * 23) % 45);
      ctxRfH.fillStyle = `rgb(${hTile},${hTile},${hTile})`;
      ctxRfH.fillRect(rx + 2, ry + 2, rStepX - 4, rStepY - 5);
    }
    // Horizontal overlap shadow line
    ctxRf.fillStyle = 'rgba(15, 10, 8, 0.45)';
    ctxRf.fillRect(0, ry + rStepY - 4, 512, 4);
    ctxRfH.fillStyle = '#202020';
    ctxRfH.fillRect(0, ry + rStepY - 4, 512, 4);
  }
  const roof = finalizeColorTex(cRoof, maxAnisotropy, 3, 2);
  const roofNormal = buildNormalFromHeight(cRoofH, 2.7, maxAnisotropy, 3, 2);

  // 6. Anatolian Kilim Rug
  const [cKilim, ctxK] = makeCanvas(512, 512);
  ctxK.fillStyle = '#6c1f1a';
  ctxK.fillRect(0, 0, 512, 512);
  ctxK.strokeStyle = '#c59b57';
  ctxK.lineWidth = 14;
  ctxK.strokeRect(24, 24, 464, 464);
  ctxK.strokeStyle = '#1f2836';
  ctxK.lineWidth = 8;
  ctxK.strokeRect(48, 48, 416, 416);
  for (let i = 0; i < 3; i++) {
    const cy = 128 + i * 128;
    ctxK.fillStyle = '#202b38';
    ctxK.beginPath();
    ctxK.moveTo(256, cy - 48);
    ctxK.lineTo(318, cy);
    ctxK.lineTo(256, cy + 48);
    ctxK.lineTo(194, cy);
    ctxK.closePath();
    ctxK.fill();
    ctxK.strokeStyle = '#d3ab65';
    ctxK.lineWidth = 4;
    ctxK.stroke();
  }
  const kilim = finalizeColorTex(cKilim, maxAnisotropy, 1, 1);

  // 7. Wet Village Road + Puddle Roughness & Cobble Normal Map
  const [cRoad, ctxR] = makeCanvas(512, 512);
  const [cRoadH, ctxRH] = makeCanvas(512, 512);
  const [cRoadR, ctxRR] = makeCanvas(512, 512);
  ctxR.fillStyle = '#2a2622';
  ctxR.fillRect(0, 0, 512, 512);
  ctxRH.fillStyle = '#686868';
  ctxRH.fillRect(0, 0, 512, 512);
  ctxRR.fillStyle = '#d8d8d8'; // matte dry mud default
  ctxRR.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 340; i++) {
    const rx = Math.random() * 512;
    const ry = Math.random() * 512;
    const rw = 8 + Math.random() * 24;
    const rh = 6 + Math.random() * 18;
    const v = 35 + Math.floor(Math.random() * 30);
    ctxR.fillStyle = `rgb(${v + 4},${v + 2},${v - 2})`;
    ctxR.fillRect(rx, ry, rw, rh);

    const hv = 110 + Math.floor(Math.random() * 90);
    ctxRH.fillStyle = `rgb(${hv},${hv},${hv})`;
    ctxRH.fillRect(rx, ry, rw, rh);
  }
  // Rain puddles (dark shiny low-roughness regions)
  for (let p = 0; p < 16; p++) {
    const px = Math.random() * 512;
    const py = Math.random() * 512;
    const rad = 22 + Math.random() * 38;
    ctxR.fillStyle = 'rgba(20, 24, 28, 0.35)';
    ctxR.beginPath();
    ctxR.arc(px, py, rad, 0, Math.PI * 2);
    ctxR.fill();

    ctxRH.fillStyle = '#404040';
    ctxRH.beginPath();
    ctxRH.arc(px, py, rad, 0, Math.PI * 2);
    ctxRH.fill();

    ctxRR.fillStyle = '#181818'; // glossy water reflection in puddles
    ctxRR.beginPath();
    ctxRR.arc(px, py, rad, 0, Math.PI * 2);
    ctxRR.fill();
  }
  const road = finalizeColorTex(cRoad, maxAnisotropy, 2, 14);
  const roadNormal = buildNormalFromHeight(cRoadH, 2.4, maxAnisotropy, 2, 14);
  const roadRoughness = finalizeDataTex(cRoadR, maxAnisotropy, 2, 14);

  // 8. Mountain Ground (Damp Soil, Moss, Pine Needles + Relief Normal)
  const [cGround, ctxG] = makeCanvas(512, 512);
  const [cGroundH, ctxGH] = makeCanvas(512, 512);
  ctxG.fillStyle = '#1e271b';
  ctxG.fillRect(0, 0, 512, 512);
  ctxGH.fillStyle = '#787878';
  ctxGH.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 620; i++) {
    const gx = Math.random() * 512;
    const gy = Math.random() * 512;
    const gw = 8 + Math.random() * 20;
    const gh = 8 + Math.random() * 20;
    if (i % 4 === 0) {
      ctxG.fillStyle = 'rgba(56, 46, 30, 0.34)'; // fallen needles / soil
      ctxGH.fillStyle = 'rgba(165, 165, 165, 0.25)';
    } else if (i % 2 === 0) {
      ctxG.fillStyle = 'rgba(42, 58, 34, 0.38)'; // damp moss/grass
      ctxGH.fillStyle = 'rgba(140, 140, 140, 0.25)';
    } else {
      ctxG.fillStyle = 'rgba(18, 22, 16, 0.38)';
      ctxGH.fillStyle = 'rgba(92, 92, 92, 0.25)';
    }
    ctxG.fillRect(gx, gy, gw, gh);
    ctxGH.fillRect(gx, gy, gw, gh);
  }
  // Small embedded pebbles & pine-needle strokes
  ctxG.strokeStyle = 'rgba(72, 56, 34, 0.35)';
  ctxG.lineWidth = 1.5;
  for (let n = 0; n < 160; n++) {
    const nx = Math.random() * 512;
    const ny = Math.random() * 512;
    const ang = Math.random() * Math.PI * 2;
    ctxG.beginPath();
    ctxG.moveTo(nx, ny);
    ctxG.lineTo(nx + Math.cos(ang) * 9, ny + Math.sin(ang) * 9);
    ctxG.stroke();
  }
  const ground = finalizeColorTex(cGround, maxAnisotropy, 18, 18);
  const groundNormal = buildNormalFromHeight(cGroundH, 1.9, maxAnisotropy, 18, 18);

  // 9. Scratched Sepia Village Photo
  const [cPhoto, ctxPh] = makeCanvas(256, 256);
  ctxPh.fillStyle = '#8b795e';
  ctxPh.fillRect(0, 0, 256, 256);
  ctxPh.fillStyle = '#473c2d';
  ctxPh.fillRect(0, 140, 256, 116);
  ctxPh.fillStyle = '#2a2219';
  [54, 104, 154, 202].forEach((fx) => {
    ctxPh.fillRect(fx - 14, 110, 28, 86);
    ctxPh.beginPath();
    ctxPh.arc(fx, 92, 13, 0, Math.PI * 2);
    ctxPh.fill();
  });
  ctxPh.strokeStyle = '#0c0908';
  ctxPh.lineWidth = 4;
  [54, 104, 154].forEach((fx) => {
    ctxPh.beginPath();
    ctxPh.moveTo(fx - 12, 82);
    ctxPh.lineTo(fx + 12, 102);
    ctxPh.moveTo(fx + 12, 82);
    ctxPh.lineTo(fx - 12, 102);
    ctxPh.stroke();
  });
  const photo = finalizeColorTex(cPhoto, maxAnisotropy, 1, 1);

  // 10. Village Entrance Sign
  const [cSign, ctxSg] = makeCanvas(512, 256);
  ctxSg.fillStyle = '#1b365d';
  ctxSg.fillRect(0, 0, 512, 256);
  ctxSg.strokeStyle = '#e6e2d8';
  ctxSg.lineWidth = 10;
  ctxSg.strokeRect(14, 14, 484, 228);
  ctxSg.fillStyle = '#f0ece1';
  ctxSg.font = 'bold 46px Georgia, serif';
  ctxSg.textAlign = 'center';
  ctxSg.fillText('KUZDAĞ KÖYÜ', 256, 118);
  ctxSg.font = '28px monospace';
  ctxSg.fillStyle = '#c8d0da';
  ctxSg.fillText('RAKIM: 1480 m', 256, 178);
  const sign = finalizeColorTex(cSign, maxAnisotropy, 1, 1);

  // 11. Soft Radial Mist Sprite
  const [cMist, ctxMs] = makeCanvas(128, 128);
  const grad = ctxMs.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(205, 218, 228, 0.32)');
  grad.addColorStop(0.55, 'rgba(175, 190, 204, 0.12)');
  grad.addColorStop(1, 'rgba(150, 168, 184, 0.0)');
  ctxMs.fillStyle = grad;
  ctxMs.fillRect(0, 0, 128, 128);
  const mistSprite = finalizeColorTex(cMist, 1, 1, 1);

  return {
    marble,
    marbleNormal,
    tile,
    tileNormal,
    tileRoughness,
    stone,
    stoneNormal,
    plaster,
    plasterNormal,
    timber,
    timberNormal,
    roof,
    roofNormal,
    kilim,
    road,
    roadNormal,
    roadRoughness,
    ground,
    groundNormal,
    photo,
    sign,
    mistSprite,
    disposeAll: () => {
      [
        marble,
        marbleNormal,
        tile,
        tileNormal,
        tileRoughness,
        stone,
        stoneNormal,
        plaster,
        plasterNormal,
        timber,
        timberNormal,
        roof,
        roofNormal,
        kilim,
        road,
        roadNormal,
        roadRoughness,
        ground,
        groundNormal,
        photo,
        sign,
        mistSprite,
      ].forEach((t) => t.dispose());
    },
  };
}
