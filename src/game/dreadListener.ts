export type HallucinationType = 'whisper' | 'floorboard_creak';

export interface SpatialDreadBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface SpatialDreadTrigger {
  id: string;
  zoneName: string;
  centerX: number;
  centerZ: number;
  radius: number;
  bounds?: SpatialDreadBounds;
  hallucinations: HallucinationType[];
  dreadThreshold: number;
  minStationarySec: number;
  cooldownSec: number;
  captions?: Partial<Record<HallucinationType, string[]>>;
}

export interface DreadHallucinationEvent {
  triggerId: string;
  zoneName: string;
  type: HallucinationType;
  dreadLevel: number;
  stationarySec: number;
  caption?: string;
}

export interface DreadListenerContext {
  elapsedTime: number;
  dreadLevel: number;
  playerX: number;
  playerZ: number;
  playerSpeed: number;
  isBlocked: boolean;
}

export type DreadHallucinationCallback = (event: DreadHallucinationEvent) => void;

/**
 * Modular, zero-GC dread-level listener that monitors player stillness inside registered
 * spatial horror zones and dispatches auditory hallucinations when dread exceeds threshold.
 */
export class DreadLevelListener {
  private triggers: readonly SpatialDreadTrigger[] = [];
  private listeners: DreadHallucinationCallback[] = [];
  private zoneCooldownUntil = new Map<string, number>();
  private stationarySec = 0;
  private globalCooldownUntil = 0;
  private lastHallucinationType: HallucinationType | null = null;

  public registerTriggers(triggers: readonly SpatialDreadTrigger[]): void {
    this.triggers = triggers;
  }

  public subscribe(cb: DreadHallucinationCallback): () => void {
    this.listeners.push(cb);
    return () => {
      const idx = this.listeners.indexOf(cb);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }

  public reset(): void {
    this.stationarySec = 0;
    this.globalCooldownUntil = 0;
    this.lastHallucinationType = null;
    this.zoneCooldownUntil.clear();
  }

  public getStationarySeconds(): number {
    return this.stationarySec;
  }

  public update(dt: number, ctx: DreadListenerContext): void {
    if (ctx.isBlocked || this.triggers.length === 0) {
      this.stationarySec = 0;
      return;
    }

    // Track continuous stillness (small micro-sway < 0.16 m/s counts as stationary)
    if (ctx.playerSpeed <= 0.16) {
      this.stationarySec = Math.min(20, this.stationarySec + dt);
    } else if (ctx.playerSpeed > 0.35) {
      this.stationarySec = 0;
      return;
    } else {
      this.stationarySec = Math.max(0, this.stationarySec - dt * 1.5);
      return;
    }

    if (ctx.elapsedTime < this.globalCooldownUntil) return;

    for (let i = 0; i < this.triggers.length; i++) {
      const trigger = this.triggers[i];
      if (ctx.dreadLevel <= trigger.dreadThreshold) continue;
      if (this.stationarySec < trigger.minStationarySec) continue;

      const until = this.zoneCooldownUntil.get(trigger.id) ?? 0;
      if (ctx.elapsedTime < until) continue;

      if (!this.isInsideTrigger(trigger, ctx.playerX, ctx.playerZ)) continue;

      const type = this.pickHallucinationType(trigger.hallucinations);
      const captionList = trigger.captions?.[type];
      const caption =
        captionList && captionList.length > 0
          ? captionList[Math.floor(Math.random() * captionList.length)]
          : undefined;

      this.lastHallucinationType = type;
      this.zoneCooldownUntil.set(trigger.id, ctx.elapsedTime + trigger.cooldownSec);
      this.globalCooldownUntil = ctx.elapsedTime + 6.5;
      // Keep partial stillness so staying even longer can trigger another wave after cooldown
      this.stationarySec = Math.max(0, trigger.minStationarySec * 0.25);

      const event: DreadHallucinationEvent = {
        triggerId: trigger.id,
        zoneName: trigger.zoneName,
        type,
        dreadLevel: ctx.dreadLevel,
        stationarySec: this.stationarySec,
        caption,
      };
      for (let j = 0; j < this.listeners.length; j++) {
        this.listeners[j](event);
      }
      return;
    }
  }

  private isInsideTrigger(trigger: SpatialDreadTrigger, x: number, z: number): boolean {
    if (trigger.bounds) {
      return (
        x >= trigger.bounds.minX &&
        x <= trigger.bounds.maxX &&
        z >= trigger.bounds.minZ &&
        z <= trigger.bounds.maxZ
      );
    }
    const dx = x - trigger.centerX;
    const dz = z - trigger.centerZ;
    return dx * dx + dz * dz <= trigger.radius * trigger.radius;
  }

  private pickHallucinationType(options: HallucinationType[]): HallucinationType {
    if (options.length === 1) return options[0];
    if (this.lastHallucinationType && Math.random() < 0.72) {
      const alt = options.filter((o) => o !== this.lastHallucinationType);
      if (alt.length > 0) {
        return alt[Math.floor(Math.random() * alt.length)];
      }
    }
    return options[Math.floor(Math.random() * options.length)];
  }
}
