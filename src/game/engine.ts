import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { HorrorAudioEngine } from './audio';
import {
  AUTOPSY_ANOMALY_LAYER,
  AUTOPSY_DIAGNOSIS,
  AUTOPSY_LAYER,
  createInitialAutopsyCases,
} from './autopsy';
import { CC0AssetLibrary } from './cc0Assets';
import { DreadLevelListener, SpatialDreadTrigger } from './dreadListener';
import { createHandCandle, HandCandleRefs } from './models';
import {
  filterDialogueOptions,
  updateNpcActorPatrol,
  VILLAGE_NPCS,
} from './npcs';
import { createPostProcessing, PostProcessingRig } from './postprocessing';
import {
  getAutoSaveSummary,
  readAutoSave,
  SaveGamePayload,
  writeAutoSave,
} from './saveSystem';
import { groundHeightAt } from './terrain';
import { createProceduralTextures, ProceduralTextureSet } from './textures';
import {
  ActiveDialogueState,
  AutopsyCameraAngle,
  AutopsyCaseId,
  AutopsyCaseState,
  AutopsyTool,
  AutopsyZoneId,
  ClueDocument,
  ControlSettings,
  DEFAULT_CONTROL_SETTINGS,
  DistrictId,
  FolkloreRule,
  GameAct,
  GameHudState,
  GameScreen,
  GlossaryCategory,
  GlossaryEntry,
  GraphicsQualityPreset,
  INITIAL_CLUES,
  INITIAL_GLOSSARY_ENTRIES,
  INITIAL_INVENTORY,
  INITIAL_RULES,
  InventoryItem,
  NpcId,
  PlayerGlossaryNote,
  SaveSummary,
} from './types';
import { buildVillageWorld, VirtualPointLight, WorldHandles } from './world';

// Module-scope reusable math objects (Zero GC inside render loop)
const _vec3 = new THREE.Vector3();
const _vec3b = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();
const _centerNdc = new THREE.Vector2(0, 0);
const _pointerNdc = new THREE.Vector2(0, 0);
const _morgueWindowPos = new THREE.Vector3();
const _whisperBaseEmissive = new THREE.Color(0x1a2634);
const _whisperAnomalyEmissive = new THREE.Color(0x3b6678);
const _autopsyCamPos = new THREE.Vector3();
const _autopsyLookPos = new THREE.Vector3();

const PLAYER_EYE_HEIGHT = 1.66;
const PLAYER_RADIUS = 0.42;

export const SPATIAL_DREAD_TRIGGERS: SpatialDreadTrigger[] = [
  {
    id: 'gasilhane_hall',
    zoneName: 'Gasilhane (Gusül Odası)',
    centerX: -10.5,
    centerZ: 6.0,
    radius: 4.5,
    bounds: { minX: -13.9, maxX: -7.1, minZ: 2.8, maxZ: 9.2 },
    dreadThreshold: 70,
    minStationarySec: 1.8,
    cooldownSec: 18,
    hallucinations: ['whisper', 'floorboard_creak'],
    captions: {
      whisper: [
        'Gasilhanenin soğuk duvarlarından fısıltılar yükseliyor...',
        'Mermer taşın arkasından kısık bir nefes duyuldu...',
      ],
      floorboard_creak: [
        'Tavandaki eski ahşap kirişler ağır bir yükle inledi...',
      ],
    },
  },
  {
    id: 'abandoned_house_floor',
    zoneName: 'Eski Köy Evi',
    centerX: -10.8,
    centerZ: -10.5,
    radius: 4.0,
    bounds: { minX: -13.8, maxX: -7.8, minZ: -13.3, maxZ: -7.7 },
    dreadThreshold: 70,
    minStationarySec: 1.5,
    cooldownSec: 16,
    hallucinations: ['floorboard_creak', 'whisper'],
    captions: {
      floorboard_creak: [
        'Çürümüş döşeme tahtaları sanki birinin ağırlığıyla gıcırdadı...',
        'Arka köşedeki bir tahta kendi kendine esnedi...',
      ],
      whisper: [
        'Karanlık odanın köşesinden boğuk bir fısıltı yükseldi...',
      ],
    },
  },
  {
    id: 'muhtar_office_boards',
    zoneName: 'Muhtarlık Odası',
    centerX: 10.5,
    centerZ: -18.0,
    radius: 4.2,
    bounds: { minX: 7.3, maxX: 13.7, minZ: -21.0, maxZ: -15.0 },
    dreadThreshold: 70,
    minStationarySec: 1.8,
    cooldownSec: 18,
    hallucinations: ['floorboard_creak', 'whisper'],
    captions: {
      floorboard_creak: [
        'Arka odanın ahşap tabanı yavaşça gıcırdadı...',
      ],
      whisper: [
        'Dolabın ardından adını fısıldayan bir ses duydun...',
      ],
    },
  },
  {
    id: 'clinic_morgue_room',
    zoneName: 'Sağlık Ocağı',
    centerX: 26.0,
    centerZ: -28.0,
    radius: 4.6,
    bounds: { minX: 22.3, maxX: 29.7, minZ: -31.3, maxZ: -24.7 },
    dreadThreshold: 70,
    minStationarySec: 1.8,
    cooldownSec: 19,
    hallucinations: ['whisper'],
    captions: {
      whisper: [
        'Ecza dolaplarının ardından kesik bir fısıltı duydun...',
        'Koridorda sanki biri adını sayıkladı...',
      ],
    },
  },
  {
    id: 'watermill_timber_loft',
    zoneName: 'Eski Su Değirmeni',
    centerX: -36.0,
    centerZ: 8.0,
    radius: 4.2,
    bounds: { minX: -39.1, maxX: -32.9, minZ: 5.1, maxZ: 10.9 },
    dreadThreshold: 70,
    minStationarySec: 1.4,
    cooldownSec: 16,
    hallucinations: ['floorboard_creak', 'whisper'],
    captions: {
      floorboard_creak: [
        'Çark uğultusunun altında tahta kirişler inledi...',
      ],
      whisper: [
        'Su sesinin içine karışan soğuk bir fısıltı duydun...',
      ],
    },
  },
  {
    id: 'cemetery_stone_crypt',
    zoneName: 'Mezarlık Taş Mahzen',
    centerX: -32.4,
    centerZ: -39.2,
    radius: 7.5,
    dreadThreshold: 70,
    minStationarySec: 1.6,
    cooldownSec: 20,
    hallucinations: ['whisper'],
    captions: {
      whisper: [
        'Taş mahzenin nemli havasından adını fısıldayan bir ses geldi...',
        'Mezar taşlarının arasından boğuk bir fısıltı yükseldi...',
      ],
    },
  },
  {
    id: 'creek_bridge_planks',
    zoneName: 'Dere Köprüsü',
    centerX: -24.0,
    centerZ: 8.0,
    radius: 3.8,
    bounds: { minX: -27.4, maxX: -20.6, minZ: 6.4, maxZ: 9.6 },
    dreadThreshold: 70,
    minStationarySec: 1.4,
    cooldownSec: 17,
    hallucinations: ['floorboard_creak'],
    captions: {
      floorboard_creak: [
        'Köprü kalasları tam arkanda ağır bir adımla gıcırdadı...',
      ],
    },
  },
];

export class SonVazifeEngine {
  private container: HTMLElement;
  private onHudUpdate: (hud: GameHudState) => void;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private textures!: ProceduralTextureSet;
  private cc0 = new CC0AssetLibrary();
  private world!: WorldHandles;
  private handCandle!: HandCandleRefs;
  private postProcessing: PostProcessingRig | null = null;
  private audio = new HorrorAudioEngine();

  private isSoftwareGl = false;
  private isLowEndHardware = false;
  private isContextLost = false;
  private envTexture: THREE.Texture | null = null;
  private frameId = 0;
  private disposed = false;
  private clock = new THREE.Clock();
  private elapsedTime = 0;

  // Asset Loading & Auto-save UI state
  private assetLoadPercent = 0;
  private assetsReady = false;
  private hasSavedGame = false;
  private saveSummary: SaveSummary | null = null;
  private saveNoticeText: string | null = null;
  private saveNoticeTimeout = 0;

  // Player state & refined controls
  private playerPos = new THREE.Vector3(0, 0, 23.0);
  private playerVel = new THREE.Vector3();
  private yaw = 0;
  private pitch = -0.04;
  private targetYaw = 0;
  private targetPitch = -0.04;
  private cameraRoll = 0;
  private headBobPhase = 0;
  private stamina = 100;
  private staminaExhausted = false;
  private crouchToggled = false;
  private isCrouching = false;
  private isSprinting = false;
  private isZooming = false;
  private rightMouseDown = false;
  private keys: Record<string, boolean> = {};
  private virtualMoveX = 0;
  private virtualMoveY = 0;
  private virtualSprint = false;
  private isDraggingLook = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private isPointerLocked = false;
  private lastPointerLockExitTime = -2000;
  private controlSettings: ControlSettings = { ...DEFAULT_CONTROL_SETTINGS };

  // Game Progression State
  private screen: GameScreen = 'title';
  private act: GameAct = 1;
  private inventory: InventoryItem[] = [];
  private rules: FolkloreRule[] = [];
  private clues: ClueDocument[] = [];
  private glossaryEntries: GlossaryEntry[] = [];
  private playerGlossaryNotes: PlayerGlossaryNote[] = [];
  private discoveredDistricts = new Set<DistrictId>(['square']);
  private trustScore = 50;

  // Doors & Shutters
  private gasilDoorOpen = false;
  private gasilDoorAngle = 0;
  private muhtarDoorOpen = false;
  private muhtarDoorAngle = 0;
  private abandonedDoorOpen = false;
  private abandonedDoorAngle = 0;
  private clinicDoorOpen = false;
  private clinicDoorAngle = 0;
  private millDoorOpen = false;
  private millDoorAngle = 0;
  private cryptDoorOpen = false;
  private cryptDoorAngle = 0;
  private shutterClosed = false;
  private shutterAngle = Math.PI * 0.62;

  private candleLit = false;
  private candleOil = 100;
  private vigilLit = false;
  private vigilTimer = 180;
  private dreadLevel = 8; // 0..100
  private dangerProximity = 0; // 0..1
  private violations = 0;

  // Ritual flags
  private stepPrepDone = false;
  private stepWashDone = false;
  private dirtyBasinReady = false;
  private dirtyBasinDrained = false;
  private gasilBulbOut = false;
  private stepFinalCamphorDone = false;
  private stepDryDone = false;
  private stepShroudDone = false;

  // Autopsy Workbench State
  private autopsyCases: Record<AutopsyCaseId, AutopsyCaseState> = createInitialAutopsyCases();
  private activeAutopsyCaseId: AutopsyCaseId | null = null;
  private activeAutopsyTool: AutopsyTool = 'magnifier';
  private activeAutopsyCameraAngle: AutopsyCameraAngle = 'overview';
  private hoveredAutopsyZone: AutopsyZoneId | null = null;
  private hoveredAutopsyAnomalyId: string | null = null;
  private cameraFlashAlpha = 0;
  private autopsyPanOffset = { x: 0, y: 0 };
  private autopsyCamPos = new THREE.Vector3();
  private autopsyLookTarget = new THREE.Vector3();
  private snapshotCanvas: HTMLCanvasElement | null = null;

  // Dynamic Adaptive FPS & Quality Controller
  private resolvedQualityTier: 'high' | 'medium' | 'low' = 'medium';
  private emaFrameMs = 16.7;
  private qualityEvalTimer = 0;
  private shadowFrameCounter = 0;
  private shadowRefreshStride = 3;
  private lightCullDistSq = 21 * 21;
  private maxPoolLights = 4;
  private lastAppliedQualityKey = '';

  // Modular Dread Listener & Zero-GC Loop Caches
  private dreadListener = new DreadLevelListener();
  private hallucinationPulse = 0;
  private lastHallucinationCaptionTime = -20;
  private raycastTimer = 0;
  private npcKeys: NpcId[] = [];
  private _rayHits: THREE.Intersection[] = [];
  private _topLights: Array<VirtualPointLight | null> = [null, null, null, null];
  private _topDistSq: number[] = [Infinity, Infinity, Infinity, Infinity];

  // Dialogue State
  private activeDialogueNpcId: NpcId | null = null;
  private activeDialogueNodeId: string | null = null;

  // Anomaly & Horror Director
  private windowAnomalyActive = false;
  private windowStareTimer = 0;
  private windowAnomalyResolved = false;
  private nextWindowWhisperTime = 4;
  private windowWhisperFxTimer = 0;
  private windowWhisperFxDuration = 1.6;
  private windowWhisperVariant = 0;
  private windowWhisperNextCaptionTime = 0;
  private leftGasilWithoutVigilFlagged = false;
  private stormFlashIntensity = 0;
  private nextThunderTime = 14;
  private karaPatrolT = 0;
  private sisPatrolT = 0;
  private karaCatchCooldown = 0;
  private caughtCount = 0;
  private endingReason = '';

  // UI Sync
  private isNotebookOpen = false;
  private captionText: string | null = null;
  private captionTimeout = 0;
  private activeInteractId: string | null = null;
  private activeInteractLabel: string | null = null;
  private lastHudPush = 0;

  constructor(container: HTMLElement, onHudUpdate: (hud: GameHudState) => void) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;
    this.setupDreadListener();
    this.loadControlSettings();
    this.refreshSaveMeta();
    this.resetStoryState();
    this.initThree();
    this.bindEvents();
    this.startLoop();
  }

  private setupDreadListener(): void {
    this.dreadListener.registerTriggers(SPATIAL_DREAD_TRIGGERS);
    this.dreadListener.subscribe((event) => {
      if (event.type === 'whisper') {
        this.audio.playWhisper(0.85);
        this.unlockGlossaryEntry('anom_window');
      } else {
        this.audio.playFloorboardCreak(0.95);
      }

      this.hallucinationPulse = 0.24;

      if (!this.captionText && this.elapsedTime - this.lastHallucinationCaptionTime >= 14) {
        this.lastHallucinationCaptionTime = this.elapsedTime;
        const hint =
          event.caption ??
          (event.type === 'whisper'
            ? 'Karanlığın içinden boğuk bir fısıltı yükseldi...'
            : 'Altındaki ahşap döşeme ansızın gıcırdadı...');
        this.showCaption(hint, 3.6);
      }
    });
  }

  private refreshSaveMeta(): void {
    this.saveSummary = getAutoSaveSummary();
    this.hasSavedGame = this.saveSummary !== null;
  }

  private loadControlSettings(): void {
    try {
      const raw = window.localStorage.getItem('son_vazife_controls_v1');
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ControlSettings>;
        const q = parsed.graphicsQuality;
        const validQuality: GraphicsQualityPreset =
          q === 'auto' || q === 'high' || q === 'medium' || q === 'low'
            ? q
            : DEFAULT_CONTROL_SETTINGS.graphicsQuality;
        this.controlSettings = {
          mouseSensitivity:
            typeof parsed.mouseSensitivity === 'number'
              ? THREE.MathUtils.clamp(parsed.mouseSensitivity, 0.4, 2.4)
              : DEFAULT_CONTROL_SETTINGS.mouseSensitivity,
          invertY: Boolean(parsed.invertY),
          lookSmoothing:
            typeof parsed.lookSmoothing === 'boolean'
              ? parsed.lookSmoothing
              : DEFAULT_CONTROL_SETTINGS.lookSmoothing,
          crouchToggle:
            typeof parsed.crouchToggle === 'boolean'
              ? parsed.crouchToggle
              : DEFAULT_CONTROL_SETTINGS.crouchToggle,
          graphicsQuality: validQuality,
        };
      }
    } catch {
      this.controlSettings = { ...DEFAULT_CONTROL_SETTINGS };
    }
  }

  public updateControlSettings(patch: Partial<ControlSettings>): void {
    this.controlSettings = {
      ...this.controlSettings,
      ...patch,
    };
    if (!this.controlSettings.crouchToggle) {
      this.crouchToggled = false;
    }
    try {
      window.localStorage.setItem('son_vazife_controls_v1', JSON.stringify(this.controlSettings));
    } catch {
      // Ignore storage restrictions
    }
    this.syncQualityTierFromSettings();
    this.pushHudState(true);
  }

  private syncQualityTierFromSettings(): void {
    if (this.isSoftwareGl) {
      this.applyGraphicsQuality('low');
      return;
    }
    const preset = this.controlSettings.graphicsQuality;
    if (preset === 'auto') {
      this.qualityEvalTimer = 0;
      this.applyGraphicsQuality(this.resolvedQualityTier);
    } else {
      this.applyGraphicsQuality(preset);
    }
  }

  private applyGraphicsQuality(tier: 'high' | 'medium' | 'low'): void {
    if (!this.renderer || !this.container) return;
    const effectiveTier = this.isSoftwareGl ? 'low' : tier;
    this.resolvedQualityTier = effectiveTier;

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    const nativeDpr = window.devicePixelRatio || 1;
    const targetDpr = this.isSoftwareGl
      ? 1
      : effectiveTier === 'high'
        ? Math.min(nativeDpr, 1.4)
        : effectiveTier === 'medium'
          ? Math.min(nativeDpr, 1.0)
          : Math.min(nativeDpr, 0.78);

    const key = `${effectiveTier}:${targetDpr.toFixed(2)}:${width}x${height}`;
    if (key !== this.lastAppliedQualityKey) {
      this.lastAppliedQualityKey = key;
      this.renderer.setPixelRatio(targetDpr);
      this.renderer.setSize(width, height);
      this.postProcessing?.setSize(width, height);
    }

    if (this.camera) {
      const targetFar = effectiveTier === 'high' ? 165 : effectiveTier === 'medium' ? 125 : 92;
      if (this.camera.far !== targetFar) {
        this.camera.far = targetFar;
        this.camera.updateProjectionMatrix();
      }
    }

    if (this.scene && this.envTexture) {
      const useIbl = !this.isSoftwareGl && effectiveTier !== 'low';
      this.scene.environment = useIbl ? this.envTexture : null;
    }

    if (this.world) {
      this.world.rainGeo.setDrawRange(0, effectiveTier === 'high' ? 1450 : effectiveTier === 'medium' ? 750 : 320);
      for (let i = 0; i < this.world.mistSprites.length; i++) {
        this.world.mistSprites[i].visible = effectiveTier !== 'low' || i % 2 === 0;
      }
    }

    this.postProcessing?.setBloomEnabled(!this.isSoftwareGl && effectiveTier === 'high');

    const shadowsOn = !this.isSoftwareGl && effectiveTier !== 'low';
    if (this.renderer.shadowMap.enabled !== shadowsOn) {
      this.renderer.shadowMap.enabled = shadowsOn;
      if (shadowsOn) {
        this.renderer.shadowMap.needsUpdate = true;
      }
    }
    if (shadowsOn && this.world) {
      const targetShadowRes = effectiveTier === 'high' ? 1024 : 512;
      const sunShadow = this.world.sunKeyLight.shadow;
      if (sunShadow.mapSize.width !== targetShadowRes) {
        sunShadow.mapSize.set(targetShadowRes, targetShadowRes);
        sunShadow.map?.dispose();
        sunShadow.map = null;
        this.renderer.shadowMap.needsUpdate = true;
      }
    }
    this.shadowRefreshStride = effectiveTier === 'high' ? 3 : effectiveTier === 'medium' ? 6 : 0;
    this.maxPoolLights = effectiveTier === 'low' ? 2 : 4;

    const cullDist = effectiveTier === 'high' ? 28 : effectiveTier === 'medium' ? 21 : 15;
    this.lightCullDistSq = cullDist * cullDist;
  }

  public triggerInteract(): void {
    this.handleInteract();
  }

  public toggleCrouch(): void {
    if (this.screen !== 'playing' || this.isNotebookOpen || this.isOverlayBlockingMove()) return;
    this.crouchToggled = !this.crouchToggled;
    this.pushHudState(true);
  }

  public setVirtualMove(x: number, y: number): void {
    this.virtualMoveX = THREE.MathUtils.clamp(x, -1, 1);
    this.virtualMoveY = THREE.MathUtils.clamp(y, -1, 1);
  }

  public addVirtualLook(dx: number, dy: number): void {
    if (this.screen !== 'playing' || this.isNotebookOpen || this.isOverlayBlockingMove()) return;
    const sens = this.controlSettings.mouseSensitivity * (this.isZooming ? 0.55 : 1.0);
    const ySign = this.controlSettings.invertY ? -1 : 1;
    this.targetYaw -= dx * 0.0042 * sens;
    this.targetPitch = THREE.MathUtils.clamp(
      this.targetPitch - dy * 0.0042 * sens * ySign,
      -1.28,
      1.28,
    );
  }

  public setVirtualSprint(active: boolean): void {
    this.virtualSprint = active;
  }

  private isOverlayBlockingMove(): boolean {
    return this.isNotebookOpen || this.activeDialogueNpcId !== null || this.activeAutopsyCaseId !== null;
  }

  private resetStoryState(): void {
    this.act = 1;
    this.inventory = INITIAL_INVENTORY.map((i) => ({ ...i }));
    this.rules = INITIAL_RULES.map((r) => ({ ...r }));
    this.clues = INITIAL_CLUES.map((c) => ({ ...c }));
    this.glossaryEntries = INITIAL_GLOSSARY_ENTRIES.map((g) => ({ ...g }));
    this.playerGlossaryNotes = [];
    this.autopsyCases = createInitialAutopsyCases();
    this.discoveredDistricts = new Set<DistrictId>(['square']);
    this.trustScore = 50;

    this.playerPos.set(0, groundHeightAt(0, 23.0), 23.0);
    this.playerVel.set(0, 0, 0);
    this.yaw = 0;
    this.pitch = -0.04;
    this.targetYaw = 0;
    this.targetPitch = -0.04;
    this.cameraRoll = 0;
    this.stamina = 100;
    this.staminaExhausted = false;
    this.crouchToggled = false;
    this.isCrouching = false;
    this.isSprinting = false;
    this.isZooming = false;
    this.rightMouseDown = false;
    this.virtualMoveX = 0;
    this.virtualMoveY = 0;
    this.virtualSprint = false;

    this.gasilDoorOpen = false;
    this.gasilDoorAngle = 0;
    this.muhtarDoorOpen = false;
    this.muhtarDoorAngle = 0;
    this.abandonedDoorOpen = false;
    this.abandonedDoorAngle = 0;
    this.clinicDoorOpen = false;
    this.clinicDoorAngle = 0;
    this.millDoorOpen = false;
    this.millDoorAngle = 0;
    this.cryptDoorOpen = false;
    this.cryptDoorAngle = 0;
    this.shutterClosed = false;
    this.shutterAngle = Math.PI * 0.62;

    this.candleLit = false;
    this.candleOil = 100;
    this.vigilLit = false;
    this.vigilTimer = 180;
    this.dreadLevel = 8;
    this.dangerProximity = 0;
    this.violations = 0;

    this.stepPrepDone = false;
    this.stepWashDone = false;
    this.dirtyBasinReady = false;
    this.dirtyBasinDrained = false;
    this.gasilBulbOut = false;
    this.stepFinalCamphorDone = false;
    this.stepDryDone = false;
    this.stepShroudDone = false;

    this.activeAutopsyCaseId = null;
    this.activeAutopsyTool = 'magnifier';
    this.activeAutopsyCameraAngle = 'overview';
    this.hoveredAutopsyZone = null;
    this.hoveredAutopsyAnomalyId = null;
    this.cameraFlashAlpha = 0;
    this.autopsyPanOffset = { x: 0, y: 0 };
    this.activeDialogueNpcId = null;
    this.activeDialogueNodeId = null;

    this.windowAnomalyActive = false;
    this.windowStareTimer = 0;
    this.windowAnomalyResolved = false;
    this.nextWindowWhisperTime = 4;
    this.windowWhisperFxTimer = 0;
    this.windowWhisperFxDuration = 1.6;
    this.windowWhisperVariant = 0;
    this.windowWhisperNextCaptionTime = 0;
    this.leftGasilWithoutVigilFlagged = false;
    this.stormFlashIntensity = 0;
    this.nextThunderTime = 12;
    this.karaPatrolT = 0;
    this.sisPatrolT = 0;
    this.karaCatchCooldown = 0;
    this.caughtCount = 0;
    this.endingReason = '';
    this.isNotebookOpen = false;
    this.captionText = null;
    this.saveNoticeText = null;

    this.dreadListener.reset();
    this.hallucinationPulse = 0;
    this.lastHallucinationCaptionTime = -20;

    if (this.world?.autopsyLights) {
      this.world.autopsyLights.examLight.intensity = 0;
      this.world.autopsyLights.flashLight.intensity = 0;
    }
    if (this.handCandle?.light) {
      this.handCandle.light.intensity = 0;
    }

    if (this.world?.npcs) {
      (Object.keys(this.world.npcs) as NpcId[]).forEach((id) => {
        const actor = this.world.npcs[id];
        actor.spokenNodes.clear();
        actor.trust = 50;
        actor.waypointIndex = 0;
        const wp = actor.def.waypoints[0];
        actor.pos.set(wp.x, groundHeightAt(wp.x, wp.z), wp.z);
        actor.root.position.copy(actor.pos);
      });
    }
  }

  private initThree(): void {
    const hardwareProfile = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      const cores = navigator.hardwareConcurrency || 4;
      const devMem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8;
      const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
      if (!gl) {
        return { softwareGl: true, lowEnd: true, veryWeak: true };
      }
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      const softwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      const lowEndGpu = /Intel.*(UHD|HD|Iris)|Mali|Adreno|PowerVR|Apple GPU/i.test(gpu) && (cores <= 4 || devMem <= 4 || coarsePointer);
      const lowEnd = softwareGl || lowEndGpu || cores <= 4 || devMem <= 4 || coarsePointer;
      const veryWeak = softwareGl || cores <= 2 || devMem <= 2;
      return { softwareGl, lowEnd, veryWeak };
    })();

    this.isSoftwareGl = hardwareProfile.softwareGl;
    this.isLowEndHardware = hardwareProfile.lowEnd;

    if (this.controlSettings.graphicsQuality === 'auto') {
      this.resolvedQualityTier = hardwareProfile.veryWeak ? 'low' : 'medium';
    }

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl && !this.isLowEndHardware,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : this.isLowEndHardware ? 1 : Math.min(window.devicePixelRatio || 1, 1.4),
    );
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && !hardwareProfile.veryWeak;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = this.renderer.shadowMap.enabled;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(64, width / height, 0.1, 165);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envTexture;
    pmremGenerator.dispose();

    const rawAniso = this.renderer.capabilities.getMaxAnisotropy();
    const maxAnisotropy = this.isSoftwareGl || this.isLowEndHardware ? Math.min(2, rawAniso) : Math.min(4, rawAniso);
    this.textures = createProceduralTextures(maxAnisotropy);
    this.world = buildVillageWorld(this.scene, this.textures, (id) => this.getInteractLabel(id));
    this.npcKeys = Object.keys(this.world.npcs) as NpcId[];

    // Preload local CC0 3D models & PBR textures in background without blocking interaction
    void this.cc0
      .preloadAll(maxAnisotropy, (percent, ready) => {
        if (this.disposed) return;
        this.assetLoadPercent = percent;
        this.assetsReady = ready;
        if (ready) {
          this.world.applyCC0Assets(this.cc0);
          if (this.renderer.shadowMap.enabled) {
            this.renderer.shadowMap.needsUpdate = true;
          }
          this.syncVisualMeshes();
        }
        this.pushHudState(true);
      });

    // First-person held brass candle (detach light onto camera permanently so NUM_POINT_LIGHTS stays constant)
    this.handCandle = createHandCandle();
    this.handCandle.root.position.set(0.32, -0.34, -0.52);
    this.handCandle.root.rotation.set(0.08, -0.15, 0);
    this.handCandle.root.visible = false;
    this.handCandle.root.remove(this.handCandle.light);
    this.handCandle.light.position.set(0.32, -0.09, -0.57);
    this.handCandle.light.intensity = 0;
    this.handCandle.light.visible = true;
    this.camera.add(this.handCandle.root);
    this.camera.add(this.handCandle.light);

    if (!this.isSoftwareGl) {
      this.postProcessing = createPostProcessing(
        this.renderer,
        this.scene,
        this.camera,
        width,
        height,
      );
      this.renderer.compile(this.scene, this.camera);
    }

    this.syncQualityTierFromSettings();
    this.syncVisualMeshes();
    this.pushHudState(true);
  }

  private syncVisualMeshes(): void {
    Object.entries(this.world.itemMeshes).forEach(([key, mesh]) => {
      const invId = key.replace('item_', '');
      const item = this.inventory.find((i) => i.id === invId);
      mesh.visible = item ? !item.collected : true;
    });

    const inspectArif = this.activeAutopsyCaseId === 'case_arif';
    const showArifForensic = inspectArif || (!this.autopsyCases.case_arif.completed && !this.stepPrepDone);

    // Toggle Gasilhane cloth vs forensic overlay cleanly
    this.world.gasil.deceasedGroup.children.forEach((child) => {
      if (child === this.world.gasilAutopsy.group) {
        child.visible = showArifForensic;
      } else if (child === this.world.gasil.pestemalMesh) {
        child.visible = !inspectArif && this.stepPrepDone && !this.stepShroudDone;
      } else if (child === this.world.gasil.kefenWrapGroup) {
        child.visible = !inspectArif && this.stepShroudDone;
      } else {
        child.visible = !showArifForensic;
      }
    });

    this.world.gasil.basinWaterMesh.visible = this.stepPrepDone && !this.dirtyBasinDrained;
    this.world.gasil.vigilFlame.visible = this.vigilLit;
    this.world.gasil.vigilLight.intensity = this.vigilLit ? 3.4 : 0;
    this.world.gasil.windowShadowFigure.visible = this.windowAnomalyActive;
    this.world.gasil.windowShadowFigure.position.set(-4.25, 1.45, 0);
    const windowGlowMat = this.world.gasil.windowGlowMesh.material as THREE.MeshStandardMaterial;
    windowGlowMat.emissive.copy(_whisperBaseEmissive);
    windowGlowMat.emissiveIntensity = 0.85;
    this.world.gasil.deceasedGroup.rotation.y = this.leftGasilWithoutVigilFlagged ? 0.14 : 0;

    // Sync all 3 autopsy cadaver visual overlays
    (Object.keys(this.world.autopsyBodies) as AutopsyCaseId[]).forEach((cid) => {
      const body = this.world.autopsyBodies[cid];
      const st = this.autopsyCases[cid];
      const isInspecting = this.activeAutopsyCaseId === cid;

      body.drapeMesh.visible = !isInspecting && st.completed;
      body.incisionGroup.visible = st.zones.chest.incised;
      body.neckIncision.visible = st.zones.neck.incised;
      if (body.sampleNodes.chest) {
        body.sampleNodes.chest.visible = isInspecting && st.zones.chest.incised && !st.zones.chest.sampleExtracted;
      }
      if (body.sampleNodes.pocket) {
        body.sampleNodes.pocket.visible = isInspecting && !st.zones.pocket.sampleExtracted;
      }

      const cameraMode = isInspecting && this.activeAutopsyTool === 'camera';

      (Object.keys(body.zoneMeshes) as AutopsyZoneId[]).forEach((zid) => {
        const m = body.zoneMeshes[zid];
        const mat = m.material as THREE.MeshBasicMaterial;
        if (!isInspecting || cameraMode) {
          mat.opacity = 0;
        } else if (this.hoveredAutopsyZone === zid) {
          mat.color.setHex(0xecd08b);
          mat.opacity = 0.34;
        } else {
          const zf = st.zones[zid];
          const done =
            zf.externalFound &&
            (!zf.requiresScalpel || zf.incised) &&
            (!zf.requiresForceps || zf.sampleExtracted);
          mat.color.setHex(done ? 0x5c946b : 0xc79e59);
          mat.opacity = done ? 0.08 : 0.16;
        }
      });

      Object.entries(body.anomalyMeshes).forEach(([aid, m]) => {
        const mat = m.material as THREE.MeshBasicMaterial;
        if (!cameraMode) {
          mat.opacity = 0;
        } else if (this.hoveredAutopsyAnomalyId === aid) {
          mat.color.setHex(0xf3d48f);
          mat.opacity = 0.42;
        } else {
          const anom = st.anomalies?.[aid];
          mat.color.setHex(anom?.photographed ? 0x5c946b : 0x8eb8ca);
          mat.opacity = anom?.photographed ? 0.12 : 0.24;
        }
      });
    });

    const { examLight, flashLight, anchors } = this.world.autopsyLights;
    if (this.activeAutopsyCaseId) {
      const anchorPair = anchors[this.activeAutopsyCaseId];
      anchorPair.examAnchor.getWorldPosition(examLight.position);
      anchorPair.flashAnchor.getWorldPosition(flashLight.position);
      examLight.intensity = 5.2;
    } else {
      examLight.intensity = 0;
      flashLight.intensity = 0;
    }

    this.world.karaBasma.root.visible = this.act >= 3;
    this.world.sisGozcusu.visible = this.act >= 3;
  }

  public startNewGame(): void {
    this.audio.init();
    this.resetStoryState();
    this.syncVisualMeshes();
    this.screen = 'playing';
    this.showCaption(
      'Kuzdağ Köyü... Bekçi Hasan ile konuş, malzemeleri topla ve Hacı Arif Efendi üzerinde ilk otopsiyi başlat.',
      6.2,
    );
    this.triggerAutoSave(false);
    this.requestPointerLockSafe();
    this.pushHudState(true);
  }

  public continueSavedGame(): void {
    const save = readAutoSave();
    if (!save) {
      this.startNewGame();
      return;
    }
    this.audio.init();
    this.resetStoryState();

    this.act = save.act;
    this.playerPos.set(save.playerPos.x, groundHeightAt(save.playerPos.x, save.playerPos.z), save.playerPos.z);
    this.yaw = save.playerPos.yaw;
    this.targetYaw = save.playerPos.yaw;
    this.pitch = save.playerPos.pitch;
    this.targetPitch = save.playerPos.pitch;

    this.candleLit = save.candleLit;
    this.candleOil = save.candleOil;
    this.handCandle.root.visible = this.candleLit;
    this.vigilLit = save.vigilLit;
    this.vigilTimer = save.vigilTimer;
    this.dreadLevel = save.dreadLevel;
    this.violations = save.violations;
    this.trustScore = save.trustScore ?? 50;

    const invSet = new Set(save.inventoryCollected || []);
    this.inventory.forEach((i) => {
      i.collected = invSet.has(i.id);
    });
    const ruleSet = new Set(save.rulesViolated || []);
    this.rules.forEach((r) => {
      r.violated = ruleSet.has(r.id);
    });
    const clueSet = new Set(save.cluesDiscovered || []);
    this.clues.forEach((c) => {
      c.discovered = clueSet.has(c.id);
    });

    this.discoveredDistricts = new Set<DistrictId>(save.discoveredDistricts || ['square']);
    if (save.doors) {
      this.gasilDoorOpen = Boolean(save.doors.gasil);
      this.abandonedDoorOpen = Boolean(save.doors.abandoned);
      this.muhtarDoorOpen = Boolean(save.doors.muhtar);
      this.clinicDoorOpen = Boolean(save.doors.clinic);
      this.millDoorOpen = Boolean(save.doors.mill);
      this.cryptDoorOpen = Boolean(save.doors.crypt);
      this.shutterClosed = Boolean(save.doors.shutter);
    }
    if (save.ritual) {
      this.stepPrepDone = Boolean(save.ritual.prep);
      this.stepWashDone = Boolean(save.ritual.wash);
      this.dirtyBasinReady = Boolean(save.ritual.dirtyReady);
      this.dirtyBasinDrained = Boolean(save.ritual.dirtyDrained);
      this.gasilBulbOut = Boolean(save.ritual.bulbOut);
      this.stepFinalCamphorDone = Boolean(save.ritual.finalCamphor);
      this.stepDryDone = Boolean(save.ritual.dry);
      this.stepShroudDone = Boolean(save.ritual.shroud);
    }
    if (save.autopsyCases) {
      const defaults = createInitialAutopsyCases();
      (Object.keys(defaults) as AutopsyCaseId[]).forEach((cid) => {
        const savedCase = save.autopsyCases[cid];
        if (!savedCase) return;
        const base = defaults[cid];
        const mergedZones = { ...base.zones };
        (Object.keys(base.zones) as AutopsyZoneId[]).forEach((zid) => {
          if (savedCase.zones?.[zid]) {
            mergedZones[zid] = { ...base.zones[zid], ...savedCase.zones[zid] };
          }
        });
        const mergedAnomalies = { ...base.anomalies };
        Object.keys(base.anomalies).forEach((aid) => {
          if (savedCase.anomalies?.[aid]) {
            mergedAnomalies[aid] = { ...base.anomalies[aid], ...savedCase.anomalies[aid] };
          }
        });
        this.autopsyCases[cid] = {
          ...base,
          ...savedCase,
          zones: mergedZones,
          anomalies: mergedAnomalies,
        };
      });
    }
    if (save.npcFlags) {
      (Object.keys(this.world.npcs) as NpcId[]).forEach((nid) => {
        const flags = save.npcFlags[nid];
        if (flags) this.world.npcs[nid].spokenNodes = new Set(flags);
        if (save.npcTrust && typeof save.npcTrust[nid] === 'number') {
          this.world.npcs[nid].trust = save.npcTrust[nid];
        }
      });
    }
    if (save.glossaryUnlocked) {
      const unlockedGlossarySet = new Set(save.glossaryUnlocked);
      this.glossaryEntries.forEach((g) => {
        g.unlocked = unlockedGlossarySet.has(g.id);
      });
    }
    if (Array.isArray(save.playerGlossaryNotes)) {
      this.playerGlossaryNotes = save.playerGlossaryNotes.map((n) => ({ ...n }));
    }

    this.syncVisualMeshes();
    this.screen = 'playing';
    this.showCaption('Kaldığın yerden devam ediliyor...', 3.8);
    this.requestPointerLockSafe();
    this.pushHudState(true);
  }

  private triggerAutoSave(showBanner = true): void {
    const npcFlags: Record<string, string[]> = {};
    const npcTrust: Record<string, number> = {};
    (Object.keys(this.world.npcs) as NpcId[]).forEach((nid) => {
      npcFlags[nid] = Array.from(this.world.npcs[nid].spokenNodes);
      npcTrust[nid] = this.world.npcs[nid].trust;
    });

    const meta = this.getObjectiveText();
    const payload: SaveGamePayload = {
      version: 2,
      savedAt: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      act: this.act,
      actTitle: meta.actTitle,
      playerPos: {
        x: Number(this.playerPos.x.toFixed(2)),
        z: Number(this.playerPos.z.toFixed(2)),
        yaw: Number(this.yaw.toFixed(3)),
        pitch: Number(this.pitch.toFixed(3)),
      },
      candleLit: this.candleLit,
      candleOil: Math.round(this.candleOil),
      vigilLit: this.vigilLit,
      vigilTimer: Math.round(this.vigilTimer),
      dreadLevel: Math.round(this.dreadLevel),
      violations: this.violations,
      trustScore: this.trustScore,
      inventoryCollected: this.inventory.filter((i) => i.collected).map((i) => i.id),
      rulesViolated: this.rules.filter((r) => r.violated).map((r) => r.id),
      cluesDiscovered: this.clues.filter((c) => c.discovered).map((c) => c.id),
      discoveredDistricts: Array.from(this.discoveredDistricts),
      doors: {
        gasil: this.gasilDoorOpen,
        abandoned: this.abandonedDoorOpen,
        muhtar: this.muhtarDoorOpen,
        clinic: this.clinicDoorOpen,
        mill: this.millDoorOpen,
        crypt: this.cryptDoorOpen,
        shutter: this.shutterClosed,
      },
      ritual: {
        prep: this.stepPrepDone,
        wash: this.stepWashDone,
        dirtyReady: this.dirtyBasinReady,
        dirtyDrained: this.dirtyBasinDrained,
        bulbOut: this.gasilBulbOut,
        finalCamphor: this.stepFinalCamphorDone,
        dry: this.stepDryDone,
        shroud: this.stepShroudDone,
      },
      npcFlags,
      npcTrust,
      autopsyCases: (Object.keys(this.autopsyCases) as AutopsyCaseId[]).reduce(
        (acc, cid) => {
          const c = this.autopsyCases[cid];
          const strippedAnomalies: AutopsyCaseState['anomalies'] = {};
          Object.entries(c.anomalies || {}).forEach(([aid, anom]) => {
            strippedAnomalies[aid] = {
              ...anom,
              photoDataUrl: undefined,
            };
          });
          acc[cid] = {
            ...c,
            zones: { ...c.zones },
            anomalies: strippedAnomalies,
          };
          return acc;
        },
        {} as Record<AutopsyCaseId, AutopsyCaseState>,
      ),
      glossaryUnlocked: this.glossaryEntries.filter((g) => g.unlocked).map((g) => g.id),
      playerGlossaryNotes: this.playerGlossaryNotes.map((n) => ({ ...n })),
    };

    if (writeAutoSave(payload)) {
      this.refreshSaveMeta();
      if (showBanner) {
        this.saveNoticeText = 'Otomatik Kayıt Alındı';
        this.saveNoticeTimeout = this.elapsedTime + 2.6;
        this.audio.playSaveChime();
      }
    }
  }

  public resumeGame(): void {
    if (this.screen === 'paused') {
      this.audio.init();
      this.screen = 'playing';
      if (!this.isOverlayBlockingMove()) {
        this.requestPointerLockSafe();
      }
      this.pushHudState(true);
    }
  }

  public pauseGame(): void {
    if (this.screen === 'playing') {
      this.screen = 'paused';
      this.isNotebookOpen = false;
      this.keys = {};
      this.rightMouseDown = false;
      this.isZooming = false;
      this.isDraggingLook = false;
      if (document.pointerLockElement === this.renderer.domElement) {
        document.exitPointerLock();
      }
      this.pushHudState(true);
    }
  }

  public toggleNotebook(): void {
    if (this.screen !== 'playing' || this.activeDialogueNpcId || this.activeAutopsyCaseId) return;
    this.isNotebookOpen = !this.isNotebookOpen;
    this.keys = {};
    this.rightMouseDown = false;
    this.isZooming = false;
    this.isDraggingLook = false;
    this.audio.playPaperFlip();
    if (this.isNotebookOpen && document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock();
    } else if (!this.isNotebookOpen) {
      this.requestPointerLockSafe();
    }
    this.pushHudState(true);
  }

  public toggleCandle(): void {
    if (this.screen !== 'playing' || this.activeAutopsyCaseId) return;
    if (!this.inventory.find((i) => i.id === 'defter')?.collected && this.act === 1) {
      this.showCaption('Henüz gassalın mumunu ve defterini almadın.', 2.8);
      return;
    }
    this.candleLit = !this.candleLit;
    this.handCandle.root.visible = this.candleLit;
    this.audio.playCandleToggle(this.candleLit);
    this.pushHudState(true);
  }

  public toggleMute(): void {
    const next = !this.audio.isMuted();
    this.audio.setMuted(next);
    this.pushHudState(true);
  }

  public returnToTitle(): void {
    this.screen = 'title';
    this.isNotebookOpen = false;
    this.activeAutopsyCaseId = null;
    this.activeDialogueNpcId = null;
    this.activeDialogueNodeId = null;
    this.refreshSaveMeta();
    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock();
    }
    this.pushHudState(true);
  }

  private unlockGlossaryEntry(id: string): boolean {
    const entry = this.glossaryEntries.find((g) => g.id === id);
    if (!entry || entry.unlocked) return false;
    entry.unlocked = true;
    entry.unlockedAt = new Date().toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return true;
  }

  public addGlossaryNote(title: string, category: GlossaryCategory, body: string): void {
    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    if (!cleanTitle || !cleanBody) return;

    const note: PlayerGlossaryNote = {
      id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      category,
      title: cleanTitle,
      body: cleanBody,
      createdAt: new Date().toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
    this.playerGlossaryNotes = [note, ...this.playerGlossaryNotes];
    this.audio.playPaperFlip();
    this.triggerAutoSave(false);
    this.pushHudState(true);
  }

  public deleteGlossaryNote(noteId: string): void {
    const next = this.playerGlossaryNotes.filter((n) => n.id !== noteId);
    if (next.length === this.playerGlossaryNotes.length) return;
    this.playerGlossaryNotes = next;
    this.audio.playPaperFlip();
    this.triggerAutoSave(false);
    this.pushHudState(true);
  }

  // --- NPC Dialogue Methods ---
  private startDialogue(npcId: NpcId): void {
    this.activeDialogueNpcId = npcId;
    this.activeDialogueNodeId = 'root';
    this.keys = {};
    this.isDraggingLook = false;
    this.isZooming = false;
    if (npcId === 'serife') {
      this.unlockGlossaryEntry('lore_serife_window');
    }
    this.audio.playDialogueBlip();
    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock();
    }
    this.pushHudState(true);
  }

  public selectDialogueOption(optionId: string): void {
    if (!this.activeDialogueNpcId || !this.activeDialogueNodeId) return;
    const npcDef = VILLAGE_NPCS[this.activeDialogueNpcId];
    const actor = this.world.npcs[this.activeDialogueNpcId];
    const node = npcDef.nodes[this.activeDialogueNodeId];
    if (!node) return;

    const option = node.options.find((o) => o.id === optionId);
    if (!option) return;

    this.audio.playDialogueBlip();
    actor.spokenNodes.add(node.id);

    let stateChanged = false;
    if (typeof option.trustDelta === 'number') {
      actor.trust = THREE.MathUtils.clamp(actor.trust + option.trustDelta, 0, 100);
      this.trustScore = THREE.MathUtils.clamp(this.trustScore + option.trustDelta, 0, 100);
    }
    if (typeof option.dreadDelta === 'number') {
      this.dreadLevel = THREE.MathUtils.clamp(this.dreadLevel + option.dreadDelta, 0, 100);
    }
    if (option.unlockItemId) {
      const inv = this.inventory.find((i) => i.id === option.unlockItemId);
      if (inv && !inv.collected) {
        inv.collected = true;
        this.audio.playPickup();
        stateChanged = true;
        if (option.unlockItemId === 'clinic_key') {
          this.autopsyCases.case_mahmut.unlocked = true;
          this.showCaption('Sağlık Ocağı Anahtarı alındı! Doğu yolundan Sağlık Ocağına git.', 5.0);
        } else if (option.unlockItemId === 'crypt_key') {
          this.autopsyCases.case_unknown.unlocked = true;
          this.showCaption('Taş Mahzen Anahtarı alındı! Kuzeybatıdaki Taş Mahzeni aç.', 5.0);
        }
      }
    }
    if (option.unlockClueId) {
      const cl = this.clues.find((c) => c.id === option.unlockClueId);
      if (cl && !cl.discovered) {
        cl.discovered = true;
        stateChanged = true;
      }
    }
    if (option.unlockGlossaryIds) {
      for (const gid of option.unlockGlossaryIds) {
        if (this.unlockGlossaryEntry(gid)) {
          stateChanged = true;
        }
      }
    }
    if (option.advanceActTo && option.advanceActTo > this.act) {
      this.act = option.advanceActTo;
      if (this.act >= 2) this.autopsyCases.case_mahmut.unlocked = true;
      if (this.act >= 4) this.autopsyCases.case_unknown.unlocked = true;
      stateChanged = true;
    }

    if (stateChanged) {
      this.syncVisualMeshes();
      this.triggerAutoSave(true);
    }

    if (option.nextNodeId === null) {
      this.closeDialogue();
    } else {
      this.activeDialogueNodeId = option.nextNodeId;
      this.pushHudState(true);
    }
  }

  public closeDialogue(): void {
    this.activeDialogueNpcId = null;
    this.activeDialogueNodeId = null;
    this.requestPointerLockSafe();
    this.pushHudState(true);
  }

  private getActiveDialogueState(): ActiveDialogueState | null {
    if (!this.activeDialogueNpcId || !this.activeDialogueNodeId) return null;
    const def = VILLAGE_NPCS[this.activeDialogueNpcId];
    const actor = this.world.npcs[this.activeDialogueNpcId];
    const node = def.nodes[this.activeDialogueNodeId];
    if (!node) return null;

    return {
      npcId: this.activeDialogueNpcId,
      speakerName: def.name,
      speakerRole: def.role,
      trustLevel: actor.trust,
      text: node.text,
      options: filterDialogueOptions(node.options, this.clues, this.autopsyCases, this.inventory),
    };
  }

  // --- Forensic 3D Autopsy Workbench & Crime Scene Investigation Methods ---
  public enterAutopsyMode(caseId: AutopsyCaseId): void {
    const body = this.world.autopsyBodies[caseId];
    if (!body) return;

    this.activeAutopsyCaseId = caseId;
    this.activeAutopsyTool = 'magnifier';
    this.activeAutopsyCameraAngle = 'overview';
    this.hoveredAutopsyZone = null;
    this.hoveredAutopsyAnomalyId = null;
    this.cameraFlashAlpha = 0;
    this.autopsyPanOffset = { x: 0, y: 0 };
    this.keys = {};
    this.isDraggingLook = false;
    this.isZooming = false;

    this.syncAutopsyCameraTarget(body, 'overview');

    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock();
    }
    this.syncVisualMeshes();
    this.audio.playExamineClick();
    this.showCaption(
      'Otopsi Masası: [1-3] ile bedeni incele, [4] Fotoğraf Makinesi ve kamera açılarıyla çevresel anomalileri belgele.',
      5.4,
    );
    this.pushHudState(true);
  }

  private syncAutopsyCameraTarget(body: WorldHandles['autopsyBodies'][AutopsyCaseId], angle: AutopsyCameraAngle): void {
    const preset = body.cameraPresets[angle] ?? body.cameraPresets.overview;
    body.group.updateWorldMatrix(true, false);
    this.autopsyCamPos.copy(preset.pos);
    body.group.localToWorld(this.autopsyCamPos);
    this.autopsyLookTarget.copy(preset.lookAt);
    body.group.localToWorld(this.autopsyLookTarget);
  }

  public exitAutopsyMode(): void {
    if (!this.activeAutopsyCaseId) return;
    this.world.autopsyLights.flashLight.intensity = 0;
    this.world.autopsyLights.examLight.intensity = 0;
    this.activeAutopsyCaseId = null;
    this.hoveredAutopsyZone = null;
    this.hoveredAutopsyAnomalyId = null;
    this.cameraFlashAlpha = 0;
    this.syncVisualMeshes();
    this.requestPointerLockSafe();
    this.pushHudState(true);
  }

  public selectAutopsyTool(tool: AutopsyTool): void {
    this.activeAutopsyTool = tool;
    this.hoveredAutopsyZone = null;
    this.hoveredAutopsyAnomalyId = null;
    this.audio.playExamineClick();
    if (tool === 'camera' && this.activeAutopsyCameraAngle === 'overview') {
      this.showCaption('Fotoğraf Makinesi seçildi. "Zemin & İzler" veya "Oda Çevresi" açısına geçip mavi işaretli anomalileri çek.', 4.6);
    }
    this.syncVisualMeshes();
    this.pushHudState(true);
  }

  public selectAutopsyCameraAngle(angle: AutopsyCameraAngle): void {
    if (!this.activeAutopsyCaseId) return;
    const body = this.world.autopsyBodies[this.activeAutopsyCaseId];
    if (!body) return;
    this.activeAutopsyCameraAngle = angle;
    this.autopsyPanOffset = { x: 0, y: 0 };
    this.hoveredAutopsyZone = null;
    this.hoveredAutopsyAnomalyId = null;
    this.syncAutopsyCameraTarget(body, angle);
    this.audio.playExamineClick();
    this.syncVisualMeshes();
    this.pushHudState(true);
  }

  public updateAutopsySelections(caseId: AutopsyCaseId, cause: string, time: string): void {
    const st = this.autopsyCases[caseId];
    if (!st) return;
    st.selectedCause = cause;
    st.selectedTime = time;
    st.diagnosisError = null;
    this.pushHudState(true);
  }

  public tagCrimeSceneAnomaly(caseId: AutopsyCaseId, anomalyId: string, tag: string): void {
    const st = this.autopsyCases[caseId];
    const anom = st?.anomalies?.[anomalyId];
    if (!st || !anom) return;
    anom.selectedTag = tag;
    st.diagnosisError = null;
    this.audio.playExamineClick();
    this.pushHudState(true);
  }

  public linkCrimeSceneAnomaly(caseId: AutopsyCaseId, anomalyId: string, zoneId: AutopsyZoneId | ''): void {
    const st = this.autopsyCases[caseId];
    const anom = st?.anomalies?.[anomalyId];
    if (!st || !anom) return;
    anom.linkedZone = zoneId;
    st.diagnosisError = null;
    this.audio.playExamineClick();
    this.pushHudState(true);
  }

  public submitAutopsyDiagnosis(caseId: AutopsyCaseId): void {
    const st = this.autopsyCases[caseId];
    const diag = AUTOPSY_DIAGNOSIS[caseId];
    if (!st || !diag) return;

    const requiredInspected = (Object.values(st.zones) as Array<AutopsyCaseState['zones'][AutopsyZoneId]>).filter(
      (z) => z.externalFound,
    ).length;

    if (requiredInspected < 4 || !st.zones.chest.incised) {
      st.diagnosisError = 'Mühürlemeden önce en az 4 bölgeyi büyüteçle incele ve göğüs bölgesine neşter uygula.';
      this.audio.playViolationSting();
      this.pushHudState(true);
      return;
    }

    const anomalies = Object.values(st.anomalies || {});
    if (anomalies.some((a) => !a.photographed)) {
      st.diagnosisError = 'Mühürlemeden önce [4] Fotoğraf Makinesi ile olay yerindeki tüm çevresel anomalileri fotoğrafla.';
      this.audio.playViolationSting();
      this.pushHudState(true);
      return;
    }

    if (anomalies.some((a) => !a.selectedTag || a.selectedTag !== a.correctTag)) {
      st.diagnosisError = 'Fotoğraflanan olay yeri anomalilerinden biri eksik veya yanlış etiketlenmiş. Kanıt etiketlerini kontrol et.';
      this.audio.playViolationSting();
      this.pushHudState(true);
      return;
    }

    if (anomalies.some((a) => !a.linkedZone || a.linkedZone !== a.correctZone)) {
      st.diagnosisError = 'Olay yeri fotoğrafı yanlış otopsi bulgusuyla eşleştirilmiş. Anatomik bulguyla çapraz referansını düzelt.';
      this.audio.playViolationSting();
      this.pushHudState(true);
      return;
    }

    if (anomalies.some((a) => !st.zones[a.linkedZone as AutopsyZoneId]?.externalFound)) {
      st.diagnosisError = 'Eşleştirdiğin anatomik bölge henüz büyüteçle incelenmemiş.';
      this.audio.playViolationSting();
      this.pushHudState(true);
      return;
    }

    if (st.selectedCause !== diag.correctCause || st.selectedTime !== diag.correctTime) {
      st.diagnosisError = 'Ölüm nedeni veya ölüm saati adli bulgularla örtüşmüyor. Bölge notlarını tekrar oku.';
      this.audio.playViolationSting();
      this.pushHudState(true);
      return;
    }

    st.completed = true;
    st.diagnosisError = null;
    const clue = this.clues.find((c) => c.id === diag.unlockClueId);
    if (clue) clue.discovered = true;

    if (caseId === 'case_arif') {
      this.autopsyCases.case_mahmut.unlocked = true;
    } else if (caseId === 'case_mahmut') {
      if (this.act < 3) this.act = 3;
    } else if (caseId === 'case_unknown') {
      if (this.act < 5) this.act = 5;
      this.dreadLevel = Math.min(100, this.dreadLevel + 22);
    }

    this.activeAutopsyCaseId = null;
    this.hoveredAutopsyZone = null;
    this.hoveredAutopsyAnomalyId = null;
    this.cameraFlashAlpha = 0;
    this.syncVisualMeshes();
    this.triggerAutoSave(true);
    this.showCaption(diag.summaryText, 6.8);
    this.requestPointerLockSafe();
    this.pushHudState(true);
  }

  private captureCrimeSceneSnapshot(clientX: number, clientY: number): string | undefined {
    try {
      const glCanvas = this.renderer.domElement;
      const rect = glCanvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return undefined;

      if (!this.snapshotCanvas) {
        this.snapshotCanvas = document.createElement('canvas');
        this.snapshotCanvas.width = 220;
        this.snapshotCanvas.height = 140;
      }
      const ctx = this.snapshotCanvas.getContext('2d');
      if (!ctx) return undefined;

      // Render synchronously with the camera flash active so the frame buffer is populated before reading
      this.renderFrame();

      const scaleX = glCanvas.width / rect.width;
      const scaleY = glCanvas.height / rect.height;
      const centerX = (clientX - rect.left) * scaleX;
      const centerY = (clientY - rect.top) * scaleY;

      const cropW = Math.min(glCanvas.width, Math.max(180, glCanvas.width * 0.42));
      const cropH = cropW * (140 / 220);
      const sx = THREE.MathUtils.clamp(centerX - cropW * 0.5, 0, Math.max(0, glCanvas.width - cropW));
      const sy = THREE.MathUtils.clamp(centerY - cropH * 0.5, 0, Math.max(0, glCanvas.height - cropH));

      ctx.drawImage(glCanvas, sx, sy, cropW, cropH, 0, 0, 220, 140);
      return this.snapshotCanvas.toDataURL('image/jpeg', 0.72);
    } catch {
      return undefined;
    }
  }

  private handleAutopsyCanvasClick(clientX: number, clientY: number): void {
    if (!this.activeAutopsyCaseId) return;
    const body = this.world.autopsyBodies[this.activeAutopsyCaseId];
    const st = this.autopsyCases[this.activeAutopsyCaseId];
    if (!body || !st) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    _pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    _pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    _raycaster.setFromCamera(_pointerNdc, this.camera);

    if (this.activeAutopsyTool === 'camera') {
      _raycaster.layers.set(AUTOPSY_ANOMALY_LAYER);
      _raycaster.far = 8.0;
      const hits = _raycaster.intersectObjects(Object.values(body.anomalyMeshes), false);
      if (hits.length === 0) {
        this.showCaption('Kadrajda çevresel anomali yok. Kamera açısını değiştirip (Zemin & İzler / Oda Çevresi) tekrar dene.', 3.4);
        return;
      }

      const anomalyId = hits[0].object.userData.autopsyAnomalyId as string;
      const anomaly = st.anomalies?.[anomalyId];
      if (!anomaly) return;

      const anchorPair = this.world.autopsyLights.anchors[this.activeAutopsyCaseId];
      anchorPair.flashAnchor.getWorldPosition(this.world.autopsyLights.flashLight.position);
      this.world.autopsyLights.flashLight.intensity = 6.0;
      this.cameraFlashAlpha = 0.85;
      this.audio.playCameraShutter();

      const photoUrl = this.captureCrimeSceneSnapshot(clientX, clientY);
      anomaly.photographed = true;
      if (photoUrl) anomaly.photoDataUrl = photoUrl;
      st.diagnosisError = null;

      this.showCaption(`Olay yeri fotoğrafı çekildi: ${anomaly.label}. Sağdan etiketleyip otopsi bulgusuyla eşleştir.`, 4.8);
      this.syncVisualMeshes();
      this.pushHudState(true);
      return;
    }

    _raycaster.layers.set(AUTOPSY_LAYER);
    _raycaster.far = 6.0;

    const hits = _raycaster.intersectObjects(Object.values(body.zoneMeshes), false);
    if (hits.length === 0) return;

    const zoneId = hits[0].object.userData.autopsyZoneId as AutopsyZoneId;
    const zone = st.zones[zoneId];
    if (!zone) return;

    if (this.activeAutopsyTool === 'magnifier') {
      zone.externalFound = true;
      this.audio.playExamineClick();
      this.showCaption(`${zone.zoneLabel}: ${zone.externalNote}`, 4.8);
    } else if (this.activeAutopsyTool === 'scalpel') {
      if (!zone.requiresScalpel) {
        this.showCaption(`${zone.zoneLabel} için kesi gerekmiyor — büyüteç veya forseps kullan.`, 3.2);
      } else {
        zone.externalFound = true;
        zone.incised = true;
        this.audio.playScalpelCut();
        this.showCaption(`Kesi açıldı (${zone.zoneLabel}): ${zone.internalNote}`, 5.2);
      }
    } else if (this.activeAutopsyTool === 'forceps') {
      if (!zone.requiresForceps) {
        this.showCaption(`${zone.zoneLabel} üzerinde çıkarılacak fiziksel örnek yok.`, 3.0);
      } else if (zone.requiresScalpel && !zone.incised) {
        this.showCaption('İç örneği almadan önce neşterle göğüs boşluğunu açmalısın.', 3.4);
      } else {
        zone.externalFound = true;
        zone.sampleExtracted = true;
        this.audio.playForcepsSample();
        this.showCaption(`Kanıt çıkarıldı: ${zone.sampleItemName}`, 4.5);
      }
    }

    this.syncVisualMeshes();
    this.pushHudState(true);
  }

  private requestPointerLockSafe(): void {
    if (this.disposed || this.isOverlayBlockingMove()) return;
    if (document.pointerLockElement === this.renderer.domElement) return;
    if (performance.now() - this.lastPointerLockExitTime < 1350) return;

    try {
      const maybePromise = this.renderer.domElement.requestPointerLock?.() as unknown as
        | Promise<void>
        | undefined;
      if (maybePromise && typeof maybePromise.catch === 'function') {
        maybePromise.catch(() => {
          // Fallback drag-look & arrow keys remain active
        });
      }
    } catch {
      // Fallback drag-look stays active if pointer lock is blocked
    }
  }

  private showCaption(text: string, durationSec = 4.5): void {
    this.captionText = text;
    this.captionTimeout = this.elapsedTime + durationSec;
    this.pushHudState(true);
  }

  private violateRule(ruleId: string, message: string): void {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (rule && !rule.violated) {
      rule.violated = true;
    }
    this.violations += 1;
    this.dreadLevel = Math.min(100, this.dreadLevel + 26);
    this.audio.playViolationSting();
    this.showCaption(message, 5.5);
    this.pushHudState(true);
  }

  private getInteractLabel(id: string): string | null {
    if (id.startsWith('npc_')) {
      const npcId = id.replace('npc_', '') as NpcId;
      const def = VILLAGE_NPCS[npcId];
      return def ? `[E] ${def.name} ile Konuş` : null;
    }

    if (id.startsWith('item_')) {
      const invId = id.replace('item_', '');
      const item = this.inventory.find((i) => i.id === invId);
      if (!item || item.collected) return null;
      if (invId === 'gulsuyu' && this.act < 3) return null;
      if (invId === 'kafur' && this.act < 4) return null;
      return `[E] ${item.name} Al`;
    }

    switch (id) {
      case 'gasil_door':
        return this.gasilDoorOpen ? '[E] Gasilhane Kapısını Kapat' : '[E] Gasilhane Kapısını Aç';
      case 'abandoned_door':
        return this.act < 3
          ? 'Kapı Sürgülü (Bölüm III’te açılabilir)'
          : this.abandonedDoorOpen
            ? '[E] Eski Ev Kapısını Kapat'
            : '[E] Eski Ev Kapısını Aç';
      case 'muhtar_door':
        return this.act < 4
          ? 'Kapı Kilitli (Önce Katip Kenan ile yüzleş)'
          : this.muhtarDoorOpen
            ? '[E] Muhtarlık Kapısını Kapat'
            : '[E] Muhtarlık Kapısını Aç';
      case 'clinic_door': {
        const hasKey = this.inventory.find((i) => i.id === 'clinic_key')?.collected;
        if (!hasKey) return 'Sağlık Ocağı Kilitli (Bekçi Hasan’dan anahtar al)';
        return this.clinicDoorOpen ? '[E] Sağlık Ocağı Kapısını Kapat' : '[E] Sağlık Ocağı Kapısını Aç';
      }
      case 'mill_door':
        return this.millDoorOpen ? '[E] Su Değirmeni Kapısını Kapat' : '[E] Su Değirmeni Kapısını Aç';
      case 'crypt_door': {
        const hasCryptKey = this.inventory.find((i) => i.id === 'crypt_key')?.collected;
        if (!hasCryptKey) return 'Taş Mahzen Kilitli (Mezarcı İdris’ten anahtar al)';
        return this.cryptDoorOpen ? '[E] Taş Mahzen Kapısını Kapat' : '[E] Taş Mahzen Kapısını Aç';
      }
      case 'gasil_shutter':
        return this.shutterClosed ? '[E] Kepengi Arala' : '[E] Ahşap Kepengi Kapat';
      case 'autopsy_case_mahmut':
        if (this.autopsyCases.case_mahmut.completed) {
          return '[E] Şoför Mahmut Dosyasını Tekrar İncele';
        }
        return '[E] Otopsi Başlat · Şoför Mahmut (Vaka II)';
      case 'autopsy_case_unknown':
        if (this.autopsyCases.case_unknown.completed) {
          return '[E] İsimsiz Yolcu Dosyasını Tekrar İncele';
        }
        return '[E] Otopsi Başlat · İsimsiz Yolcu (Vaka III)';
      case 'tenesir_slab': {
        if (!this.autopsyCases.case_arif.completed) {
          return '[E] Mermer Teneşir · Hacı Arif Adli Otopsisi (Vaka I)';
        }
        if (this.act === 1) {
          const ready = ['defter', 'kefen', 'sabun', 'ibrik'].every(
            (req) => this.inventory.find((i) => i.id === req)?.collected,
          );
          return ready ? '[E] Gusül Hazırlığına Başla' : 'Önce köydeki 4 malzemeyi topla';
        }
        if (this.act === 2) {
          if (!this.stepPrepDone) return '[E] Örtüyü (Setr-i Avret) Ser ve Suyu Hazırla';
          if (!this.stepWashDone) return '[E] Sabunlu Ilık Suyla Yıka (Sağdan Sola)';
          if (this.windowAnomalyActive && !this.shutterClosed) return 'Önce pencere kepengini kapat!';
          if (!this.dirtyBasinDrained) return 'Önce kirli su leğenini iç gidere boşalt';
          return 'Bekçi Hasan’dan Sağlık Ocağı Anahtarını alıp Şoför Mahmut’u incele';
        }
        if (this.act === 3) {
          return 'Değirmen & Viraj kanıtlarını topla, Katip Kenan ile yüzleş';
        }
        if (this.act === 4) {
          return 'Mezarlık Taş Mahzende 3. vakayı çöz ve Muhtarlıktan Kafur al';
        }
        if (this.act === 5) {
          const hasKafur = this.inventory.find((i) => i.id === 'kafur')?.collected;
          const hasGulsuyu = this.inventory.find((i) => i.id === 'gulsuyu')?.collected;
          if (!hasKafur) return 'Önce Muhtarlık odasından Kafur Kavanozunu al';
          if (!hasGulsuyu) return 'Önce Eski Köy Evinden Gülsuyu & Havlu al';
          if (!this.stepFinalCamphorDone) return '[E] Kafurlu Su ile Üç Kez Son Durulamayı Yap';
          if (!this.stepDryDone) return '[E] Temiz Havlu ve Gülsuyu ile Kurula';
          if (!this.stepShroudDone) return '[E] Kefenle ve Baş-Bel-Ayak Bağlarını Bağla';
        }
        return null;
      }
      case 'gasil_drain':
        return this.dirtyBasinReady && !this.dirtyBasinDrained
          ? '[E] Kirli Suyu Taş Gidere Boşalt'
          : null;
      case 'yard_drain':
        return this.dirtyBasinReady && !this.dirtyBasinDrained
          ? '[E] Kirli Suyu Avlu Oluğuna Dök'
          : null;
      case 'vigil_candle':
        return this.act >= 2 && !this.vigilLit
          ? '[E] Başucunda Sabır Mumunu Yak'
          : null;
      case 'clue_serife_letter':
        return this.act >= 3 ? '[E] Şerife Nine’nin Mektubunu Oku' : null;
      case 'clue_mill_ledger':
        return '[E] Değirmenci Zehir Kaydını Oku';
      case 'clue_crash_manifest':
        return '[E] Minibüs Enkazındaki Yolcu Listesini Al';
      case 'clue_muhtar_note':
        return this.act >= 4 ? '[E] Muhtarın Son Tutanağını Oku' : null;
      case 'clue_crash_report':
        return this.act >= 4 ? '[E] Jandarma Telsiz Kaydını İncele' : null;
      case 'clue_photo':
        return this.act >= 4 ? '[E] Duvar Fotoğrafını İncele' : null;
      default:
        return null;
    }
  }

  private handleInteract(): void {
    if (this.screen !== 'playing' || this.isOverlayBlockingMove() || !this.activeInteractId) return;
    const id = this.activeInteractId;

    // 0. NPCs
    if (id.startsWith('npc_')) {
      const npcId = id.replace('npc_', '') as NpcId;
      this.startDialogue(npcId);
      return;
    }

    // 1. Pickups
    if (id.startsWith('item_')) {
      const invId = id.replace('item_', '');
      const item = this.inventory.find((i) => i.id === invId);
      if (!item || item.collected) return;
      if (invId === 'gulsuyu' && this.act < 3) return;
      if (invId === 'kafur' && this.act < 4) return;

      item.collected = true;
      this.audio.playPickup();
      this.syncVisualMeshes();

      if (invId === 'defter') {
        this.candleLit = true;
        this.handCandle.root.visible = true;
        this.unlockGlossaryEntry('lore_arif_alone');
        this.showCaption('Gassalın Defteri ve mumu alındı. [Tab] ile Harita/Sözlük/Kuralları aç.', 5.0);
      } else if (invId === 'gulsuyu') {
        this.candleOil = 100;
        this.showCaption('Gülsuyu, temiz havlu ve yedek mum yağı alındı!', 4.6);
      } else if (invId === 'mill_toxin') {
        this.unlockGlossaryEntry('lore_serife_boganak');
        this.showCaption('Değirmen kıyısından Boğanak Otu numunesi toplandı!', 4.4);
      } else if (invId === 'kafur') {
        const torn = this.clues.find((c) => c.id === 'clue_torn_page');
        if (torn) torn.discovered = true;
        if (this.autopsyCases.case_unknown.completed) {
          this.act = 5;
        }
        this.showCaption('Kafur kavanozu ve yırtık sayfa alındı! Gasilhanede Son Vazifeyi tamamla.', 5.6);
      } else {
        this.showCaption(`${item.name} alındı.`, 3.0);
      }

      if (
        this.act === 1 &&
        ['defter', 'kefen', 'sabun', 'ibrik'].every((r) => this.inventory.find((i) => i.id === r)?.collected)
      ) {
        this.showCaption('Hazırlık malzemeleri tamam. Gasilhanede Vaka I otopsisini ve guslü yürüt.', 5.0);
      }
      this.triggerAutoSave(true);
      this.pushHudState(true);
      return;
    }

    // 2. Doors & Shutters
    if (id === 'gasil_door') {
      this.gasilDoorOpen = !this.gasilDoorOpen;
      this.audio.playDoorCreak();
      this.pushHudState(true);
      return;
    }

    if (id === 'abandoned_door') {
      if (this.act < 3) {
        this.showCaption('Eski evin kapısı içeriden sürgülü (Bölüm III’te açılır).', 2.8);
        return;
      }
      this.abandonedDoorOpen = !this.abandonedDoorOpen;
      this.audio.playDoorCreak();
      this.pushHudState(true);
      return;
    }

    if (id === 'muhtar_door') {
      if (this.act < 4) {
        this.showCaption('Önce Eski Su Değirmeni kanıtıyla Katip Kenan’la yüzleşmelisin.', 3.2);
        return;
      }
      this.muhtarDoorOpen = !this.muhtarDoorOpen;
      this.audio.playDoorCreak();
      this.pushHudState(true);
      return;
    }

    if (id === 'clinic_door') {
      const hasKey = this.inventory.find((i) => i.id === 'clinic_key')?.collected;
      if (!hasKey) {
        this.showCaption('Sağlık Ocağı kilitli. Önce Vaka I bulgularını Bekçi Hasan’a götür.', 3.4);
        return;
      }
      this.clinicDoorOpen = !this.clinicDoorOpen;
      this.audio.playDoorCreak();
      this.pushHudState(true);
      return;
    }

    if (id === 'mill_door') {
      this.millDoorOpen = !this.millDoorOpen;
      this.audio.playDoorCreak();
      this.pushHudState(true);
      return;
    }

    if (id === 'crypt_door') {
      const hasCryptKey = this.inventory.find((i) => i.id === 'crypt_key')?.collected;
      if (!hasCryptKey) {
        this.showCaption('Taş Mahzen kilitli. Mezarlık Tepesindeki Mezarcı İdris ile konuş.', 3.4);
        return;
      }
      this.cryptDoorOpen = !this.cryptDoorOpen;
      this.audio.playDoorCreak();
      this.pushHudState(true);
      return;
    }

    if (id === 'gasil_shutter') {
      this.shutterClosed = !this.shutterClosed;
      this.audio.playDoorCreak();
      if (this.shutterClosed && this.windowAnomalyActive) {
        this.windowAnomalyActive = false;
        this.windowAnomalyResolved = true;
        this.world.gasil.windowShadowFigure.visible = false;
        this.showCaption('Kepengi kapattın. Dışarıdaki tıklama kesildi.', 3.8);
      }
      this.pushHudState(true);
      return;
    }

    // 3. Vigil Candle
    if (id === 'vigil_candle') {
      if (this.act >= 2 && !this.vigilLit) {
        this.vigilLit = true;
        this.audio.playCandleToggle(true);
        this.syncVisualMeshes();
        this.showCaption('Başucunda Sabır Mumu yakıldı. Şimdi gecikmeden köye çıkabilirsin.', 4.5);
        this.pushHudState(true);
      }
      return;
    }

    // 4. Drains (Rule 2)
    if (id === 'gasil_drain' && this.dirtyBasinReady && !this.dirtyBasinDrained) {
      this.dirtyBasinDrained = true;
      this.dirtyBasinReady = false;
      this.gasilBulbOut = true;
      this.unlockGlossaryEntry('anom_bulb');
      this.audio.playWaterPour();
      this.syncVisualMeshes();
      this.triggerAutoSave(true);
      this.showCaption(
        'Suyu iç gidere boşalttın... Tavan ampulü patladı! Sabır Mumunu yak, Bekçi Hasan’dan Sağlık Ocağı Anahtarını al.',
        6.2,
      );
      this.pushHudState(true);
      return;
    }

    if (id === 'yard_drain' && this.dirtyBasinReady && !this.dirtyBasinDrained) {
      this.dirtyBasinDrained = true;
      this.dirtyBasinReady = false;
      this.gasilBulbOut = true;
      this.unlockGlossaryEntry('anom_bulb');
      this.unlockGlossaryEntry('anom_drain');
      this.audio.playWaterPour();
      this.syncVisualMeshes();
      this.violateRule(
        'rule_water',
        'KURAL İHLALİ: Gece dışarıya kirli su döktün! Ampul patladı, yağmurun içinden soğuk bir uğultu yükseldi.',
      );
      this.triggerAutoSave(false);
      this.pushHudState(true);
      return;
    }

    // 5. Clues & Documents
    const clueIds = [
      'clue_serife_letter',
      'clue_mill_ledger',
      'clue_crash_manifest',
      'clue_muhtar_note',
      'clue_crash_report',
      'clue_photo',
    ];
    if (clueIds.includes(id)) {
      const clue = this.clues.find((c) => c.id === id);
      if (clue) {
        clue.discovered = true;
        this.audio.playPaperFlip();
        if (id === 'clue_serife_letter') {
          this.unlockGlossaryEntry('lore_serife_window');
        }
        if (id === 'clue_crash_report' || id === 'clue_crash_manifest') {
          this.dreadLevel = Math.min(100, this.dreadLevel + 14);
        }
        this.triggerAutoSave(true);
        this.showCaption(`${clue.title} deftere eklendi [Tab].`, 4.4);
        this.pushHudState(true);
      }
      return;
    }

    // 6. Forensic Autopsy Tables (Cases II & III)
    if (id === 'autopsy_case_mahmut') {
      this.enterAutopsyMode('case_mahmut');
      return;
    }
    if (id === 'autopsy_case_unknown') {
      this.enterAutopsyMode('case_unknown');
      return;
    }

    // 7. Marble Tenesir (Case I Autopsy -> Respectful Gusül Steps)
    if (id === 'tenesir_slab') {
      if (!this.autopsyCases.case_arif.completed) {
        this.enterAutopsyMode('case_arif');
        return;
      }

      if (this.act === 1) {
        const ready = ['defter', 'kefen', 'sabun', 'ibrik'].every(
          (req) => this.inventory.find((i) => i.id === req)?.collected,
        );
        if (!ready) {
          this.showCaption('Önce köydeki 4 gusül malzemesini toplamalısın.', 3.2);
          return;
        }
        this.act = 2;
      }

      if (this.act === 2) {
        if (!this.stepPrepDone) {
          this.stepPrepDone = true;
          this.audio.playWaterPour();
          this.syncVisualMeshes();
          this.showCaption('Setr-i avret örtüsü serildi, ılık su hazırlandı.', 3.6);
        } else if (!this.stepWashDone) {
          this.stepWashDone = true;
          this.dirtyBasinReady = true;
          this.audio.playWaterPour();
          this.windowAnomalyActive = true;
          this.windowStareTimer = 0;
          this.windowWhisperFxTimer = 0;
          this.unlockGlossaryEntry('anom_window');
          this.dreadLevel = Math.min(100, this.dreadLevel + 18);
          this.syncVisualMeshes();
          this.audio.playWindowKnock();
          this.showCaption('Sabunlu yıkama tamamlandı... Pencereye bir şey vurdu! Bakma, kepengi kapat!', 5.6);
        } else if (this.windowAnomalyActive && !this.shutterClosed) {
          this.showCaption('Önce sol duvardaki ahşap kepengi kapat!', 3.2);
        } else if (!this.dirtyBasinDrained) {
          this.showCaption('Leğendeki kirli suyu gasilhane içindeki taş gidere dök.', 3.6);
        } else {
          this.showCaption('Şimdi Sabır Mumunu yakıp Bekçi Hasan’dan Sağlık Ocağı Anahtarını al.', 4.4);
        }
        this.pushHudState(true);
        return;
      }

      if (this.act === 5) {
        const hasKafur = this.inventory.find((i) => i.id === 'kafur')?.collected;
        const hasGulsuyu = this.inventory.find((i) => i.id === 'gulsuyu')?.collected;
        if (!hasKafur) {
          this.showCaption('Önce Muhtarlık odasından Kafur Kavanozunu getir.', 3.5);
          return;
        }
        if (!hasGulsuyu) {
          this.showCaption('Önce Eski Köy Evinden Gülsuyu & Temiz Havlu getir.', 3.5);
          return;
        }

        if (!this.stepFinalCamphorDone) {
          this.stepFinalCamphorDone = true;
          this.audio.playWaterPour();
          this.showCaption('Kafurlu suyla üç kez son durulama yapıldı. Şimdi havlu ve gülsuyu ile kurula.', 4.2);
        } else if (!this.stepDryDone) {
          this.stepDryDone = true;
          this.audio.playPickup();
          this.showCaption('Kurulama ve gülsuyu tamamlandı. Son adım: kefenle ve bağları bağla.', 4.2);
        } else if (!this.stepShroudDone) {
          this.stepShroudDone = true;
          this.audio.playPickup();
          this.syncVisualMeshes();
          this.triggerEnding();
        }
        this.pushHudState(true);
      }
    }
  }

  private triggerEnding(): void {
    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock();
    }
    const completedCases = (Object.values(this.autopsyCases) as AutopsyCaseState[]).filter(
      (c) => c.completed,
    ).length;
    const discoveredClues = this.clues.filter((c) => c.discovered).length;

    if (this.violations <= 1 && completedCases === 3 && discoveredClues >= 6) {
      this.screen = 'ending_truth';
      this.endingReason =
        'Hem halk inanışlarına sadık kaldın hem de üç otopsiyi mühürleyip Katip Kenan’ın Boğanak komplosunu açığa çıkardın. Şafakta jandarma köye ulaştı; Hacı Arif de, 22:42’de yitip giden ruhun da huzura erdi.';
      this.audio.playDawnSereneChord();
      this.dreadLevel = 0;
      this.scene.background = new THREE.Color(0x2d3a4b);
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.setHex(0x2d3a4b);
        this.scene.fog.density = 0.016;
      }
    } else if (this.violations <= 1) {
      this.screen = 'ending_peace';
      this.endingReason =
        'Halk inanışlarına ve son vazifene sadık kaldın. Yağmur dindi, doğudan sabah ezanı yükseldi.';
      this.audio.playDawnSereneChord();
      this.dreadLevel = 0;
      this.scene.background = new THREE.Color(0x2a3544);
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.setHex(0x2a3544);
        this.scene.fog.density = 0.018;
      }
    } else {
      this.screen = 'ending_twist';
      this.endingReason =
        'Yasakları çiğnedin. Kefeni bağlarken elin bileğindeki saate çarptı — 22:42’de camı kırık durmuş saat. Virajda ölen yolcu sendin.';
      this.audio.playViolationSting();
    }
    this.pushHudState(true);
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    document.addEventListener('pointerlockerror', this.onPointerLockError);

    const canvas = this.renderer.domElement;
    canvas.addEventListener('webglcontextlost', this.onWebGlContextLost);
    canvas.addEventListener('webglcontextrestored', this.onWebGlContextRestored);
    canvas.addEventListener('mousedown', this.onMouseDown);
    canvas.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
  }

  private onWebGlContextLost = (e: Event): void => {
    e.preventDefault();
    this.isContextLost = true;
  };

  private onWebGlContextRestored = (): void => {
    this.isContextLost = false;
    if (this.renderer.shadowMap.enabled) {
      this.renderer.shadowMap.needsUpdate = true;
    }
    this.syncQualityTierFromSettings();
  };

  private onContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
  };

  private onResize = (): void => {
    if (this.disposed) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.lastAppliedQualityKey = '';
    this.syncQualityTierFromSettings();
  };

  private onWindowBlur = (): void => {
    this.keys = {};
    this.isDraggingLook = false;
    this.rightMouseDown = false;
    this.isZooming = false;
    this.virtualMoveX = 0;
    this.virtualMoveY = 0;
    this.virtualSprint = false;
  };

  private onPointerLockChange = (): void => {
    const locked = document.pointerLockElement === this.renderer.domElement;
    if (this.isPointerLocked && !locked) {
      this.lastPointerLockExitTime = performance.now();
    }
    this.isPointerLocked = locked;
    this.pushHudState(true);
  };

  private onPointerLockError = (): void => {
    this.isPointerLocked = false;
    this.lastPointerLockExitTime = performance.now();
    this.pushHudState(true);
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (this.screen !== 'playing' || this.isNotebookOpen || this.activeDialogueNpcId) return;
    this.audio.init();

    if (this.activeAutopsyCaseId) {
      if (e.button === 0) {
        this.handleAutopsyCanvasClick(e.clientX, e.clientY);
      }
      return;
    }

    if (e.button === 2) {
      this.rightMouseDown = true;
      return;
    }
    if (e.button === 0) {
      if (this.isPointerLocked) {
        if (this.activeInteractId) {
          this.handleInteract();
        }
      } else {
        this.requestPointerLockSafe();
        this.isDraggingLook = true;
        this.lastPointerX = e.clientX;
        this.lastPointerY = e.clientY;
      }
    }
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (this.screen !== 'playing' || this.isNotebookOpen || this.activeDialogueNpcId) return;

    if (this.activeAutopsyCaseId) {
      const body = this.world.autopsyBodies[this.activeAutopsyCaseId];
      if (!body) return;
      const rect = this.renderer.domElement.getBoundingClientRect();
      _pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.autopsyPanOffset.x = THREE.MathUtils.clamp(_pointerNdc.x * 0.08, -0.08, 0.08);
      this.autopsyPanOffset.y = THREE.MathUtils.clamp(_pointerNdc.y * 0.05, -0.05, 0.05);

      _raycaster.setFromCamera(_pointerNdc, this.camera);
      if (this.activeAutopsyTool === 'camera') {
        _raycaster.layers.set(AUTOPSY_ANOMALY_LAYER);
        _raycaster.far = 8.0;
        const hits = _raycaster.intersectObjects(Object.values(body.anomalyMeshes), false);
        const nextAnomaly = hits.length > 0 ? (hits[0].object.userData.autopsyAnomalyId as string) : null;
        if (nextAnomaly !== this.hoveredAutopsyAnomalyId || this.hoveredAutopsyZone !== null) {
          this.hoveredAutopsyAnomalyId = nextAnomaly;
          this.hoveredAutopsyZone = null;
          this.syncVisualMeshes();
        }
      } else {
        _raycaster.layers.set(AUTOPSY_LAYER);
        _raycaster.far = 6.0;
        const hits = _raycaster.intersectObjects(Object.values(body.zoneMeshes), false);
        const nextZone = hits.length > 0 ? (hits[0].object.userData.autopsyZoneId as AutopsyZoneId) : null;
        if (nextZone !== this.hoveredAutopsyZone || this.hoveredAutopsyAnomalyId !== null) {
          this.hoveredAutopsyZone = nextZone;
          this.hoveredAutopsyAnomalyId = null;
          this.syncVisualMeshes();
        }
      }
      return;
    }

    const sens = this.controlSettings.mouseSensitivity * (this.isZooming ? 0.55 : 1.0);
    const ySign = this.controlSettings.invertY ? -1 : 1;

    if (this.isPointerLocked) {
      this.targetYaw -= e.movementX * 0.0022 * sens;
      this.targetPitch = THREE.MathUtils.clamp(
        this.targetPitch - e.movementY * 0.0022 * sens * ySign,
        -1.28,
        1.28,
      );
    } else if (this.isDraggingLook) {
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.targetYaw -= dx * 0.0035 * sens;
      this.targetPitch = THREE.MathUtils.clamp(
        this.targetPitch - dy * 0.0035 * sens * ySign,
        -1.28,
        1.28,
      );
    }
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (e.button === 2) {
      this.rightMouseDown = false;
    }
    if (e.button === 0) {
      this.isDraggingLook = false;
    }
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    const target = e.target as HTMLElement | null;
    const isTypingTarget =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement;

    if (isTypingTarget) {
      if (e.code === 'Escape') {
        target.blur();
      }
      return;
    }

    const wasDown = Boolean(this.keys[e.code]);
    this.keys[e.code] = true;

    if (this.screen === 'title' && (e.code === 'Enter' || e.code === 'Space')) {
      e.preventDefault();
      this.startNewGame();
      return;
    }

    if (e.code === 'Escape') {
      if (this.activeDialogueNpcId) {
        this.closeDialogue();
      } else if (this.activeAutopsyCaseId) {
        this.exitAutopsyMode();
      } else if (this.isNotebookOpen) {
        this.toggleNotebook();
      } else if (this.screen === 'playing') {
        this.pauseGame();
      } else if (this.screen === 'paused') {
        this.resumeGame();
      }
      return;
    }

    if (this.screen !== 'playing') return;

    if (this.activeAutopsyCaseId) {
      if (e.code === 'Digit1') this.selectAutopsyTool('magnifier');
      else if (e.code === 'Digit2') this.selectAutopsyTool('scalpel');
      else if (e.code === 'Digit3') this.selectAutopsyTool('forceps');
      else if (e.code === 'Digit4') this.selectAutopsyTool('camera');
      return;
    }

    if (this.activeDialogueNpcId) return;

    if (e.code === 'Tab') {
      e.preventDefault();
      this.toggleNotebook();
      return;
    }

    if (this.isNotebookOpen) return;

    if (e.code === 'KeyE' && !wasDown) {
      this.handleInteract();
    } else if (e.code === 'KeyF' && !wasDown) {
      this.toggleCandle();
    } else if (e.code === 'KeyM' && !wasDown) {
      this.toggleMute();
    } else if (e.code === 'KeyC' && !wasDown && this.controlSettings.crouchToggle) {
      this.crouchToggled = !this.crouchToggled;
      this.pushHudState(true);
    } else if (e.code === 'Space' && !wasDown && this.crouchToggled) {
      this.crouchToggled = false;
      this.pushHudState(true);
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys[e.code] = false;
  };

  private isInsideGasilhane(p: THREE.Vector3): boolean {
    return p.x >= -13.9 && p.x <= -7.1 && p.z >= 2.8 && p.z <= 9.2;
  }

  private isInsideAbandoned(p: THREE.Vector3): boolean {
    return p.x >= -13.8 && p.x <= -7.8 && p.z >= -13.3 && p.z <= -7.7;
  }

  private isInsideMuhtar(p: THREE.Vector3): boolean {
    return p.x >= 7.3 && p.x <= 13.7 && p.z >= -21.0 && p.z <= -15.0;
  }

  private isInsideClinic(p: THREE.Vector3): boolean {
    return p.x >= 22.3 && p.x <= 29.7 && p.z >= -31.3 && p.z <= -24.7;
  }

  private isInsideMill(p: THREE.Vector3): boolean {
    return p.x >= -39.1 && p.x <= -32.9 && p.z >= 5.1 && p.z <= 10.9;
  }

  private isInsideCrypt(p: THREE.Vector3): boolean {
    return p.x >= -34.7 && p.x <= -30.1 && p.z >= -41.6 && p.z <= -36.8;
  }

  private isOnBridge(p: THREE.Vector3): boolean {
    return p.x >= -27.4 && p.x <= -20.6 && p.z >= 6.4 && p.z <= 9.6;
  }

  private isUnderPorchOrAlcove(p: THREE.Vector3): boolean {
    const muhtarPorch = p.x >= 5.3 && p.x <= 7.4 && p.z >= -19.8 && p.z <= -16.2;
    const abandonedPorch = p.x >= -7.8 && p.x <= -6.1 && p.z >= -12.3 && p.z <= -8.7;
    const mosquePorch = p.x >= -6.3 && p.x <= -4.4 && p.z >= -1.8 && p.z <= 4.5;
    return muhtarPorch || abandonedPorch || mosquePorch;
  }

  private getCurrentDistrict(p: THREE.Vector3): DistrictId {
    if (Math.hypot(p.x - 26, p.z + 28) < 13) return 'clinic';
    if (p.x < -21 && p.z > -10) return 'mill';
    if (p.x < -20 && p.z <= -22) return 'cemetery';
    if (Math.hypot(p.x - 28, p.z - 20) < 13) return 'crash_site';
    return 'square';
  }

  private resolveCollisions(nextPos: THREE.Vector3): void {
    nextPos.x = THREE.MathUtils.clamp(nextPos.x, -46.5, 38.5);
    nextPos.z = THREE.MathUtils.clamp(nextPos.z, -48.5, 39.5);

    for (const c of this.world.colliders) {
      const closestX = THREE.MathUtils.clamp(nextPos.x, c.minX, c.maxX);
      const closestZ = THREE.MathUtils.clamp(nextPos.z, c.minZ, c.maxZ);
      const dx = nextPos.x - closestX;
      const dz = nextPos.z - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < PLAYER_RADIUS * PLAYER_RADIUS) {
        const dist = Math.sqrt(distSq) || 0.0001;
        const push = PLAYER_RADIUS - dist;
        if (distSq > 0.00001) {
          nextPos.x += (dx / dist) * push;
          nextPos.z += (dz / dist) * push;
        } else {
          const penLeft = Math.abs(nextPos.x - c.minX);
          const penRight = Math.abs(c.maxX - nextPos.x);
          const penTop = Math.abs(nextPos.z - c.minZ);
          const penBot = Math.abs(c.maxZ - nextPos.z);
          const minPen = Math.min(penLeft, penRight, penTop, penBot);
          if (minPen === penLeft) nextPos.x = c.minX - PLAYER_RADIUS;
          else if (minPen === penRight) nextPos.x = c.maxX + PLAYER_RADIUS;
          else if (minPen === penTop) nextPos.z = c.minZ - PLAYER_RADIUS;
          else nextPos.z = c.maxZ + PLAYER_RADIUS;
        }
      }
    }

    if (!this.gasilDoorOpen && Math.abs(nextPos.x - -7.1) < 0.45 && nextPos.z > 5.2 && nextPos.z < 6.8) {
      nextPos.x = nextPos.x > -7.1 ? -7.1 + 0.45 : -7.1 - 0.45;
    }
    if (!this.abandonedDoorOpen && Math.abs(nextPos.x - -7.8) < 0.45 && nextPos.z > -11.3 && nextPos.z < -9.7) {
      nextPos.x = nextPos.x > -7.8 ? -7.8 + 0.45 : -7.8 - 0.45;
    }
    if (!this.muhtarDoorOpen && Math.abs(nextPos.x - 7.3) < 0.45 && nextPos.z > -18.8 && nextPos.z < -17.2) {
      nextPos.x = nextPos.x > 7.3 ? 7.3 + 0.45 : 7.3 - 0.45;
    }
    if (!this.clinicDoorOpen && Math.abs(nextPos.x - 22.3) < 0.45 && nextPos.z > -28.8 && nextPos.z < -27.2) {
      nextPos.x = nextPos.x > 22.3 ? 22.3 + 0.45 : 22.3 - 0.45;
    }
    if (!this.millDoorOpen && Math.abs(nextPos.x - -32.9) < 0.45 && nextPos.z > 7.2 && nextPos.z < 8.8) {
      nextPos.x = nextPos.x > -32.9 ? -32.9 + 0.45 : -32.9 - 0.45;
    }
    if (!this.cryptDoorOpen && Math.abs(nextPos.z - -36.8) < 0.45 && nextPos.x > -33.15 && nextPos.x < -31.65) {
      nextPos.z = nextPos.z > -36.8 ? -36.8 + 0.45 : -36.8 - 0.45;
    }
  }

  private renderFrame(): void {
    if (this.isContextLost) return;
    if (this.postProcessing && !this.isSoftwareGl && this.resolvedQualityTier !== 'low') {
      this.postProcessing.update(
        this.elapsedTime,
        THREE.MathUtils.clamp(this.dreadLevel / 100, 0, 1),
        this.dangerProximity,
      );
      this.postProcessing.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  private evaluateAdaptiveQuality(rawDt: number): void {
    if (this.isSoftwareGl || this.screen !== 'playing' || this.controlSettings.graphicsQuality !== 'auto') {
      return;
    }
    const frameMs = THREE.MathUtils.clamp(rawDt * 1000, 4, 100);
    this.emaFrameMs = this.emaFrameMs * 0.9 + frameMs * 0.1;
    this.qualityEvalTimer += Math.min(rawDt, 0.1);
    if (this.qualityEvalTimer < 1.2) return;
    this.qualityEvalTimer = 0;

    let nextTier = this.resolvedQualityTier;
    if (this.emaFrameMs > 29) {
      nextTier = 'low';
    } else if (this.emaFrameMs > 22) {
      nextTier = this.resolvedQualityTier === 'high' ? 'medium' : 'low';
    } else if (this.emaFrameMs < 13.5) {
      nextTier = this.resolvedQualityTier === 'low' ? 'medium' : 'high';
    }

    if (nextTier !== this.resolvedQualityTier) {
      this.applyGraphicsQuality(nextTier);
      this.pushHudState(true);
    }
  }

  private startLoop(): void {
    const tick = () => {
      if (this.disposed) return;

      const rawDt = this.clock.getDelta();
      const dt = Math.min(rawDt, 0.05);
      this.elapsedTime += dt;

      this.evaluateAdaptiveQuality(rawDt);
      this.updateSimulation(dt);

      if (this.renderer.shadowMap.enabled && !this.isSoftwareGl && this.shadowRefreshStride > 0) {
        this.shadowFrameCounter += 1;
        if (this.shadowFrameCounter >= this.shadowRefreshStride) {
          this.shadowFrameCounter = 0;
          this.renderer.shadowMap.needsUpdate = true;
        }
      }

      this.renderFrame();

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.afterDraw(tick);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private updateSimulation(dt: number): void {
    // Animate watermill wheel constantly
    if (this.world?.millAndBridge) {
      this.world.millAndBridge.wheelPivot.rotation.x += dt * 0.72;
    }

    // 1. Title Screen Camera Orbit
    if (this.screen === 'title') {
      const t = this.elapsedTime * 0.14;
      this.camera.position.set(
        Math.sin(t) * 8.5,
        groundHeightAt(0, 12) + 4.2 + Math.sin(t * 1.4) * 0.45,
        16.5 + Math.cos(t) * 4.5,
      );
      this.camera.lookAt(-5.5, 2.4, 2.0);
      this.dangerProximity = 0;
      this.updateEnvironmentVisuals(dt, false, 0);
      return;
    }

    if (this.screen !== 'playing') return;

    // 2. NPC Patrols (zero-GC index loop)
    for (let i = 0; i < this.npcKeys.length; i++) {
      const nid = this.npcKeys[i];
      updateNpcActorPatrol(
        this.world.npcs[nid],
        dt,
        this.playerPos,
        this.activeDialogueNpcId === nid,
        this.elapsedTime,
      );
    }

    // 2b. Close-up Autopsy & Crime Scene Camera Mode
    if (this.activeAutopsyCaseId) {
      _autopsyCamPos.copy(this.autopsyCamPos);
      _autopsyCamPos.x += this.autopsyPanOffset.x;
      _autopsyCamPos.y += this.autopsyPanOffset.y;
      _autopsyLookPos.copy(this.autopsyLookTarget);
      this.camera.position.lerp(_autopsyCamPos, Math.min(1, dt * 8));
      this.camera.lookAt(_autopsyLookPos);
      this.handCandle.root.visible = false;
      this.handCandle.light.intensity = 0;

      const flashLight = this.world.autopsyLights.flashLight;
      if (flashLight.intensity > 0) {
        flashLight.intensity = Math.max(0, flashLight.intensity - dt * 18);
      }
      if (this.cameraFlashAlpha > 0) {
        this.cameraFlashAlpha = Math.max(0, this.cameraFlashAlpha - dt * 2.8);
        this.pushHudState(true, true, false, 0);
      } else if (this.elapsedTime - this.lastHudPush > 0.22) {
        this.pushHudState(false, true, false, 0);
      }

      if (this.captionText && this.elapsedTime > this.captionTimeout) {
        this.captionText = null;
        this.pushHudState(true, true, false, 0);
      }

      this.updateEnvironmentVisuals(dt, true, 0);
      return;
    } else if (this.handCandle) {
      this.handCandle.root.visible = this.candleLit;
      if (!this.candleLit) {
        this.handCandle.light.intensity = 0;
      }
    }

    // 3. Look, Turn & Focus Zoom
    const blocked = this.isOverlayBlockingMove();
    if (!blocked) {
      const turnRate = 1.75 * this.controlSettings.mouseSensitivity * (this.isZooming ? 0.58 : 1.0);
      const ySign = this.controlSettings.invertY ? -1 : 1;
      if (this.keys['ArrowLeft']) this.targetYaw += turnRate * dt;
      if (this.keys['ArrowRight']) this.targetYaw -= turnRate * dt;
      if (this.keys['ArrowUp'])
        this.targetPitch = THREE.MathUtils.clamp(this.targetPitch + 1.15 * ySign * dt, -1.28, 1.28);
      if (this.keys['ArrowDown'])
        this.targetPitch = THREE.MathUtils.clamp(this.targetPitch - 1.15 * ySign * dt, -1.28, 1.28);
    }

    // Gentle camera focus toward NPC face while talking
    if (this.activeDialogueNpcId) {
      const actor = this.world.npcs[this.activeDialogueNpcId];
      if (actor) {
        const dx = actor.pos.x - this.playerPos.x;
        const dz = actor.pos.z - this.playerPos.z;
        const desiredYaw = Math.atan2(-dx, -dz);
        let diff = desiredYaw - this.targetYaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.targetYaw += diff * Math.min(1, dt * 5);
        this.targetPitch = THREE.MathUtils.damp(this.targetPitch, -0.05, 5, dt);
      }
    }

    if (this.controlSettings.lookSmoothing) {
      this.yaw = THREE.MathUtils.damp(this.yaw, this.targetYaw, 30, dt);
      this.pitch = THREE.MathUtils.damp(this.pitch, this.targetPitch, 30, dt);
    } else {
      this.yaw = this.targetYaw;
      this.pitch = this.targetPitch;
    }

    this.isZooming = !blocked && (this.rightMouseDown || Boolean(this.keys['KeyV']));

    // 4. Inertial Player Movement, Crouch & Stamina
    const holdCrouch =
      Boolean(this.keys['ControlLeft']) ||
      (!this.controlSettings.crouchToggle && Boolean(this.keys['KeyC']));
    const crouching = this.controlSettings.crouchToggle ? this.crouchToggled || holdCrouch : holdCrouch;
    this.isCrouching = crouching;

    let moveZ = 0;
    let moveX = 0;
    if (!blocked) {
      if (this.keys['KeyW']) moveZ += 1;
      if (this.keys['KeyS']) moveZ -= 1;
      if (this.keys['KeyA']) moveX -= 1;
      if (this.keys['KeyD']) moveX += 1;
      moveX = THREE.MathUtils.clamp(moveX + this.virtualMoveX, -1, 1);
      moveZ = THREE.MathUtils.clamp(moveZ + this.virtualMoveY, -1, 1);
    }

    const wantsMove = Math.hypot(moveX, moveZ) > 0.05;
    const wantsSprint =
      Boolean(this.keys['ShiftLeft'] || this.keys['ShiftRight'] || this.virtualSprint) &&
      wantsMove &&
      !crouching &&
      !this.isZooming;

    if (wantsSprint && !this.staminaExhausted) {
      this.stamina = Math.max(0, this.stamina - 12 * dt);
      if (this.stamina <= 0.5) {
        this.staminaExhausted = true;
      }
      this.isSprinting = true;
    } else {
      const regenRate = wantsMove ? 14 : 24;
      this.stamina = Math.min(100, this.stamina + regenRate * dt);
      if (this.staminaExhausted && this.stamina >= 25) {
        this.staminaExhausted = false;
      }
      this.isSprinting = false;
    }

    const targetSpeed = crouching ? 2.2 : this.isSprinting ? 5.2 : 3.7;
    const insideGasil = this.isInsideGasilhane(this.playerPos);
    const insideAbandoned = this.isInsideAbandoned(this.playerPos);
    const insideMuhtar = this.isInsideMuhtar(this.playerPos);
    const insideClinic = this.isInsideClinic(this.playerPos);
    const insideMill = this.isInsideMill(this.playerPos);
    const insideCrypt = this.isInsideCrypt(this.playerPos);
    const onBridge = this.isOnBridge(this.playerPos);
    const isIndoors =
      insideGasil || insideAbandoned || insideMuhtar || insideClinic || insideMill || insideCrypt;

    const currentDistrict = this.getCurrentDistrict(this.playerPos);
    if (!this.discoveredDistricts.has(currentDistrict)) {
      this.discoveredDistricts.add(currentDistrict);
    }

    _forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
    _right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();
    _vec3.set(0, 0, 0).addScaledVector(_forward, moveZ).addScaledVector(_right, moveX);
    if (_vec3.lengthSq() > 1.0) {
      _vec3.normalize();
    }
    _vec3.multiplyScalar(targetSpeed);

    const accelLambda = wantsMove ? 16 : 14;
    this.playerVel.x = THREE.MathUtils.damp(this.playerVel.x, _vec3.x, accelLambda, dt);
    this.playerVel.z = THREE.MathUtils.damp(this.playerVel.z, _vec3.z, accelLambda, dt);

    const horizSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
    if (horizSpeed > 0.04) {
      this.playerPos.x += this.playerVel.x * dt;
      this.playerPos.z += this.playerVel.z * dt;
      this.resolveCollisions(this.playerPos);
      this.headBobPhase += dt * (2.6 + horizSpeed * 1.9);
      if (horizSpeed > 0.85) {
        this.audio.playFootstep(isIndoors, this.elapsedTime);
      }
    }

    const groundY = isIndoors
      ? (insideGasil
          ? groundHeightAt(-10.5, 6.0) + 0.16
          : insideAbandoned
            ? groundHeightAt(-10.8, -10.5) + 0.16
            : insideMuhtar
              ? groundHeightAt(10.5, -18.0) + 0.16
              : insideClinic
                ? groundHeightAt(26.0, -28.0) + 0.16
                : insideMill
                  ? groundHeightAt(-36.0, 8.0) + 0.16
                  : groundHeightAt(-34.0, -36.0) + 0.14)
      : onBridge
        ? 0.44
        : groundHeightAt(this.playerPos.x, this.playerPos.z);

    const bobAmp = THREE.MathUtils.clamp(horizSpeed / 3.5, 0, 1.2) * (crouching ? 0.02 : 0.032);
    const targetEyeY = groundY + (crouching ? 1.12 : PLAYER_EYE_HEIGHT) + Math.sin(this.headBobPhase) * bobAmp;
    this.camera.position.x = this.playerPos.x;
    this.camera.position.z = this.playerPos.z;
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, targetEyeY, 14, dt);

    const targetRoll = !blocked ? -moveX * 0.013 : 0;
    this.cameraRoll = THREE.MathUtils.damp(this.cameraRoll, targetRoll, 10, dt);
    this.camera.rotation.set(this.pitch, this.yaw, this.cameraRoll, 'YXZ');

    const targetFov = this.isZooming ? 42 : this.isSprinting && horizSpeed > 2.5 ? 68.5 : 64;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 11, dt);
      this.camera.updateProjectionMatrix();
    }

    // 5. Doors & Shutters Damping
    this.gasilDoorAngle = THREE.MathUtils.damp(this.gasilDoorAngle, this.gasilDoorOpen ? -Math.PI * 0.56 : 0, 7, dt);
    this.world.gasil.doorPivot.rotation.y = this.gasilDoorAngle;

    this.abandonedDoorAngle = THREE.MathUtils.damp(
      this.abandonedDoorAngle,
      this.abandonedDoorOpen ? -Math.PI * 0.56 : 0,
      7,
      dt,
    );
    this.world.abandoned.doorPivot.rotation.y = this.abandonedDoorAngle;

    this.muhtarDoorAngle = THREE.MathUtils.damp(this.muhtarDoorAngle, this.muhtarDoorOpen ? Math.PI * 0.56 : 0, 7, dt);
    this.world.muhtar.doorPivot.rotation.y = this.muhtarDoorAngle;

    this.clinicDoorAngle = THREE.MathUtils.damp(this.clinicDoorAngle, this.clinicDoorOpen ? Math.PI * 0.56 : 0, 7, dt);
    this.world.clinic.doorPivot.rotation.y = this.clinicDoorAngle;

    this.millDoorAngle = THREE.MathUtils.damp(this.millDoorAngle, this.millDoorOpen ? -Math.PI * 0.56 : 0, 7, dt);
    this.world.millAndBridge.doorPivot.rotation.y = this.millDoorAngle;

    this.cryptDoorAngle = THREE.MathUtils.damp(this.cryptDoorAngle, this.cryptDoorOpen ? -Math.PI * 0.58 : 0, 7, dt);
    this.world.cemetery.doorPivot.rotation.y = this.cryptDoorAngle;

    this.shutterAngle = THREE.MathUtils.damp(this.shutterAngle, this.shutterClosed ? 0 : Math.PI * 0.62, 9, dt);
    this.world.gasil.shutterPivot.rotation.y = this.shutterAngle;

    // 6. Candle Flicker, Sway & Oil
    if (this.candleLit) {
      this.candleOil = Math.max(8, this.candleOil - dt * 0.1);
      const flicker = 0.88 + Math.sin(this.elapsedTime * 19) * 0.08 + Math.sin(this.elapsedTime * 31) * 0.06;
      this.handCandle.light.intensity = 4.4 * flicker;
      this.handCandle.flame.scale.set(1, flicker, 1);
      const swayAmp = THREE.MathUtils.clamp(horizSpeed / 4.2, 0.08, 1);
      this.handCandle.root.position.set(
        0.32 + Math.cos(this.headBobPhase * 0.5) * 0.014 * swayAmp,
        -0.34 + Math.sin(this.headBobPhase) * 0.015 * swayAmp,
        -0.52,
      );
    } else {
      this.handCandle.light.intensity = 0;
    }

    // 7. Rule 1: Sabır Mumu Vigil outside Gasilhane once gusül has started
    if ((this.act === 3 || this.act === 4) && this.stepWashDone && !insideGasil) {
      if (!this.vigilLit && !this.leftGasilWithoutVigilFlagged) {
        this.leftGasilWithoutVigilFlagged = true;
        this.unlockGlossaryEntry('anom_vigil');
        this.violateRule(
          'rule_alone',
          'KURAL İHLALİ: Ölüyü Sabır Mumu yakmadan yalnız bıraktın! Arkandan bir kapı çarptı.',
        );
        this.syncVisualMeshes();
      }
      this.vigilTimer = Math.max(0, this.vigilTimer - dt * (this.vigilLit ? 0.55 : 1.5));
      if (this.vigilTimer <= 0 && !this.leftGasilWithoutVigilFlagged) {
        this.leftGasilWithoutVigilFlagged = true;
        this.unlockGlossaryEntry('anom_vigil');
        this.violateRule(
          'rule_alone',
          'Sabır Mumu söndü! Gasilhanede mermer taş üzerinden bir sürtünme sesi geldi.',
        );
        this.syncVisualMeshes();
      }
    }

    // 8. Rule 3: Window Anomaly Stare Check
    if (this.windowAnomalyActive && !this.shutterClosed && insideGasil) {
      this.camera.getWorldDirection(_vec3);
      _vec3b
        .set(-13.8, groundHeightAt(-10.5, 6.0) + 2.1, 6.0)
        .sub(this.camera.position)
        .normalize();
      if (_vec3.dot(_vec3b) > 0.86) {
        this.windowStareTimer += dt;
        this.dreadLevel = Math.min(100, this.dreadLevel + dt * 14);
        if (this.windowStareTimer > 2.2) {
          this.windowAnomalyActive = false;
          this.windowAnomalyResolved = true;
          this.world.gasil.windowShadowFigure.visible = false;
          this.violateRule(
            'rule_window',
            'KURAL İHLALİ: Pencereye tıklayana baktın! Camdaki gölge adını fısıldayıp kayboldu.',
          );
        }
      } else {
        this.windowStareTimer = Math.max(0, this.windowStareTimer - dt * 0.5);
      }
    }

    // 8b. Dynamic Folk Horror Environment Trigger: High Dread near Morgue Window
    let whisperDangerPulse = 0;
    _morgueWindowPos.set(-13.8, groundHeightAt(-10.5, 6.0) + 1.6, 6.0);
    const distToMorgueWindow = this.playerPos.distanceTo(_morgueWindowPos);

    if (
      !blocked &&
      !this.windowAnomalyActive &&
      this.dreadLevel >= 55 &&
      distToMorgueWindow < 4.8 &&
      this.elapsedTime >= this.nextWindowWhisperTime
    ) {
      this.audio.playWhisper();
      if (this.unlockGlossaryEntry('anom_window')) {
        this.pushHudState(true);
      }
      this.nextWindowWhisperTime = this.elapsedTime + 9 + Math.random() * 9;
      this.windowWhisperFxDuration = 1.45 + Math.random() * 0.85;
      this.windowWhisperFxTimer = this.windowWhisperFxDuration;
      this.windowWhisperVariant = Math.floor(Math.random() * 3);

      if (this.elapsedTime >= this.windowWhisperNextCaptionTime && !this.captionText) {
        const whisperLines = [
          'Morg penceresinin ardından boğuk bir fısıltı yükseldi...',
          'Buzlu camın ötesinde soğuk bir nefes kepengi titretti...',
          'Camın arkasından adını fısıldayan kısık bir ses duydun...',
        ];
        this.showCaption(whisperLines[this.windowWhisperVariant % whisperLines.length], 3.8);
        this.windowWhisperNextCaptionTime = this.elapsedTime + 22;
      }
    }

    if (this.windowWhisperFxTimer > 0 && !this.windowAnomalyActive) {
      this.windowWhisperFxTimer = Math.max(0, this.windowWhisperFxTimer - dt);
      const windowGlowMat = this.world.gasil.windowGlowMesh.material as THREE.MeshStandardMaterial;

      if (this.windowWhisperFxTimer > 0) {
        const progress = 1 - this.windowWhisperFxTimer / Math.max(0.1, this.windowWhisperFxDuration);
        const env = Math.sin(progress * Math.PI);
        const flicker = Math.sin(this.elapsedTime * 29) * 0.5 + 0.5;

        windowGlowMat.emissive
          .copy(_whisperBaseEmissive)
          .lerp(_whisperAnomalyEmissive, env * (0.55 + flicker * 0.45));
        windowGlowMat.emissiveIntensity = 0.85 + env * (0.5 + flicker * 0.35);

        this.world.gasil.shutterPivot.rotation.y =
          this.shutterAngle + Math.sin(this.elapsedTime * 42) * 0.036 * env;

        const showFleetingShadow =
          !this.shutterClosed &&
          (this.windowWhisperVariant === 0 || this.windowWhisperVariant === 2) &&
          env > 0.32 &&
          flicker > 0.3;
        this.world.gasil.windowShadowFigure.visible = showFleetingShadow;
        if (showFleetingShadow) {
          this.world.gasil.windowShadowFigure.position.set(
            -4.25,
            1.42 + Math.sin(this.elapsedTime * 6) * 0.04,
            Math.sin(this.elapsedTime * 4.2) * 0.32,
          );
        }
        whisperDangerPulse = 0.24 * env;
      } else {
        windowGlowMat.emissive.copy(_whisperBaseEmissive);
        windowGlowMat.emissiveIntensity = 0.85;
        this.world.gasil.windowShadowFigure.position.set(-4.25, 1.45, 0);
        this.world.gasil.windowShadowFigure.visible = false;
      }
    }

    // 9. Nocturnal Threats (Acts 3-5): Kara Basma & Sis Gözcüsü
    let dangerProximity = 0;
    const isHiding = isIndoors || ((this.isUnderPorchOrAlcove(this.playerPos) || crouching) && !this.candleLit);

    if (this.act >= 3) {
      // Kara Basma patrols center/clinic roads
      this.karaPatrolT += dt * (this.act >= 4 ? 0.26 : 0.21);
      const kz = Math.sin(this.karaPatrolT) * 20.0 - 6.0;
      const kx = Math.cos(this.karaPatrolT * 0.72) * 8.0;
      const ky = groundHeightAt(kx, kz);
      this.world.karaBasma.root.position.set(kx, ky, kz);

      // Sis Gözcüsü patrols stream bridge & cemetery hill
      this.sisPatrolT += dt * 0.18;
      const sx = -26 + Math.sin(this.sisPatrolT) * 9.0;
      const sz = -14 + Math.cos(this.sisPatrolT * 0.8) * 18.0;
      const sy = groundHeightAt(sx, sz);
      this.world.sisGozcusu.position.set(sx, sy + Math.sin(this.elapsedTime * 2.1) * 0.08, sz);
      this.world.sisGozcusu.lookAt(this.playerPos.x, sy, this.playerPos.z);

      const dKara = this.playerPos.distanceTo(this.world.karaBasma.root.position);
      const dSis = this.playerPos.distanceTo(this.world.sisGozcusu.position);
      if (dKara < 14.0 && this.unlockGlossaryEntry('anom_karabasma')) {
        this.pushHudState(true);
      }
      if (dSis < 15.0 && this.unlockGlossaryEntry('anom_sisgozcusu')) {
        this.pushHudState(true);
      }
      const closestThreat = Math.min(dKara, dSis);
      const threatObj = dKara <= dSis ? this.world.karaBasma.root : this.world.sisGozcusu;
      dangerProximity = THREE.MathUtils.clamp(1 - (closestThreat - 2.2) / 14.0, 0, 1);

      if (this.karaCatchCooldown > 0) this.karaCatchCooldown -= dt;

      if (!isIndoors && closestThreat < 12.0 && !blocked) {
        const playerExposed = this.candleLit || !isHiding;
        if (playerExposed && closestThreat < 10.5) {
          if (this.candleLit) {
            this.handCandle.light.intensity *= 0.45 + Math.random() * 0.4;
          }
          _vec3.subVectors(this.playerPos, threatObj.position);
          _vec3.y = 0;
          if (_vec3.lengthSq() > 0.01) {
            _vec3.normalize();
            threatObj.position.addScaledVector(_vec3, dt * (this.candleLit ? 2.5 : 1.35));
            threatObj.lookAt(this.playerPos.x, threatObj.position.y, this.playerPos.z);
          }

          if (closestThreat < 2.15 && this.karaCatchCooldown <= 0) {
            this.karaCatchCooldown = 6.5;
            this.caughtCount += 1;
            if (this.caughtCount >= 3) {
              this.screen = 'game_over';
              this.endingReason = 'Kara Basma ve Sis Gözcüsü seni yağmurlu sokakta yakaladı. Köyün sisi seni yuttu.';
              if (document.pointerLockElement === this.renderer.domElement) {
                document.exitPointerLock();
              }
              this.pushHudState(true);
              return;
            } else {
              this.violateRule(
                'rule_dark',
                'Karanlık gölge üzerine çöktü! Son anda kenara savruldun — eğil [C] ve mumunu söndür [F]!',
              );
              this.candleLit = false;
              this.handCandle.root.visible = false;
            }
          }
        }
      }

      this.world.karaBasma.root.position.y += Math.sin(this.elapsedTime * 3.2) * 0.06;
    }

    // 9b. Modular Spatial Dread-Level Listener (whispers & floorboard creaks when dread > 70% & stationary)
    this.dreadListener.update(dt, {
      elapsedTime: this.elapsedTime,
      dreadLevel: this.dreadLevel,
      playerX: this.playerPos.x,
      playerZ: this.playerPos.z,
      playerSpeed: horizSpeed,
      isBlocked: blocked,
    });
    this.hallucinationPulse = Math.max(0, this.hallucinationPulse - dt * 0.45);

    this.dangerProximity = Math.max(dangerProximity, whisperDangerPulse, this.hallucinationPulse);

    // 10. Dynamic Dread Level
    const targetFloorDread =
      (this.act - 1) * 9 +
      this.violations * 14 +
      (this.gasilBulbOut && insideGasil && !this.vigilLit ? 15 : 0);

    if (dangerProximity > 0.2) {
      this.dreadLevel = Math.min(100, this.dreadLevel + dangerProximity * 18 * dt);
    } else if (!isIndoors && !this.candleLit && this.act >= 2) {
      this.dreadLevel = Math.min(100, this.dreadLevel + 2.4 * dt);
    } else if (isIndoors && (this.candleLit || this.vigilLit || !this.gasilBulbOut)) {
      this.dreadLevel = THREE.MathUtils.damp(this.dreadLevel, Math.min(90, targetFloorDread), 0.35, dt);
    } else {
      this.dreadLevel = Math.max(targetFloorDread, this.dreadLevel - 1.2 * dt);
    }

    // 11. Environment, Mist, Rain, Thunder & Audio
    this.updateEnvironmentVisuals(dt, isIndoors, this.dangerProximity);

    // 12. Center Reticle Raycasting (throttled ~16Hz with cached mesh array & zero-GC intersection target)
    if (!blocked) {
      this.raycastTimer += dt;
      if (this.raycastTimer >= 0.06) {
        this.raycastTimer = 0;
        _raycaster.setFromCamera(_centerNdc, this.camera);
        _raycaster.layers.set(1);
        _raycaster.far = 4.6;
        this._rayHits.length = 0;
        const hits = _raycaster.intersectObjects(this.world.interactableMeshes, false, this._rayHits);

        let foundId: string | null = null;
        let foundLabel: string | null = null;
        if (hits.length > 0) {
          const hitId = hits[0].object.userData.interactId as string;
          const interactables = this.world.interactables;
          for (let i = 0; i < interactables.length; i++) {
            const target = interactables[i];
            if (target.id === hitId) {
              if (hits[0].distance <= target.maxDist) {
                const lbl = target.label();
                if (lbl) {
                  foundId = hitId;
                  foundLabel = lbl;
                }
              }
              break;
            }
          }
        }
        if (foundId !== this.activeInteractId || foundLabel !== this.activeInteractLabel) {
          this.activeInteractId = foundId;
          this.activeInteractLabel = foundLabel;
          this.pushHudState(true);
        }
      }
    }

    if (this.captionText && this.elapsedTime > this.captionTimeout) {
      this.captionText = null;
      this.pushHudState(true);
    }

    if (this.saveNoticeText && this.elapsedTime > this.saveNoticeTimeout) {
      this.saveNoticeText = null;
      this.pushHudState(true);
    }

    if (this.elapsedTime - this.lastHudPush > 0.22) {
      this.pushHudState(false, isIndoors, isHiding, this.dangerProximity);
    }
  }

  private updateEnvironmentVisuals(dt: number, isIndoors: boolean, dangerProximity: number): void {
    const targetBgHex = this.act === 1 ? 0x212936 : 0x080b10;
    const baseFogDensity = this.act === 1 ? 0.022 : this.act >= 3 ? 0.044 : 0.032;
    const targetFogDensity =
      this.resolvedQualityTier === 'low' ? Math.max(baseFogDensity, 0.034) : baseFogDensity;

    if (this.scene.background instanceof THREE.Color) {
      _vec3.set((targetBgHex >> 16) & 255, (targetBgHex >> 8) & 255, targetBgHex & 255).divideScalar(255);
      this.scene.background.r = THREE.MathUtils.damp(this.scene.background.r, _vec3.x, 1.5, dt);
      this.scene.background.g = THREE.MathUtils.damp(this.scene.background.g, _vec3.y, 1.5, dt);
      this.scene.background.b = THREE.MathUtils.damp(this.scene.background.b, _vec3.z, 1.5, dt);
    }

    if (this.scene.fog instanceof THREE.FogExp2 && this.scene.background instanceof THREE.Color) {
      this.scene.fog.color.copy(this.scene.background);
      this.scene.fog.density = THREE.MathUtils.damp(this.scene.fog.density, targetFogDensity, 1.5, dt);
    }

    const targetKey = this.act === 1 ? 1.35 : 0.28 + this.stormFlashIntensity;
    const iblBoost = this.scene.environment === null ? 0.14 : 0;
    this.world.sunKeyLight.intensity = THREE.MathUtils.damp(this.world.sunKeyLight.intensity, targetKey, 4, dt);
    this.world.hemiLight.intensity = THREE.MathUtils.damp(
      this.world.hemiLight.intensity,
      (this.act === 1 ? 0.72 : 0.34) + iblBoost,
      2,
      dt,
    );

    const mistSprites = this.world.mistSprites;
    for (let idx = 0; idx < mistSprites.length; idx++) {
      const sp = mistSprites[idx];
      if (!sp.visible) continue;
      const baseX = sp.userData.baseX as number;
      sp.position.x = baseX + Math.sin(this.elapsedTime * 0.25 + idx) * 2.1;
    }

    const rainLevel = this.act === 1 ? 0.15 : this.act >= 3 ? 1.0 : 0.45;
    this.world.rainUniforms.uTime.value = this.elapsedTime;
    this.world.rainUniforms.uPlayerPos.value.copy(this.camera.position);
    this.world.rainUniforms.uOpacity.value = rainLevel * 0.58;
    this.world.rainUniforms.uSpeed.value = 11 + rainLevel * 7;

    if (this.act >= 3 && this.elapsedTime > this.nextThunderTime) {
      this.nextThunderTime = this.elapsedTime + 14 + Math.random() * 14;
      this.stormFlashIntensity = 2.8;
      this.audio.playThunder();
    }
    this.stormFlashIntensity = Math.max(0, this.stormFlashIntensity - dt * 6.5);

    // Streetlight & Hazard flicker on virtual light definitions before pool assignment
    const streetLights = this.world.streetLights;
    for (let idx = 0; idx < streetLights.length; idx++) {
      const sl = streetLights[idx];
      const f =
        this.act >= 3 && Math.sin(this.elapsedTime * (8 + idx * 3)) > 0.92
          ? 0.25
          : 0.94 + Math.sin(this.elapsedTime * 5 + idx) * 0.06;
      sl.light.intensity = sl.baseIntensity * f;
    }

    if (this.world.crashSite) {
      const blink = Math.sin(this.elapsedTime * 5.2) > 0.15 ? 3.2 : 0.12;
      this.world.crashSite.hazardLight.intensity = blink;
    }

    this.world.abandoned.emberLight.intensity = 1.9 + Math.sin(this.elapsedTime * 7.5) * 0.35;

    if (this.gasilBulbOut) {
      this.world.gasil.ceilingLight.intensity = 0.0;
      this.world.gasil.ceilingBulbMat.emissiveIntensity = 0.05;
    } else if (this.windowAnomalyActive) {
      const bf = Math.sin(this.elapsedTime * 34) > 0.3 ? 1.0 : 0.18;
      this.world.gasil.ceilingLight.intensity = 6.2 * bf;
      this.world.gasil.ceilingBulbMat.emissiveIntensity = 1.4 * bf;
    } else if (this.windowWhisperFxTimer > 0 && this.windowWhisperVariant === 2) {
      const dip = 0.78 + Math.sin(this.elapsedTime * 34) * 0.16;
      this.world.gasil.ceilingLight.intensity = 6.2 * dip;
      this.world.gasil.ceilingBulbMat.emissiveIntensity = 1.4 * dip;
    } else {
      this.world.gasil.ceilingLight.intensity = 6.2;
      this.world.gasil.ceilingBulbMat.emissiveIntensity = 1.4;
    }

    this.updateWorldLightPool();

    this.audio.updateAmbience({
      time: this.elapsedTime,
      isIndoors,
      rainIntensity: rainLevel,
      dread: this.dreadLevel / 100,
      danger: dangerProximity,
    });
  }

  private updateWorldLightPool(): void {
    const vLights = this.world.virtualLights;
    const pool = this.world.worldLightPool;
    const limit = Math.min(this.maxPoolLights, pool.length);

    for (let k = 0; k < limit; k++) {
      this._topLights[k] = null;
      this._topDistSq[k] = Infinity;
    }

    for (let i = 0; i < vLights.length; i++) {
      const vl = vLights[i];
      if (vl.light.intensity <= 0.01) continue;
      vl.anchor.getWorldPosition(vl.worldPos);
      const distSq = vl.worldPos.distanceToSquared(this.camera.position);
      if (distSq > this.lightCullDistSq) continue;

      if (distSq < this._topDistSq[limit - 1]) {
        let insertAt = limit - 1;
        while (insertAt > 0 && distSq < this._topDistSq[insertAt - 1]) {
          this._topDistSq[insertAt] = this._topDistSq[insertAt - 1];
          this._topLights[insertAt] = this._topLights[insertAt - 1];
          insertAt--;
        }
        this._topDistSq[insertAt] = distSq;
        this._topLights[insertAt] = vl;
      }
    }

    for (let k = 0; k < pool.length; k++) {
      const pLight = pool[k];
      const src = k < limit ? this._topLights[k] : null;
      if (src) {
        pLight.position.copy(src.worldPos);
        pLight.color.copy(src.light.color);
        pLight.intensity = src.light.intensity;
        pLight.distance = src.light.distance;
        pLight.decay = src.light.decay;
      } else {
        pLight.intensity = 0;
      }
    }
  }

  private getObjectiveText(): { actTitle: string; objective: string; location: string } {
    const insideGasil = this.isInsideGasilhane(this.playerPos);
    const insideAbandoned = this.isInsideAbandoned(this.playerPos);
    const insideMuhtar = this.isInsideMuhtar(this.playerPos);
    const insideClinic = this.isInsideClinic(this.playerPos);
    const insideMill = this.isInsideMill(this.playerPos);
    const insideCrypt = this.isInsideCrypt(this.playerPos);
    const district = this.getCurrentDistrict(this.playerPos);

    const location = insideGasil
      ? 'Gasilhane (Gusül Odası)'
      : insideAbandoned
        ? 'Eski Köy Evi'
        : insideMuhtar
          ? 'Muhtarın Odası'
          : insideClinic
            ? 'Sağlık Ocağı · Otopsi'
            : insideMill
              ? 'Eski Su Değirmeni'
              : insideCrypt
                ? 'Mezarlık · Taş Mahzen'
                : district === 'clinic'
                  ? 'Yukarı Mahalle · Sağlık Ocağı Önü'
                  : district === 'mill'
                    ? 'Dere Köprüsü & Değirmen Kıyısı'
                    : district === 'cemetery'
                      ? 'Mezarlık Tepesi'
                      : district === 'crash_site'
                        ? 'Viraj Kaza Alanı'
                        : 'Kuzdağ Köy Meydanı';

    if (this.act === 1) {
      const collectedCount = ['defter', 'kefen', 'sabun', 'ibrik'].filter(
        (id) => this.inventory.find((i) => i.id === id)?.collected,
      ).length;
      if (!this.autopsyCases.case_arif.completed) {
        return {
          actTitle: 'BÖLÜM I · İLK OTOPSİ VE HAZIRLIK',
          objective: `Malzemeleri topla (${collectedCount}/4), Bekçi Hasan’la konuş ve Teneşirde Vaka I otopsisini tamamla`,
          location,
        };
      }
      if (collectedCount < 4) {
        return {
          actTitle: 'BÖLÜM I · HAZIRLIK',
          objective: `Köydeki gusül malzemelerini topla (${collectedCount}/4) ve Bekçi Hasan’a rapor ver`,
          location,
        };
      }
      return {
        actTitle: 'BÖLÜM I · İLK OTOPSİ VE HAZIRLIK',
        objective: 'Gasilhaneye girip gusle başla veya Vaka I kanıtıyla Bekçi Hasan’la konuş',
        location,
      };
    }

    if (this.act === 2) {
      let objective = 'Bekçi Hasan’dan Sağlık Ocağı Anahtarını al ve Şoför Mahmut’a otopsi yap';
      if (!this.stepPrepDone) {
        objective = 'Teneşirde setr-i avret örtüsünü ser veya Sağlık Ocağına git';
      } else if (!this.stepWashDone) {
        objective = 'Sabunlu ılık su ile cenazeyi sağdan sola yıka';
      } else if (this.windowAnomalyActive && !this.shutterClosed) {
        objective = 'Pencereye bakma! Sol duvardaki ahşap kepengi kapat';
      } else if (this.dirtyBasinReady && !this.dirtyBasinDrained) {
        objective = 'Kirli su leğenini gasilhane içindeki taş gidere dök';
      } else if (!this.inventory.find((i) => i.id === 'clinic_key')?.collected) {
        objective = 'Sabır Mumunu yak · Dışarıda Bekçi Hasan’la konuşup Sağlık Ocağı Anahtarını al';
      } else {
        objective = 'Doğu yolundaki Sağlık Ocağına gir · Şoför Mahmut üzerinde Vaka II otopsisini çöz';
      }
      return {
        actTitle: 'BÖLÜM II · SAĞLIK OCAĞI & VAKA II',
        objective,
        location,
      };
    }

    if (this.act === 3) {
      const hasMillLedger = this.clues.find((c) => c.id === 'clue_mill_ledger')?.discovered;
      const objective = !hasMillLedger
        ? 'Dere Köprüsünden Eski Su Değirmenine geç · Boğanak otunu ve Değirmen Zehir Kaydını bul'
        : 'Viraj Kaza Alanını incele, Eski Evden Gülsuyu al ve Katip Kenan’la yüzleş!';
      return {
        actTitle: 'BÖLÜM III · DEĞİRMEN & VİRAJ',
        objective,
        location,
      };
    }

    if (this.act === 4) {
      const hasCryptKey = this.inventory.find((i) => i.id === 'crypt_key')?.collected;
      const objective = !hasCryptKey
        ? 'Mezarlık Tepesindeki Mezarcı İdris’ten Taş Mahzen Anahtarını al'
        : 'Taş Mahzene gir ve İsimsiz Yolcu (Vaka III) otopsisini çöz';
      return {
        actTitle: 'BÖLÜM IV · MEZARLIK & TAŞ MAHZEN',
        objective,
        location,
      };
    }

    const hasKafur = this.inventory.find((i) => i.id === 'kafur')?.collected;
    const hasGulsuyu = this.inventory.find((i) => i.id === 'gulsuyu')?.collected;
    return {
      actTitle: 'BÖLÜM V · SON VAZİFE VE ŞAFAK',
      objective: !hasKafur
        ? 'Muhtarlık odasına gir · Belgeleri incele ve Kafur Kavanozunu al'
        : !hasGulsuyu
          ? 'Eski Köy Evinden Gülsuyu & Temiz Havlu al'
          : !this.stepFinalCamphorDone
            ? 'Gasilhaneye dön ve teneşirde kafurlu su ile son durulamayı yap'
            : !this.stepDryDone
              ? 'Temiz havlu ve gülsuyu ile cenazeyi kurula'
              : 'Cenazeyi kefenle ve sabah ezanını bekle',
      location,
    };
  }

  private pushHudState(
    force: boolean,
    isIndoors = this.isInsideGasilhane(this.playerPos) ||
      this.isInsideAbandoned(this.playerPos) ||
      this.isInsideMuhtar(this.playerPos) ||
      this.isInsideClinic(this.playerPos) ||
      this.isInsideMill(this.playerPos) ||
      this.isInsideCrypt(this.playerPos),
    isHiding = false,
    dangerProximity = this.dangerProximity,
  ): void {
    if (force || this.elapsedTime - this.lastHudPush > 0.22) {
      this.lastHudPush = this.elapsedTime;
    }

    const meta = this.getObjectiveText();
    const ritualProgress =
      (this.stepPrepDone ? 1 : 0) +
      (this.stepWashDone ? 1 : 0) +
      (this.windowAnomalyResolved || this.shutterClosed ? 1 : 0) +
      (this.dirtyBasinDrained ? 1 : 0) +
      (this.vigilLit ? 1 : 0) +
      (this.stepFinalCamphorDone ? 1 : 0) +
      (this.stepDryDone ? 1 : 0) +
      (this.stepShroudDone ? 1 : 0);

    const cloneCase = (c: AutopsyCaseState): AutopsyCaseState => {
      const clonedAnomalies: AutopsyCaseState['anomalies'] = {};
      Object.entries(c.anomalies || {}).forEach(([aid, a]) => {
        clonedAnomalies[aid] = { ...a };
      });
      return {
        ...c,
        zones: { ...c.zones },
        anomalies: clonedAnomalies,
      };
    };

    const clonedCases: Record<AutopsyCaseId, AutopsyCaseState> = {
      case_arif: cloneCase(this.autopsyCases.case_arif),
      case_mahmut: cloneCase(this.autopsyCases.case_mahmut),
      case_unknown: cloneCase(this.autopsyCases.case_unknown),
    };

    this.onHudUpdate({
      screen: this.screen,
      act: this.act,
      actTitle: meta.actTitle,
      objectiveText: meta.objective,
      locationName: meta.location,
      currentDistrict: this.getCurrentDistrict(this.playerPos),
      discoveredDistricts: Array.from(this.discoveredDistricts),
      isIndoors,
      candleLit: this.candleLit,
      candleOil: Math.round(this.candleOil),
      vigilTimer: Math.ceil(this.vigilTimer),
      vigilActive: this.act >= 3 && this.stepWashDone,
      dreadLevel: Math.round(this.dreadLevel),
      stamina: Math.round(this.stamina),
      isCrouching: this.isCrouching,
      isSprinting: this.isSprinting,
      isZooming: this.isZooming,
      violations: this.violations,
      trustScore: this.trustScore,
      interactPrompt: this.activeInteractLabel,
      captionText: this.captionText,
      isNotebookOpen: this.isNotebookOpen,
      isMuted: this.audio.isMuted(),
      isPointerLocked: this.isPointerLocked,
      isHiding,
      dangerProximity,
      windowAnomalyActive: this.windowAnomalyActive,
      dirtyBasinReady: this.dirtyBasinReady,
      inventory: this.inventory.map((i) => ({ ...i })),
      rules: this.rules.map((r) => ({ ...r })),
      clues: this.clues.map((c) => ({ ...c })),
      ritualProgress,
      endingReason: this.endingReason,
      controlSettings: { ...this.controlSettings },
      resolvedQualityTier: this.resolvedQualityTier,
      assetLoadPercent: this.assetLoadPercent,
      assetsReady: this.assetsReady,
      hasSavedGame: this.hasSavedGame,
      saveSummary: this.saveSummary,
      saveNoticeText: this.saveNoticeText,
      activeDialogue: this.getActiveDialogueState(),
      activeAutopsyCaseId: this.activeAutopsyCaseId,
      activeAutopsyTool: this.activeAutopsyTool,
      activeAutopsyCameraAngle: this.activeAutopsyCameraAngle,
      cameraFlashAlpha: this.cameraFlashAlpha,
      autopsyCases: clonedCases,
      playerMapPos: {
        x: this.playerPos.x,
        z: this.playerPos.z,
        yaw: this.yaw,
      },
      glossaryEntries: this.glossaryEntries.map((g) => ({ ...g })),
      playerGlossaryNotes: this.playerGlossaryNotes.map((n) => ({ ...n })),
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onWindowBlur);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    document.removeEventListener('pointerlockerror', this.onPointerLockError);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onWebGlContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.onWebGlContextRestored);
    this.renderer.domElement.removeEventListener('mousedown', this.onMouseDown);
    this.renderer.domElement.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);

    this.envTexture?.dispose();
    this.postProcessing?.dispose();
    this.world.dispose();
    this.cc0.dispose();
    this.textures.disposeAll();
    this.audio.dispose();
    this.renderer.dispose();

    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
