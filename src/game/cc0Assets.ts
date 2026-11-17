import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

export type CC0ModelId =
  | 'soldier'
  | 'lantern'
  | 'table'
  | 'chair'
  | 'barrel'
  | 'cabinet'
  | 'candleholders'
  | 'brass_pot'
  | 'desk_lamp'
  | 'binder'
  | 'dead_tree'
  | 'rock'
  | 'crate';

export type CC0TextureId =
  | 'cobblestone'
  | 'roof_tiles'
  | 'clay_plaster'
  | 'mud_leaves'
  | 'brown_planks';

export interface CC0TexturePack {
  diffuse: THREE.Texture;
  normal: THREE.Texture;
  roughness: THREE.Texture;
}

const MODEL_PATHS: Record<CC0ModelId, string> = {
  soldier: '/assets/cc0/models/Soldier.glb',
  lantern: '/assets/cc0/models/Lantern_01/Lantern_01_1k.gltf',
  table: '/assets/cc0/models/WoodenTable_01/WoodenTable_01_1k.gltf',
  chair: '/assets/cc0/models/WoodenChair_01/WoodenChair_01_1k.gltf',
  barrel: '/assets/cc0/models/Barrel_01/Barrel_01_1k.gltf',
  cabinet: '/assets/cc0/models/GothicCabinet_01/GothicCabinet_01_1k.gltf',
  candleholders: '/assets/cc0/models/brass_candleholders/brass_candleholders_1k.gltf',
  brass_pot: '/assets/cc0/models/brass_pot_01/brass_pot_01_1k.gltf',
  desk_lamp: '/assets/cc0/models/desk_lamp_arm_01/desk_lamp_arm_01_1k.gltf',
  binder: '/assets/cc0/models/binder_notebook/binder_notebook_1k.gltf',
  dead_tree: '/assets/cc0/models/dead_tree_trunk/dead_tree_trunk_1k.gltf',
  rock: '/assets/cc0/models/rock_04/rock_04_1k.gltf',
  crate: '/assets/cc0/models/wooden_crate_01/wooden_crate_01_1k.gltf',
};

const TEXTURE_DIRS: Record<CC0TextureId, string> = {
  cobblestone: '/assets/cc0/textures/cobblestone_02',
  roof_tiles: '/assets/cc0/textures/clay_roof_tiles_02',
  clay_plaster: '/assets/cc0/textures/clay_plaster',
  mud_leaves: '/assets/cc0/textures/brown_mud_leaves_01',
  brown_planks: '/assets/cc0/textures/brown_planks_04',
};

const _box = new THREE.Box3();
const _size = new THREE.Vector3();
const _center = new THREE.Vector3();

export class CC0AssetLibrary {
  private models = new Map<CC0ModelId, GLTF>();
  private textures = new Map<CC0TextureId, CC0TexturePack>();
  private loadingPromise: Promise<void> | null = null;
  private ready = false;
  private progress = 0;
  private disposed = false;

  public isReady(): boolean {
    return this.ready;
  }

  public getProgress(): number {
    return this.progress;
  }

  public async preloadAll(
    maxAnisotropy: number,
    onProgress?: (percent: number, ready: boolean) => void,
  ): Promise<void> {
    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = new Promise<void>((resolve) => {
      const manager = new THREE.LoadingManager();
      manager.onProgress = (_url, loaded, total) => {
        if (this.disposed) return;
        this.progress = Math.min(99, Math.round((loaded / Math.max(1, total)) * 100));
        onProgress?.(this.progress, false);
      };
      manager.onLoad = () => {
        if (this.disposed) return;
        this.progress = 100;
        this.ready = true;
        onProgress?.(100, true);
        resolve();
      };
      manager.onError = () => {
        // Fallback meshes stay active for any failed item; never block game start
      };

      const gltfLoader = new GLTFLoader(manager);
      const texLoader = new THREE.TextureLoader(manager);

      const modelPromises = (Object.entries(MODEL_PATHS) as Array<[CC0ModelId, string]>).map(
        ([id, url]) =>
          new Promise<void>((res) => {
            gltfLoader.load(
              url,
              (gltf) => {
                if (this.disposed) {
                  res();
                  return;
                }
                gltf.scene.traverse((obj) => {
                  const mesh = obj as THREE.Mesh;
                  if (mesh.isMesh) {
                    mesh.castShadow = true;
                    mesh.receiveShadow = true;
                  }
                });
                this.models.set(id, gltf);
                res();
              },
              undefined,
              () => res(),
            );
          }),
      );

      const loadTex = (url: string, isColor: boolean, rx: number, ry: number): Promise<THREE.Texture> =>
        new Promise((res, rej) => {
          texLoader.load(
            url,
            (tex) => {
              tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
              tex.wrapS = THREE.RepeatWrapping;
              tex.wrapT = THREE.RepeatWrapping;
              tex.repeat.set(rx, ry);
              tex.anisotropy = maxAnisotropy;
              tex.needsUpdate = true;
              res(tex);
            },
            undefined,
            rej,
          );
        });

      const texPromises = (Object.entries(TEXTURE_DIRS) as Array<[CC0TextureId, string]>).map(
        async ([id, dir]) => {
          try {
            const rep = id === 'cobblestone' ? [2, 16] : id === 'mud_leaves' ? [22, 22] : [2, 2];
            const [diffuse, normal, roughness] = await Promise.all([
              loadTex(`${dir}/Diffuse.jpg`, true, rep[0], rep[1]),
              loadTex(`${dir}/nor_gl.jpg`, false, rep[0], rep[1]),
              loadTex(`${dir}/Rough.jpg`, false, rep[0], rep[1]),
            ]);
            if (!this.disposed) {
              this.textures.set(id, { diffuse, normal, roughness });
            }
          } catch {
            // Keep procedural PBR fallback if individual texture fails
          }
        },
      );

      void Promise.all([...modelPromises, ...texPromises]).then(() => {
        if (!this.ready && !this.disposed) {
          this.progress = 100;
          this.ready = true;
          onProgress?.(100, true);
          resolve();
        }
      });
    });

    return this.loadingPromise;
  }

  public getTexturePack(id: CC0TextureId): CC0TexturePack | null {
    return this.textures.get(id) ?? null;
  }

  /**
   * Returns a bottom-center grounded clone of a static CC0 GLTF model scaled to targetHeight.
   */
  public cloneModel(id: CC0ModelId, targetHeight: number, castShadow = true): THREE.Group | null {
    const gltf = this.models.get(id);
    if (!gltf) return null;

    const wrapper = new THREE.Group();
    const cloned = gltf.scene.clone(true);
    if (!castShadow) {
      cloned.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.castShadow = false;
        }
      });
    }

    cloned.updateMatrixWorld(true);
    _box.setFromObject(cloned);
    _box.getSize(_size);
    _box.getCenter(_center);

    const h = Math.max(0.01, _size.y);
    const scale = targetHeight / h;
    cloned.scale.setScalar(scale);

    cloned.updateMatrixWorld(true);
    _box.setFromObject(cloned);
    _box.getCenter(_center);
    cloned.position.x -= _center.x;
    cloned.position.z -= _center.z;
    cloned.position.y -= _box.min.y;

    wrapper.add(cloned);
    return wrapper;
  }

  /**
   * Returns a SkeletonUtils-cloned animated character with clips so each NPC has its own AnimationMixer.
   */
  public cloneSkinnedNpc(
    id: CC0ModelId,
    targetHeight: number,
  ): { root: THREE.Group; model: THREE.Object3D; clips: THREE.AnimationClip[] } | null {
    const gltf = this.models.get(id);
    if (!gltf) return null;

    const root = new THREE.Group();
    const cloned = SkeletonUtils.clone(gltf.scene);
    cloned.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        if (mesh.material) {
          mesh.material = Array.isArray(mesh.material)
            ? mesh.material.map((m) => m.clone())
            : mesh.material.clone();
        }
      }
    });

    cloned.updateMatrixWorld(true);
    _box.setFromObject(cloned);
    _box.getSize(_size);
    const scale = targetHeight / Math.max(0.1, _size.y);
    cloned.scale.setScalar(scale);

    cloned.updateMatrixWorld(true);
    _box.setFromObject(cloned);
    _box.getCenter(_center);
    cloned.position.x -= _center.x;
    cloned.position.z -= _center.z;
    cloned.position.y -= _box.min.y;

    root.add(cloned);
    return {
      root,
      model: cloned,
      clips: gltf.animations || [],
    };
  }

  public dispose(): void {
    this.disposed = true;
    this.textures.forEach((pack) => {
      pack.diffuse.dispose();
      pack.normal.dispose();
      pack.roughness.dispose();
    });
    this.textures.clear();
    this.models.clear();
  }
}
