import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { AutopsyBodyRefs, createAutopsyCadaverOverlay } from './autopsy';
import { ProceduralTextureSet } from './textures';

/**
 * Merges static sibling meshes inside a group by material & shadow flags to slash draw calls.
 * Skips any objects in `skipSet` (doors, shutters, interactive props, lights, autopsy tables).
 */
function bakeStaticChildrenByMaterial(
  root: THREE.Group,
  skipSet?: Set<THREE.Object3D>,
): void {
  root.updateMatrixWorld(true);
  const invRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const relMatrix = new THREE.Matrix4();

  interface Bucket {
    mat: THREE.Material;
    castShadow: boolean;
    receiveShadow: boolean;
    meshes: THREE.Mesh[];
  }
  const buckets = new Map<string, Bucket>();

  const collect = (obj: THREE.Object3D) => {
    if (skipSet && skipSet.has(obj)) return;
    if (obj instanceof THREE.Light) return;

    const mesh = obj as THREE.Mesh;
    if (
      mesh.isMesh &&
      mesh.geometry &&
      !Array.isArray(mesh.material) &&
      mesh.material instanceof THREE.Material
    ) {
      const key = `${mesh.material.uuid}:${mesh.castShadow ? 1 : 0}:${mesh.receiveShadow ? 1 : 0}`;
      let b = buckets.get(key);
      if (!b) {
        b = {
          mat: mesh.material,
          castShadow: mesh.castShadow,
          receiveShadow: mesh.receiveShadow,
          meshes: [],
        };
        buckets.set(key, b);
      }
      b.meshes.push(mesh);
      return;
    }

    const children = [...obj.children];
    for (let i = 0; i < children.length; i++) {
      collect(children[i]);
    }
  };

  const topChildren = [...root.children];
  for (let i = 0; i < topChildren.length; i++) {
    collect(topChildren[i]);
  }

  buckets.forEach((b) => {
    if (b.meshes.length < 2) {
      if (b.meshes.length === 1) {
        b.meshes[0].matrixAutoUpdate = false;
        b.meshes[0].updateMatrix();
      }
      return;
    }

    const geos: THREE.BufferGeometry[] = [];
    let valid = true;
    const refHasUv = Boolean(b.meshes[0].geometry.attributes.uv);
    const refHasNormal = Boolean(b.meshes[0].geometry.attributes.normal);

    for (let i = 0; i < b.meshes.length; i++) {
      const m = b.meshes[i];
      if (
        Boolean(m.geometry.attributes.uv) !== refHasUv ||
        Boolean(m.geometry.attributes.normal) !== refHasNormal
      ) {
        valid = false;
        break;
      }
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      relMatrix.multiplyMatrices(invRoot, m.matrixWorld);
      g.applyMatrix4(relMatrix);
      geos.push(g);
    }

    if (!valid || geos.length < 2) {
      geos.forEach((g) => g.dispose());
      return;
    }

    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!merged) return;

    for (let i = 0; i < b.meshes.length; i++) {
      b.meshes[i].parent?.remove(b.meshes[i]);
    }

    const mergedMesh = new THREE.Mesh(merged, b.mat);
    mergedMesh.castShadow = b.castShadow;
    mergedMesh.receiveShadow = b.receiveShadow;
    mergedMesh.matrixAutoUpdate = false;
    mergedMesh.updateMatrix();
    root.add(mergedMesh);
  });
}

interface SharedVillageMaterials {
  stoneMat: THREE.MeshStandardMaterial;
  graveStoneMat: THREE.MeshStandardMaterial;
  capStoneMat: THREE.MeshStandardMaterial;
  plasterMat: THREE.MeshStandardMaterial;
  timberMat: THREE.MeshStandardMaterial;
  darkTimberMat: THREE.MeshStandardMaterial;
  roofMat: THREE.MeshStandardMaterial;
  glassMat: THREE.MeshStandardMaterial;
  brassMat: THREE.MeshStandardMaterial;
  ironMat: THREE.MeshStandardMaterial;
  ceramicMat: THREE.MeshStandardMaterial;
  cutWoodMat: THREE.MeshStandardMaterial;
}

const sharedMaterialCache = new WeakMap<ProceduralTextureSet, SharedVillageMaterials>();

function getSharedVillageMaterials(textures: ProceduralTextureSet): SharedVillageMaterials {
  const existing = sharedMaterialCache.get(textures);
  if (existing) return existing;

  const created: SharedVillageMaterials = {
    stoneMat: new THREE.MeshStandardMaterial({
      map: textures.stone,
      normalMap: textures.stoneNormal,
      normalScale: new THREE.Vector2(1.0, 1.0),
      roughness: 0.9,
      metalness: 0.03,
    }),
    graveStoneMat: new THREE.MeshStandardMaterial({
      map: textures.stone,
      normalMap: textures.stoneNormal,
      normalScale: new THREE.Vector2(0.9, 0.9),
      roughness: 0.92,
      metalness: 0.03,
      color: 0x8e918c,
    }),
    capStoneMat: new THREE.MeshStandardMaterial({
      map: textures.stone,
      color: 0x6f6c64,
      roughness: 0.86,
    }),
    plasterMat: new THREE.MeshStandardMaterial({
      map: textures.plaster,
      normalMap: textures.plasterNormal,
      normalScale: new THREE.Vector2(0.7, 0.7),
      roughness: 0.86,
      metalness: 0.02,
    }),
    timberMat: new THREE.MeshStandardMaterial({
      map: textures.timber,
      normalMap: textures.timberNormal,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughness: 0.76,
      metalness: 0.05,
    }),
    darkTimberMat: new THREE.MeshStandardMaterial({
      map: textures.timber,
      normalMap: textures.timberNormal,
      color: 0x4b3828,
      roughness: 0.92,
      metalness: 0.02,
    }),
    roofMat: new THREE.MeshStandardMaterial({
      map: textures.roof,
      normalMap: textures.roofNormal,
      normalScale: new THREE.Vector2(1.1, 1.1),
      roughness: 0.76,
      metalness: 0.04,
    }),
    glassMat: new THREE.MeshStandardMaterial({
      color: 0x18212a,
      emissive: 0x101820,
      emissiveIntensity: 0.35,
      roughness: 0.16,
      metalness: 0.45,
    }),
    brassMat: new THREE.MeshStandardMaterial({ color: 0x9b7a3c, roughness: 0.35, metalness: 0.84 }),
    ironMat: new THREE.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.45, metalness: 0.85 }),
    ceramicMat: new THREE.MeshStandardMaterial({ color: 0xd4d8dc, roughness: 0.22, metalness: 0.08 }),
    cutWoodMat: new THREE.MeshStandardMaterial({ color: 0xb69367, roughness: 0.88 }),
  };
  sharedMaterialCache.set(textures, created);
  return created;
}

const lampWoodMat = new THREE.MeshStandardMaterial({ color: 0x33271e, roughness: 0.9, metalness: 0.04 });
const lampIronMat = new THREE.MeshStandardMaterial({ color: 0x26292d, roughness: 0.45, metalness: 0.82 });

export interface BoxCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface GasilhaneRefs {
  group: THREE.Group;
  doorPivot: THREE.Group;
  shutterPivot: THREE.Group;
  windowGlowMesh: THREE.Mesh;
  windowShadowFigure: THREE.Group;
  vigilFlame: THREE.Mesh;
  vigilLight: THREE.PointLight;
  ceilingLight: THREE.PointLight;
  ceilingBulbMat: THREE.MeshStandardMaterial;
  porchLanternLight: THREE.PointLight;
  deceasedGroup: THREE.Group;
  pestemalMesh: THREE.Mesh;
  kefenWrapGroup: THREE.Group;
  basinWaterMesh: THREE.Mesh;
}

export interface MuhtarRefs {
  group: THREE.Group;
  doorPivot: THREE.Group;
  deskLampLight: THREE.PointLight;
  camphorJar: THREE.Group;
  notePaper: THREE.Group;
  crashFolder: THREE.Group;
  wallPhotoFrame: THREE.Group;
}

export interface AbandonedHouseRefs {
  group: THREE.Group;
  doorPivot: THREE.Group;
  emberLight: THREE.PointLight;
  letterPaper: THREE.Group;
  gulsuyuProp: THREE.Group;
}

export interface HandCandleRefs {
  root: THREE.Group;
  flame: THREE.Mesh;
  light: THREE.PointLight;
}

export interface KaraBasmaRefs {
  root: THREE.Group;
  cloakParts: THREE.Mesh[];
  eyeLeft: THREE.Mesh;
  eyeRight: THREE.Mesh;
}

export function createStoneFountain(
  textures: ProceduralTextureSet,
): THREE.Group {
  const group = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({
    map: textures.stone,
    normalMap: textures.stoneNormal,
    normalScale: new THREE.Vector2(1.0, 1.0),
    roughness: 0.88,
    metalness: 0.04,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xb68b42,
    roughness: 0.28,
    metalness: 0.88,
  });
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x223842,
    roughness: 0.1,
    metalness: 0.2,
  });

  const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.3, 0.7), stoneMat);
  back.position.set(0, 1.15, -0.35);
  back.castShadow = true;
  back.receiveShadow = true;
  group.add(back);

  const cap = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.22, 0.92), stoneMat);
  cap.position.set(0, 2.38, -0.32);
  cap.castShadow = true;
  group.add(cap);

  const troughBase = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 0.85), stoneMat);
  troughBase.position.set(0, 0.275, 0.35);
  troughBase.castShadow = true;
  troughBase.receiveShadow = true;
  group.add(troughBase);

  const water = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.55), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.57, 0.36);
  group.add(water);

  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.32, 10), brassMat);
  spout.rotation.x = Math.PI / 2;
  spout.position.set(0, 1.05, 0.12);
  group.add(spout);

  const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.08, 0.28), stoneMat);
  shelf.position.set(0.72, 1.15, 0.1);
  group.add(shelf);

  return group;
}

export function createGraveyardCluster(textures: ProceduralTextureSet): THREE.Group {
  const g = new THREE.Group();
  const { graveStoneMat: stoneMat } = getSharedVillageMaterials(textures);

  const stones = [
    { x: 0, z: 0, rot: 0.08, h: 1.35, turban: true },
    { x: -1.6, z: 0.4, rot: -0.14, h: 1.1, turban: false },
    { x: 1.4, z: -0.5, rot: 0.18, h: 1.25, turban: true },
    { x: -0.5, z: -1.7, rot: -0.06, h: 1.05, turban: false },
    { x: 1.1, z: -2.1, rot: 0.11, h: 1.3, turban: false },
  ];

  stones.forEach((st) => {
    const marker = new THREE.Group();
    marker.position.set(st.x, 0, st.z);
    marker.rotation.y = st.rot;
    marker.rotation.z = (st.rot - 0.05) * 0.25;

    const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 1.45), stoneMat);
    plinth.position.y = 0.09;
    plinth.receiveShadow = true;

    const stele = new THREE.Mesh(new THREE.BoxGeometry(0.28, st.h, 0.11), stoneMat);
    stele.position.set(0, 0.18 + st.h / 2, -0.55);
    marker.add(plinth, stele);

    if (st.turban) {
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.14, 10), stoneMat);
      neck.position.set(0, 0.18 + st.h + 0.06, -0.55);
      const kavuk = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), stoneMat);
      kavuk.scale.set(1.0, 0.85, 1.0);
      kavuk.position.set(0, 0.18 + st.h + 0.22, -0.55);
      marker.add(neck, kavuk);
    }

    g.add(marker);
  });

  bakeStaticChildrenByMaterial(g);
  return g;
}

export function createCopperEwerAndSoap(
  type: 'ibrik' | 'sabun' | 'kefen' | 'defter' | 'kafur' | 'gulsuyu',
): THREE.Group {
  const g = new THREE.Group();

  if (type === 'ibrik') {
    const copper = new THREE.MeshStandardMaterial({
      color: 0xb86d3c,
      roughness: 0.26,
      metalness: 0.88,
    });
    const pts = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.11, 0.0),
      new THREE.Vector2(0.14, 0.14),
      new THREE.Vector2(0.06, 0.28),
      new THREE.Vector2(0.08, 0.36),
      new THREE.Vector2(0.06, 0.38),
    ];
    const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 16), copper);
    g.add(body);

    const handleCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.07, 0.32, 0),
      new THREE.Vector3(-0.18, 0.24, 0),
      new THREE.Vector3(-0.12, 0.1, 0),
    ]);
    const handle = new THREE.Mesh(new THREE.TubeGeometry(handleCurve, 12, 0.015, 8, false), copper);
    g.add(handle);

    const spoutCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.09, 0.14, 0),
      new THREE.Vector3(0.19, 0.24, 0),
      new THREE.Vector3(0.22, 0.34, 0),
    ]);
    const spout = new THREE.Mesh(new THREE.TubeGeometry(spoutCurve, 10, 0.014, 8, false), copper);
    g.add(spout);
  } else if (type === 'sabun') {
    const dishMat = new THREE.MeshStandardMaterial({ color: 0x6f553c, roughness: 0.82, metalness: 0.05 });
    const soapMat = new THREE.MeshStandardMaterial({ color: 0xc4b98f, roughness: 0.52, metalness: 0.0 });
    const loofahMat = new THREE.MeshStandardMaterial({ color: 0x9b8257, roughness: 0.96, metalness: 0.0 });

    const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.04, 14), dishMat);
    dish.position.y = 0.02;
    const soap = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.08), soapMat);
    soap.position.set(-0.04, 0.055, 0);
    const lif = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.14, 10), loofahMat);
    lif.rotation.z = Math.PI / 2;
    lif.position.set(0.05, 0.06, 0.03);
    g.add(dish, soap, lif);
  } else if (type === 'kefen') {
    const clothMat = new THREE.MeshStandardMaterial({ color: 0xeae5da, roughness: 0.88, metalness: 0.0 });
    const cordMat = new THREE.MeshStandardMaterial({ color: 0xb9aa90, roughness: 0.9, metalness: 0.0 });

    const bundle1 = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.34), clothMat);
    bundle1.position.y = 0.06;
    const bundle2 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.09, 0.3), clothMat);
    bundle2.position.set(0, 0.16, 0.01);
    bundle2.rotation.y = 0.05;
    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.21, 0.03), cordMat);
    tie.position.y = 0.105;
    g.add(bundle1, bundle2, tie);
  } else if (type === 'defter') {
    const coverMat = new THREE.MeshStandardMaterial({ color: 0x3a2419, roughness: 0.78, metalness: 0.08 });
    const pagesMat = new THREE.MeshStandardMaterial({ color: 0xd8ccb2, roughness: 0.92, metalness: 0.0 });
    const brassCorner = new THREE.MeshStandardMaterial({ color: 0xa4803d, roughness: 0.35, metalness: 0.85 });

    const cover = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.035, 0.36), coverMat);
    cover.position.y = 0.018;
    const pages = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.026, 0.33), pagesMat);
    pages.position.set(0.01, 0.022, 0);
    const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.08), brassCorner);
    clasp.position.set(0.14, 0.022, 0);
    g.add(cover, pages, clasp);
  } else if (type === 'kafur') {
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xaec2ba,
      roughness: 0.18,
      metalness: 0.05,
      transparent: true,
      opacity: 0.72,
    });
    const powderMat = new THREE.MeshStandardMaterial({ color: 0xf4f2ec, roughness: 0.9, metalness: 0.0 });
    const corkMat = new THREE.MeshStandardMaterial({ color: 0x745438, roughness: 0.88, metalness: 0.0 });

    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.09, 0.2, 14), glassMat);
    jar.position.y = 0.1;
    const contents = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.075, 0.12, 12), powderMat);
    contents.position.y = 0.07;
    const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.05, 12), corkMat);
    cork.position.y = 0.215;
    g.add(jar, contents, cork);
  } else if (type === 'gulsuyu') {
    const towelMat = new THREE.MeshStandardMaterial({ color: 0xe3dfd2, roughness: 0.9, metalness: 0.0 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x628c74,
      roughness: 0.16,
      metalness: 0.08,
      transparent: true,
      opacity: 0.78,
    });
    const capMat = new THREE.MeshStandardMaterial({ color: 0xb28741, roughness: 0.32, metalness: 0.85 });

    const towel = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.09, 0.28), towelMat);
    towel.position.y = 0.045;
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.24, 12), glassMat);
    bottle.position.set(0.04, 0.21, 0.02);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.032, 0.07, 10), glassMat);
    neck.position.set(0.04, 0.35, 0.02);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.03, 10), capMat);
    cap.position.set(0.04, 0.39, 0.02);
    g.add(towel, bottle, neck, cap);
  }

  return g;
}

export function createVillageHouse(
  textures: ProceduralTextureSet,
  width = 6.2,
  depth = 5.4,
  height = 4.2,
): THREE.Group {
  const g = new THREE.Group();
  const { stoneMat, plasterMat, timberMat, roofMat, glassMat, brassMat } =
    getSharedVillageMaterials(textures);

  // Stone foundation (Subasman) + plinth ledge
  const baseH = height * 0.42;
  const base = new THREE.Mesh(new THREE.BoxGeometry(width, baseH, depth), stoneMat);
  base.position.y = baseH * 0.5;
  base.castShadow = true;
  base.receiveShadow = true;
  g.add(base);

  const beltBeam = new THREE.Mesh(new THREE.BoxGeometry(width + 0.42, 0.14, depth + 0.42), timberMat);
  beltBeam.position.y = baseH + 0.04;
  g.add(beltBeam);

  // Overhanging upper floor (Cumba / Çıkma style)
  const upperH = height * 0.58;
  const upperW = width + 0.36;
  const upperD = depth + 0.36;
  const upper = new THREE.Mesh(new THREE.BoxGeometry(upperW, upperH, upperD), plasterMat);
  upper.position.y = baseH + upperH * 0.5;
  upper.castShadow = true;
  upper.receiveShadow = true;
  g.add(upper);

  // Corner & mid-wall timber framing (Hımış)
  [
    [-upperW * 0.5, -upperD * 0.5],
    [upperW * 0.5, -upperD * 0.5],
    [-upperW * 0.5, upperD * 0.5],
    [upperW * 0.5, upperD * 0.5],
  ].forEach(([bx, bz]) => {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.18, upperH + 0.08, 0.18), timberMat);
    beam.position.set(bx, baseH + upperH * 0.5, bz);
    g.add(beam);
  });

  // Top fascia eave rim under roof
  const eaveRim = new THREE.Mesh(new THREE.BoxGeometry(upperW + 0.65, 0.16, upperD + 0.65), timberMat);
  eaveRim.position.y = height + 0.02;
  g.add(eaveRim);

  // Overhanging Pitched Kiremit Roof (4-sided hipped kırma çatı)
  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(upperW, upperD) * 0.57, 2.15, 4), roofMat);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = height + 1.08;
  roof.castShadow = true;
  roof.receiveShadow = true;
  g.add(roof);

  // Ridge cap finial
  const ridgeCap = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.32), stoneMat);
  ridgeCap.position.y = height + 2.14;
  g.add(ridgeCap);

  // Stone chimney with clay cowl
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.56, 1.65, 0.56), stoneMat);
  chimney.position.set(width * 0.24, height + 1.28, -depth * 0.18);
  chimney.castShadow = true;
  const chimneyCap = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.7), roofMat);
  chimneyCap.position.set(width * 0.24, height + 2.14, -depth * 0.18);
  g.add(chimney, chimneyCap);

  // Entrance Door, Stone Step & Wooden Awning (Sundurma)
  const step = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.16, 0.65), stoneMat);
  step.position.set(0, 0.08, depth * 0.5 + 0.32);
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.12, 1.95, 0.14), timberMat);
  doorFrame.position.set(0, 0.98, depth * 0.5 + 0.02);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.92, 1.82, 0.16), timberMat);
  door.position.set(0, 0.95, depth * 0.5 + 0.04);
  const handle = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), brassMat);
  handle.position.set(0.32, 0.96, depth * 0.5 + 0.14);
  const awning = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.65), roofMat);
  awning.rotation.x = 0.22;
  awning.position.set(0, 2.08, depth * 0.5 + 0.32);
  g.add(step, doorFrame, door, handle, awning);

  // Shuttered upper windows (front & sides)
  [-1.35, 1.35].forEach((wx) => {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.96, 1.14, 0.14), timberMat);
    frame.position.set(wx, baseH + upperH * 0.52, upperD * 0.5 + 0.01);
    const pane = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.92, 0.16), glassMat);
    pane.position.set(wx, baseH + upperH * 0.52, upperD * 0.5 + 0.01);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.08, 0.24), timberMat);
    sill.position.set(wx, baseH + upperH * 0.52 - 0.58, upperD * 0.5 + 0.05);
    const shutterL = new THREE.Mesh(new THREE.BoxGeometry(0.38, 1.06, 0.06), timberMat);
    shutterL.position.set(wx - 0.66, baseH + upperH * 0.52, upperD * 0.5 + 0.05);
    const shutterR = new THREE.Mesh(new THREE.BoxGeometry(0.38, 1.06, 0.06), timberMat);
    shutterR.position.set(wx + 0.66, baseH + upperH * 0.52, upperD * 0.5 + 0.05);
    g.add(frame, pane, sill, shutterL, shutterR);
  });

  bakeStaticChildrenByMaterial(g);
  return g;
}

export function createAbandonedHouse(textures: ProceduralTextureSet): AbandonedHouseRefs {
  const g = new THREE.Group();

  const stoneMat = new THREE.MeshStandardMaterial({
    map: textures.stone,
    normalMap: textures.stoneNormal,
    normalScale: new THREE.Vector2(0.95, 0.95),
    roughness: 0.9,
  });
  const plasterMat = new THREE.MeshStandardMaterial({
    map: textures.plaster,
    normalMap: textures.plasterNormal,
    normalScale: new THREE.Vector2(0.75, 0.75),
    roughness: 0.88,
    color: 0xa39b8a,
  });
  const timberMat = new THREE.MeshStandardMaterial({
    map: textures.timber,
    normalMap: textures.timberNormal,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughness: 0.78,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    map: textures.roof,
    normalMap: textures.roofNormal,
    normalScale: new THREE.Vector2(1.05, 1.05),
    roughness: 0.78,
    color: 0xb8a89d,
  });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xa27e3d, roughness: 0.35, metalness: 0.85 });

  // Walk-in interior: X -3.0..+3.0 (6.0m), Z -2.8..+2.8 (5.6m), H 3.2m
  // Doorway faces East (+X) toward the main road!
  const rw = 6.0;
  const rd = 5.6;
  const rh = 3.2;

  const floor = new THREE.Mesh(new THREE.BoxGeometry(rw, 0.16, rd), timberMat);
  floor.position.y = 0.08;
  floor.receiveShadow = true;
  g.add(floor);

  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(rw + 0.3, 0.2, rd + 0.3), timberMat);
  ceiling.position.y = rh + 0.1;
  g.add(ceiling);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(4.6, 1.9, 4), roofMat);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = rh + 1.05;
  roof.castShadow = true;
  g.add(roof);

  // Porch facing +X
  const porchFloor = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.14, 3.2), stoneMat);
  porchFloor.position.set(rw / 2 + 0.75, 0.07, 0);
  const porchRoof = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.16, 3.4), timberMat);
  porchRoof.position.set(rw / 2 + 0.75, 2.75, 0);
  const pCol1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 2.6, 8), timberMat);
  pCol1.position.set(rw / 2 + 1.4, 1.4, -1.4);
  const pCol2 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 2.6, 8), timberMat);
  pCol2.position.set(rw / 2 + 1.4, 1.4, 1.4);
  g.add(porchFloor, porchRoof, pCol1, pCol2);

  // Walls (West, North, South solid; East has doorway Z -0.8..+0.8)
  const westW = new THREE.Mesh(new THREE.BoxGeometry(0.24, rh, rd), plasterMat);
  westW.position.set(-rw / 2, rh / 2, 0);
  const northW = new THREE.Mesh(new THREE.BoxGeometry(rw, rh, 0.24), plasterMat);
  northW.position.set(0, rh / 2, -rd / 2);
  const southW = new THREE.Mesh(new THREE.BoxGeometry(rw, rh, 0.24), plasterMat);
  southW.position.set(0, rh / 2, rd / 2);
  g.add(westW, northW, southW);

  const eastL = new THREE.Mesh(new THREE.BoxGeometry(0.24, rh, 2.0), plasterMat);
  eastL.position.set(rw / 2, rh / 2, -1.8);
  const eastR = new THREE.Mesh(new THREE.BoxGeometry(0.24, rh, 2.0), plasterMat);
  eastR.position.set(rw / 2, rh / 2, 1.8);
  const eastHead = new THREE.Mesh(new THREE.BoxGeometry(0.24, rh - 2.25, 1.6), plasterMat);
  eastHead.position.set(rw / 2, 2.25 + (rh - 2.25) / 2, 0);
  g.add(eastL, eastR, eastHead);

  const doorPivot = new THREE.Group();
  doorPivot.position.set(rw / 2, 0.16, -0.78);
  const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.09, 2.1, 1.54), timberMat);
  doorMesh.position.set(0, 1.05, 0.77);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), brassMat);
  knob.position.set(0.08, 1.02, 1.36);
  doorPivot.add(doorMesh, knob);
  g.add(doorPivot);

  // Dusty wooden table & overturned stool + stone hearth
  const table = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.78, 1.5), timberMat);
  table.position.set(-1.3, 0.55, 0.4);
  g.add(table);

  const hearth = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 1.6), stoneMat);
  hearth.position.set(-2.3, 0.86, -1.7);
  g.add(hearth);

  const emberLight = new THREE.PointLight(0xd96a2b, 2.1, 7.5, 1.7);
  emberLight.position.set(-1.5, 0.85, -1.7);
  g.add(emberLight);

  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.55, 0.65), timberMat);
  chest.position.set(0.6, 0.43, -2.15);
  g.add(chest);

  const letterPaper = new THREE.Group();
  letterPaper.position.set(-1.15, 0.95, 0.52);
  const sheet = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.015, 0.42),
    new THREE.MeshStandardMaterial({ color: 0xd9ceb2, roughness: 0.9 }),
  );
  letterPaper.add(sheet);
  g.add(letterPaper);

  const gulsuyuProp = createCopperEwerAndSoap('gulsuyu');
  gulsuyuProp.position.set(0.6, 0.71, -2.15);
  g.add(gulsuyuProp);

  bakeStaticChildrenByMaterial(g, new Set<THREE.Object3D>([doorPivot, emberLight, letterPaper, gulsuyuProp]));

  return {
    group: g,
    doorPivot,
    emberLight,
    letterPaper,
    gulsuyuProp,
  };
}

export function createStreetLamp(): { group: THREE.Group; light: THREE.PointLight; bulbMat: THREE.MeshStandardMaterial } {
  const g = new THREE.Group();
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xffd79a,
    emissive: 0xffaa44,
    emissiveIntensity: 2.1,
    roughness: 0.2,
  });

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 5.4, 8), lampWoodMat);
  pole.position.y = 2.7;
  g.add(pole);

  const armCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 4.9, 0),
    new THREE.Vector3(0.45, 5.25, 0),
    new THREE.Vector3(0.95, 5.1, 0),
  ]);
  const arm = new THREE.Mesh(new THREE.TubeGeometry(armCurve, 10, 0.04, 8, false), lampIronMat);
  g.add(arm);

  const hood = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.18, 12), lampIronMat);
  hood.position.set(0.95, 5.05, 0);
  g.add(hood);

  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), bulbMat);
  bulb.position.set(0.95, 4.94, 0);
  g.add(bulb);

  const light = new THREE.PointLight(0xffb45c, 6.8, 19, 1.6);
  light.position.set(0.95, 4.78, 0);
  g.add(light);

  return { group: g, light, bulbMat };
}

export function createMosqueAndGasilhane(
  textures: ProceduralTextureSet,
): GasilhaneRefs {
  const root = new THREE.Group();

  const stoneMat = new THREE.MeshStandardMaterial({
    map: textures.stone,
    normalMap: textures.stoneNormal,
    normalScale: new THREE.Vector2(1.0, 1.0),
    roughness: 0.9,
    metalness: 0.03,
  });
  const plasterMat = new THREE.MeshStandardMaterial({
    map: textures.plaster,
    normalMap: textures.plasterNormal,
    normalScale: new THREE.Vector2(0.7, 0.7),
    roughness: 0.84,
    metalness: 0.02,
  });
  const tileMat = new THREE.MeshStandardMaterial({
    map: textures.tile,
    normalMap: textures.tileNormal,
    normalScale: new THREE.Vector2(0.9, 0.9),
    roughnessMap: textures.tileRoughness,
    roughness: 0.72,
    metalness: 0.08,
  });
  const marbleMat = new THREE.MeshStandardMaterial({
    map: textures.marble,
    normalMap: textures.marbleNormal,
    normalScale: new THREE.Vector2(0.35, 0.35),
    roughness: 0.24,
    metalness: 0.05,
  });
  const timberMat = new THREE.MeshStandardMaterial({
    map: textures.timber,
    normalMap: textures.timberNormal,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughness: 0.72,
    metalness: 0.05,
  });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x2c3034, roughness: 0.62, metalness: 0.28 });
  const kiremitMat = new THREE.MeshStandardMaterial({
    map: textures.roof,
    normalMap: textures.roofNormal,
    normalScale: new THREE.Vector2(1.0, 1.0),
    roughness: 0.76,
    metalness: 0.05,
  });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xc2984b, roughness: 0.28, metalness: 0.86 });

  // --- A. VILLAGE MOSQUE ---
  const mosqueGroup = new THREE.Group();
  mosqueGroup.position.set(0, 0, -4.6);

  const mBase = new THREE.Mesh(new THREE.BoxGeometry(6.8, 4.4, 6.4), plasterMat);
  mBase.position.y = 2.2;
  mBase.castShadow = true;
  mBase.receiveShadow = true;
  mosqueGroup.add(mBase);

  const mRoof = new THREE.Mesh(new THREE.ConeGeometry(5.1, 2.2, 4), roofMat);
  mRoof.rotation.y = Math.PI / 4;
  mRoof.position.y = 5.45;
  mRoof.castShadow = true;
  mosqueGroup.add(mRoof);

  const porchFloor = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.25, 6.2), stoneMat);
  porchFloor.position.set(4.5, 0.125, 0);
  porchFloor.receiveShadow = true;
  const porchRoof = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.22, 6.4), timberMat);
  porchRoof.position.set(4.5, 3.1, 0);
  mosqueGroup.add(porchFloor, porchRoof);

  [-2.6, 0, 2.6].forEach((pz) => {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 2.9, 10), timberMat);
    col.position.set(5.4, 1.65, pz);
    col.castShadow = true;
    mosqueGroup.add(col);
  });

  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.56, 1.35), timberMat);
  chest.position.set(4.2, 0.52, -1.6);
  chest.castShadow = true;
  mosqueGroup.add(chest);

  const minaret = new THREE.Group();
  minaret.position.set(3.2, 0, -3.1);
  const minPlinth = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.85, 3.2, 8), stoneMat);
  minPlinth.position.y = 1.6;
  const minShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.58, 6.8, 12), plasterMat);
  minShaft.position.y = 6.5;
  const minBalcony = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.52, 0.55, 12), stoneMat);
  minBalcony.position.y = 9.9;
  const minUpper = new THREE.CylinderGeometry(0.36, 0.4, 2.2, 12);
  const minUpperMesh = new THREE.Mesh(minUpper, plasterMat);
  minUpperMesh.position.y = 11.2;
  const minCap = new THREE.Mesh(new THREE.ConeGeometry(0.44, 2.1, 12), roofMat);
  minCap.position.y = 13.3;
  const minFinial = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.75, 6), brassMat);
  minFinial.position.y = 14.65;
  minaret.add(minPlinth, minShaft, minBalcony, minUpperMesh, minCap, minFinial);
  mosqueGroup.add(minaret);

  root.add(mosqueGroup);

  // --- B. GASILHANE ---
  const gasilGroup = new THREE.Group();
  const rw = 6.8;
  const rd = 6.4;
  const rh = 3.4;

  const floor = new THREE.Mesh(new THREE.BoxGeometry(rw, 0.16, rd), tileMat);
  floor.position.y = 0.08;
  floor.receiveShadow = true;
  gasilGroup.add(floor);

  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(rw + 0.3, 0.22, rd + 0.3), plasterMat);
  ceiling.position.y = rh + 0.11;
  gasilGroup.add(ceiling);
  const gRoof = new THREE.Mesh(new THREE.ConeGeometry(5.2, 1.65, 4), kiremitMat);
  gRoof.rotation.y = Math.PI / 4;
  gRoof.position.y = rh + 1.02;
  gRoof.castShadow = true;
  gasilGroup.add(gRoof);

  // Exterior Stone Entry Step & Rain Gutter Downspout on Gasilhane
  const gStep = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.15, 2.0), stoneMat);
  gStep.position.set(rw / 2 + 0.45, 0.075, 0);
  const gutterPipe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, rh + 0.2, 8),
    new THREE.MeshStandardMaterial({ color: 0x353b40, roughness: 0.45, metalness: 0.72 }),
  );
  gutterPipe.position.set(rw / 2 + 0.1, rh * 0.5, -rd / 2 + 0.18);
  gasilGroup.add(gStep, gutterPipe);

  // Exterior Hanging Porch Lantern over Gasilhane Door
  const lanternBracket = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.08), brassMat);
  lanternBracket.position.set(rw / 2 + 0.25, 2.55, 0);
  const lanternGlass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.06, 0.18, 8),
    new THREE.MeshStandardMaterial({ color: 0xffd79b, emissive: 0xff9f40, emissiveIntensity: 1.7 }),
  );
  lanternGlass.position.set(rw / 2 + 0.4, 2.38, 0);
  const porchLanternLight = new THREE.PointLight(0xffa74e, 3.2, 10, 1.7);
  porchLanternLight.position.set(rw / 2 + 0.45, 2.3, 0);
  gasilGroup.add(lanternBracket, lanternGlass, porchLanternLight);

  const northWall = new THREE.Mesh(new THREE.BoxGeometry(rw, rh, 0.24), tileMat);
  northWall.position.set(0, rh / 2, -rd / 2);
  northWall.receiveShadow = true;
  const southWall = new THREE.Mesh(new THREE.BoxGeometry(rw, rh, 0.24), tileMat);
  southWall.position.set(0, rh / 2, rd / 2);
  southWall.receiveShadow = true;
  gasilGroup.add(northWall, southWall);

  const eastLeft = new THREE.Mesh(new THREE.BoxGeometry(0.24, rh, 2.4), tileMat);
  eastLeft.position.set(rw / 2, rh / 2, -2.0);
  const eastRight = new THREE.Mesh(new THREE.BoxGeometry(0.24, rh, 2.4), tileMat);
  eastRight.position.set(rw / 2, rh / 2, 2.0);
  const eastHeader = new THREE.Mesh(new THREE.BoxGeometry(0.24, rh - 2.35, 1.6), tileMat);
  eastHeader.position.set(rw / 2, 2.35 + (rh - 2.35) / 2, 0);
  gasilGroup.add(eastLeft, eastRight, eastHeader);

  const doorPivot = new THREE.Group();
  doorPivot.position.set(rw / 2, 0.16, -0.78);
  const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.09, 2.22, 1.54), timberMat);
  doorMesh.position.set(0, 1.11, 0.77);
  doorMesh.castShadow = true;
  const doorKnob = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), brassMat);
  doorKnob.position.set(0.08, 1.05, 1.38);
  const doorKnobIn = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), brassMat);
  doorKnobIn.position.set(-0.08, 1.05, 1.38);
  doorPivot.add(doorMesh, doorKnob, doorKnobIn);
  gasilGroup.add(doorPivot);

  const westLeft = new THREE.Mesh(new THREE.BoxGeometry(0.24, rh, 2.3), tileMat);
  westLeft.position.set(-rw / 2, rh / 2, -2.05);
  const westRight = new THREE.Mesh(new THREE.BoxGeometry(0.24, rh, 2.3), tileMat);
  westRight.position.set(-rw / 2, rh / 2, 2.05);
  const westBelow = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.55, 1.8), tileMat);
  westBelow.position.set(-rw / 2, 0.775, 0);
  const westAbove = new THREE.Mesh(new THREE.BoxGeometry(0.24, rh - 2.65, 1.8), tileMat);
  westAbove.position.set(-rw / 2, 2.65 + (rh - 2.65) / 2, 0);
  gasilGroup.add(westLeft, westRight, westBelow, westAbove);

  const windowGlowMat = new THREE.MeshStandardMaterial({
    color: 0x3b4e63,
    emissive: 0x1a2634,
    emissiveIntensity: 0.85,
    roughness: 0.25,
    transparent: true,
    opacity: 0.72,
  });
  const windowGlowMesh = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.08, 1.76), windowGlowMat);
  windowGlowMesh.position.set(-rw / 2, 2.1, 0);
  gasilGroup.add(windowGlowMesh);

  const mullionH = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 1.76), timberMat);
  mullionH.position.set(-rw / 2, 2.1, 0);
  const mullionV = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.08, 0.05), timberMat);
  mullionV.position.set(-rw / 2, 2.1, 0);
  gasilGroup.add(mullionH, mullionV);

  const shutterPivot = new THREE.Group();
  shutterPivot.position.set(-rw / 2 + 0.16, 2.1, -0.88);
  const shutterBoard = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.12, 1.78), timberMat);
  shutterBoard.position.set(0, 0, 0.89);
  shutterPivot.add(shutterBoard);
  shutterPivot.rotation.y = Math.PI * 0.62;
  gasilGroup.add(shutterPivot);

  const windowShadowFigure = new THREE.Group();
  windowShadowFigure.position.set(-rw / 2 - 0.85, 1.45, 0);
  const shadowMat = new THREE.MeshStandardMaterial({ color: 0x050608, roughness: 0.95 });
  const shTorso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 1.2, 8), shadowMat);
  const shHead = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 10), shadowMat);
  shHead.position.y = 0.78;
  windowShadowFigure.add(shTorso, shHead);
  windowShadowFigure.visible = false;
  gasilGroup.add(windowShadowFigure);

  const drainGroup = new THREE.Group();
  drainGroup.position.set(-1.9, 0.17, 2.0);
  const drainRim = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.38, 0.04, 16), stoneMat);
  const drainHole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.24, 0.05, 14),
    new THREE.MeshStandardMaterial({ color: 0x0c0e0e, roughness: 0.9 }),
  );
  drainHole.position.y = 0.005;
  const grateBar1 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.02, 0.03), brassMat);
  grateBar1.position.y = 0.03;
  const grateBar2 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.42), brassMat);
  grateBar2.position.y = 0.03;
  drainGroup.add(drainRim, drainHole, grateBar1, grateBar2);
  gasilGroup.add(drainGroup);

  const cab1 = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.1, 0.52), timberMat);
  cab1.position.set(-1.5, 2.35, -rd / 2 + 0.38);
  const cab2 = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 0.58), timberMat);
  cab2.position.set(1.5, 0.61, -rd / 2 + 0.42);
  gasilGroup.add(cab1, cab2);

  // Marble Teneşir Slab
  const tenesir = new THREE.Group();
  tenesir.position.set(0, 0.16, 0);

  const ped1 = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.72, 0.9), stoneMat);
  ped1.position.set(-0.75, 0.36, 0);
  const ped2 = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.72, 0.9), stoneMat);
  ped2.position.set(0.75, 0.36, 0);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.14, 1.12), marbleMat);
  slab.position.set(0, 0.79, 0);
  slab.castShadow = true;
  slab.receiveShadow = true;

  const headRest = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.09, 0.56), marbleMat);
  headRest.position.set(-0.88, 0.9, 0);
  tenesir.add(ped1, ped2, slab, headRest);

  const deceasedGroup = new THREE.Group();
  deceasedGroup.position.set(0, 0.87, 0);

  const clothBaseMat = new THREE.MeshStandardMaterial({ color: 0xc8c3b8, roughness: 0.88, metalness: 0.0 });
  const pestemalMat = new THREE.MeshStandardMaterial({ color: 0xe6e1d4, roughness: 0.84, metalness: 0.0 });
  const kefenMat = new THREE.MeshStandardMaterial({ color: 0xf2eee6, roughness: 0.86, metalness: 0.0 });

  const bodyCore = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.22, 0.44), clothBaseMat);
  bodyCore.position.set(0.08, 0.11, 0);
  bodyCore.castShadow = true;
  const shoulderContour = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.24, 0.56, 12), clothBaseMat);
  shoulderContour.rotation.x = Math.PI / 2;
  shoulderContour.position.set(-0.46, 0.14, 0);
  const headContour = new THREE.Mesh(new THREE.SphereGeometry(0.145, 14, 12), clothBaseMat);
  headContour.scale.set(1.15, 0.85, 0.92);
  headContour.position.set(-0.86, 0.15, 0);
  const feetContour = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.34), clothBaseMat);
  feetContour.position.set(0.84, 0.12, 0);
  deceasedGroup.add(bodyCore, shoulderContour, headContour, feetContour);

  const pestemalMesh = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.25, 0.5), pestemalMat);
  pestemalMesh.position.set(0.08, 0.125, 0);
  pestemalMesh.visible = false;
  deceasedGroup.add(pestemalMesh);

  const kefenWrapGroup = new THREE.Group();
  const kefenBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 1.48, 8, 16), kefenMat);
  kefenBody.rotation.z = Math.PI / 2;
  kefenBody.scale.set(0.75, 1.0, 1.08);
  kefenBody.position.set(0, 0.17, 0);
  kefenWrapGroup.add(kefenBody);

  [-0.95, 0.05, 0.95].forEach((bx) => {
    const knot = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.022, 8, 16), kefenMat);
    knot.rotation.y = Math.PI / 2;
    knot.position.set(bx, 0.17, 0);
    kefenWrapGroup.add(knot);
  });
  kefenWrapGroup.visible = false;
  deceasedGroup.add(kefenWrapGroup);
  tenesir.add(deceasedGroup);

  const basinGroup = new THREE.Group();
  basinGroup.position.set(0.25, 0.16, 1.05);
  const stool = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.35, 0.55), timberMat);
  stool.position.y = 0.175;
  const basinWall = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.21, 0.24, 16, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xa66238, roughness: 0.32, metalness: 0.85, side: THREE.DoubleSide }),
  );
  basinWall.position.y = 0.47;
  const basinBottom = new THREE.Mesh(
    new THREE.CircleGeometry(0.21, 16),
    new THREE.MeshStandardMaterial({ color: 0x8f522d, roughness: 0.4, metalness: 0.82 }),
  );
  basinBottom.rotation.x = -Math.PI / 2;
  basinBottom.position.y = 0.355;
  const basinWaterMesh = new THREE.Mesh(
    new THREE.CircleGeometry(0.255, 16),
    new THREE.MeshStandardMaterial({ color: 0x45606b, roughness: 0.12, metalness: 0.22, transparent: true, opacity: 0.85 }),
  );
  basinWaterMesh.rotation.x = -Math.PI / 2;
  basinWaterMesh.position.y = 0.53;
  basinWaterMesh.visible = false;
  basinGroup.add(stool, basinWall, basinBottom, basinWaterMesh);
  gasilGroup.add(basinGroup);

  const vigilStand = new THREE.Group();
  vigilStand.position.set(-1.35, 0.16, -0.75);
  const standPed = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.92, 10), brassMat);
  standPed.position.y = 0.46;
  const candleBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.045, 0.22, 10),
    new THREE.MeshStandardMaterial({ color: 0xeae1c9, roughness: 0.7 }),
  );
  candleBody.position.y = 1.03;
  const vigilFlame = new THREE.Mesh(
    new THREE.ConeGeometry(0.025, 0.08, 8),
    new THREE.MeshBasicMaterial({ color: 0xffbe55 }),
  );
  vigilFlame.position.y = 1.18;
  vigilFlame.visible = false;
  const vigilLight = new THREE.PointLight(0xffa447, 0, 9, 1.8);
  vigilLight.position.set(0, 1.24, 0);
  vigilStand.add(standPed, candleBody, vigilFlame, vigilLight);
  gasilGroup.add(vigilStand);

  const ceilingCord = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.55, 6), timberMat);
  ceilingCord.position.set(0, rh - 0.28, 0);
  const ceilingBulbMat = new THREE.MeshStandardMaterial({
    color: 0xeef3eb,
    emissive: 0xdce4d5,
    emissiveIntensity: 1.4,
    roughness: 0.2,
  });
  const ceilingBulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), ceilingBulbMat);
  ceilingBulb.position.set(0, rh - 0.58, 0);
  const ceilingLight = new THREE.PointLight(0xd9e3dc, 6.2, 11, 1.5);
  ceilingLight.position.set(0, rh - 0.65, 0);
  gasilGroup.add(ceilingCord, ceilingBulb, ceilingLight);

  gasilGroup.add(tenesir);
  root.add(gasilGroup);

  bakeStaticChildrenByMaterial(
    root,
    new Set<THREE.Object3D>([
      doorPivot,
      shutterPivot,
      windowGlowMesh,
      windowShadowFigure,
      vigilFlame,
      vigilLight,
      ceilingBulb,
      ceilingLight,
      porchLanternLight,
      deceasedGroup,
      basinWaterMesh,
    ]),
  );

  return {
    group: root,
    doorPivot,
    shutterPivot,
    windowGlowMesh,
    windowShadowFigure,
    vigilFlame,
    vigilLight,
    ceilingLight,
    ceilingBulbMat,
    porchLanternLight,
    deceasedGroup,
    pestemalMesh,
    kefenWrapGroup,
    basinWaterMesh,
  };
}

export function createMuhtarHouse(textures: ProceduralTextureSet): MuhtarRefs {
  const g = new THREE.Group();

  const stoneMat = new THREE.MeshStandardMaterial({
    map: textures.stone,
    normalMap: textures.stoneNormal,
    normalScale: new THREE.Vector2(0.95, 0.95),
    roughness: 0.9,
    metalness: 0.03,
  });
  const plasterMat = new THREE.MeshStandardMaterial({
    map: textures.plaster,
    normalMap: textures.plasterNormal,
    normalScale: new THREE.Vector2(0.7, 0.7),
    roughness: 0.85,
    metalness: 0.02,
  });
  const timberMat = new THREE.MeshStandardMaterial({
    map: textures.timber,
    normalMap: textures.timberNormal,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughness: 0.72,
    metalness: 0.06,
  });
  const kilimMat = new THREE.MeshStandardMaterial({ map: textures.kilim, roughness: 0.92, metalness: 0.0 });
  const roofMat = new THREE.MeshStandardMaterial({
    map: textures.roof,
    normalMap: textures.roofNormal,
    normalScale: new THREE.Vector2(1.05, 1.05),
    roughness: 0.74,
    metalness: 0.05,
  });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xba9246, roughness: 0.3, metalness: 0.85 });

  const rw = 6.4;
  const rd = 6.0;
  const rh = 3.2;

  const floor = new THREE.Mesh(new THREE.BoxGeometry(rw, 0.16, rd), timberMat);
  floor.position.y = 0.08;
  floor.receiveShadow = true;
  g.add(floor);

  const porchFloor = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.14, 3.6), stoneMat);
  porchFloor.position.set(-rw / 2 - 0.9, 0.07, 0);
  const porchRoof = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.18, 3.8), timberMat);
  porchRoof.position.set(-rw / 2 - 0.9, 2.75, 0);
  const pCol1 = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 2.6, 8), timberMat);
  pCol1.position.set(-rw / 2 - 1.7, 1.4, -1.6);
  const pCol2 = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 2.6, 8), timberMat);
  pCol2.position.set(-rw / 2 - 1.7, 1.4, 1.6);
  g.add(porchFloor, porchRoof, pCol1, pCol2);

  const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 3.2), kilimMat);
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0.2, 0.17, 0);
  rug.receiveShadow = true;
  g.add(rug);

  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(rw + 0.4, 0.2, rd + 0.4), timberMat);
  ceiling.position.y = rh + 0.1;
  g.add(ceiling);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(4.9, 1.9, 4), roofMat);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = rh + 1.1;
  roof.castShadow = true;
  g.add(roof);

  const eastW = new THREE.Mesh(new THREE.BoxGeometry(0.24, rh, rd), plasterMat);
  eastW.position.set(rw / 2, rh / 2, 0);
  const northW = new THREE.Mesh(new THREE.BoxGeometry(rw, rh, 0.24), plasterMat);
  northW.position.set(0, rh / 2, -rd / 2);
  const southW = new THREE.Mesh(new THREE.BoxGeometry(rw, rh, 0.24), plasterMat);
  southW.position.set(0, rh / 2, rd / 2);
  g.add(eastW, northW, southW);

  const wainEast = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.2, rd - 0.3), timberMat);
  wainEast.position.set(rw / 2 - 0.14, 0.72, 0);
  const wainNorth = new THREE.Mesh(new THREE.BoxGeometry(rw - 0.3, 1.2, 0.08), timberMat);
  wainNorth.position.set(0, 0.72, -rd / 2 + 0.14);
  g.add(wainEast, wainNorth);

  const westL = new THREE.Mesh(new THREE.BoxGeometry(0.24, rh, 2.2), plasterMat);
  westL.position.set(-rw / 2, rh / 2, -1.9);
  const westR = new THREE.Mesh(new THREE.BoxGeometry(0.24, rh, 2.2), plasterMat);
  westR.position.set(-rw / 2, rh / 2, 1.9);
  const westHead = new THREE.Mesh(new THREE.BoxGeometry(0.24, rh - 2.3, 1.6), plasterMat);
  westHead.position.set(-rw / 2, 2.3 + (rh - 2.3) / 2, 0);
  g.add(westL, westR, westHead);

  const doorPivot = new THREE.Group();
  doorPivot.position.set(-rw / 2, 0.16, -0.78);
  const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.09, 2.15, 1.54), timberMat);
  doorMesh.position.set(0, 1.075, 0.77);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), brassMat);
  knob.position.set(-0.08, 1.02, 1.38);
  doorPivot.add(doorMesh, knob);
  g.add(doorPivot);

  const desk = new THREE.Group();
  desk.position.set(1.2, 0.16, -0.2);
  const deskTop = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.09, 2.1), timberMat);
  deskTop.position.y = 0.78;
  const deskPed1 = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.74, 0.55), timberMat);
  deskPed1.position.set(0, 0.37, -0.7);
  const deskPed2 = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.74, 0.55), timberMat);
  deskPed2.position.set(0, 0.37, 0.7);
  desk.add(deskTop, deskPed1, deskPed2);
  g.add(desk);

  const chair = new THREE.Group();
  chair.position.set(2.15, 0.16, -0.2);
  const fabricMat = new THREE.MeshStandardMaterial({ color: 0x6b201b, roughness: 0.85 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.12, 0.54), fabricMat);
  seat.position.y = 0.48;
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.65, 0.52), fabricMat);
  back.position.set(0.22, 0.82, 0);
  const chairLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.24, 0.45, 8), timberMat);
  chairLeg.position.y = 0.225;
  chair.add(seat, back, chairLeg);
  g.add(chair);

  const lampStand = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 0.42, 10), brassMat);
  lampStand.position.set(1.4, 1.19, -0.95);
  const lampShade = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 0.2, 12, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xe3cf9e, emissive: 0x996528, emissiveIntensity: 0.75, side: THREE.DoubleSide }),
  );
  lampShade.position.set(1.4, 1.44, -0.95);
  const deskLampLight = new THREE.PointLight(0xffad58, 4.8, 9.5, 1.6);
  deskLampLight.position.set(1.3, 1.32, -0.95);
  g.add(lampStand, lampShade, deskLampLight);

  const notePaper = new THREE.Group();
  notePaper.position.set(0.98, 0.99, 0.12);
  const sheet = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.015, 0.42),
    new THREE.MeshStandardMaterial({ color: 0xd9ceb2, roughness: 0.9 }),
  );
  const stamp = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.018, 12),
    new THREE.MeshStandardMaterial({ color: 0x7c201e, roughness: 0.8 }),
  );
  stamp.position.set(0.06, 0.005, 0.12);
  notePaper.add(sheet, stamp);
  g.add(notePaper);

  // Jandarma Crash Report Folder on South end of desk
  const crashFolder = new THREE.Group();
  crashFolder.position.set(1.02, 0.99, 0.62);
  const folderMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.025, 0.44),
    new THREE.MeshStandardMaterial({ color: 0x6b563c, roughness: 0.85 }),
  );
  const labelStrip = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.028, 0.12),
    new THREE.MeshStandardMaterial({ color: 0xe3dac5, roughness: 0.9 }),
  );
  crashFolder.add(folderMesh, labelStrip);
  g.add(crashFolder);

  const camphorJar = createCopperEwerAndSoap('kafur');
  camphorJar.position.set(1.05, 0.99, -0.45);
  g.add(camphorJar);

  const wallPhotoFrame = new THREE.Group();
  wallPhotoFrame.position.set(0.4, 1.85, -rd / 2 + 0.16);
  const pFrame = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.86, 0.06), timberMat);
  const pImage = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 0.7),
    new THREE.MeshStandardMaterial({ map: textures.photo, roughness: 0.75 }),
  );
  pImage.position.z = 0.035;
  wallPhotoFrame.add(pFrame, pImage);
  g.add(wallPhotoFrame);

  bakeStaticChildrenByMaterial(
    g,
    new Set<THREE.Object3D>([doorPivot, deskLampLight, camphorJar, notePaper, crashFolder, wallPhotoFrame]),
  );

  return {
    group: g,
    doorPivot,
    deskLampLight,
    camphorJar,
    notePaper,
    crashFolder,
    wallPhotoFrame,
  };
}

export function createHandCandle(): HandCandleRefs {
  const root = new THREE.Group();

  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xb78b43,
    roughness: 0.32,
    metalness: 0.88,
  });
  const waxMat = new THREE.MeshStandardMaterial({
    color: 0xe6dcc4,
    roughness: 0.68,
    metalness: 0.0,
  });

  const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.065, 0.024, 14), brassMat);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.008, 8, 14), brassMat);
  handle.position.set(0.085, 0.015, 0);
  const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.16, 10), waxMat);
  wax.position.y = 0.09;
  const wick = new THREE.Mesh(
    new THREE.CylinderGeometry(0.003, 0.003, 0.02, 6),
    new THREE.MeshStandardMaterial({ color: 0x1a1512 }),
  );
  wick.position.y = 0.175;

  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.016, 0.055, 8),
    new THREE.MeshBasicMaterial({ color: 0xffbe55 }),
  );
  flame.position.y = 0.205;

  const light = new THREE.PointLight(0xffa748, 4.4, 13.5, 1.5);
  light.position.set(0, 0.25, -0.05);

  root.add(saucer, handle, wax, wick, flame, light);
  return { root, flame, light };
}

export function createKaraBasma(): KaraBasmaRefs {
  const root = new THREE.Group();
  const cloakMat = new THREE.MeshStandardMaterial({
    color: 0x0a0b0e,
    roughness: 0.96,
    metalness: 0.04,
  });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x8ea0b5 });

  const lowerSkirt = new THREE.Mesh(new THREE.ConeGeometry(0.58, 1.65, 9), cloakMat);
  lowerSkirt.position.y = 0.85;
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.36, 0.9, 8), cloakMat);
  torso.position.y = 1.55;
  const shoulders = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.22, 0.32), cloakMat);
  shoulders.position.y = 1.92;
  const hood = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.5, 8), cloakMat);
  hood.position.set(0, 2.2, 0.06);
  hood.rotation.x = 0.24;

  const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.03, 0.95, 6), cloakMat);
  armL.position.set(-0.38, 1.48, 0.14);
  armL.rotation.z = 0.15;
  armL.rotation.x = -0.25;
  const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.03, 0.95, 6), cloakMat);
  armR.position.set(0.38, 1.48, 0.14);
  armR.rotation.z = -0.15;
  armR.rotation.x = -0.25;

  const eyeLeft = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), eyeMat);
  eyeLeft.position.set(-0.065, 2.08, 0.2);
  const eyeRight = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), eyeMat);
  eyeRight.position.set(0.065, 2.08, 0.2);

  root.add(lowerSkirt, torso, shoulders, hood, armL, armR, eyeLeft, eyeRight);
  return {
    root,
    cloakParts: [lowerSkirt, torso, shoulders, hood, armL, armR],
    eyeLeft,
    eyeRight,
  };
}

export function createUtilityPole(textures: ProceduralTextureSet): {
  group: THREE.Group;
  wireAttachY: number;
} {
  const g = new THREE.Group();
  const { darkTimberMat: woodMat, ironMat, ceramicMat } = getSharedVillageMaterials(textures);

  const poleH = 7.4;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, poleH, 8), woodMat);
  pole.position.y = poleH * 0.5;
  g.add(pole);

  const crossArm = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.1, 0.1), woodMat);
  crossArm.position.set(0, poleH - 0.55, 0);
  g.add(crossArm);

  const braceL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.55, 0.04), ironMat);
  braceL.position.set(-0.28, poleH - 0.78, 0.05);
  braceL.rotation.z = -0.58;
  const braceR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.55, 0.04), ironMat);
  braceR.position.set(0.28, poleH - 0.78, 0.05);
  braceR.rotation.z = 0.58;
  g.add(braceL, braceR);

  [-0.5, 0.5].forEach((ix) => {
    const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.048, 0.14, 8), ceramicMat);
    ins.position.set(ix, poleH - 0.44, 0);
    g.add(ins);
  });

  bakeStaticChildrenByMaterial(g);
  return { group: g, wireAttachY: poleH - 0.4 };
}

export function createFirewoodStack(textures: ProceduralTextureSet): THREE.Group {
  const g = new THREE.Group();
  const { darkTimberMat: barkMat, cutWoodMat: cutMat } = getSharedVillageMaterials(textures);

  const rackBase = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.07, 0.56), barkMat);
  rackBase.position.y = 0.035;
  g.add(rackBase);

  const logGeo = new THREE.CylinderGeometry(0.095, 0.1, 0.52, 7, 1, true);
  const capGeo = new THREE.CircleGeometry(0.095, 7);

  for (let row = 0; row < 4; row++) {
    const cols = row % 2 === 0 ? 5 : 4;
    for (let c = 0; c < cols; c++) {
      const lx = (c - (cols - 1) * 0.5) * 0.24;
      const ly = 0.16 + row * 0.18;
      const log = new THREE.Mesh(logGeo, barkMat);
      log.rotation.x = Math.PI / 2;
      log.position.set(lx, ly, 0);
      const capF = new THREE.Mesh(capGeo, cutMat);
      capF.position.set(lx, ly, 0.26);
      const capB = new THREE.Mesh(capGeo, cutMat);
      capB.rotation.y = Math.PI;
      capB.position.set(lx, ly, -0.26);
      g.add(log, capF, capB);
    }
  }

  bakeStaticChildrenByMaterial(g);
  return g;
}

export function createVillageBench(textures: ProceduralTextureSet): THREE.Group {
  const g = new THREE.Group();
  const { stoneMat, darkTimberMat: woodMat } = getSharedVillageMaterials(textures);

  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.42, 0.44), stoneMat);
  legL.position.set(-0.62, 0.21, 0);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.42, 0.44), stoneMat);
  legR.position.set(0.62, 0.21, 0);
  const plank1 = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.07, 0.2), woodMat);
  plank1.position.set(0, 0.45, -0.11);
  const plank2 = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.07, 0.2), woodMat);
  plank2.position.set(0, 0.45, 0.11);
  g.add(legL, legR, plank1, plank2);
  bakeStaticChildrenByMaterial(g);
  return g;
}

export function createStoneCourtyardWall(
  textures: ProceduralTextureSet,
  length: number,
  withGate = false,
): THREE.Group {
  const g = new THREE.Group();
  const { stoneMat, capStoneMat: capMat, timberMat } = getSharedVillageMaterials(textures);

  if (!withGate) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.15, length), stoneMat);
    wall.position.y = 0.575;
    wall.castShadow = true;
    wall.receiveShadow = true;
    const coping = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.11, length + 0.08), capMat);
    coping.position.y = 1.2;
    g.add(wall, coping);
  } else {
    const segLen = Math.max(1.2, (length - 1.4) * 0.5);
    [-1, 1].forEach((dir) => {
      const seg = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.15, segLen), stoneMat);
      seg.position.set(0, 0.575, dir * (0.7 + segLen * 0.5));
      seg.castShadow = true;
      seg.receiveShadow = true;
      const cop = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.11, segLen + 0.04), capMat);
      cop.position.set(0, 1.2, dir * (0.7 + segLen * 0.5));
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.48, 0.22), timberMat);
      post.position.set(0, 0.74, dir * 0.72);
      g.add(seg, cop, post);
    });

    // Half-ajar weathered wooden gate leaf
    const gate = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.08, 1.28), timberMat);
    gate.position.set(0.44, 0.62, -0.2);
    gate.rotation.y = 0.72;
    g.add(gate);
  }

  bakeStaticChildrenByMaterial(g);
  return g;
}

export function createClayJug(): THREE.Group {
  const g = new THREE.Group();
  const clayMat = new THREE.MeshStandardMaterial({ color: 0x8b4c33, roughness: 0.78, metalness: 0.04 });
  const pts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.09, 0),
    new THREE.Vector2(0.15, 0.16),
    new THREE.Vector2(0.13, 0.28),
    new THREE.Vector2(0.05, 0.37),
    new THREE.Vector2(0.065, 0.44),
  ];
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 14), clayMat);
  const handleCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.06, 0.39, 0),
    new THREE.Vector3(0.16, 0.34, 0),
    new THREE.Vector3(0.14, 0.22, 0),
  ]);
  const handle = new THREE.Mesh(new THREE.TubeGeometry(handleCurve, 10, 0.015, 6, false), clayMat);
  g.add(body, handle);
  return g;
}

export interface ClinicRefs {
  group: THREE.Group;
  doorPivot: THREE.Group;
  examLight: THREE.PointLight;
  autopsyBody: AutopsyBodyRefs;
}

export function createClinicBuilding(textures: ProceduralTextureSet): ClinicRefs {
  const g = new THREE.Group();
  const plasterMat = new THREE.MeshStandardMaterial({
    map: textures.plaster,
    normalMap: textures.plasterNormal,
    color: 0xc8c3b8,
    roughness: 0.84,
  });
  const tileMat = new THREE.MeshStandardMaterial({
    map: textures.tile,
    normalMap: textures.tileNormal,
    roughnessMap: textures.tileRoughness,
    color: 0xb6c4bf,
    roughness: 0.48,
  });
  const timberMat = new THREE.MeshStandardMaterial({
    map: textures.timber,
    normalMap: textures.timberNormal,
    roughness: 0.78,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    map: textures.roof,
    normalMap: textures.roofNormal,
    roughness: 0.72,
  });
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x9aa4ab,
    roughness: 0.25,
    metalness: 0.88,
  });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xb48c48, roughness: 0.35, metalness: 0.82 });

  const rw = 7.4;
  const rd = 6.6;
  const rh = 3.4;

  const floor = new THREE.Mesh(new THREE.BoxGeometry(rw, 0.16, rd), tileMat);
  floor.position.y = 0.08;
  floor.receiveShadow = true;
  g.add(floor);

  const step = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.14, 2.4), plasterMat);
  step.position.set(-rw / 2 - 0.7, 0.07, 0);
  g.add(step);

  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(rw + 0.4, 0.2, rd + 0.4), plasterMat);
  ceiling.position.y = rh + 0.1;
  g.add(ceiling);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(5.6, 2.0, 4), roofMat);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = rh + 1.15;
  roof.castShadow = true;
  g.add(roof);

  // Walls (Doorway on West wall x = -rw/2, z: -0.8..0.8)
  const eastW = new THREE.Mesh(new THREE.BoxGeometry(0.24, rh, rd), tileMat);
  eastW.position.set(rw / 2, rh / 2, 0);
  const northW = new THREE.Mesh(new THREE.BoxGeometry(rw, rh, 0.24), tileMat);
  northW.position.set(0, rh / 2, -rd / 2);
  const southW = new THREE.Mesh(new THREE.BoxGeometry(rw, rh, 0.24), tileMat);
  southW.position.set(0, rh / 2, rd / 2);
  const westL = new THREE.Mesh(new THREE.BoxGeometry(0.24, rh, 2.5), plasterMat);
  westL.position.set(-rw / 2, rh / 2, -2.05);
  const westR = new THREE.Mesh(new THREE.BoxGeometry(0.24, rh, 2.5), plasterMat);
  westR.position.set(-rw / 2, rh / 2, 2.05);
  const westTop = new THREE.Mesh(new THREE.BoxGeometry(0.24, rh - 2.3, 1.6), plasterMat);
  westTop.position.set(-rw / 2, 2.3 + (rh - 2.3) / 2, 0);
  g.add(eastW, northW, southW, westL, westR, westTop);

  // Clinic red crescent / cross wall sign above doorway
  const signPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.42, 1.4),
    new THREE.MeshStandardMaterial({ color: 0xe6e0d4, roughness: 0.6 }),
  );
  signPlate.position.set(-rw / 2 - 0.14, 2.75, 0);
  const crossH = new THREE.Mesh(
    new THREE.BoxGeometry(0.07, 0.1, 0.34),
    new THREE.MeshStandardMaterial({ color: 0x8f221d, roughness: 0.5 }),
  );
  crossH.position.set(-rw / 2 - 0.15, 2.75, 0);
  g.add(signPlate, crossH);

  const doorPivot = new THREE.Group();
  doorPivot.position.set(-rw / 2, 0.16, -0.78);
  const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.09, 2.15, 1.54), timberMat);
  doorMesh.position.set(0, 1.075, 0.77);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), brassMat);
  knob.position.set(-0.08, 1.02, 1.38);
  doorPivot.add(doorMesh, knob);
  g.add(doorPivot);

  // Stainless steel autopsy table holding Case II (Şoför Mahmut)
  const tableBase = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.74, 0.72), steelMat);
  tableBase.position.set(0.4, 0.53, 0);
  const tableTop = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 1.05), steelMat);
  tableTop.position.set(0.4, 0.94, 0);
  tableTop.castShadow = true;
  tableTop.receiveShadow = true;
  g.add(tableBase, tableTop);

  const autopsyBody = createAutopsyCadaverOverlay('case_mahmut', 0x9aa09a, 0x2a313a, -0.83);
  autopsyBody.group.position.set(0.4, 0.99, 0);
  g.add(autopsyBody.group);

  // Overhead cold clinical exam lamp
  const lampBar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.05, 8), steelMat);
  lampBar.position.set(0.4, 2.85, 0);
  const lampHood = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 0.16, 14), steelMat);
  lampHood.position.set(0.4, 2.32, 0);
  const examLight = new THREE.PointLight(0xd9eff7, 6.4, 11.5, 1.5);
  examLight.position.set(0.4, 2.18, 0);
  g.add(lampBar, lampHood, examLight);

  // Side medical shelf
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.35, 0.48), steelMat);
  shelf.position.set(0.5, 0.84, -rd / 2 + 0.42);
  g.add(shelf);

  bakeStaticChildrenByMaterial(g, new Set<THREE.Object3D>([doorPivot, examLight, autopsyBody.group]));

  return { group: g, doorPivot, examLight, autopsyBody };
}

export interface MillAndBridgeRefs {
  bridgeGroup: THREE.Group;
  millGroup: THREE.Group;
  doorPivot: THREE.Group;
  wheelPivot: THREE.Group;
  ledgerPaper: THREE.Group;
  herbPatch: THREE.Group;
  lanternLight: THREE.PointLight;
}

export function createWatermillAndBridge(textures: ProceduralTextureSet): MillAndBridgeRefs {
  const stoneMat = new THREE.MeshStandardMaterial({
    map: textures.stone,
    normalMap: textures.stoneNormal,
    roughness: 0.9,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    map: textures.timber,
    normalMap: textures.timberNormal,
    roughness: 0.82,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    map: textures.roof,
    normalMap: textures.roofNormal,
    roughness: 0.74,
  });

  // 1. Wooden & Stone Stream Bridge (spanning ~6.6m across stream at x=-24, z=8)
  const bridgeGroup = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.22, 3.2), woodMat);
  deck.position.y = 0.28;
  deck.castShadow = true;
  deck.receiveShadow = true;
  bridgeGroup.add(deck);

  [-1.5, 1.5].forEach((rz) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.1, 0.1), woodMat);
    rail.position.set(0, 1.05, rz);
    bridgeGroup.add(rail);
    [-3.1, -1.5, 0, 1.5, 3.1].forEach((px) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.95, 0.14), woodMat);
      post.position.set(px, 0.72, rz);
      bridgeGroup.add(post);
    });
  });

  [-3.25, 3.25].forEach((ax) => {
    const abutment = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.9, 3.5), stoneMat);
    abutment.position.set(ax, -0.05, 0);
    bridgeGroup.add(abutment);
  });

  // 2. Walk-in Eski Su Değirmeni (Old Watermill)
  const millGroup = new THREE.Group();
  const rw = 6.2;
  const rd = 5.8;
  const rh = 3.2;

  const floor = new THREE.Mesh(new THREE.BoxGeometry(rw, 0.16, rd), woodMat);
  floor.position.y = 0.08;
  floor.receiveShadow = true;
  millGroup.add(floor);

  const westW = new THREE.Mesh(new THREE.BoxGeometry(0.26, rh, rd), stoneMat);
  westW.position.set(-rw / 2, rh / 2, 0);
  const northW = new THREE.Mesh(new THREE.BoxGeometry(rw, rh, 0.26), stoneMat);
  northW.position.set(0, rh / 2, -rd / 2);
  const southW = new THREE.Mesh(new THREE.BoxGeometry(rw, rh, 0.26), woodMat);
  southW.position.set(0, rh / 2, rd / 2);
  const eastL = new THREE.Mesh(new THREE.BoxGeometry(0.24, rh, 2.1), woodMat);
  eastL.position.set(rw / 2, rh / 2, -1.85);
  const eastR = new THREE.Mesh(new THREE.BoxGeometry(0.24, rh, 2.1), woodMat);
  eastR.position.set(rw / 2, rh / 2, 1.85);
  const eastTop = new THREE.Mesh(new THREE.BoxGeometry(0.24, rh - 2.3, 1.6), woodMat);
  eastTop.position.set(rw / 2, 2.3 + (rh - 2.3) / 2, 0);
  millGroup.add(westW, northW, southW, eastL, eastR, eastTop);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(4.8, 2.0, 4), roofMat);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = rh + 1.05;
  roof.castShadow = true;
  millGroup.add(roof);

  const doorPivot = new THREE.Group();
  doorPivot.position.set(rw / 2, 0.16, -0.78);
  const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.09, 2.15, 1.54), woodMat);
  doorMesh.position.set(0, 1.075, 0.77);
  doorPivot.add(doorMesh);
  millGroup.add(doorPivot);

  // Rotating Wooden Waterwheel on East/Stream flank
  const wheelPivot = new THREE.Group();
  wheelPivot.position.set(rw / 2 + 0.5, 1.35, 2.2);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.11, 8, 20), woodMat);
  rim.rotation.y = Math.PI / 2;
  wheelPivot.add(rim);
  for (let i = 0; i < 8; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.65, 0.16), woodMat);
    spoke.rotation.x = (i / 8) * Math.PI;
    wheelPivot.add(spoke);
  }
  millGroup.add(wheelPivot);

  // Flour sacks & millstone inside + Ledger Paper
  const millstone = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.34, 16), stoneMat);
  millstone.position.set(-1.3, 0.33, -1.1);
  const crateDesk = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.78, 0.8), woodMat);
  crateDesk.position.set(-1.5, 0.55, 1.1);
  millGroup.add(millstone, crateDesk);

  const ledgerPaper = new THREE.Group();
  ledgerPaper.position.set(-1.5, 0.96, 1.1);
  const sheet = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.03, 0.44),
    new THREE.MeshStandardMaterial({ color: 0xc9be9f, roughness: 0.9 }),
  );
  ledgerPaper.add(sheet);
  millGroup.add(ledgerPaper);

  // Toxic Boğanak herb patch beside stream bank
  const herbPatch = new THREE.Group();
  herbPatch.position.set(rw / 2 + 1.8, 0.04, -1.8);
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x263b22, roughness: 0.88 });
  const berryMat = new THREE.MeshStandardMaterial({
    color: 0x4b1d52,
    emissive: 0x200926,
    emissiveIntensity: 0.45,
    roughness: 0.45,
  });
  for (let i = 0; i < 5; i++) {
    const st = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.42, 6), stemMat);
    st.position.set((i - 2) * 0.14, 0.21, (i % 2) * 0.14);
    const fl = new THREE.Mesh(new THREE.SphereGeometry(0.055, 7, 7), berryMat);
    fl.position.set((i - 2) * 0.14, 0.4, (i % 2) * 0.14);
    herbPatch.add(st, fl);
  }
  millGroup.add(herbPatch);

  const lanternLight = new THREE.PointLight(0xffa94f, 4.2, 10, 1.6);
  lanternLight.position.set(0, 2.5, 0);
  millGroup.add(lanternLight);

  bakeStaticChildrenByMaterial(bridgeGroup);
  bakeStaticChildrenByMaterial(
    millGroup,
    new Set<THREE.Object3D>([doorPivot, wheelPivot, ledgerPaper, herbPatch, lanternLight]),
  );

  return { bridgeGroup, millGroup, doorPivot, wheelPivot, ledgerPaper, herbPatch, lanternLight };
}

export interface CemeteryCryptRefs {
  group: THREE.Group;
  doorPivot: THREE.Group;
  autopsyBody: AutopsyBodyRefs;
  vaultLight: THREE.PointLight;
}

export function createCemeteryHillAndCrypt(textures: ProceduralTextureSet): CemeteryCryptRefs {
  const group = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({
    map: textures.stone,
    normalMap: textures.stoneNormal,
    roughness: 0.92,
  });
  const timberMat = new THREE.MeshStandardMaterial({
    map: textures.timber,
    normalMap: textures.timberNormal,
    roughness: 0.82,
  });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x282c31, roughness: 0.42, metalness: 0.85 });

  // Outer low stone graveyard walls
  const northFence = new THREE.Mesh(new THREE.BoxGeometry(12.5, 0.9, 0.45), stoneMat);
  northFence.position.set(0, 0.45, -6.5);
  const westFence = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.9, 13.0), stoneMat);
  westFence.position.set(-6.2, 0.45, 0);
  group.add(northFence, westFence);

  // Additional Ottoman stone steles + freshly dug grave mound
  const graveOffsets = [
    [-3.5, 2.2],
    [-1.4, 2.6],
    [-3.8, -0.4],
    [-1.8, -0.6],
    [-4.2, -3.2],
    [-2.0, -3.6],
    [1.8, 3.2],
    [3.8, 2.8],
  ];
  graveOffsets.forEach(([gx, gz], idx) => {
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.16, 1.35), stoneMat);
    plinth.position.set(gx, 0.08, gz);
    const stele = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.05 + (idx % 3) * 0.18, 0.1), stoneMat);
    stele.position.set(gx, 0.65, gz - 0.52);
    stele.rotation.z = (idx % 2 === 0 ? 1 : -1) * 0.06;
    group.add(plinth, stele);
  });

  // Freshly dug grave mound + pit
  const mound = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.58, 1.65, 8),
    new THREE.MeshStandardMaterial({ color: 0x2b2016, roughness: 0.96 }),
  );
  mound.rotation.x = Math.PI / 2;
  mound.scale.set(1.2, 1, 0.42);
  mound.position.set(3.2, 0.14, 0.4);
  group.add(mound);

  // Walk-in Taş Mahzen (Stone Morgue Vault) at local (0, 0, -2.5) facing South (+Z)
  const crypt = new THREE.Group();
  crypt.position.set(1.6, 0, -3.2);
  const cw = 4.6;
  const cd = 4.8;
  const ch = 2.8;

  const cFloor = new THREE.Mesh(new THREE.BoxGeometry(cw, 0.14, cd), stoneMat);
  cFloor.position.y = 0.07;
  const cBack = new THREE.Mesh(new THREE.BoxGeometry(cw, ch, 0.34), stoneMat);
  cBack.position.set(0, ch / 2, -cd / 2);
  const cLeft = new THREE.Mesh(new THREE.BoxGeometry(0.34, ch, cd), stoneMat);
  cLeft.position.set(-cw / 2, ch / 2, 0);
  const cRight = new THREE.Mesh(new THREE.BoxGeometry(0.34, ch, cd), stoneMat);
  cRight.position.set(cw / 2, ch / 2, 0);
  const cFrontL = new THREE.Mesh(new THREE.BoxGeometry(1.5, ch, 0.34), stoneMat);
  cFrontL.position.set(-1.55, ch / 2, cd / 2);
  const cFrontR = new THREE.Mesh(new THREE.BoxGeometry(1.5, ch, 0.34), stoneMat);
  cFrontR.position.set(1.55, ch / 2, cd / 2);
  const cFrontHead = new THREE.Mesh(new THREE.BoxGeometry(1.6, ch - 2.15, 0.34), stoneMat);
  cFrontHead.position.set(0, 2.15 + (ch - 2.15) / 2, cd / 2);
  const cRoof = new THREE.Mesh(new THREE.BoxGeometry(cw + 0.5, 0.32, cd + 0.5), stoneMat);
  cRoof.position.y = ch + 0.16;
  crypt.add(cFloor, cBack, cLeft, cRight, cFrontL, cFrontR, cFrontHead, cRoof);

  const doorPivot = new THREE.Group();
  doorPivot.position.set(-0.75, 0.14, cd / 2);
  const doorLeaf = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.08, 0.1), timberMat);
  doorLeaf.position.set(0.75, 1.04, 0);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.08, 0.13), ironMat);
  bar.position.set(0.75, 1.1, 0);
  doorPivot.add(doorLeaf, bar);
  crypt.add(doorPivot);

  // Basalt slab inside crypt holding Case III (İsimsiz Yolcu)
  const slab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.78, 1.02), stoneMat);
  slab.position.set(0, 0.53, -0.35);
  crypt.add(slab);

  const autopsyBody = createAutopsyCadaverOverlay('case_unknown', 0x8f98a0, 0x202229, -0.8);
  autopsyBody.group.position.set(0, 0.94, -0.35);
  crypt.add(autopsyBody.group);

  const vaultLight = new THREE.PointLight(0xa5c3d4, 3.6, 8.5, 1.5);
  vaultLight.position.set(0, 2.35, -0.2);
  crypt.add(vaultLight);

  group.add(crypt);
  bakeStaticChildrenByMaterial(group, new Set<THREE.Object3D>([doorPivot, autopsyBody.group, vaultLight]));
  return { group, doorPivot, autopsyBody, vaultLight };
}

export interface WreckedMinibusRefs {
  group: THREE.Group;
  hazardLight: THREE.PointLight;
  manifestPaper: THREE.Group;
}

export function createWreckedMinibus(textures: ProceduralTextureSet): WreckedMinibusRefs {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xb7b2a4, roughness: 0.58, metalness: 0.32 });
  const rustMat = new THREE.MeshStandardMaterial({ color: 0x4b2f21, roughness: 0.9, metalness: 0.25 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x2c3c47,
    roughness: 0.18,
    metalness: 0.1,
    transparent: true,
    opacity: 0.65,
  });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x161719, roughness: 0.92 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x565c63, roughness: 0.4, metalness: 0.8 });

  // Broken steel roadside guardrail beside bend
  const rail1 = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.18, 0.08), steelMat);
  rail1.position.set(-2.4, 0.62, -2.1);
  rail1.rotation.y = 0.28;
  rail1.rotation.z = -0.18;
  const post1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.85, 0.12), steelMat);
  post1.position.set(-3.8, 0.42, -1.6);
  const post2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.72, 0.12), steelMat);
  post2.position.set(-1.1, 0.35, -2.5);
  post2.rotation.x = 0.45;
  group.add(rail1, post1, post2);

  // Tilted Minibus hull
  const bus = new THREE.Group();
  bus.rotation.set(0.16, -0.45, -0.22);
  bus.position.set(0.4, 0.28, 0.6);

  const lowerHull = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.95, 1.95), bodyMat);
  lowerHull.position.y = 0.75;
  lowerHull.castShadow = true;
  const upperCabin = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.88, 1.85), bodyMat);
  upperCabin.position.set(-0.25, 1.62, 0);
  upperCabin.castShadow = true;
  const roofRack = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 1.5), rustMat);
  roofRack.position.set(-0.25, 2.1, 0);
  const windows = new THREE.Mesh(new THREE.BoxGeometry(3.54, 0.56, 1.88), glassMat);
  windows.position.set(-0.25, 1.58, 0);
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.26, 2.02), rustMat);
  bumper.position.set(2.2, 0.46, 0);
  bumper.rotation.y = 0.14;
  bus.add(lowerHull, upperCabin, roofRack, windows, bumper);

  [
    [-1.25, -0.95],
    [-1.25, 0.95],
    [1.35, -0.95],
    [1.35, 0.95],
  ].forEach(([wx, wz]) => {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.24, 14), tireMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    bus.add(wheel);
  });

  const hazardLight = new THREE.PointLight(0xff8e2b, 3.2, 8.5, 1.7);
  hazardLight.position.set(2.25, 0.75, -0.72);
  bus.add(hazardLight);
  group.add(bus);

  // Manifest paper spilled on muddy ground beside open rear door
  const manifestPaper = new THREE.Group();
  manifestPaper.position.set(-2.2, 0.14, 1.35);
  const sheet = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.02, 0.44),
    new THREE.MeshStandardMaterial({ map: textures.plaster, color: 0xd9cfb6, roughness: 0.9 }),
  );
  manifestPaper.add(sheet);
  group.add(manifestPaper);

  return { group, hazardLight, manifestPaper };
}

export function createDistrictSignpost(textures: ProceduralTextureSet): THREE.Group {
  const g = new THREE.Group();
  const { darkTimberMat: woodMat } = getSharedVillageMaterials(textures);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.35, 8), woodMat);
  post.position.y = 1.175;

  const arm1 = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.2, 0.06), woodMat);
  arm1.position.set(0.42, 2.05, 0);
  arm1.rotation.y = 0.25;
  const arm2 = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.2, 0.06), woodMat);
  arm2.position.set(-0.42, 1.75, 0);
  arm2.rotation.y = -0.35;

  g.add(post, arm1, arm2);
  bakeStaticChildrenByMaterial(g);
  return g;
}

export function createSisGozcusu(): THREE.Group {
  const root = new THREE.Group();
  const mistBodyMat = new THREE.MeshStandardMaterial({
    color: 0x161c22,
    roughness: 0.94,
    metalness: 0.05,
    transparent: true,
    opacity: 0.86,
  });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xb7d1de });

  const veil = new THREE.Mesh(new THREE.ConeGeometry(0.62, 2.15, 10), mistBodyMat);
  veil.position.y = 1.1;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), mistBodyMat);
  head.position.y = 2.25;
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), eyeMat);
  eyeL.position.set(-0.07, 2.28, 0.19);
  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), eyeMat);
  eyeR.position.set(0.07, 2.28, 0.19);

  root.add(veil, head, eyeL, eyeR);
  return root;
}

