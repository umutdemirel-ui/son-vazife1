import {
  GlossaryCategory,
  GlossaryEntry,
  INITIAL_GLOSSARY_ENTRIES,
  PlayerGlossaryNote,
} from './glossary';

export type { GlossaryCategory, GlossaryEntry, PlayerGlossaryNote };
export { INITIAL_GLOSSARY_ENTRIES };

export type GameScreen =
  | 'title'
  | 'playing'
  | 'paused'
  | 'ending_peace'
  | 'ending_truth'
  | 'ending_twist'
  | 'game_over';

export type GameAct = 1 | 2 | 3 | 4 | 5;
// Bölüm 1: Kuzdağ'a Geliş, İlk İnceleme & Vaka I (Hacı Arif Efendi)
// Bölüm 2: Sağlık Ocağı, İkinci Ceset (Şoför Mahmut) & Katip Kenan Yüzleşmesi
// Bölüm 3: Dere Köprüsü, Eski Su Değirmeni & Viraj Kaza Alanı
// Bölüm 4: Mezarlık Tepesi, Üçüncü Ceset (İsimsiz Yolcu) & Taş Mahzen
// Bölüm 5: Muhtarlık Sırları, Şafak Öncesi Son Vazife & Final

export type DistrictId = 'square' | 'clinic' | 'mill' | 'cemetery' | 'crash_site';

export type AutopsyCaseId = 'case_arif' | 'case_mahmut' | 'case_unknown';
export type AutopsyTool = 'magnifier' | 'scalpel' | 'forceps' | 'camera';
export type AutopsyCameraAngle = 'overview' | 'floor' | 'perimeter';
export type AutopsyZoneId = 'head' | 'neck' | 'chest' | 'hands' | 'pocket';
export type GraphicsQualityPreset = 'auto' | 'high' | 'medium' | 'low';

export type NpcId = 'bekci' | 'serife' | 'kenan' | 'idris';

export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  collected: boolean;
}

export interface FolkloreRule {
  id: string;
  number: string;
  title: string;
  text: string;
  violated: boolean;
}

export interface ClueDocument {
  id: string;
  title: string;
  subtitle: string;
  body: string;
  discovered: boolean;
}

export interface AutopsyZoneFinding {
  zone: AutopsyZoneId;
  zoneLabel: string;
  externalFound: boolean;
  externalNote: string;
  incised: boolean;
  internalNote: string;
  sampleExtracted: boolean;
  sampleItemName: string;
  requiresScalpel: boolean;
  requiresForceps: boolean;
}

export interface CrimeSceneAnomalyState {
  id: string;
  label: string;
  locationHint: string;
  photographed: boolean;
  photoDataUrl?: string;
  selectedTag: string;
  linkedZone: AutopsyZoneId | '';
  correctTag: string;
  correctZone: AutopsyZoneId;
  tagOptions: string[];
}

export interface AutopsyCaseState {
  id: AutopsyCaseId;
  victimName: string;
  locationLabel: string;
  unlocked: boolean;
  completed: boolean;
  selectedCause: string;
  selectedTime: string;
  diagnosisError: string | null;
  zones: Record<AutopsyZoneId, AutopsyZoneFinding>;
  anomalies: Record<string, CrimeSceneAnomalyState>;
}

export interface DialogueOption {
  id: string;
  label: string;
  nextNodeId: string | null; // null closes dialogue
  requiredClueId?: string;
  requiredCompletedCase?: AutopsyCaseId;
  unlockItemId?: string;
  unlockClueId?: string;
  trustDelta?: number;
  dreadDelta?: number;
  advanceActTo?: GameAct;
  unlockGlossaryIds?: string[];
}

export interface ActiveDialogueState {
  npcId: NpcId;
  speakerName: string;
  speakerRole: string;
  trustLevel: number;
  text: string;
  options: DialogueOption[];
}

export interface ControlSettings {
  mouseSensitivity: number; // 0.4 - 2.4
  invertY: boolean;
  lookSmoothing: boolean;
  crouchToggle: boolean;
  graphicsQuality: GraphicsQualityPreset;
}

export const DEFAULT_CONTROL_SETTINGS: ControlSettings = {
  mouseSensitivity: 1.0,
  invertY: false,
  lookSmoothing: true,
  crouchToggle: true,
  graphicsQuality: 'auto',
};

export interface SaveSummary {
  act: GameAct;
  actTitle: string;
  savedAt: string;
  completedAutopsies: number;
  discoveredClues: number;
}

export interface GameHudState {
  screen: GameScreen;
  act: GameAct;
  actTitle: string;
  objectiveText: string;
  locationName: string;
  currentDistrict: DistrictId;
  discoveredDistricts: DistrictId[];
  isIndoors: boolean;
  candleLit: boolean;
  candleOil: number;
  vigilTimer: number;
  vigilActive: boolean;
  dreadLevel: number;
  stamina: number;
  isCrouching: boolean;
  isSprinting: boolean;
  isZooming: boolean;
  violations: number;
  trustScore: number;
  interactPrompt: string | null;
  captionText: string | null;
  isNotebookOpen: boolean;
  isMuted: boolean;
  isPointerLocked: boolean;
  isHiding: boolean;
  dangerProximity: number;
  windowAnomalyActive: boolean;
  dirtyBasinReady: boolean;
  inventory: InventoryItem[];
  rules: FolkloreRule[];
  clues: ClueDocument[];
  ritualProgress: number; // 0-8
  endingReason: string;
  controlSettings: ControlSettings;
  resolvedQualityTier: 'high' | 'medium' | 'low';
  // New extended systems
  assetLoadPercent: number;
  assetsReady: boolean;
  hasSavedGame: boolean;
  saveSummary: SaveSummary | null;
  saveNoticeText: string | null;
  activeDialogue: ActiveDialogueState | null;
  activeAutopsyCaseId: AutopsyCaseId | null;
  activeAutopsyTool: AutopsyTool;
  activeAutopsyCameraAngle: AutopsyCameraAngle;
  cameraFlashAlpha: number;
  autopsyCases: Record<AutopsyCaseId, AutopsyCaseState>;
  playerMapPos: { x: number; z: number; yaw: number };
  glossaryEntries: GlossaryEntry[];
  playerGlossaryNotes: PlayerGlossaryNote[];
}

export const INITIAL_RULES: FolkloreRule[] = [
  {
    id: 'rule_alone',
    number: 'I',
    title: 'Ölü Yalnız Bırakılmaz',
    text: 'Gusül başladıktan sonra cenaze odada yalnız ve ışıksız bırakılmaz. Dışarı çıkman gerekirse başucunda Sabır Mumunu yak ve gecikmeden dön.',
    violated: false,
  },
  {
    id: 'rule_water',
    number: 'II',
    title: 'Gece Dışarıya Kirli Su Dökülmez',
    text: 'Yıkama suyu gece vakti avluya ya da toprağa dökülmez. Suyu yalnızca gasilhane içindeki taş gidere boşalt.',
    violated: false,
  },
  {
    id: 'rule_window',
    number: 'III',
    title: 'Pencereye Tıklayana Bakılmaz',
    text: 'Gece camda gölge belirir ya da dışarıdan adınla seslenilirse yüzüne bakma. Gözünü çevir ve ahşap kepengi kapat.',
    violated: false,
  },
  {
    id: 'rule_dark',
    number: 'IV',
    title: 'Kara Basma Yaklaşırsa Işığı Söndür',
    text: 'Yağmurlu sokakta fenerin titrer, derinden bir uğultu duyarsan duvar dibine ya da sundurmaya çekil, eğil [C] ve mumunu söndür [F].',
    violated: false,
  },
  {
    id: 'rule_ritual',
    number: 'V',
    title: 'Son Vazife Saygı ve Sırayla Yapılır',
    text: 'Adli otopsi bulguları mühürlendikten sonra setr-i avret örtüsü, sağdan sola ılık su ve sabunla yıkama, kafurlu durulama, gülsuyu ve kefenleme sırayla yapılır.',
    violated: false,
  },
];

export const INITIAL_INVENTORY: InventoryItem[] = [
  {
    id: 'defter',
    name: 'Gassalın Defteri & Mumu',
    description: 'Hacı Arif Efendi’nin el yazması kuralları, pirinç mumu ve adli vaka cetveli.',
    collected: false,
  },
  {
    id: 'kefen',
    name: 'Kefen Bezi',
    description: 'Cami sundurmasındaki sandıktan alınan temiz pamuklu kefen.',
    collected: false,
  },
  {
    id: 'sabun',
    name: 'Zeytinyağlı Sabun & Lif',
    description: 'Köy çeşmesinin taş nişinden alınan doğal sabun.',
    collected: false,
  },
  {
    id: 'ibrik',
    name: 'Bakır İbrik (Ilık Su)',
    description: 'Avlu çeşmesinden doldurulmuş temiz su ibriği.',
    collected: false,
  },
  {
    id: 'clinic_key',
    name: 'Sağlık Ocağı Anahtarı',
    description: 'Bekçi Hasan’ın verdiği paslı pirinç klinik kapı anahtarı.',
    collected: false,
  },
  {
    id: 'gulsuyu',
    name: 'Gülsuyu & Temiz Havlu',
    description: 'Eski köy evindeki sandıktan alınan kurulama havlusu, gülsuyu ve yedek mum yağı.',
    collected: false,
  },
  {
    id: 'mill_toxin',
    name: 'Boğanak Otu Numunesi',
    description: 'Eski Su Değirmeni kıyısından toplanan zehirli kök örneği — toksikoloji kanıtı.',
    collected: false,
  },
  {
    id: 'crypt_key',
    name: 'Taş Mahzen Anahtarı',
    description: 'Mezarcı İdris’in teslim ettiği mezarlık taş mahzen anahtarı.',
    collected: false,
  },
  {
    id: 'kafur',
    name: 'Kafur Kavanozu',
    description: 'Muhtarlık odasından alınan son durulama kafuru.',
    collected: false,
  },
];

export const INITIAL_CLUES: ClueDocument[] = [
  {
    id: 'clue_arif_autopsy',
    title: 'Vaka I Ön Raporu: Hacı Arif',
    subtitle: 'Gasilhane Teneşir İncelemesi',
    body: 'Kalp krizi değil: göz aklarında boğulma peteşisi ve ciğerlerde dere suyu ile acı boğanak izi bulundu. Gasilhane kasasının gizli bölmesi açığa çıktı.',
    discovered: false,
  },
  {
    id: 'clue_mahmut_autopsy',
    title: 'Vaka II Adli Raporu: Şoför Mahmut',
    subtitle: 'Sağlık Ocağı Otopsi Masası',
    body: 'Ölüm saati 21:15 — yani 22:40 viraj kazasından 85 dakika önce! Çay fincanında Boğanak alkaloiti var; minibüs şarampole ölü bir sürücüyle itilmiş.',
    discovered: false,
  },
  {
    id: 'clue_serife_letter',
    title: 'Şerife Nine’nin Yarım Mektubu',
    subtitle: 'Eski Köy Evi · Masa Üstü',
    body: 'Üçüncü gecedir köyün çeşmesi gece yarısı kesiliyor. Pencereye tıkırtı gelince komşular dayanamayıp perdeyi araladı, sabahına kamyonetle şehre indiler. Değirmende zehirli ot kaynatıldığını duymuştum.',
    discovered: false,
  },
  {
    id: 'clue_mill_ledger',
    title: 'Değirmenci Zehir Kaydı & Bilet',
    subtitle: 'Eski Su Değirmeni · Un Sandığı',
    body: 'Kayıt defterinde Katip Kenan’ın el yazısı: "Saat 21:00’de Şoför Mahmut’a demlenen çay içine iki tutam Boğanak katılacak; kaza raporu 22:40’a yazılacak."',
    discovered: false,
  },
  {
    id: 'clue_crash_manifest',
    title: '22:40 Viraj Enkazı Yolcu Listesi',
    subtitle: 'Viraj Kaza Alanı · Minibüs Enkazı',
    body: 'Çamurlu koltuk altından çıkan ıslak manifesto: "Son yolcu: Hacı Arif’in yeğeni. İniş saati 22:42. Sağ kalan yok."',
    discovered: false,
  },
  {
    id: 'clue_unknown_autopsy',
    title: 'Vaka III Raporu: İsimsiz Yolcu',
    subtitle: 'Mezarlık Taş Mahzeni',
    body: 'Bileğindeki saat 22:42’de camı kırık halde durmuş. Cebindeki bilet parçası ve palto kumaşı senin üzerindekiyle birebir aynı.',
    discovered: false,
  },
  {
    id: 'clue_muhtar_note',
    title: 'Muhtarın Son Tutanağı',
    subtitle: 'Tarih: 16 Kasım — 01:15',
    body: 'Kış erken bastırdı. Köyde kalan son üç hane de ilçeye indi. Yukarı virajda tipi yüzünden minibüs şarampole kaydı. Katip Kenan tutanakları değiştirip suçu tipiye attı.',
    discovered: false,
  },
  {
    id: 'clue_photo',
    title: 'Çizilmiş Köy Fotoğrafı',
    subtitle: 'Muhtarlık Duvarı',
    body: 'Cami avlusunda çekilmiş solgun bir fotoğraf. Yüzlerin çoğu siyah mürekkeple kazınmış; yalnızca Hacı Arif, Bekçi Hasan ve yanlarında yakasındaki saati parlayan genç adam duruyor.',
    discovered: false,
  },
  {
    id: 'clue_crash_report',
    title: 'Jandarma Telsiz Kaydı',
    subtitle: 'Muhtarlık Masası · Arka Klasör',
    body: 'Kuzdağ 14. km virajı — 15 Kasım 22:40. Şarampole yuvarlanan minibüste iki ceset bulundu: Şoför Mahmut ve şehirden gelen yeğen. Kayıt notu: "Saat 22:42’de camı kırık, durmuş."',
    discovered: false,
  },
  {
    id: 'clue_torn_page',
    title: 'Defterden Yırtılmış Sayfa',
    subtitle: 'Arif Efendi’nin El Yazısı',
    body: '"Eğer kuralları bozar ve kendi hikâyeni reddedersen, sabah ezanı bu köye doğmaz. Hakikati mühürleyip son vazifeyi tamamlarsan hem Arif’in hem senin ruhun huzura erer."',
    discovered: false,
  },
];
