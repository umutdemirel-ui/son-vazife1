import * as THREE from 'three';
import { CC0TexturePack } from './cc0Assets';
import { ProceduralTextureSet } from './textures';

/**
 * Deterministic heightfield for the expanded 5-district Kuzdağ Anatolian mountain valley.
 * Keeps village square, clinic, mill, cemetery hill, and crash bend gently walkable
 * while carving a shallow mountain stream at x ≈ -24 and raising surrounding mountain ridges.
 */
export function groundHeightAt(x: number, z: number): number {
  // Playable valley corridor spans x:[-48, 42], z:[-52, 44]
  const laneDistX = Math.max(0, Math.abs(x + 3) - 46);
  const laneDistZ = z < -54 ? -54 - z : z > 46 ? z - 46 : 0;
  const edgeDist = Math.hypot(laneDistX, laneDistZ);

  const ridgeDetail =
    edgeDist > 2
      ? (Math.sin(x * 0.085 + z * 0.06) * 1.15 + Math.cos(x * 0.045 - z * 0.075) * 1.45) *
        Math.min(1, (edgeDist - 2) / 18)
      : 0;
  const mountain = Math.pow(Math.min(edgeDist, 95) / 16.5, 1.68) * 3.1 + ridgeDetail;

  // Gentle natural undulation along the village roads
  const gentleSlope = Math.sin(z * 0.055) * 0.14 + Math.cos(x * 0.065) * 0.08;

  // Slight elevation bump for Mezarlık Tepesi (-34, -36)
  const dCemeteryHill = Math.hypot(x + 34, z + 36);
  const cemeteryRise = dCemeteryHill < 14 ? (1 - dCemeteryHill / 14) * 0.85 : 0;

  // Shallow stream channel along x ≈ -24 (except under the wooden bridge at z ≈ 8 and cemetery road at z ≈ -32)
  const streamCenter = -24 + Math.sin(z * 0.07) * 1.4;
  const streamDist = Math.abs(x - streamCenter);
  const nearBridge = Math.abs(z - 8) < 3.4 || Math.abs(z + 32) < 3.4;
  const streamDip =
    streamDist < 3.2 && !nearBridge ? -0.68 * Math.cos((streamDist / 3.2) * (Math.PI * 0.5)) : 0;

  // Flatten building pads so interiors sit flush on ground
  const dMosque = Math.hypot(x + 10.5, z - 6.0);
  const dAbandoned = Math.hypot(x + 10.8, z + 10.5);
  const dMuhtar = Math.hypot(x - 10.5, z + 18.0);
  const dFountain = Math.hypot(x - 4.8, z - 12.5);
  const dClinic = Math.hypot(x - 26.0, z + 28.0);
  const dMill = Math.hypot(x + 36.0, z - 8.0);
  const dCrypt = Math.hypot(x + 34.0, z + 36.0);
  const dCrash = Math.hypot(x - 28.0, z - 20.0);

  const padMask = Math.min(
    1,
    Math.min(
      dMosque / 8.0,
      dAbandoned / 6.2,
      dMuhtar / 7.2,
      dFountain / 4.0,
      dClinic / 7.5,
      dMill / 6.8,
      dCrypt / 7.2,
      dCrash / 6.5,
    ),
  );

  return mountain + cemeteryRise + streamDip + gentleSlope * padMask;
}

export interface TerrainHandles {
  applyCC0Ground: (pack: CC0TexturePack) => void;
  applyCC0Road: (pack: CC0TexturePack) => void;
  streamWater: THREE.Mesh;
  dispose: () => void;
}

export function buildMountainTerrainAndForest(
  scene: THREE.Scene,
  textures: ProceduralTextureSet,
): TerrainHandles {
  const disposables: Array<{ dispose: () => void }> = [];

  // 1. Valley Terrain Mesh (340m x 340m)
  const size = 340;
  const segs = 104;
  const terrainGeo = new THREE.PlaneGeometry(size, size, segs, segs);
  terrainGeo.rotateX(-Math.PI / 2);

  const pos = terrainGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vz = pos.getZ(i);
    pos.setY(i, groundHeightAt(vx, vz));
  }
  terrainGeo.computeVertexNormals();

  const terrainMat = new THREE.MeshStandardMaterial({
    map: textures.ground,
    normalMap: textures.groundNormal,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughness: 0.94,
    metalness: 0.02,
    color: 0x85917a,
  });
  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  terrainMesh.matrixAutoUpdate = false;
  terrainMesh.updateMatrix();
  scene.add(terrainMesh);
  disposables.push(terrainGeo, terrainMat);

  // 2. Main Road + District Side Roads (shared wet cobblestone material)
  const roadMat = new THREE.MeshStandardMaterial({
    map: textures.road,
    normalMap: textures.roadNormal,
    normalScale: new THREE.Vector2(0.95, 0.95),
    roughnessMap: textures.roadRoughness,
    roughness: 0.88,
    metalness: 0.08,
    envMapIntensity: 1.3,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  disposables.push(roadMat);

  // Main North-South Road (z: -48..42)
  const mainRoadGeo = new THREE.PlaneGeometry(5.2, 90, 10, 72);
  mainRoadGeo.rotateX(-Math.PI / 2);
  const mrPos = mainRoadGeo.attributes.position;
  for (let i = 0; i < mrPos.count; i++) {
    const rx = mrPos.getX(i);
    const rz = mrPos.getZ(i) - 3;
    const curveOffset = Math.sin(rz * 0.08) * 1.4;
    const worldX = rx + curveOffset;
    mrPos.setX(i, worldX);
    mrPos.setZ(i, rz);
    mrPos.setY(i, groundHeightAt(worldX, rz) + 0.038);
  }
  mainRoadGeo.computeVertexNormals();
  const mainRoadMesh = new THREE.Mesh(mainRoadGeo, roadMat);
  mainRoadMesh.receiveShadow = true;
  mainRoadMesh.matrixAutoUpdate = false;
  mainRoadMesh.updateMatrix();
  scene.add(mainRoadMesh);
  disposables.push(mainRoadGeo);

  // Helper to build branch paths
  const buildSideRoad = (startX: number, startZ: number, endX: number, endZ: number, width: number) => {
    const len = Math.hypot(endX - startX, endZ - startZ);
    const segLen = Math.max(12, Math.round(len * 1.4));
    const geo = new THREE.PlaneGeometry(width, len, 6, segLen);
    geo.rotateX(-Math.PI / 2);
    const angle = Math.atan2(endX - startX, endZ - startZ);
    const cx = (startX + endX) * 0.5;
    const cz = (startZ + endZ) * 0.5;

    const p = geo.attributes.position;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    for (let i = 0; i < p.count; i++) {
      const lx = p.getX(i);
      const lz = p.getZ(i);
      const wx = cx + lx * cosA + lz * sinA;
      const wz = cz - lx * sinA + lz * cosA;
      p.setX(i, wx);
      p.setZ(i, wz);
      p.setY(i, groundHeightAt(wx, wz) + 0.036);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, roadMat);
    m.receiveShadow = true;
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    scene.add(m);
    disposables.push(geo);
  };

  // Branch 1: East to Sağlık Ocağı (x: 1 -> 26, z: -24 -> -28)
  buildSideRoad(0.5, -24, 26.5, -28, 3.8);
  // Branch 2: West to Mezarlık Tepesi (x: -1 -> -34, z: -29 -> -36)
  buildSideRoad(-1.0, -29, -34.0, -36, 3.4);
  // Branch 3: West to Dere Köprüsü & Eski Su Değirmeni (x: -1 -> -36, z: 8 -> 8)
  buildSideRoad(-1.5, 8.0, -36.0, 8.0, 3.5);
  // Branch 4: Southeast to Viraj Kaza Alanı (x: 1 -> 28, z: 16 -> 20)
  buildSideRoad(1.0, 16.0, 29.0, 20.5, 4.0);

  // 2c. Mountain Stream Water along x ≈ -24
  const streamGeo = new THREE.PlaneGeometry(4.4, 96, 8, 48);
  streamGeo.rotateX(-Math.PI / 2);
  const sPos = streamGeo.attributes.position;
  for (let i = 0; i < sPos.count; i++) {
    const sx = sPos.getX(i);
    const sz = sPos.getZ(i) - 4;
    const sc = -24 + Math.sin(sz * 0.07) * 1.4;
    sPos.setX(i, sx + sc);
    sPos.setZ(i, sz);
    sPos.setY(i, -0.26);
  }
  streamGeo.computeVertexNormals();
  const streamMat = new THREE.MeshStandardMaterial({
    color: 0x162730,
    roughness: 0.14,
    metalness: 0.35,
    envMapIntensity: 1.5,
  });
  const streamWater = new THREE.Mesh(streamGeo, streamMat);
  streamWater.receiveShadow = true;
  streamWater.matrixAutoUpdate = false;
  streamWater.updateMatrix();
  scene.add(streamWater);
  disposables.push(streamGeo, streamMat);

  // Deterministic PRNG for organic dressing
  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();

  // 2b. Roadside Cobble Curbs / Drainage Shoulder Stones (InstancedMesh)
  const curbGeo = new THREE.DodecahedronGeometry(0.24, 0);
  const curbMat = new THREE.MeshStandardMaterial({
    map: textures.stone,
    normalMap: textures.stoneNormal,
    normalScale: new THREE.Vector2(0.9, 0.9),
    roughness: 0.88,
    metalness: 0.03,
    color: 0x79766f,
  });
  const curbEntries: Array<{ x: number; y: number; z: number; sx: number; sy: number; sz: number; ry: number }> = [];
  for (let rz = -42; rz <= 36; rz += 1.05) {
    const center = Math.sin(rz * 0.08) * 1.4;
    for (const side of [-1, 1]) {
      if (side === -1 && ((rz > 1 && rz < 10.5) || (rz > -13.5 && rz < -7.5) || (rz > -34 && rz < -26))) continue;
      if (side === 1 && ((rz > 10.5 && rz < 22) || (rz > -29 && rz < -15))) continue;
      const cx = center + side * 2.68 + (rand() - 0.5) * 0.14;
      const cz = rz + (rand() - 0.5) * 0.16;
      curbEntries.push({
        x: cx,
        y: groundHeightAt(cx, cz) + 0.04,
        z: cz,
        sx: 0.85 + rand() * 0.45,
        sy: 0.42 + rand() * 0.25,
        sz: 1.15 + rand() * 0.6,
        ry: rand() * Math.PI,
      });
    }
  }
  const curbs = new THREE.InstancedMesh(curbGeo, curbMat, curbEntries.length);
  curbs.receiveShadow = true;
  curbEntries.forEach((c, idx) => {
    dummy.position.set(c.x, c.y, c.z);
    dummy.rotation.set(0, c.ry, 0);
    dummy.scale.set(c.sx, c.sy, c.sz);
    dummy.updateMatrix();
    curbs.setMatrixAt(idx, dummy.matrix);
    const v = 0.85 + rand() * 0.25;
    tint.setRGB(v, v * 0.98, v * 0.94);
    curbs.setColorAt(idx, tint);
  });
  curbs.instanceMatrix.needsUpdate = true;
  if (curbs.instanceColor) curbs.instanceColor.needsUpdate = true;
  curbs.computeBoundingSphere();
  curbs.matrixAutoUpdate = false;
  curbs.updateMatrix();
  scene.add(curbs);
  disposables.push(curbGeo, curbMat);

  // 3. Instanced 3-Tier Pine Forest bordering the expanded 5-district valley (~420 pines)
  const treeCoords: Array<{ x: number; z: number; scale: number; rot: number; leanX: number; leanZ: number }> = [];
  for (let i = 0; i < 480; i++) {
    const angle = rand() * Math.PI * 2;
    const radius = 26 + rand() * 98;
    const tx = Math.cos(angle) * radius;
    const tz = Math.sin(angle) * radius;
    // Keep all 5 districts and connecting roads clear of trees
    if (Math.abs(tx) < 16.5 && tz > -46 && tz < 38) continue;
    if (Math.hypot(tx - 26, tz + 28) < 11.5) continue; // Clinic pad
    if (Math.hypot(tx + 34, tz + 36) < 12.5) continue; // Cemetery hill
    if (Math.hypot(tx + 36, tz - 8) < 11.5) continue; // Mill pad
    if (Math.hypot(tx - 28, tz - 20) < 11.5) continue; // Crash bend
    if (Math.abs(tz - 8) < 4.5 && tx > -38 && tx < 2) continue; // Mill lane
    if (Math.abs(tz + 26) < 4.8 && tx > -4 && tx < 28) continue; // Clinic lane
    if (Math.abs(tz + 32) < 4.8 && tx > -36 && tx < 2) continue; // Cemetery lane
    if (Math.abs(tz - 18) < 4.8 && tx > -2 && tx < 30) continue; // Crash lane
    if (Math.abs(tx + 24) < 3.8) continue; // Stream bed

    treeCoords.push({
      x: tx,
      z: tz,
      scale: 0.82 + rand() * 0.44,
      rot: rand() * Math.PI * 2,
      leanX: (rand() - 0.5) * 0.07,
      leanZ: (rand() - 0.5) * 0.07,
    });
  }

  const count = treeCoords.length;
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.36, 3.2, 7);
  trunkGeo.translate(0, 1.6, 0);
  const trunkMat = new THREE.MeshStandardMaterial({
    map: textures.timber,
    normalMap: textures.timberNormal,
    color: 0x453224,
    roughness: 0.94,
    metalness: 0.0,
  });

  const coneLowGeo = new THREE.ConeGeometry(2.25, 3.8, 9);
  coneLowGeo.translate(0, 3.6, 0);
  const coneMidGeo = new THREE.ConeGeometry(1.72, 3.4, 9);
  coneMidGeo.translate(0, 5.4, 0);
  const coneTopGeo = new THREE.ConeGeometry(1.15, 3.1, 8);
  coneTopGeo.translate(0, 7.1, 0);

  const foliageMat = new THREE.MeshStandardMaterial({
    color: 0x213224,
    roughness: 0.89,
    metalness: 0.02,
  });

  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
  const conesLow = new THREE.InstancedMesh(coneLowGeo, foliageMat, count);
  const conesMid = new THREE.InstancedMesh(coneMidGeo, foliageMat, count);
  const conesTop = new THREE.InstancedMesh(coneTopGeo, foliageMat, count);
  trunks.castShadow = false;
  conesLow.castShadow = false;
  conesMid.castShadow = false;
  conesTop.castShadow = false;

  treeCoords.forEach((t, idx) => {
    const gy = groundHeightAt(t.x, t.z);
    dummy.position.set(t.x, gy - 0.12, t.z);
    dummy.rotation.set(t.leanX, t.rot, t.leanZ);
    dummy.scale.setScalar(t.scale);
    dummy.updateMatrix();
    trunks.setMatrixAt(idx, dummy.matrix);
    conesLow.setMatrixAt(idx, dummy.matrix);
    conesMid.setMatrixAt(idx, dummy.matrix);
    conesTop.setMatrixAt(idx, dummy.matrix);

    const gShift = 0.76 + (idx % 6) * 0.075;
    tint.setRGB(0.82 * gShift, gShift, 0.86 * gShift);
    conesLow.setColorAt(idx, tint);
    conesMid.setColorAt(idx, tint);
    conesTop.setColorAt(idx, tint);
  });

  [trunks, conesLow, conesMid, conesTop].forEach((im) => {
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
    im.matrixAutoUpdate = false;
    im.updateMatrix();
  });

  scene.add(trunks, conesLow, conesMid, conesTop);
  disposables.push(trunkGeo, trunkMat, coneLowGeo, coneMidGeo, coneTopGeo, foliageMat);

  // 4. Instanced Mossy Mountain Boulders along edges, stream banks & slopes
  const rockGeo = new THREE.IcosahedronGeometry(0.65, 1);
  const rockMat = new THREE.MeshStandardMaterial({
    map: textures.stone,
    normalMap: textures.stoneNormal,
    normalScale: new THREE.Vector2(1.1, 1.1),
    roughness: 0.9,
    metalness: 0.04,
    color: 0x6f736a,
  });
  const rockData: Array<{ x: number; z: number; sx: number; sy: number; sz: number; ry: number }> = [];
  for (let i = 0; i < 110; i++) {
    const rx = -48 + rand() * 90;
    const rz = -50 + rand() * 90;
    if (Math.abs(rx) < 4.5) continue;
    if (Math.abs(rx + 10.5) < 5.5 && Math.abs(rz - 6.0) < 5.5) continue;
    if (Math.abs(rx + 10.8) < 5.0 && Math.abs(rz + 10.5) < 4.5) continue;
    if (Math.abs(rx - 10.5) < 5.0 && Math.abs(rz + 18.0) < 4.5) continue;
    if (Math.hypot(rx - 26, rz + 28) < 7.5) continue;
    if (Math.hypot(rx + 36, rz - 8) < 7.5) continue;
    if (Math.hypot(rx + 34, rz + 36) < 8.5) continue;
    if (Math.hypot(rx - 28, rz - 20) < 7.5) continue;
    rockData.push({
      x: rx,
      z: rz,
      sx: 0.7 + rand() * 1.45,
      sy: 0.45 + rand() * 0.75,
      sz: 0.7 + rand() * 1.35,
      ry: rand() * Math.PI * 2,
    });
  }
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, rockData.length);
  rocks.castShadow = false;
  rocks.receiveShadow = true;
  rockData.forEach((r, idx) => {
    const gy = groundHeightAt(r.x, r.z);
    dummy.position.set(r.x, gy + r.sy * 0.16, r.z);
    dummy.rotation.set((rand() - 0.5) * 0.3, r.ry, (rand() - 0.5) * 0.3);
    dummy.scale.set(r.sx, r.sy, r.sz);
    dummy.updateMatrix();
    rocks.setMatrixAt(idx, dummy.matrix);
    const s = 0.76 + rand() * 0.32;
    tint.setRGB(s * 0.94, s, s * 0.9);
    rocks.setColorAt(idx, tint);
  });
  rocks.instanceMatrix.needsUpdate = true;
  if (rocks.instanceColor) rocks.instanceColor.needsUpdate = true;
  rocks.computeBoundingSphere();
  rocks.matrixAutoUpdate = false;
  rocks.updateMatrix();
  scene.add(rocks);
  disposables.push(rockGeo, rockMat);

  // 5. Instanced Mountain Scrub / Wild Ferns across all 5 districts
  const shrubGeo = new THREE.DodecahedronGeometry(0.45, 0);
  shrubGeo.translate(0, 0.25, 0);
  const shrubMat = new THREE.MeshStandardMaterial({
    color: 0x263723,
    roughness: 0.92,
    metalness: 0.0,
  });
  const shrubData: Array<{ x: number; z: number; s: number }> = [];
  for (let i = 0; i < 150; i++) {
    const sx = -44 + rand() * 82;
    const sz = -46 + rand() * 84;
    if (Math.abs(sx) < 3.6) continue;
    if (Math.abs(sx + 10.5) < 4.5 && Math.abs(sz - 6.0) < 4.5) continue;
    if (Math.abs(sx + 10.8) < 4.0 && Math.abs(sz + 10.5) < 4.0) continue;
    if (Math.abs(sx - 10.5) < 4.2 && Math.abs(sz + 18.0) < 4.2) continue;
    if (Math.hypot(sx - 26, sz + 28) < 6.0) continue;
    if (Math.hypot(sx + 36, sz - 8) < 5.5) continue;
    if (Math.hypot(sx + 34, sz + 36) < 6.5) continue;
    shrubData.push({ x: sx, z: sz, s: 0.65 + rand() * 0.95 });
  }
  const shrubs = new THREE.InstancedMesh(shrubGeo, shrubMat, shrubData.length);
  shrubData.forEach((sh, idx) => {
    const gy = groundHeightAt(sh.x, sh.z);
    dummy.position.set(sh.x, gy - 0.04, sh.z);
    dummy.rotation.set(0, rand() * Math.PI * 2, 0);
    dummy.scale.set(sh.s * 1.15, sh.s * 0.78, sh.s);
    dummy.updateMatrix();
    shrubs.setMatrixAt(idx, dummy.matrix);
    const g = 0.75 + rand() * 0.4;
    tint.setRGB(0.8 * g, g, 0.75 * g);
    shrubs.setColorAt(idx, tint);
  });
  shrubs.instanceMatrix.needsUpdate = true;
  if (shrubs.instanceColor) shrubs.instanceColor.needsUpdate = true;
  shrubs.computeBoundingSphere();
  shrubs.matrixAutoUpdate = false;
  shrubs.updateMatrix();
  scene.add(shrubs);
  disposables.push(shrubGeo, shrubMat);

  return {
    streamWater,
    applyCC0Ground: (pack: CC0TexturePack) => {
      terrainMat.map = pack.diffuse;
      terrainMat.normalMap = pack.normal;
      terrainMat.roughnessMap = pack.roughness;
      terrainMat.color.setHex(0xadb5a3);
      terrainMat.needsUpdate = true;
    },
    applyCC0Road: (pack: CC0TexturePack) => {
      roadMat.map = pack.diffuse;
      roadMat.normalMap = pack.normal;
      roadMat.roughnessMap = pack.roughness;
      roadMat.color.setHex(0xb8b2a8);
      roadMat.needsUpdate = true;
    },
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
