import * as THREE from 'three';
import { AutopsyBodyRefs, createAutopsyCadaverOverlay } from './autopsy';
import { CC0AssetLibrary } from './cc0Assets';
import {
  AbandonedHouseRefs,
  BoxCollider,
  CemeteryCryptRefs,
  ClinicRefs,
  createAbandonedHouse,
  createCemeteryHillAndCrypt,
  createClayJug,
  createClinicBuilding,
  createCopperEwerAndSoap,
  createDistrictSignpost,
  createFirewoodStack,
  createGraveyardCluster,
  createKaraBasma,
  createMosqueAndGasilhane,
  createMuhtarHouse,
  createSisGozcusu,
  createStoneCourtyardWall,
  createStoneFountain,
  createStreetLamp,
  createUtilityPole,
  createVillageBench,
  createVillageHouse,
  createWatermillAndBridge,
  createWreckedMinibus,
  GasilhaneRefs,
  KaraBasmaRefs,
  MillAndBridgeRefs,
  MuhtarRefs,
  WreckedMinibusRefs,
} from './models';
import {
  attachCC0RigToNpc,
  buildProceduralVillagerFallback,
  NpcRuntimeActor,
  VILLAGE_NPCS,
} from './npcs';
import { buildMountainTerrainAndForest, groundHeightAt } from './terrain';
import { ProceduralTextureSet } from './textures';
import { AutopsyCaseId, NpcId } from './types';

export interface InteractableTarget {
  id: string;
  mesh: THREE.Object3D;
  worldPos: THREE.Vector3;
  maxDist: number;
  label: () => string | null;
}

export interface VirtualPointLight {
  light: THREE.PointLight;
  anchor: THREE.Object3D;
  worldPos: THREE.Vector3;
  distSq: number;
}

export interface WorldHandles {
  colliders: BoxCollider[];
  interactables: InteractableTarget[];
  interactableMeshes: THREE.Object3D[];
  itemMeshes: Record<string, THREE.Object3D>;
  gasil: GasilhaneRefs;
  muhtar: MuhtarRefs;
  abandoned: AbandonedHouseRefs;
  clinic: ClinicRefs;
  millAndBridge: MillAndBridgeRefs;
  cemetery: CemeteryCryptRefs;
  crashSite: WreckedMinibusRefs;
  gasilAutopsy: AutopsyBodyRefs;
  autopsyBodies: Record<AutopsyCaseId, AutopsyBodyRefs>;
  autopsyLights: {
    examLight: THREE.PointLight;
    flashLight: THREE.PointLight;
    anchors: Record<AutopsyCaseId, { examAnchor: THREE.Object3D; flashAnchor: THREE.Object3D }>;
  };
  npcs: Record<NpcId, NpcRuntimeActor>;
  karaBasma: KaraBasmaRefs;
  sisGozcusu: THREE.Group;
  streetLights: Array<{
    light: THREE.PointLight;
    bulbMat: THREE.MeshStandardMaterial;
    baseIntensity: number;
  }>;
  virtualLights: VirtualPointLight[];
  worldLightPool: THREE.PointLight[];
  sunKeyLight: THREE.DirectionalLight;
  hemiLight: THREE.HemisphereLight;
  moonMesh: THREE.Mesh;
  mistSprites: THREE.Sprite[];
  rainPoints: THREE.Points;
  rainGeo: THREE.BufferGeometry;
  rainUniforms: {
    uTime: { value: number };
    uPlayerPos: { value: THREE.Vector3 };
    uOpacity: { value: number };
    uSpeed: { value: number };
  };
  applyCC0Assets: (cc0: CC0AssetLibrary) => void;
  dispose: () => void;
}

export function buildVillageWorld(
  scene: THREE.Scene,
  textures: ProceduralTextureSet,
  getLabel: (id: string) => string | null,
): WorldHandles {
  const disposables: Array<{ dispose: () => void }> = [];
  const colliders: BoxCollider[] = [];
  const interactables: InteractableTarget[] = [];
  const itemMeshes: Record<string, THREE.Object3D> = {};

  // 1. Lighting Rig (Warm/Cool contrast + FogExp2)
  const hemiLight = new THREE.HemisphereLight(0x52657d, 0x262119, 0.72);
  scene.add(hemiLight);

  const sunKeyLight = new THREE.DirectionalLight(0xc49c74, 1.35);
  sunKeyLight.position.set(18, 26, 22);
  sunKeyLight.castShadow = true;
  sunKeyLight.shadow.mapSize.set(1024, 1024);
  sunKeyLight.shadow.camera.left = -36;
  sunKeyLight.shadow.camera.right = 36;
  sunKeyLight.shadow.camera.top = 36;
  sunKeyLight.shadow.camera.bottom = -36;
  sunKeyLight.shadow.camera.near = 2;
  sunKeyLight.shadow.camera.far = 90;
  sunKeyLight.shadow.bias = -0.0005;
  sunKeyLight.shadow.normalBias = 0.02;
  scene.add(sunKeyLight);

  scene.background = new THREE.Color(0x18202b);
  scene.fog = new THREE.FogExp2(0x18202b, 0.029);

  // Subtle distant Moon in sky
  const moonGeo = new THREE.CircleGeometry(2.8, 24);
  const moonMat = new THREE.MeshBasicMaterial({
    color: 0xdce4ee,
    fog: false,
    transparent: true,
    opacity: 0.78,
  });
  const moonMesh = new THREE.Mesh(moonGeo, moonMat);
  moonMesh.position.set(-34, 42, -74);
  moonMesh.lookAt(0, 2, 0);
  moonMesh.updateMatrix();
  moonMesh.matrixAutoUpdate = false;
  scene.add(moonMesh);
  disposables.push(moonGeo, moonMat);

  // 2. Expanded 5-District Terrain & Instanced Pine Forest
  const terrainHandle = buildMountainTerrainAndForest(scene, textures);
  disposables.push(terrainHandle);

  // 3. Mosque & Gasilhane Complex at (-10.5, y, 6.0)
  const gasilPos = new THREE.Vector3(-10.5, groundHeightAt(-10.5, 6.0), 6.0);
  const gasil = createMosqueAndGasilhane(textures);
  gasil.group.position.copy(gasilPos);
  scene.add(gasil.group);

  // Case I Forensic Overlay aligned directly onto Gasilhane Tenesir Slab
  const gasilAutopsy = createAutopsyCadaverOverlay('case_arif', 0xa69c90, 0x3b362e, -0.885);
  gasilAutopsy.group.position.set(0, 0.015, 0);
  gasilAutopsy.group.visible = false;
  gasil.deceasedGroup.add(gasilAutopsy.group);

  colliders.push(
    { minX: -14.1, maxX: -6.9, minZ: 2.55, maxZ: 3.05 }, // Gasil North
    { minX: -14.1, maxX: -6.9, minZ: 8.95, maxZ: 9.45 }, // Gasil South
    { minX: -14.15, maxX: -13.65, minZ: 2.6, maxZ: 9.4 }, // Gasil West
    { minX: -7.35, maxX: -6.85, minZ: 2.6, maxZ: 5.2 }, // Gasil East-North
    { minX: -7.35, maxX: -6.85, minZ: 6.8, maxZ: 9.4 }, // Gasil East-South
    { minX: -11.75, maxX: -9.25, minZ: 5.35, maxZ: 6.65 }, // Marble Tenesir Slab
    { minX: -14.1, maxX: -6.9, minZ: -2.0, maxZ: 2.6 }, // Mosque body
  );

  // Mosque Graveyard beside Mosque
  const graveyard = createGraveyardCluster(textures);
  graveyard.position.set(-10.6, groundHeightAt(-10.6, -4.2), -4.2);
  scene.add(graveyard);

  // 4. Walk-in Abandoned Village House (Eski Köy Evi) at (-10.8, y, -10.5)
  const abandonedPos = new THREE.Vector3(-10.8, groundHeightAt(-10.8, -10.5), -10.5);
  const abandoned = createAbandonedHouse(textures);
  abandoned.group.position.copy(abandonedPos);
  scene.add(abandoned.group);

  colliders.push(
    { minX: -13.95, maxX: -7.65, minZ: -13.5, maxZ: -13.0 },
    { minX: -13.95, maxX: -7.65, minZ: -8.0, maxZ: -7.5 },
    { minX: -14.0, maxX: -13.5, minZ: -13.5, maxZ: -7.5 },
    { minX: -8.05, maxX: -7.55, minZ: -13.5, maxZ: -11.3 },
    { minX: -8.05, maxX: -7.55, minZ: -9.7, maxZ: -7.5 },
    { minX: -12.7, maxX: -11.5, minZ: -10.9, maxZ: -9.3 },
  );

  // 5. Muhtar's House at (10.5, y, -18.0)
  const muhtarPos = new THREE.Vector3(10.5, groundHeightAt(10.5, -18.0), -18.0);
  const muhtar = createMuhtarHouse(textures);
  muhtar.group.position.copy(muhtarPos);
  scene.add(muhtar.group);

  colliders.push(
    { minX: 7.1, maxX: 13.9, minZ: -21.25, maxZ: -20.75 },
    { minX: 7.1, maxX: 13.9, minZ: -15.25, maxZ: -14.75 },
    { minX: 13.45, maxX: 13.95, minZ: -21.2, maxZ: -14.8 },
    { minX: 7.05, maxX: 7.55, minZ: -21.2, maxZ: -18.8 },
    { minX: 7.05, maxX: 7.55, minZ: -17.2, maxZ: -14.8 },
    { minX: 11.1, maxX: 12.4, minZ: -19.3, maxZ: -17.1 },
  );

  // 5b. Sağlık Ocağı (District II: East Clinic) at (26.0, y, -28.0)
  const clinicPos = new THREE.Vector3(26.0, groundHeightAt(26.0, -28.0), -28.0);
  const clinic = createClinicBuilding(textures);
  clinic.group.position.copy(clinicPos);
  scene.add(clinic.group);

  colliders.push(
    { minX: 22.1, maxX: 29.9, minZ: -31.5, maxZ: -31.05 }, // Clinic North
    { minX: 22.1, maxX: 29.9, minZ: -24.95, maxZ: -24.5 }, // Clinic South
    { minX: 29.45, maxX: 29.95, minZ: -31.4, maxZ: -24.6 }, // Clinic East
    { minX: 22.05, maxX: 22.55, minZ: -31.4, maxZ: -28.8 }, // Clinic West-North
    { minX: 22.05, maxX: 22.55, minZ: -27.2, maxZ: -24.6 }, // Clinic West-South
    { minX: 25.25, maxX: 27.55, minZ: -28.55, maxZ: -27.45 }, // Autopsy table
    { minX: 25.4, maxX: 27.6, minZ: -31.1, maxZ: -30.5 }, // Medical shelf
  );

  // 5c. Dere Köprüsü & Eski Su Değirmeni (District III: West Stream & Mill)
  const millAndBridge = createWatermillAndBridge(textures);
  const bridgePos = new THREE.Vector3(-24.0, 0.05, 8.0);
  millAndBridge.bridgeGroup.position.copy(bridgePos);
  scene.add(millAndBridge.bridgeGroup);

  const millPos = new THREE.Vector3(-36.0, groundHeightAt(-36.0, 8.0), 8.0);
  millAndBridge.millGroup.position.copy(millPos);
  scene.add(millAndBridge.millGroup);

  colliders.push(
    // Bridge railings (North & South)
    { minX: -27.4, maxX: -20.6, minZ: 6.28, maxZ: 6.56 },
    { minX: -27.4, maxX: -20.6, minZ: 9.44, maxZ: 9.72 },
    // Watermill walls (Doorway on East wall x=-32.9, z: 7.2..8.8)
    { minX: -39.3, maxX: -38.85, minZ: 4.95, maxZ: 11.05 }, // Mill West
    { minX: -39.2, maxX: -32.8, minZ: 4.9, maxZ: 5.35 }, // Mill North
    { minX: -39.2, maxX: -32.8, minZ: 10.65, maxZ: 11.1 }, // Mill South
    { minX: -33.1, maxX: -32.7, minZ: 5.0, maxZ: 7.2 }, // Mill East-North
    { minX: -33.1, maxX: -32.7, minZ: 8.8, maxZ: 11.0 }, // Mill East-South
    { minX: -38.1, maxX: -36.5, minZ: 6.1, maxZ: 7.7 }, // Millstone
    { minX: -38.1, maxX: -36.8, minZ: 8.6, maxZ: 9.6 }, // Crate desk
  );

  // 5d. Mezarlık Tepesi & Taş Mahzen (District IV: Northwest Cemetery Hill) at (-34.0, y, -36.0)
  const cemPos = new THREE.Vector3(-34.0, groundHeightAt(-34.0, -36.0), -36.0);
  const cemetery = createCemeteryHillAndCrypt(textures);
  cemetery.group.position.copy(cemPos);
  scene.add(cemetery.group);

  // Crypt local center (1.6, 0, -3.2) => world (-32.4, y, -39.2), cw=4.6, cd=4.8
  colliders.push(
    { minX: -40.35, maxX: -27.7, minZ: -42.75, maxZ: -42.25 }, // Outer North fence
    { minX: -40.45, maxX: -39.95, minZ: -42.5, maxZ: -29.5 }, // Outer West fence
    { minX: -34.8, maxX: -30.0, minZ: -41.8, maxZ: -41.4 }, // Crypt Back North
    { minX: -34.9, maxX: -34.5, minZ: -41.65, maxZ: -36.75 }, // Crypt West
    { minX: -30.3, maxX: -29.9, minZ: -41.65, maxZ: -36.75 }, // Crypt East
    { minX: -34.8, maxX: -33.15, minZ: -37.0, maxZ: -36.6 }, // Crypt South-West
    { minX: -31.65, maxX: -30.0, minZ: -37.0, maxZ: -36.6 }, // Crypt South-East
    { minX: -33.55, maxX: -31.25, minZ: -40.08, maxZ: -39.02 }, // Basalt slab
  );

  // 5e. Viraj Kaza Alanı (District V: Southeast Wrecked Minibus) at (28.0, y, 20.0)
  const crashPos = new THREE.Vector3(28.0, groundHeightAt(28.0, 20.0), 20.0);
  const crashSite = createWreckedMinibus(textures);
  crashSite.group.position.copy(crashPos);
  scene.add(crashSite.group);
  colliders.push({ minX: 26.2, maxX: 30.6, minZ: 18.8, maxZ: 22.4 });

  // 6. Flanking & Perimeter Village Houses + Stone Courtyard Walls
  const houseConfigs = [
    { x: 10.6, z: 2.0, rotY: -Math.PI / 2, w: 6.2, d: 5.4, h: 4.3, collide: true },
    { x: -11.2, z: 18.0, rotY: Math.PI / 2, w: 5.6, d: 4.8, h: 3.9, collide: true },
    { x: 11.4, z: -8.6, rotY: -Math.PI / 2 + 0.08, w: 5.8, d: 5.0, h: 4.0, collide: true },
    { x: -13.0, z: -20.5, rotY: Math.PI / 2 - 0.12, w: 6.0, d: 5.2, h: 4.1, collide: true },
    { x: 19.5, z: 13.0, rotY: -Math.PI * 0.6, w: 6.4, d: 5.4, h: 4.2, collide: false },
    { x: -19.2, z: -3.5, rotY: Math.PI * 0.45, w: 5.8, d: 5.0, h: 4.0, collide: false },
    { x: 18.2, z: -34.5, rotY: -Math.PI * 0.25, w: 6.0, d: 5.2, h: 4.1, collide: false },
    { x: -16.8, z: -35.5, rotY: Math.PI * 0.35, w: 5.8, d: 5.0, h: 4.0, collide: false },
  ];
  houseConfigs.forEach((hc) => {
    const house = createVillageHouse(textures, hc.w, hc.d, hc.h);
    house.position.set(hc.x, groundHeightAt(hc.x, hc.z), hc.z);
    house.rotation.y = hc.rotY;
    scene.add(house);
    if (hc.collide) {
      colliders.push({
        minX: hc.x - hc.d * 0.52,
        maxX: hc.x + hc.d * 0.52,
        minZ: hc.z - hc.w * 0.52,
        maxZ: hc.z + hc.w * 0.52,
      });
    }
  });

  const stoneWallMat = new THREE.MeshStandardMaterial({
    map: textures.stone,
    normalMap: textures.stoneNormal,
    normalScale: new THREE.Vector2(0.95, 0.95),
    roughness: 0.9,
  });
  disposables.push(stoneWallMat);
  [
    { x: -4.4, z: 14.8, len: 7.4, rot: 0, gate: false },
    { x: 4.6, z: -5.5, len: 8.6, rot: 0, gate: true },
    { x: 5.2, z: 4.8, len: 4.2, rot: 0, gate: false },
  ].forEach((sw) => {
    const wallGroup = createStoneCourtyardWall(textures, sw.len, sw.gate);
    wallGroup.position.set(sw.x, groundHeightAt(sw.x, sw.z), sw.z);
    wallGroup.rotation.y = sw.rot;
    scene.add(wallGroup);
    if (!sw.gate) {
      colliders.push({
        minX: sw.x - 0.35,
        maxX: sw.x + 0.35,
        minZ: sw.z - sw.len / 2,
        maxZ: sw.z + sw.len / 2,
      });
    } else {
      colliders.push(
        { minX: sw.x - 0.35, maxX: sw.x + 0.35, minZ: sw.z - sw.len / 2, maxZ: sw.z - 0.7 },
        { minX: sw.x - 0.35, maxX: sw.x + 0.35, minZ: sw.z + 0.7, maxZ: sw.z + sw.len / 2 },
      );
    }
  });

  // Village Storytelling Micro-Props & District Signposts
  [
    { x: -10.4, z: 9.65, rot: 0 },
    { x: -10.8, z: -7.25, rot: 0 },
    { x: 7.5, z: 4.2, rot: Math.PI / 2 },
  ].forEach((fw) => {
    const stack = createFirewoodStack(textures);
    stack.position.set(fw.x, groundHeightAt(fw.x, fw.z), fw.z);
    stack.rotation.y = fw.rot;
    scene.add(stack);
  });

  [
    { x: -2.2, z: 6.2, rot: 0.3 },
    { x: 2.8, z: -23.0, rot: -0.4 },
    { x: -2.6, z: -28.0, rot: 0.45 },
    { x: 3.1, z: 15.2, rot: -0.35 },
  ].forEach((sp) => {
    const post = createDistrictSignpost(textures);
    post.position.set(sp.x, groundHeightAt(sp.x, sp.z), sp.z);
    post.rotation.y = sp.rot;
    scene.add(post);
  });

  const mosqueBench = createVillageBench(textures);
  mosqueBench.position.set(-4.35, groundHeightAt(-4.35, 1.8), 1.8);
  mosqueBench.rotation.y = Math.PI / 2;
  scene.add(mosqueBench);
  colliders.push({ minX: -4.7, maxX: -4.0, minZ: 0.9, maxZ: 2.7 });

  const fountainBench = createVillageBench(textures);
  fountainBench.position.set(4.5, groundHeightAt(4.5, 15.1), 15.1);
  fountainBench.rotation.y = -Math.PI / 2;
  scene.add(fountainBench);
  colliders.push({ minX: 4.15, maxX: 4.85, minZ: 14.2, maxZ: 16.0 });

  const jug1 = createClayJug();
  jug1.position.set(4.1, groundHeightAt(4.1, 13.45), 13.45);
  const jug2 = createClayJug();
  jug2.position.set(abandonedPos.x + 3.55, abandonedPos.y + 0.14, abandonedPos.z + 1.15);
  scene.add(jug1, jug2);

  // 7. Village Entrance Sign ("KUZDAĞ KÖYÜ - RAKIM 1480 m")
  const signGroup = new THREE.Group();
  const signX = -3.6;
  const signZ = 20.8;
  signGroup.position.set(signX, groundHeightAt(signX, signZ), signZ);
  signGroup.rotation.y = 0.35;
  const postMat = new THREE.MeshStandardMaterial({ color: 0x3b4045, roughness: 0.6, metalness: 0.7 });
  const signMat = new THREE.MeshStandardMaterial({ map: textures.sign, roughness: 0.45 });
  const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 8), postMat);
  postL.position.set(-0.65, 1.1, 0);
  const postR = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 8), postMat);
  postR.position.set(0.65, 1.1, 0);
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.85, 0.06), signMat);
  board.position.set(0, 1.95, 0);
  signGroup.add(postL, postR, board);
  signGroup.updateMatrixWorld(true);
  signGroup.traverse((o) => {
    o.matrixAutoUpdate = false;
  });
  scene.add(signGroup);
  disposables.push(postMat, signMat);

  // 8. Stone Village Fountain (Çeşme) at (4.8, y, 12.5)
  const fountainPos = new THREE.Vector3(4.8, groundHeightAt(4.8, 12.5), 12.5);
  const fountain = createStoneFountain(textures);
  fountain.position.copy(fountainPos);
  fountain.rotation.y = -Math.PI / 2;
  fountain.updateMatrix();
  fountain.matrixAutoUpdate = false;
  scene.add(fountain);
  colliders.push({ minX: 4.0, maxX: 5.6, minZ: 11.2, maxZ: 13.8 });

  // 9. Exterior Yard Drain near Gasilhane (Rule 2 Trap)
  const yardDrainGroup = new THREE.Group();
  const ydX = -5.4;
  const ydZ = 8.6;
  yardDrainGroup.position.set(ydX, groundHeightAt(ydX, ydZ) + 0.03, ydZ);
  const ydRim = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.14, 0.85), stoneWallMat);
  const ydHole = new THREE.Mesh(
    new THREE.BoxGeometry(0.54, 0.16, 0.54),
    new THREE.MeshStandardMaterial({ color: 0x090b0b, roughness: 0.9 }),
  );
  yardDrainGroup.add(ydRim, ydHole);
  yardDrainGroup.updateMatrixWorld(true);
  yardDrainGroup.traverse((o) => {
    o.matrixAutoUpdate = false;
  });
  scene.add(yardDrainGroup);

  // 10. Street Lamps across all 5 Districts + Overhead Utility Poles
  const streetLights: WorldHandles['streetLights'] = [];
  [
    { x: -4.2, z: 6.2, rot: 0, base: 6.8 },
    { x: 4.1, z: -12.2, rot: Math.PI, base: 6.6 },
    { x: 3.9, z: 17.5, rot: Math.PI, base: 5.4 },
    { x: -4.0, z: -17.5, rot: 0, base: 5.2 },
    { x: 13.5, z: -24.5, rot: -Math.PI / 2, base: 5.6 }, // Clinic road
    { x: 20.8, z: -29.5, rot: 0, base: 6.0 }, // Clinic courtyard
    { x: -19.5, z: 6.0, rot: Math.PI / 2, base: 5.2 }, // Bridge head
    { x: -26.5, z: -33.2, rot: 0.3, base: 4.8 }, // Cemetery hill approach
    { x: 22.0, z: 18.2, rot: -0.4, base: 5.0 }, // Crash bend approach
  ].forEach((lp) => {
    const sl = createStreetLamp();
    sl.group.position.set(lp.x, groundHeightAt(lp.x, lp.z), lp.z);
    sl.group.rotation.y = lp.rot;
    sl.light.intensity = lp.base;
    scene.add(sl.group);
    streetLights.push({ light: sl.light, bulbMat: sl.bulbMat, baseIntensity: lp.base });
  });

  const poleCoords = [
    { x: -4.15, z: 21.5, rot: 0.1 },
    { x: -4.3, z: 9.6, rot: -0.05 },
    { x: -4.3, z: -2.8, rot: 0.08 },
    { x: 4.25, z: -11.2, rot: -0.1 },
    { x: 4.3, z: -22.2, rot: 0.05 },
  ];
  const poleTops: THREE.Vector3[] = [];
  poleCoords.forEach((pc) => {
    const { group, wireAttachY } = createUtilityPole(textures);
    const py = groundHeightAt(pc.x, pc.z);
    group.position.set(pc.x, py, pc.z);
    group.rotation.y = pc.rot;
    scene.add(group);
    poleTops.push(new THREE.Vector3(pc.x, py + wireAttachY, pc.z));
    colliders.push({ minX: pc.x - 0.25, maxX: pc.x + 0.25, minZ: pc.z - 0.25, maxZ: pc.z + 0.25 });
  });

  const cableMat = new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.7, metalness: 0.3 });
  disposables.push(cableMat);
  for (let i = 0; i < poleTops.length - 1; i++) {
    const a = poleTops[i];
    const b = poleTops[i + 1];
    [-0.45, 0.45].forEach((offset) => {
      const p0 = new THREE.Vector3(a.x + offset, a.y, a.z);
      const p2 = new THREE.Vector3(b.x + offset, b.y, b.z);
      const mid = p0.clone().lerp(p2, 0.5);
      mid.y -= 0.78;
      const cableGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([p0, mid, p2]), 14, 0.016, 4, false);
      const cable = new THREE.Mesh(cableGeo, cableMat);
      cable.updateMatrix();
      cable.matrixAutoUpdate = false;
      scene.add(cable);
      disposables.push(cableGeo);
    });
  }

  // 11. Wooden Crate beside Gasilhane entrance
  const crateMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.75, 0.65, 0.75),
    new THREE.MeshStandardMaterial({
      map: textures.timber,
      normalMap: textures.timberNormal,
      roughness: 0.8,
    }),
  );
  crateMesh.position.set(-6.1, groundHeightAt(-6.1, 4.4) + 0.325, 4.4);
  crateMesh.castShadow = true;
  crateMesh.updateMatrix();
  crateMesh.matrixAutoUpdate = false;
  scene.add(crateMesh);

  // 12. Collectible Supplies
  const defterMesh = createCopperEwerAndSoap('defter');
  defterMesh.position.set(-6.1, groundHeightAt(-6.1, 4.4) + 0.66, 4.4);
  defterMesh.rotation.y = 0.4;
  scene.add(defterMesh);
  itemMeshes['item_defter'] = defterMesh;

  const kefenMesh = createCopperEwerAndSoap('kefen');
  kefenMesh.position.set(gasilPos.x + 4.2, gasilPos.y + 0.81, gasilPos.z - 6.2);
  scene.add(kefenMesh);
  itemMeshes['item_kefen'] = kefenMesh;

  const sabunMesh = createCopperEwerAndSoap('sabun');
  sabunMesh.position.set(fountainPos.x - 0.1, fountainPos.y + 1.2, fountainPos.z + 0.72);
  scene.add(sabunMesh);
  itemMeshes['item_sabun'] = sabunMesh;

  const ibrikMesh = createCopperEwerAndSoap('ibrik');
  ibrikMesh.position.set(fountainPos.x - 0.68, fountainPos.y + 0.56, fountainPos.z - 0.25);
  scene.add(ibrikMesh);
  itemMeshes['item_ibrik'] = ibrikMesh;

  itemMeshes['item_gulsuyu'] = abandoned.gulsuyuProp;
  itemMeshes['item_kafur'] = muhtar.camphorJar;
  itemMeshes['item_mill_toxin'] = millAndBridge.herbPatch;

  // 13. Register Interactables
  const registerTarget = (
    id: string,
    worldPos: THREE.Vector3,
    size: [number, number, number],
    maxDist = 3.2,
    parent?: THREE.Object3D,
  ) => {
    const hitGeo = new THREE.BoxGeometry(size[0], size[1], size[2]);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    const proxy = new THREE.Mesh(hitGeo, hitMat);
    proxy.position.copy(worldPos);
    proxy.userData.interactId = id;
    proxy.layers.set(1);
    (parent ?? scene).add(proxy);
    disposables.push(hitGeo, hitMat);
    interactables.push({
      id,
      mesh: proxy,
      worldPos: worldPos.clone(),
      maxDist,
      label: () => getLabel(id),
    });
  };

  registerTarget('item_defter', defterMesh.position.clone().add(new THREE.Vector3(0, 0.12, 0)), [0.6, 0.5, 0.6]);
  registerTarget('item_kefen', kefenMesh.position.clone().add(new THREE.Vector3(0, 0.15, 0)), [0.7, 0.55, 0.6]);
  registerTarget('item_sabun', sabunMesh.position.clone().add(new THREE.Vector3(0, 0.12, 0)), [0.55, 0.45, 0.55]);
  registerTarget('item_ibrik', ibrikMesh.position.clone().add(new THREE.Vector3(0, 0.22, 0)), [0.55, 0.6, 0.55]);
  registerTarget('item_mill_toxin', new THREE.Vector3(millPos.x + 4.9, millPos.y + 0.32, millPos.z - 1.8), [0.9, 0.7, 0.9], 3.3);

  registerTarget('gasil_door', new THREE.Vector3(gasilPos.x + 3.4, gasilPos.y + 1.25, gasilPos.z), [0.6, 2.2, 1.5], 3.1);
  registerTarget('tenesir_slab', new THREE.Vector3(gasilPos.x, gasilPos.y + 1.05, gasilPos.z), [2.4, 0.9, 1.2], 3.4);
  registerTarget('gasil_shutter', new THREE.Vector3(gasilPos.x - 3.25, gasilPos.y + 2.0, gasilPos.z), [0.6, 1.3, 1.9], 4.2);
  registerTarget('gasil_drain', new THREE.Vector3(gasilPos.x - 1.9, gasilPos.y + 0.35, gasilPos.z + 2.0), [0.9, 0.7, 0.9], 3.2);
  registerTarget('vigil_candle', new THREE.Vector3(gasilPos.x - 1.35, gasilPos.y + 1.1, gasilPos.z - 0.75), [0.6, 1.2, 0.6], 3.2);
  registerTarget('yard_drain', new THREE.Vector3(ydX, groundHeightAt(ydX, ydZ) + 0.35, ydZ), [1.0, 0.8, 1.0], 3.2);

  // Eski Köy Evi targets
  registerTarget('abandoned_door', new THREE.Vector3(abandonedPos.x + 3.0, abandonedPos.y + 1.2, abandonedPos.z), [0.6, 2.2, 1.5], 3.1);
  registerTarget('clue_serife_letter', new THREE.Vector3(abandonedPos.x - 1.15, abandonedPos.y + 1.0, abandonedPos.z + 0.52), [0.6, 0.4, 0.6], 3.0);
  registerTarget('item_gulsuyu', new THREE.Vector3(abandonedPos.x + 0.6, abandonedPos.y + 0.85, abandonedPos.z - 2.15), [0.65, 0.6, 0.65], 3.1);

  // Muhtar targets
  registerTarget('muhtar_door', new THREE.Vector3(muhtarPos.x - 3.2, muhtarPos.y + 1.2, muhtarPos.z), [0.6, 2.2, 1.5], 3.1);
  registerTarget('clue_muhtar_note', new THREE.Vector3(muhtarPos.x + 0.98, muhtarPos.y + 1.05, muhtarPos.z + 0.12), [0.6, 0.4, 0.6], 3.0);
  registerTarget('clue_crash_report', new THREE.Vector3(muhtarPos.x + 1.02, muhtarPos.y + 1.05, muhtarPos.z + 0.62), [0.6, 0.4, 0.6], 3.0);
  registerTarget('item_kafur', new THREE.Vector3(muhtarPos.x + 1.05, muhtarPos.y + 1.1, muhtarPos.z - 0.45), [0.55, 0.5, 0.55], 3.0);
  registerTarget('clue_photo', new THREE.Vector3(muhtarPos.x + 0.4, muhtarPos.y + 1.85, muhtarPos.z - 2.8), [1.0, 1.0, 0.4], 3.4);

  // Sağlık Ocağı targets
  registerTarget('clinic_door', new THREE.Vector3(clinicPos.x - 3.7, clinicPos.y + 1.2, clinicPos.z), [0.6, 2.2, 1.5], 3.2);
  registerTarget('autopsy_case_mahmut', new THREE.Vector3(clinicPos.x + 0.4, clinicPos.y + 1.1, clinicPos.z), [2.3, 0.8, 1.1], 3.4);

  // Eski Su Değirmeni targets
  registerTarget('mill_door', new THREE.Vector3(millPos.x + 3.1, millPos.y + 1.2, millPos.z), [0.6, 2.2, 1.5], 3.2);
  registerTarget('clue_mill_ledger', new THREE.Vector3(millPos.x - 1.5, millPos.y + 1.0, millPos.z + 1.1), [0.7, 0.45, 0.7], 3.1);

  // Mezarlık Taş Mahzen targets (Crypt local center +1.6, 0, -3.2)
  registerTarget('crypt_door', new THREE.Vector3(cemPos.x + 1.6, cemPos.y + 1.15, cemPos.z - 0.8), [1.5, 2.2, 0.6], 3.2);
  registerTarget('autopsy_case_unknown', new THREE.Vector3(cemPos.x + 1.6, cemPos.y + 1.05, cemPos.z - 3.55), [2.2, 0.85, 1.05], 3.4);

  // Viraj Kaza Alanı targets
  registerTarget('clue_crash_manifest', new THREE.Vector3(crashPos.x - 2.2, crashPos.y + 0.25, crashPos.z + 1.35), [0.8, 0.45, 0.8], 3.3);

  // 14. Villager NPCs (4 interactive patrolling/standing residents)
  const npcs = {} as Record<NpcId, NpcRuntimeActor>;
  (Object.keys(VILLAGE_NPCS) as NpcId[]).forEach((npcId) => {
    const def = VILLAGE_NPCS[npcId];
    const startWp = def.waypoints[0];
    const startPos = new THREE.Vector3(startWp.x, groundHeightAt(startWp.x, startWp.z), startWp.z);
    const root = new THREE.Group();
    root.position.copy(startPos);

    const fallbackGroup = buildProceduralVillagerFallback(
      def.coatTint,
      def.hasLantern,
      def.hasShovel,
      def.headscarf,
    );
    root.add(fallbackGroup);
    scene.add(root);

    // Attach raycast proxy directly to NPC root so it follows patrol movement automatically
    registerTarget(`npc_${npcId}`, new THREE.Vector3(0, 1.05, 0), [0.85, 1.9, 0.85], 3.8, root);

    npcs[npcId] = {
      def,
      root,
      mixer: null,
      idleAction: null,
      walkAction: null,
      currentMode: 'idle',
      waypointIndex: 0,
      pauseTimer: 2.0,
      pos: startPos,
      yaw: 0,
      talkCooldown: 0,
      spokenNodes: new Set<string>(),
      trust: 50,
      cc0Attached: false,
      fallbackGroup,
    };
  });

  // 15. Night Threats: Kara Basma & Sis Gözcüsü
  const karaBasma = createKaraBasma();
  karaBasma.root.position.set(1.5, groundHeightAt(1.5, -6), -6);
  karaBasma.root.visible = false;
  scene.add(karaBasma.root);

  const sisGozcusu = createSisGozcusu();
  sisGozcusu.position.set(-22, groundHeightAt(-22, -16), -16);
  sisGozcusu.visible = false;
  scene.add(sisGozcusu);

  // 16. Drifting Ground Mist Wisps across Expanded Valley
  const mistSprites: THREE.Sprite[] = [];
  const mistMat = new THREE.SpriteMaterial({
    map: textures.mistSprite,
    transparent: true,
    opacity: 0.36,
    depthWrite: false,
  });
  disposables.push(mistMat);

  const mistLocations = [
    [-6, 1.1, 16],
    [3, 1.0, 8],
    [-11, 1.1, -4.5],
    [1, 1.1, -8],
    [-2, 1.2, -16],
    [6, 1.1, -21],
    [20, 1.2, -26],
    [-24, 0.9, 4],
    [-33, 1.3, -32],
    [24, 1.1, 18],
  ];
  mistLocations.forEach(([mx, my, mz]) => {
    const sp = new THREE.Sprite(mistMat);
    sp.position.set(mx, groundHeightAt(mx, mz) + my, mz);
    sp.scale.set(9.8, 3.3, 1);
    sp.userData.baseX = mx;
    scene.add(sp);
    mistSprites.push(sp);
  });

  // 17. GPU-Driven Rain Particles (zero CPU per-frame vertex upload)
  const rainCount = 1450;
  const rainPositions = new Float32Array(rainCount * 3);
  const rainPhases = new Float32Array(rainCount);
  for (let i = 0; i < rainCount; i++) {
    rainPositions[i * 3] = (Math.random() - 0.5) * 30;
    rainPositions[i * 3 + 1] = Math.random() * 14;
    rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 30;
    rainPhases[i] = Math.random();
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  rainGeo.setAttribute('aPhase', new THREE.BufferAttribute(rainPhases, 1));
  const rainUniforms = {
    uTime: { value: 0 },
    uPlayerPos: { value: new THREE.Vector3() },
    uOpacity: { value: 0 },
    uSpeed: { value: 12 },
  };
  const rainMat = new THREE.ShaderMaterial({
    uniforms: rainUniforms,
    vertexShader: `
      uniform float uTime;
      uniform vec3 uPlayerPos;
      uniform float uSpeed;
      attribute float aPhase;
      varying float vAlpha;
      void main() {
        float y = mod(position.y - uTime * uSpeed + aPhase * 14.0, 14.0);
        float relX = mod(position.x - uPlayerPos.x + 15.0, 30.0) - 15.0;
        float relZ = mod(position.z - uPlayerPos.z + 15.0, 30.0) - 15.0;
        vec3 worldPos = vec3(uPlayerPos.x + relX, uPlayerPos.y - 2.0 + y, uPlayerPos.z + relZ);
        vAlpha = smoothstep(0.0, 1.2, y) * (1.0 - smoothstep(12.2, 14.0, y));
        vec4 mvPosition = modelViewMatrix * vec4(worldPos, 1.0);
        gl_PointSize = clamp(24.0 / max(1.0, -mvPosition.z), 1.5, 4.5);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      varying float vAlpha;
      void main() {
        vec2 c = gl_PointCoord - vec2(0.5);
        float d = dot(c * vec2(2.2, 0.7), c * vec2(2.2, 0.7));
        if (d > 0.25) discard;
        gl_FragColor = vec4(0.67, 0.73, 0.78, uOpacity * vAlpha * (1.0 - d * 3.5));
      }
    `,
    transparent: true,
    depthWrite: false,
  });
  const rainPoints = new THREE.Points(rainGeo, rainMat);
  rainPoints.frustumCulled = false;
  scene.add(rainPoints);
  disposables.push(rainGeo, rainMat);

  // 17b. Virtualize all PointLights into a fixed 4-light pool + 2 shared autopsy lights.
  // Keeping a constant PointLight count in scene eliminates runtime GLSL shader recompiles
  // and reduces per-pixel PBR shading cost by ~4x on low-end GPUs.
  const detachToAnchor = (light: THREE.PointLight): THREE.Object3D => {
    const anchor = new THREE.Object3D();
    anchor.position.copy(light.position);
    const parent = light.parent;
    if (parent) {
      parent.add(anchor);
      parent.remove(light);
    }
    return anchor;
  };

  const autopsyAnchors: Record<AutopsyCaseId, { examAnchor: THREE.Object3D; flashAnchor: THREE.Object3D }> = {
    case_arif: {
      examAnchor: detachToAnchor(gasilAutopsy.examLight),
      flashAnchor: detachToAnchor(gasilAutopsy.flashLight),
    },
    case_mahmut: {
      examAnchor: detachToAnchor(clinic.autopsyBody.examLight),
      flashAnchor: detachToAnchor(clinic.autopsyBody.flashLight),
    },
    case_unknown: {
      examAnchor: detachToAnchor(cemetery.autopsyBody.examLight),
      flashAnchor: detachToAnchor(cemetery.autopsyBody.flashLight),
    },
  };

  const sharedAutopsyExamLight = new THREE.PointLight(0xfff3de, 0, 4.2, 1.6);
  sharedAutopsyExamLight.visible = true;
  scene.add(sharedAutopsyExamLight);

  const sharedAutopsyFlashLight = new THREE.PointLight(0xe8f4ff, 0, 5.6, 1.4);
  sharedAutopsyFlashLight.visible = true;
  scene.add(sharedAutopsyFlashLight);

  const rawScenePointLights: THREE.PointLight[] = [];
  scene.traverse((obj) => {
    if (
      obj instanceof THREE.PointLight &&
      obj !== sharedAutopsyExamLight &&
      obj !== sharedAutopsyFlashLight
    ) {
      rawScenePointLights.push(obj);
    }
  });

  const virtualLights: VirtualPointLight[] = rawScenePointLights.map((light) => {
    const anchor = detachToAnchor(light);
    return {
      light,
      anchor,
      worldPos: new THREE.Vector3(),
      distSq: 0,
    };
  });

  const worldLightPool: THREE.PointLight[] = [];
  for (let i = 0; i < 4; i++) {
    const poolLight = new THREE.PointLight(0xffbe73, 0, 12, 1.6);
    poolLight.visible = true;
    scene.add(poolLight);
    worldLightPool.push(poolLight);
  }

  const interactableMeshes = interactables.map((item) => item.mesh);

  // 18. CC0 Asset Attachment Helper (runs cleanly after non-blocking preload finishes)
  let cc0Applied = false;
  const applyCC0Assets = (cc0: CC0AssetLibrary) => {
    if (cc0Applied) return;
    cc0Applied = true;

    // A. PBR Terrain & Cobblestone Road textures
    const mudPack = cc0.getTexturePack('mud_leaves');
    if (mudPack) terrainHandle.applyCC0Ground(mudPack);
    const cobblePack = cc0.getTexturePack('cobblestone');
    if (cobblePack) terrainHandle.applyCC0Road(cobblePack);

    // B. Attach rigged CC0 Soldier.glb to all 4 NPCs
    (Object.keys(npcs) as NpcId[]).forEach((npcId) => {
      attachCC0RigToNpc(npcs[npcId], cc0);
    });

    // C. Place CC0 3D Props across the 5 districts
    const placeProp = (
      id: Parameters<CC0AssetLibrary['cloneModel']>[0],
      height: number,
      x: number,
      y: number,
      z: number,
      rotY = 0,
      castShadow = true,
    ) => {
      const m = cc0.cloneModel(id, height, castShadow);
      if (!m) return;
      m.position.set(x, y, z);
      m.rotation.y = rotY;
      m.updateMatrixWorld(true);
      m.traverse((obj) => {
        obj.matrixAutoUpdate = false;
      });
      scene.add(m);
    };

    // Lanterns on porches & bridge posts
    placeProp('lantern', 0.44, gasilPos.x + 3.85, gasilPos.y + 0.16, gasilPos.z - 1.35, 0.4, false);
    placeProp('lantern', 0.44, clinicPos.x - 4.1, clinicPos.y + 0.14, clinicPos.z - 1.0, 0.2, false);
    placeProp('lantern', 0.46, millPos.x + 3.45, millPos.y + 0.14, millPos.z + 1.2, -0.3, false);
    placeProp('lantern', 0.46, cemPos.x + 0.3, cemPos.y + 0.1, cemPos.z - 0.6, 0.1, false);

    // Muhtar & Abandoned House interior furniture props
    placeProp('cabinet', 1.95, muhtarPos.x - 1.6, muhtarPos.y + 0.16, muhtarPos.z - 2.35, 0, true);
    placeProp('desk_lamp', 0.46, muhtarPos.x + 1.45, muhtarPos.y + 0.99, muhtarPos.z - 0.85, -0.6, false);
    placeProp('binder', 0.08, muhtarPos.x + 0.85, muhtarPos.y + 0.99, muhtarPos.z - 0.15, 0.2, false);
    placeProp('chair', 0.88, abandonedPos.x - 0.45, abandonedPos.y + 0.16, abandonedPos.z + 0.45, -1.3, false);
    placeProp('candleholders', 0.34, gasilPos.x - 2.5, gasilPos.y + 1.08, gasilPos.z - 2.75, 0.2, false);

    // Barrels & Crates around Mill & Courtyard
    placeProp('barrel', 0.92, millPos.x - 2.2, millPos.y + 0.16, millPos.z - 2.1, 0.3, true);
    placeProp('barrel', 0.92, millPos.x - 1.2, millPos.y + 0.16, millPos.z - 2.2, 1.1, true);
    placeProp('crate', 0.72, millPos.x + 4.2, groundHeightAt(millPos.x + 4.2, millPos.z + 2.4), millPos.z + 2.4, 0.5, true);
    placeProp('crate', 0.72, -5.8, groundHeightAt(-5.8, 7.2), 7.2, 0.2, true);

    // Dead tree trunks & boulders around Cemetery & Crash Bend
    placeProp('dead_tree', 4.6, -28.0, groundHeightAt(-28.0, -39.5), -39.5, 0.4, true);
    placeProp('dead_tree', 4.2, -38.5, groundHeightAt(-38.5, -31.0), -31.0, 1.7, true);
    placeProp('rock', 1.1, 25.0, groundHeightAt(25.0, 23.0), 23.0, 0.8, false);
    placeProp('rock', 0.9, -20.5, groundHeightAt(-20.5, 4.5), 4.5, 1.9, false);
  };

  return {
    colliders,
    interactables,
    interactableMeshes,
    itemMeshes,
    gasil,
    muhtar,
    abandoned,
    clinic,
    millAndBridge,
    cemetery,
    crashSite,
    gasilAutopsy,
    autopsyBodies: {
      case_arif: gasilAutopsy,
      case_mahmut: clinic.autopsyBody,
      case_unknown: cemetery.autopsyBody,
    },
    autopsyLights: {
      examLight: sharedAutopsyExamLight,
      flashLight: sharedAutopsyFlashLight,
      anchors: autopsyAnchors,
    },
    npcs,
    karaBasma,
    sisGozcusu,
    streetLights,
    virtualLights,
    worldLightPool,
    sunKeyLight,
    hemiLight,
    moonMesh,
    mistSprites,
    rainPoints,
    rainGeo,
    rainUniforms,
    applyCC0Assets,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
