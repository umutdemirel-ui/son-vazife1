import * as THREE from 'three';
import { CC0AssetLibrary } from './cc0Assets';
import { groundHeightAt } from './terrain';
import {
  AutopsyCaseId,
  AutopsyCaseState,
  ClueDocument,
  DialogueOption,
  GameAct,
  InventoryItem,
  NpcId,
} from './types';

export interface NpcDialogueNode {
  id: string;
  text: string;
  options: DialogueOption[];
}

export interface NpcDefinition {
  id: NpcId;
  name: string;
  role: string;
  coatTint: number;
  waypoints: Array<{ x: number; z: number; pauseSec: number }>;
  hasLantern: boolean;
  hasShovel?: boolean;
  headscarf?: boolean;
  nodes: Record<string, NpcDialogueNode>;
}

export const VILLAGE_NPCS: Record<NpcId, NpcDefinition> = {
  bekci: {
    id: 'bekci',
    name: 'Bekçi Hasan',
    role: 'Gece Bekçisi · Kuzdağ Karakol Emeklisi',
    coatTint: 0x2f3b48,
    hasLantern: true,
    waypoints: [
      { x: -1.8, z: 14.0, pauseSec: 4.5 },
      { x: 1.5, z: -3.5, pauseSec: 4.0 },
      { x: 6.2, z: -18.5, pauseSec: 4.5 },
      { x: 1.8, z: 3.5, pauseSec: 3.5 },
    ],
    nodes: {
      root: {
        id: 'root',
        text: 'Hoş geldin evlat. Hava tipiye dönmeden Hacı Arif Amca’nın yanına geçmen iyi oldu. Ama dikkat et — bu gece rüzgâr bile başka esiyor.',
        options: [
          {
            id: 'ask_village',
            label: 'Köy neden bu kadar boş? Diğerleri nerede?',
            nextNodeId: 'village_empty',
            trustDelta: 4,
            unlockGlossaryIds: ['lore_bekci_shadows'],
          },
          {
            id: 'ask_arif_autopsy',
            label: '[Adli Kanıt] Hacı Arif kalp krizinden ölmemiş — ciğerlerinde dere suyu ve zehir var.',
            nextNodeId: 'arif_reaction',
            requiredCompletedCase: 'case_arif',
            unlockItemId: 'clinic_key',
            trustDelta: 12,
            advanceActTo: 2,
          },
          {
            id: 'ask_mahmut_autopsy',
            label: '[Otopsi Raporu] Şoför Mahmut kazadan 85 dakika önce zehirlenmiş!',
            nextNodeId: 'mahmut_reaction',
            requiredCompletedCase: 'case_mahmut',
            trustDelta: 10,
            advanceActTo: 3,
            unlockGlossaryIds: ['lore_bekci_breath'],
          },
          {
            id: 'leave',
            label: 'Şimdi gitmem gerek, gözün kulağın açık olsun.',
            nextNodeId: null,
          },
        ],
      },
      village_empty: {
        id: 'village_empty',
        text: 'Üç gün önce çeşme geceleri kesilmeye başladı. Önce Şoför Mahmut’un minibüsü yukarı virajda uçtu dediler, ertesi sabah köydeki son üç hane kamyonete doluşup indi. Kalan bir tek Şerife Nine, Katip Kenan, Mezarcı İdris, bir de ben varım.',
        options: [
          {
            id: 'ask_crash',
            label: 'Minibüs virajdan nasıl düştü? Yolcu var mıydı?',
            nextNodeId: 'crash_detail',
          },
          {
            id: 'back_root',
            label: 'Diğer konulara dön',
            nextNodeId: 'root',
          },
        ],
      },
      crash_detail: {
        id: 'crash_detail',
        text: '22:40 sularında tipi göz gözü görmüyordu. Katip Kenan “tek şoför vardı” diye tutanak yazdı ama ben o gece iki gölge gördüm. Merak ediyorsan Sağlık Ocağındaki ikinci masaya bakman gerek.',
        options: [
          {
            id: 'back_root',
            label: 'Anladım, dikkat edeceğim.',
            nextNodeId: 'root',
          },
        ],
      },
      arif_reaction: {
        id: 'arif_reaction',
        text: 'Ne diyorsun sen?! Arif Hoca akşamüstü değirmene doğru yürümüştü... Kenan “kalp” deyip gasilhaneye kapattırdı. Al bu pirinç anahtarı: Yukarı Mahalle’deki Sağlık Ocağında Şoför Mahmut’un bedeni de duruyor. Onu da incele!',
        options: [
          {
            id: 'go_clinic',
            label: 'Sağlık Ocağı Anahtarını al ve oraya doğru yola çık.',
            nextNodeId: null,
          },
        ],
      },
      mahmut_reaction: {
        id: 'mahmut_reaction',
        text: 'Demek Kenan herkesi kandırdı! Eğer zehir Boğanak otuysa bu ot sadece batıdaki Dere Köprüsünün ötesinde, Eski Su Değirmeni kıyısında yetişir. Dereyi geçerken Kara Basma’ya yakalanma — ışığını söndürüp eğil!',
        options: [
          {
            id: 'close_bekci',
            label: 'Değirmene ve viraja bakacağım. Sağ ol Bekçi Amca.',
            nextNodeId: null,
          },
        ],
      },
    },
  },
  serife: {
    id: 'serife',
    name: 'Şerife Nine',
    role: 'Köyün Son Yaşlısı · Eski Köy Evi Avlusu',
    coatTint: 0x4c362e,
    hasLantern: false,
    headscarf: true,
    waypoints: [
      { x: -6.4, z: -10.5, pauseSec: 9.0 },
      { x: -5.8, z: -9.4, pauseSec: 6.5 },
    ],
    nodes: {
      root: {
        id: 'root',
        text: 'Evladım... yüzün neden o kadar solgun? Üşümüşsün, ellerin buz gibi. Geceleri bu sokakta tek başına dolaşma, pencereye tıklayan olursa sakın bakma.',
        options: [
          {
            id: 'ask_folklore',
            label: 'Hacı Arif’in defterindeki kurallar gerçekten doğru mu?',
            nextNodeId: 'folklore_advice',
            trustDelta: 5,
            unlockGlossaryIds: ['lore_serife_window', 'lore_serife_water'],
          },
          {
            id: 'ask_boganak',
            label: '[Otopsi Bulgusu] Bedenlerde Boğanak zehri buldum — köyde kim toplar bunu?',
            nextNodeId: 'boganak_story',
            requiredCompletedCase: 'case_arif',
            trustDelta: 8,
            unlockGlossaryIds: ['lore_serife_boganak'],
          },
          {
            id: 'ask_identity',
            label: '[Mahzen Gerçeği] Taş mahzende duran 22:42 saatli yolcu kim?',
            nextNodeId: 'truth_whisper',
            requiredCompletedCase: 'case_unknown',
            trustDelta: 10,
          },
          {
            id: 'leave',
            label: 'Allah’a emanet ol Nine, işime dönmem lazım.',
            nextNodeId: null,
          },
        ],
      },
      folklore_advice: {
        id: 'folklore_advice',
        text: 'Ölü bekletilmez evlat, Sabır Mumunu yakmadan kapıdan çıkma. Kirli yıkama suyunu gece toprağa dökersen eşiktekiler uyanır. Kara Basma uğultuyla gelirse eğil ve mumunu üfle.',
        options: [
          {
            id: 'back',
            label: 'Aklımda tutacağım.',
            nextNodeId: 'root',
          },
        ],
      },
      boganak_story: {
        id: 'boganak_story',
        text: 'Eski Su Değirmeninin arkasında mor çiçek açar Boğanak... Eskiden deli danayı uyutmak için bir damla kaynatırlardı. İki gece önce Katip Kenan’ı elinde bakır tasla değirmenden çıkarken gördüm.',
        options: [
          {
            id: 'back',
            label: 'Değirmende iz bulabilirim demek.',
            nextNodeId: 'root',
          },
        ],
      },
      truth_whisper: {
        id: 'truth_whisper',
        text: 'Sen... yukarı virajdan yürüyerek geldiğini sanıyorsun, değil mi? Oysa minibüs 22:40’ta uçuruma yuvarlandığında Hacı Arif seni son vazifesini tamamlayamadan çağırmış gibi ruhun köye düştü. Vazifeyi bitir ki şafak söksün.',
        options: [
          {
            id: 'close',
            label: 'Son vazifeyi tamamlayacağım.',
            nextNodeId: null,
          },
        ],
      },
    },
  },
  kenan: {
    id: 'kenan',
    name: 'Katip Kenan',
    role: 'Muhtarlık Katibi & Sağlık Memuru',
    coatTint: 0x3b352d,
    hasLantern: true,
    waypoints: [
      { x: 6.2, z: -17.5, pauseSec: 5.5 },
      { x: 16.5, z: -23.5, pauseSec: 5.0 },
      { x: 21.0, z: -26.5, pauseSec: 5.5 },
    ],
    nodes: {
      root: {
        id: 'root',
        text: 'Gassal yardımcısı! İşini sessizce yap, sabah jandarma yolu açınca raporları alıp gideceğiz. Eski kayıtlara burnunu sokmana hiç gerek yok.',
        options: [
          {
            id: 'ask_report',
            label: '22:40 viraj kazasında neden tutanaklar eksik görünüyor?',
            nextNodeId: 'defensive_reply',
            dreadDelta: 4,
          },
          {
            id: 'confront_mahmut',
            label: '[Otopsi + Değirmen Kanıtı] Mahmut kazadan 85 dakika önce zehirlendi! El yazın değirmen defterinde!',
            nextNodeId: 'kenan_breakdown',
            requiredClueId: 'clue_mill_ledger',
            requiredCompletedCase: 'case_mahmut',
            trustDelta: -10,
            dreadDelta: 12,
            advanceActTo: 4,
          },
          {
            id: 'leave',
            label: 'Şimdilik bu kadar yeter.',
            nextNodeId: null,
          },
        ],
      },
      defensive_reply: {
        id: 'defensive_reply',
        text: 'Tipide evrak mı tutulurmuş?! Şoför Mahmut direksiyonu kırdı, o kadar. Gasilhanede işin bittiyse kapıyı kapa ve sabahı bekle.',
        options: [
          {
            id: 'back',
            label: 'Göreceğiz bakalım.',
            nextNodeId: 'root',
          },
        ],
      },
      kenan_breakdown: {
        id: 'kenan_breakdown',
        text: 'Sus... sus artık! Mahmut şehre gidip köyün su şebekesindeki kaçak hafriyatı ve kaybolan paraları ihbar edecekti! Hacı Arif de çeşmede konuşurken duydu. İkisini susturmak zorundaydım... ama 22:40’ta minibüse binen sen — senin ölmeni istememiştim! Mezarlık Tepesindeki İdris’e git, üçüncü bedeni oraya sakladık!',
        options: [
          {
            id: 'close_kenan',
            label: 'Mezarlık Tepesine çıkıp gerçeği göreceğim!',
            nextNodeId: null,
          },
        ],
      },
    },
  },
  idris: {
    id: 'idris',
    name: 'Mezarcı İdris',
    role: 'Mezarlık Tepesi Bekçisi',
    coatTint: 0x262925,
    hasLantern: true,
    hasShovel: true,
    waypoints: [
      { x: -27.5, z: -31.5, pauseSec: 6.0 },
      { x: -31.0, z: -35.5, pauseSec: 6.5 },
    ],
    nodes: {
      root: {
        id: 'root',
        text: 'Toprak bu gece çok sert... Kazma bile girmiyor. Buraya neden çıktın yabancı? Mezarlık gece yaşayanlara göre değil.',
        options: [
          {
            id: 'ask_grave',
            label: 'Yeni kazılmış mezar kimin için hazırlandı?',
            nextNodeId: 'grave_talk',
            unlockGlossaryIds: ['lore_idris_soil'],
          },
          {
            id: 'demand_crypt',
            label: '[Kenan İtirafı] Katip Kenan üçüncü bedeni Taş Mahzene koyduğunuzu söyledi. Anahtarı ver!',
            nextNodeId: 'give_crypt_key',
            requiredCompletedCase: 'case_mahmut',
            unlockItemId: 'crypt_key',
            trustDelta: 6,
          },
          {
            id: 'leave',
            label: 'Geri dönüyorum.',
            nextNodeId: null,
          },
        ],
      },
      grave_talk: {
        id: 'grave_talk',
        text: 'Sabaha karşı iki tabut gömülecek sandım ama Kenan üçüncü bir çukur daha kazdırdı. “Kimliği belirsiz yolcu” dedi, soğuk taş mahzene kilitledi.',
        options: [
          {
            id: 'back',
            label: 'Mahzeni açmam gerekecek.',
            nextNodeId: 'root',
          },
        ],
      },
      give_crypt_key: {
        id: 'give_crypt_key',
        text: 'Demek Kenan çözüldü... Al mahzenin demir anahtarını. İçerideki masada yatan yolcunun cebine bakınca kendi gözlerine inanamayacaksın. Allah taksiratını affetsin.',
        options: [
          {
            id: 'close_idris',
            label: 'Taş Mahzen Anahtarını al ve içeri gir.',
            nextNodeId: null,
          },
        ],
      },
    },
  },
};

export interface NpcRuntimeActor {
  def: NpcDefinition;
  root: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  idleAction: THREE.AnimationAction | null;
  walkAction: THREE.AnimationAction | null;
  currentMode: 'idle' | 'walk';
  waypointIndex: number;
  pauseTimer: number;
  animAccum?: number;
  pos: THREE.Vector3;
  yaw: number;
  talkCooldown: number;
  spokenNodes: Set<string>;
  trust: number;
  cc0Attached: boolean;
  fallbackGroup: THREE.Group;
}

export function buildProceduralVillagerFallback(coatColor: number, hasLantern: boolean, hasShovel?: boolean, headscarf?: boolean): THREE.Group {
  const g = new THREE.Group();
  const coatMat = new THREE.MeshStandardMaterial({ color: coatColor, roughness: 0.85, metalness: 0.05 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xc9a98e, roughness: 0.72 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e1d1b, roughness: 0.9 });

  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.82, 8), darkMat);
  legs.position.y = 0.41;
  legs.castShadow = true;

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.25, 0.68, 10), coatMat);
  torso.position.y = 1.12;
  torso.castShadow = true;

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), skinMat);
  head.position.y = 1.62;
  head.castShadow = true;

  g.add(legs, torso, head);

  if (headscarf) {
    const scarf = new THREE.Mesh(new THREE.SphereGeometry(0.155, 10, 10), new THREE.MeshStandardMaterial({ color: 0xdfd8c8, roughness: 0.9 }));
    scarf.position.set(0, 1.64, -0.02);
    g.add(scarf);
  } else {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.15, 0.09, 10), darkMat);
    cap.position.y = 1.73;
    g.add(cap);
  }

  if (hasLantern) {
    const lanternLight = new THREE.PointLight(0xffac52, 2.2, 8.0, 1.7);
    lanternLight.position.set(0.28, 1.05, 0.25);
    const bulb = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.14, 8), new THREE.MeshBasicMaterial({ color: 0xffd07a }));
    bulb.position.set(0.28, 1.05, 0.25);
    g.add(lanternLight, bulb);
  }

  if (hasShovel) {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.35, 6), coatMat);
    shaft.position.set(-0.28, 0.85, 0.1);
    shaft.rotation.z = 0.18;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, 0.02), darkMat);
    blade.position.set(-0.4, 0.2, 0.1);
    g.add(shaft, blade);
  }

  return g;
}

export function attachCC0RigToNpc(actor: NpcRuntimeActor, cc0: CC0AssetLibrary): void {
  if (actor.cc0Attached) return;
  const cloned = cc0.cloneSkinnedNpc('soldier', 1.72);
  if (!cloned) return;

  cloned.model.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh && mesh.material) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => {
        if (m instanceof THREE.MeshStandardMaterial) {
          m.color.lerp(new THREE.Color(actor.def.coatTint), 0.55);
          m.roughness = Math.max(0.45, m.roughness);
        }
      });
    }
  });

  actor.fallbackGroup.visible = false;
  actor.root.add(cloned.root);

  const mixer = new THREE.AnimationMixer(cloned.model);
  const idleClip =
    THREE.AnimationClip.findByName(cloned.clips, 'Idle') ?? cloned.clips[0] ?? null;
  const walkClip =
    THREE.AnimationClip.findByName(cloned.clips, 'Walk') ??
    THREE.AnimationClip.findByName(cloned.clips, 'Run') ??
    null;

  actor.mixer = mixer;
  actor.idleAction = idleClip ? mixer.clipAction(idleClip) : null;
  actor.walkAction = walkClip ? mixer.clipAction(walkClip) : null;
  if (actor.idleAction) {
    actor.idleAction.play();
  }
  if (actor.walkAction) {
    actor.walkAction.play();
    actor.walkAction.setEffectiveWeight(0);
  }
  actor.cc0Attached = true;
}

export function filterDialogueOptions(
  options: DialogueOption[],
  clues: ClueDocument[],
  autopsyCases: Record<AutopsyCaseId, AutopsyCaseState>,
  inventory: InventoryItem[],
): DialogueOption[] {
  return options.filter((opt) => {
    if (opt.requiredClueId) {
      const c = clues.find((cl) => cl.id === opt.requiredClueId);
      if (!c || !c.discovered) return false;
    }
    if (opt.requiredCompletedCase) {
      const ac = autopsyCases[opt.requiredCompletedCase];
      if (!ac || !ac.completed) return false;
    }
    if (opt.unlockItemId) {
      const inv = inventory.find((i) => i.id === opt.unlockItemId);
      if (inv?.collected) return false;
    }
    return true;
  });
}

export function updateNpcActorPatrol(
  actor: NpcRuntimeActor,
  dt: number,
  playerPos: THREE.Vector3,
  isTalkingToThisNpc: boolean,
  elapsedTime: number,
): void {
  const distToPlayer = actor.pos.distanceTo(playerPos);

  if (actor.mixer) {
    if (distToPlayer < 18) {
      actor.mixer.update(dt);
    } else if (distToPlayer < 42) {
      const accum = (actor.animAccum ?? 0) + dt;
      if (accum >= 0.065) {
        actor.mixer.update(accum);
        actor.animAccum = 0;
      } else {
        actor.animAccum = accum;
      }
    }
  }

  if (isTalkingToThisNpc || distToPlayer < 2.9) {
    // Face player politely and idle
    const targetYaw = Math.atan2(playerPos.x - actor.pos.x, playerPos.z - actor.pos.z);
    let diff = targetYaw - actor.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    actor.yaw += diff * Math.min(1, dt * 6);
    actor.root.rotation.y = actor.yaw;
    setNpcAnimMode(actor, 'idle', dt);
    return;
  }

  if (actor.pauseTimer > 0) {
    actor.pauseTimer -= dt;
    setNpcAnimMode(actor, 'idle', dt);
    // Subtle idle breathing bob on fallback
    if (!actor.cc0Attached) {
      actor.fallbackGroup.position.y = Math.sin(elapsedTime * 2.1 + actor.waypointIndex) * 0.015;
    }
    return;
  }

  const wp = actor.def.waypoints[actor.waypointIndex];
  const dx = wp.x - actor.pos.x;
  const dz = wp.z - actor.pos.z;
  const dist = Math.hypot(dx, dz);

  if (dist < 0.35) {
    actor.pauseTimer = wp.pauseSec;
    actor.waypointIndex = (actor.waypointIndex + 1) % actor.def.waypoints.length;
    setNpcAnimMode(actor, 'idle', dt);
    return;
  }

  const speed = 1.35;
  actor.pos.x += (dx / dist) * speed * dt;
  actor.pos.z += (dz / dist) * speed * dt;
  actor.pos.y = groundHeightAt(actor.pos.x, actor.pos.z);
  actor.root.position.copy(actor.pos);

  const targetYaw = Math.atan2(dx, dz);
  let diff = targetYaw - actor.yaw;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  actor.yaw += diff * Math.min(1, dt * 5);
  actor.root.rotation.y = actor.yaw;

  setNpcAnimMode(actor, 'walk', dt);
  if (!actor.cc0Attached) {
    actor.fallbackGroup.position.y = Math.abs(Math.sin(elapsedTime * 6.5)) * 0.04;
  }
}

function setNpcAnimMode(actor: NpcRuntimeActor, mode: 'idle' | 'walk', dt: number): void {
  actor.currentMode = mode;
  if (!actor.idleAction || !actor.walkAction) return;
  const targetWalk = mode === 'walk' ? 1 : 0;
  const curWalk = actor.walkAction.getEffectiveWeight();
  const nextWalk = THREE.MathUtils.damp(curWalk, targetWalk, 7, dt);
  actor.walkAction.setEffectiveWeight(nextWalk);
  actor.idleAction.setEffectiveWeight(1 - nextWalk);
}
