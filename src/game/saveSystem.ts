import {
  AutopsyCaseId,
  AutopsyCaseState,
  DistrictId,
  GameAct,
  PlayerGlossaryNote,
  SaveSummary,
} from './types';

const SAVE_STORAGE_KEY = 'son_vazife_save_v2';

export interface SaveGamePayload {
  version: 2;
  savedAt: string;
  act: GameAct;
  playerPos: { x: number; z: number; yaw: number; pitch: number };
  candleLit: boolean;
  candleOil: number;
  vigilLit: boolean;
  vigilTimer: number;
  dreadLevel: number;
  violations: number;
  trustScore: number;
  inventoryCollected: string[];
  rulesViolated: string[];
  cluesDiscovered: string[];
  discoveredDistricts: DistrictId[];
  doors: {
    gasil: boolean;
    abandoned: boolean;
    muhtar: boolean;
    clinic: boolean;
    mill: boolean;
    crypt: boolean;
    shutter: boolean;
  };
  ritual: {
    prep: boolean;
    wash: boolean;
    dirtyReady: boolean;
    dirtyDrained: boolean;
    bulbOut: boolean;
    finalCamphor: boolean;
    dry: boolean;
    shroud: boolean;
  };
  npcFlags: Record<string, string[]>;
  npcTrust: Record<string, number>;
  autopsyCases: Record<AutopsyCaseId, AutopsyCaseState>;
  glossaryUnlocked?: string[];
  playerGlossaryNotes?: PlayerGlossaryNote[];
  actTitle: string;
}

export function writeAutoSave(payload: SaveGamePayload): boolean {
  try {
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function readAutoSave(): SaveGamePayload | null {
  try {
    const raw = window.localStorage.getItem(SAVE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SaveGamePayload>;
    if (parsed.version !== 2 || typeof parsed.act !== 'number' || !parsed.playerPos) {
      return null;
    }
    return parsed as SaveGamePayload;
  } catch {
    return null;
  }
}

export function getAutoSaveSummary(): SaveSummary | null {
  const save = readAutoSave();
  if (!save) return null;
  const completedAutopsies = Object.values(save.autopsyCases || {}).filter(
    (c) => c && c.completed,
  ).length;
  return {
    act: save.act,
    actTitle: save.actTitle || `BÖLÜM ${save.act}`,
    savedAt: save.savedAt,
    completedAutopsies,
    discoveredClues: (save.cluesDiscovered || []).length,
  };
}

export function clearAutoSave(): void {
  try {
    window.localStorage.removeItem(SAVE_STORAGE_KEY);
  } catch {
    // ignore
  }
}
