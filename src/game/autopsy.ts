import * as THREE from 'three';
import {
  AutopsyCameraAngle,
  AutopsyCaseId,
  AutopsyCaseState,
  AutopsyZoneFinding,
  AutopsyZoneId,
  CrimeSceneAnomalyState,
} from './types';

export const AUTOPSY_LAYER = 2;
export const AUTOPSY_ANOMALY_LAYER = 3;

export interface AutopsyDiagnosisChoice {
  causes: string[];
  times: string[];
  correctCause: string;
  correctTime: string;
  unlockClueId: string;
  summaryText: string;
}

export const AUTOPSY_DIAGNOSIS: Record<AutopsyCaseId, AutopsyDiagnosisChoice> = {
  case_arif: {
    causes: [
      'Doğal kalp yetmezliği ve yaşlılığa bağlı ölüm',
      'Boğanak zehirlenmesi ve ardından soğuk suda boğulma',
      'Sobadan sızan karbonmonoksit zehirlenmesi',
    ],
    times: [
      '21:30 — Yağmur başlamadan hemen önce',
      '01:15 — Muhtarlık tutanağı saatinde',
      '23:55 — Gece yarısından hemen önce',
    ],
    correctCause: 'Boğanak zehirlenmesi ve ardından soğuk suda boğulma',
    correctTime: '21:30 — Yağmur başlamadan hemen önce',
    unlockClueId: 'clue_arif_autopsy',
    summaryText:
      'Hacı Arif doğal nedenlerle değil; Boğanak alkaloitiyle felç edilip dere suyuna bastırıldı. Elindeki reçete Sağlık Ocağına işaret ediyor.',
  },
  case_mahmut: {
    causes: [
      'Viraj kazasında göğüs travması ve kan kaybı',
      'Zehirli bitki çayıyla kasıtlı zehirlenme (kaza süsü)',
      'Soğukta kalmaya bağlı ağır hipotermi',
    ],
    times: [
      '22:40 — Minibüs şarampole yuvarlandığında',
      '21:15 — Minibüs şarampole itilmeden 85 dakika önce',
      '00:30 — Gece yarısından sonra',
    ],
    correctCause: 'Zehirli bitki çayıyla kasıtlı zehirlenme (kaza süsü)',
    correctTime: '21:15 — Minibüs şarampole itilmeden 85 dakika önce',
    unlockClueId: 'clue_mahmut_autopsy',
    summaryText:
      'Şoför Mahmut kazadan 85 dakika önce zehirli çayla öldürülmüş! Değirmen kaydı ve Kenan’ın tutanağı arasındaki çelişki açığa çıktı.',
  },
  case_unknown: {
    causes: [
      '22:40 viraj kazası darbesi ve ardından soğukta donma',
      'Boğanak zehriyle köy meydanında öldürülme',
      'Mezarlıkta kalp durması',
    ],
    times: [
      '22:42 — Viraj kazası ve duran kol saati anı',
      '20:10 — Hava kararmadan önce',
      '03:20 — Sabaha karşı',
    ],
    correctCause: '22:40 viraj kazası darbesi ve ardından soğukta donma',
    correctTime: '22:42 — Viraj kazası ve duran kol saati anı',
    unlockClueId: 'clue_unknown_autopsy',
    summaryText:
      'İsimsiz yolcunun bileğindeki saat 22:42’de durmuş. Ceketindeki bilet ve isim... bu senin bedenin. Son vazife seni özgür bırakacak.',
  },
};

function makeZone(
  zone: AutopsyZoneId,
  zoneLabel: string,
  externalNote: string,
  internalNote: string,
  sampleItemName: string,
  requiresScalpel: boolean,
  requiresForceps: boolean,
): AutopsyZoneFinding {
  return {
    zone,
    zoneLabel,
    externalFound: false,
    externalNote,
    incised: false,
    internalNote,
    sampleExtracted: false,
    sampleItemName,
    requiresScalpel,
    requiresForceps,
  };
}

function makeAnomaly(
  id: string,
  label: string,
  locationHint: string,
  correctTag: string,
  correctZone: AutopsyZoneId,
  tagOptions: string[],
): CrimeSceneAnomalyState {
  return {
    id,
    label,
    locationHint,
    photographed: false,
    selectedTag: '',
    linkedZone: '',
    correctTag,
    correctZone,
    tagOptions,
  };
}

export function createInitialAutopsyCases(): Record<AutopsyCaseId, AutopsyCaseState> {
  return {
    case_arif: {
      id: 'case_arif',
      victimName: 'Hacı Arif Efendi (Köy Gassalı)',
      locationLabel: 'Gasilhane · Mermer Teneşir',
      unlocked: true,
      completed: false,
      selectedCause: '',
      selectedTime: '',
      diagnosisError: null,
      zones: {
        head: makeZone(
          'head',
          'Baş & Göz Kapakları',
          'Göz konjonktivasında iğne ucu peteşiyal kanamalar ve dudaklarda hafif siyanoz.',
          '',
          '',
          false,
          false,
        ),
        neck: makeZone(
          'neck',
          'Boyun & Soluk Borusu',
          'Boyun yanlarında parmak basısı izleri ve soğuk çamur lekesi.',
          'Trakea mukozasında dere tortusu ile birlikte acı alkaloit köpüğü tespit edildi.',
          '',
          true,
          false,
        ),
        chest: makeZone(
          'chest',
          'Göğüs Kafesi & Akciğerler',
          'Dış kaburga bütünlüğü tam; ölüm morlukları sırtında sabitlenmiş (tahminen 21:30 civarı).',
          'Akciğerler aşırı ödemli ve soğuk dere suyuyla dolu — kalp krizi değil, boğulma bulgusu!',
          'Akciğerden Çıkarılan Boğanak Tortusu',
          true,
          true,
        ),
        hands: makeZone(
          'hands',
          'Eller & Tırnak Altları',
          'Tırnak altlarında değirmen yosunu ve mor çiçekli Boğanak kökü kalıntısı.',
          '',
          '',
          false,
          false,
        ),
        pocket: makeZone(
          'pocket',
          'Kuşak & Kişisel Eşya',
          'Yıpranmış cübbe kuşağında katlı sert bir kâğıt kenarı fark ediliyor.',
          '',
          'Sağlık Ocağı Sevk Pusulası',
          false,
          true,
        ),
      },
      anomalies: {
        arif_residue: makeAnomaly(
          'arif_residue',
          'Teneşir Altındaki Mor-Yeşil Tortu',
          'Zemin & İzler açısında mermer teneşir kenarında',
          'Bitkisel Alkaloid & Dere Yosunu Kalıntısı',
          'chest',
          [
            'Bitkisel Alkaloid & Dere Yosunu Kalıntısı',
            'İnsan Dışı Uzamış Çamur İzleri',
            'Doğal Kireç ve Sabun Köpüğü',
          ],
        ),
        arif_footprints: makeAnomaly(
          'arif_footprints',
          'Pencere Altındaki Çarpık İzler',
          'Oda Çevresi açısında batı penceresi önünde',
          'İnsan Dışı Uzamış Çamur İzleri',
          'neck',
          [
            'İnsan Dışı Uzamış Çamur İzleri',
            'Bitkisel Alkaloid & Dere Yosunu Kalıntısı',
            'Normal Köy Çizmesi İzi',
          ],
        ),
      },
    },
    case_mahmut: {
      id: 'case_mahmut',
      victimName: 'Şoför Mahmut (Minibüs Sürücüsü)',
      locationLabel: 'Sağlık Ocağı · Otopsi Masası',
      unlocked: false,
      completed: false,
      selectedCause: '',
      selectedTime: '',
      diagnosisError: null,
      zones: {
        head: makeZone(
          'head',
          'Baş & Pupiller',
          'Göz bebekleri aşırı genişlemiş (midriyazis); alın bölgesindeki sıyrık ölüm sonrası oluşmuş (kanama yok).',
          '',
          '',
          false,
          false,
        ),
        neck: makeZone(
          'neck',
          'Boyun & Emniyet İzi',
          'Emniyet kemeri veya direksiyon çarpma ekimozu kesinlikle yok!',
          'Solunum kasları felç olmuş; boyun damarlarında çarpma pıhtısı bulunmuyor.',
          '',
          true,
          false,
        ),
        chest: makeZone(
          'chest',
          'Göğüs & Mide İçeriği',
          'Rigor mortis tüm çenede sertleşmiş — 22:40’tan en az bir saat önce ölmüş (yaklaşık 21:15).',
          'İç organlarda trafik kazası yırtığı yok. Mide içeriğinde yarı sindirilmiş acı bitki çayı ve alkaloid!',
          'Toksikoloji Numune Tüpü (Boğanak Alkaloiti)',
          true,
          true,
        ),
        hands: makeZone(
          'hands',
          'Eller & Parmaklar',
          'Direksiyon tutuşuna ait hiçbir kasılma yok; sağ başparmakta çay bardağı ısı izi.',
          '',
          '',
          false,
          false,
        ),
        pocket: makeZone(
          'pocket',
          'Ceket İçi Cebi',
          'Islak şoför yeleğinin iç cebinde metalik bir kâğıt sıkışmış.',
          '',
          '21:10 Tarihli Sefer Fişi (Kaza Öncesi)',
          false,
          true,
        ),
      },
      anomalies: {
        mahmut_cup_residue: makeAnomaly(
          'mahmut_cup_residue',
          'Kırık Çay Bardağı ve Zehir Tortusu',
          'Zemin & İzler açısında çelik masanın yanında',
          'Boğanak Demlenmiş Çay Tortusu',
          'chest',
          [
            'Boğanak Demlenmiş Çay Tortusu',
            'Sürükleme İzi ve Geniş Kül Ayak İzleri',
            'Rastgele Cam Kırığı ve Yağmur Suyu',
          ],
        ),
        mahmut_drag_prints: makeAnomaly(
          'mahmut_drag_prints',
          'Sürükleme Olukları ve Kül İzleri',
          'Oda Çevresi açısında kapı eşiği yönünde',
          'Sürükleme İzi ve Geniş Kül Ayak İzleri',
          'head',
          [
            'Sürükleme İzi ve Geniş Kül Ayak İzleri',
            'Boğanak Demlenmiş Çay Tortusu',
            'Sedye Tekerlek İzi',
          ],
        ),
      },
    },
    case_unknown: {
      id: 'case_unknown',
      victimName: 'İsimsiz Yolcu (Taş Mahzen Vakası)',
      locationLabel: 'Mezarlık Tepesi · Taş Mahzen',
      unlocked: false,
      completed: false,
      selectedCause: '',
      selectedTime: '',
      diagnosisError: null,
      zones: {
        head: makeZone(
          'head',
          'Baş & Yüz',
          'Şakakta cam kesiği ve buz gibi donma kızarıklığı; yüz hatları tanıdık, soğuktan solmuş.',
          '',
          '',
          false,
          false,
        ),
        neck: makeZone(
          'neck',
          'Boyun & Yaka',
          'Yün kaşkol altında bakır bir muska zinciri izi duruyor.',
          'Boyun omurlarında ani kaza savrulmasına bağlı çatlak izi.',
          '',
          true,
          false,
        ),
        chest: makeZone(
          'chest',
          'Göğüs & Kalp Bölgesi',
          'Göğüs üzerinde taze araç darbesi morluğu — ölüm saati darbe anıyla örtüşüyor.',
          'Sternum kemiğinde 22:40 çarpmasına uyan kırık ve akciğerlerde soğuk tipi havası.',
          'Kaza Anına Ait Kumaş & Muska Parçası',
          true,
          true,
        ),
        hands: makeZone(
          'hands',
          'Sol Bilek & Eller',
          'Sol bilekte camı kırılmış bir kol saati: akrep ve yelkovan tam 22:42’de durmuş.',
          '',
          '',
          false,
          false,
        ),
        pocket: makeZone(
          'pocket',
          'İç Cep & Kimlik',
          'Senin üzerindeki paltoyla birebir aynı yün kumaş cebinden bir bilet ucu görünüyor.',
          '',
          '22:42 Durmuş Kol Saati & İsimsiz Bilet',
          false,
          true,
        ),
      },
      anomalies: {
        unknown_frost_shards: makeAnomaly(
          'unknown_frost_shards',
          'Donmuş Cam Kırığı ve Zift Halkası',
          'Zemin & İzler açısında bazalt sunağın önünde',
          '22:42 Donmuş Cam Kırığı ve Zift Halkası',
          'hands',
          [
            '22:42 Donmuş Cam Kırığı ve Zift Halkası',
            'Çift Yarık Sis ve Kırağı İzi',
            'Eski Mum Damlaması',
          ],
        ),
        unknown_hoof_tracks: makeAnomaly(
          'unknown_hoof_tracks',
          'Mahzen Taşında Çift Tırnaklı Kırağı İzi',
          'Oda Çevresi açısında batı duvarı dibinde',
          'Çift Yarık Sis ve Kırağı İzi',
          'pocket',
          [
            'Çift Yarık Sis ve Kırağı İzi',
            '22:42 Donmuş Cam Kırığı ve Zift Halkası',
            'Mezarcı Küreği Çiziği',
          ],
        ),
      },
    },
  };
}

export interface AutopsyCameraPreset {
  pos: THREE.Vector3;
  lookAt: THREE.Vector3;
}

export interface AutopsyBodyRefs {
  group: THREE.Group;
  drapeMesh: THREE.Mesh;
  incisionGroup: THREE.Group;
  neckIncision: THREE.Mesh;
  sampleNodes: Partial<Record<AutopsyZoneId, THREE.Mesh>>;
  zoneMeshes: Record<AutopsyZoneId, THREE.Mesh>;
  anomalyMeshes: Record<string, THREE.Mesh>;
  anomalyMarkers: Record<string, THREE.Group>;
  examLight: THREE.PointLight;
  flashLight: THREE.PointLight;
  cameraAnchor: THREE.Vector3;
  cameraLookAt: THREE.Vector3;
  cameraPresets: Record<AutopsyCameraAngle, AutopsyCameraPreset>;
}

export function createAutopsyCadaverOverlay(
  caseId: AutopsyCaseId,
  skinToneHex: number,
  coatColorHex: number,
  floorOffsetY = -0.95,
): AutopsyBodyRefs {
  const group = new THREE.Group();

  const skinMat = new THREE.MeshStandardMaterial({
    color: skinToneHex,
    roughness: 0.72,
    metalness: 0.04,
  });
  const coatMat = new THREE.MeshStandardMaterial({
    color: coatColorHex,
    roughness: 0.88,
    metalness: 0.02,
  });
  const drapeMat = new THREE.MeshStandardMaterial({
    color: 0xd9d4c8,
    roughness: 0.9,
    metalness: 0.0,
    transparent: true,
    opacity: 0.92,
  });
  const incisionMat = new THREE.MeshStandardMaterial({
    color: 0x4b0d0c,
    roughness: 0.35,
    metalness: 0.12,
  });
  const ribMat = new THREE.MeshStandardMaterial({
    color: 0xcbc2ae,
    roughness: 0.65,
  });

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.145, 16, 14), skinMat);
  head.scale.set(1.12, 0.88, 0.95);
  head.position.set(-0.78, 0.14, 0);
  head.castShadow = true;

  // Neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.16, 12), skinMat);
  neck.rotation.z = Math.PI / 2;
  neck.position.set(-0.58, 0.12, 0);

  // Torso / Chest
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.24, 0.44), coatMat);
  torso.position.set(-0.18, 0.12, 0);
  torso.castShadow = true;

  // Abdomen & Legs
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.2, 0.38), coatMat);
  legs.position.set(0.54, 0.1, 0);
  legs.castShadow = true;

  // Arms & Hands
  const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.56, 10), coatMat);
  armL.rotation.z = Math.PI / 2;
  armL.position.set(-0.08, 0.11, -0.27);
  const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.56, 10), coatMat);
  armR.rotation.z = Math.PI / 2;
  armR.position.set(-0.08, 0.11, 0.27);

  const handL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05, 0.1), skinMat);
  handL.position.set(0.24, 0.1, -0.25);
  const handR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05, 0.1), skinMat);
  handR.position.set(0.24, 0.1, 0.25);

  group.add(head, neck, torso, legs, armL, armR, handL, handR);

  // Cover drape (peels back or hides when active inspection begins)
  const drapeMesh = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.26, 0.5), drapeMat);
  drapeMesh.position.set(0.08, 0.13, 0);
  group.add(drapeMesh);

  // Surgical Y-Incision + Ribs (revealed on chest cut)
  const incisionGroup = new THREE.Group();
  incisionGroup.position.set(-0.18, 0.242, 0);
  const slitMain = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.025, 0.11), incisionMat);
  const slitL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.025, 0.045), incisionMat);
  slitL.position.set(-0.24, 0, -0.09);
  slitL.rotation.y = 0.52;
  const slitR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.025, 0.045), incisionMat);
  slitR.position.set(-0.24, 0, 0.09);
  slitR.rotation.y = -0.52;
  incisionGroup.add(slitMain, slitL, slitR);
  for (let i = 0; i < 4; i++) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.028, 0.13), ribMat);
    rib.position.set(-0.12 + i * 0.08, 0.004, 0);
    incisionGroup.add(rib);
  }
  incisionGroup.visible = false;
  group.add(incisionGroup);

  const neckIncision = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.022, 0.032), incisionMat);
  neckIncision.position.set(-0.58, 0.205, 0);
  neckIncision.visible = false;
  group.add(neckIncision);

  // Extractable forensic clue nodes
  const clueMat = new THREE.MeshStandardMaterial({
    color: 0xc9a359,
    emissive: 0x62461a,
    emissiveIntensity: 0.7,
    roughness: 0.35,
    metalness: 0.7,
  });
  const chestClue = new THREE.Mesh(new THREE.OctahedronGeometry(0.035, 0), clueMat);
  chestClue.position.set(-0.12, 0.27, 0);
  chestClue.visible = false;
  const pocketClue = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.09), clueMat);
  pocketClue.position.set(0.05, 0.25, 0.18);
  group.add(chestClue, pocketClue);

  // Raycastable interactive zones on AUTOPSY_LAYER (layer 2)
  const zoneSpecs: Array<{ id: AutopsyZoneId; pos: [number, number, number]; size: [number, number, number] }> = [
    { id: 'head', pos: [-0.78, 0.17, 0], size: [0.34, 0.28, 0.34] },
    { id: 'neck', pos: [-0.56, 0.15, 0], size: [0.22, 0.22, 0.26] },
    { id: 'chest', pos: [-0.18, 0.18, 0], size: [0.62, 0.26, 0.46] },
    { id: 'hands', pos: [0.24, 0.12, 0.25], size: [0.3, 0.2, 0.65] },
    { id: 'pocket', pos: [0.06, 0.18, 0.18], size: [0.28, 0.24, 0.26] },
  ];

  const zoneMeshes = {} as Record<AutopsyZoneId, THREE.Mesh>;
  zoneSpecs.forEach((zs) => {
    const hitGeo = new THREE.BoxGeometry(zs.size[0], zs.size[1], zs.size[2]);
    const hitMat = new THREE.MeshBasicMaterial({
      color: 0xc79e59,
      wireframe: true,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    });
    const m = new THREE.Mesh(hitGeo, hitMat);
    m.position.set(zs.pos[0], zs.pos[1], zs.pos[2]);
    m.userData.autopsyCaseId = caseId;
    m.userData.autopsyZoneId = zs.id;
    m.layers.set(AUTOPSY_LAYER);
    group.add(m);
    zoneMeshes[zs.id] = m;
  });

  // Focused cold clinical exam spotlight overhead + camera flash light
  const examLight = new THREE.PointLight(0xd9eaf2, 0, 5.5, 1.4);
  examLight.position.set(0, 1.45, 0.15);
  group.add(examLight);

  const flashLight = new THREE.PointLight(0xfff7e6, 0, 7.5, 1.2);
  flashLight.position.set(0.35, 1.15, 0.9);
  group.add(flashLight);

  // Crime Scene Environmental Anomalies (placed flush on the room floor around the autopsy table)
  const anomalyMeshes: Record<string, THREE.Mesh> = {};
  const anomalyMarkers: Record<string, THREE.Group> = {};
  const fy = floorOffsetY + 0.012;

  const addAnomalyCollider = (id: string, px: number, py: number, pz: number, sx: number, sy: number, sz: number) => {
    const hitGeo = new THREE.BoxGeometry(sx, sy, sz);
    const hitMat = new THREE.MeshBasicMaterial({
      color: 0x8eb8ca,
      wireframe: true,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    });
    const m = new THREE.Mesh(hitGeo, hitMat);
    m.position.set(px, py, pz);
    m.userData.autopsyCaseId = caseId;
    m.userData.autopsyAnomalyId = id;
    m.layers.set(AUTOPSY_ANOMALY_LAYER);
    group.add(m);
    anomalyMeshes[id] = m;
  };

  if (caseId === 'case_arif') {
    // 1. Mor-yeşil alkaloid kalıntısı
    const resG = new THREE.Group();
    resG.position.set(0.56, fy, 0.74);
    const puddleMat = new THREE.MeshStandardMaterial({
      color: 0x2c3b29,
      emissive: 0x160a22,
      emissiveIntensity: 0.6,
      roughness: 0.18,
      metalness: 0.25,
    });
    const puddle = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.27, 0.012, 14), puddleMat);
    resG.add(puddle);
    const petalMat = new THREE.MeshStandardMaterial({ color: 0x5c2463, emissive: 0x2a0c30, emissiveIntensity: 0.5, roughness: 0.6 });
    for (let i = 0; i < 5; i++) {
      const petal = new THREE.Mesh(new THREE.DodecahedronGeometry(0.032, 0), petalMat);
      petal.scale.set(1.2, 0.4, 0.9);
      petal.position.set(Math.cos(i * 1.25) * 0.11, 0.012, Math.sin(i * 1.25) * 0.11);
      resG.add(petal);
    }
    group.add(resG);
    anomalyMarkers.arif_residue = resG;
    addAnomalyCollider('arif_residue', 0.56, fy + 0.08, 0.74, 0.62, 0.28, 0.62);

    // 2. Pencere altında çarpık pençe/çamur izleri
    const fpG = new THREE.Group();
    fpG.position.set(-1.55, fy, -0.42);
    const mudMat = new THREE.MeshStandardMaterial({ color: 0x1e1915, roughness: 0.92, metalness: 0.05 });
    for (let step = 0; step < 3; step++) {
      const print = new THREE.Group();
      print.position.set(step * 0.28, 0, (step % 2 === 0 ? -1 : 1) * 0.09);
      print.rotation.y = 0.25;
      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.012, 0.1), mudMat);
      print.add(pad);
      [-0.04, 0, 0.04].forEach((tz) => {
        const claw = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.09, 5), mudMat);
        claw.rotation.z = -Math.PI / 2;
        claw.position.set(0.13, 0.005, tz);
        print.add(claw);
      });
      fpG.add(print);
    }
    group.add(fpG);
    anomalyMarkers.arif_footprints = fpG;
    addAnomalyCollider('arif_footprints', -1.28, fy + 0.08, -0.42, 0.85, 0.28, 0.56);
  } else if (caseId === 'case_mahmut') {
    // 1. Kırık çay bardağı ve yeşilimsi alkaloid tortusu
    const cupG = new THREE.Group();
    cupG.position.set(0.62, fy, 0.76);
    const stain = new THREE.Mesh(
      new THREE.CylinderGeometry(0.21, 0.23, 0.01, 14),
      new THREE.MeshStandardMaterial({ color: 0x263822, roughness: 0.22, metalness: 0.15 }),
    );
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x9ab5ba, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.82 });
    const shard1 = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.09, 4), glassMat);
    shard1.rotation.z = 1.25;
    shard1.position.set(-0.04, 0.025, 0.02);
    const shard2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.015, 0.04), glassMat);
    shard2.rotation.y = 0.7;
    shard2.position.set(0.07, 0.015, -0.05);
    cupG.add(stain, shard1, shard2);
    group.add(cupG);
    anomalyMarkers.mahmut_cup_residue = cupG;
    addAnomalyCollider('mahmut_cup_residue', 0.62, fy + 0.08, 0.76, 0.58, 0.28, 0.58);

    // 2. Sürükleme olukları ve geniş kül ayak izleri
    const dragG = new THREE.Group();
    dragG.position.set(-1.52, fy, -0.34);
    const ashMat = new THREE.MeshStandardMaterial({ color: 0x3b3d40, roughness: 0.94 });
    [-0.12, 0.12].forEach((oz) => {
      const groove = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.01, 0.05), ashMat);
      groove.position.set(0.15, 0.005, oz);
      dragG.add(groove);
    });
    for (let i = 0; i < 2; i++) {
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.014, 0.13), ashMat);
      sole.position.set(i * 0.34, 0.008, i === 0 ? -0.15 : 0.15);
      sole.rotation.y = -0.18;
      dragG.add(sole);
    }
    group.add(dragG);
    anomalyMarkers.mahmut_drag_prints = dragG;
    addAnomalyCollider('mahmut_drag_prints', -1.35, fy + 0.08, -0.34, 0.9, 0.28, 0.6);
  } else {
    // 1. 22:42 donmuş saat camı kırıkları ve zift halkası
    const frostG = new THREE.Group();
    frostG.position.set(0.56, fy, 0.74);
    const pitchRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.19, 0.025, 6, 16),
      new THREE.MeshStandardMaterial({ color: 0x121417, roughness: 0.4, metalness: 0.35 }),
    );
    pitchRing.rotation.x = Math.PI / 2;
    const iceMat = new THREE.MeshStandardMaterial({
      color: 0xaad4e6,
      emissive: 0x224658,
      emissiveIntensity: 0.5,
      roughness: 0.15,
      metalness: 0.3,
    });
    frostG.add(pitchRing);
    for (let i = 0; i < 4; i++) {
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.032, 0), iceMat);
      crystal.scale.set(1.4, 0.35, 0.9);
      crystal.position.set((i - 1.5) * 0.06, 0.018, ((i % 2) - 0.5) * 0.08);
      frostG.add(crystal);
    }
    group.add(frostG);
    anomalyMarkers.unknown_frost_shards = frostG;
    addAnomalyCollider('unknown_frost_shards', 0.56, fy + 0.08, 0.74, 0.58, 0.28, 0.58);

    // 2. Çift tırnaklı kırağı & sis izleri
    const hoofG = new THREE.Group();
    hoofG.position.set(-1.42, fy, -0.26);
    const frostPrintMat = new THREE.MeshStandardMaterial({
      color: 0x99bac8,
      emissive: 0x1b323d,
      emissiveIntensity: 0.45,
      roughness: 0.3,
    });
    for (let i = 0; i < 3; i++) {
      const cleft = new THREE.Group();
      cleft.position.set(i * 0.24, 0.008, (i % 2 === 0 ? -1 : 1) * 0.08);
      const lHalf = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.012, 0.042), frostPrintMat);
      lHalf.position.z = -0.032;
      lHalf.rotation.y = 0.15;
      const rHalf = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.012, 0.042), frostPrintMat);
      rHalf.position.z = 0.032;
      rHalf.rotation.y = -0.15;
      cleft.add(lHalf, rHalf);
      hoofG.add(cleft);
    }
    group.add(hoofG);
    anomalyMarkers.unknown_hoof_tracks = hoofG;
    addAnomalyCollider('unknown_hoof_tracks', -1.2, fy + 0.08, -0.26, 0.8, 0.28, 0.55);
  }

  const cameraPresets: Record<AutopsyCameraAngle, AutopsyCameraPreset> = {
    overview: {
      pos: new THREE.Vector3(0.05, 1.32, 0.96),
      lookAt: new THREE.Vector3(-0.18, 0.14, 0),
    },
    floor: {
      pos: new THREE.Vector3(1.18, Math.max(0.02, floorOffsetY + 0.82), 1.42),
      lookAt: new THREE.Vector3(0.45, floorOffsetY + 0.08, 0.65),
    },
    perimeter: {
      pos: new THREE.Vector3(-1.55, Math.max(0.25, floorOffsetY + 1.05), 0.95),
      lookAt: new THREE.Vector3(-1.25, floorOffsetY + 0.08, -0.32),
    },
  };

  return {
    group,
    drapeMesh,
    incisionGroup,
    neckIncision,
    sampleNodes: {
      chest: chestClue,
      pocket: pocketClue,
    },
    zoneMeshes,
    anomalyMeshes,
    anomalyMarkers,
    examLight,
    flashLight,
    cameraAnchor: cameraPresets.overview.pos.clone(),
    cameraLookAt: cameraPresets.overview.lookAt.clone(),
    cameraPresets,
  };
}
