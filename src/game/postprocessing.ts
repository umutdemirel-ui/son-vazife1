import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

/**
 * Custom horror post-processing shader driven by dreadLevel (0..1) and dangerProximity (0..1).
 * Adds smooth radial vignette, edge-weighted chromatic aberration, cold nocturnal color grading,
 * and subtle organic film grain without obscuring the center aiming reticle.
 */
export const DreadPostShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uDread: { value: 0 }, // 0..1
    uDanger: { value: 0 }, // 0..1
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uDread;
    uniform float uDanger;
    varying vec2 vUv;

    float hash12(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    void main() {
      vec2 centered = vUv - 0.5;
      float dist = length(centered);
      float edgeWeight = smoothstep(0.18, 0.78, dist);

      // Combined tension driver
      float tension = clamp(uDread * 0.85 + uDanger * 0.55, 0.0, 1.35);

      // Heartbeat throb when danger or high dread is active
      float pulse = 1.0 + sin(uTime * (3.2 + uDanger * 4.5)) * 0.14 * clamp(uDanger + max(0.0, uDread - 0.45), 0.0, 1.0);

      // Subtle radial chromatic aberration scaled by dread & screen edge distance
      float chromaAmt = (0.00055 + tension * 0.0052 * pulse) * edgeWeight;
      vec2 offset = centered * chromaAmt;

      float r = texture2D(tDiffuse, clamp(vUv + offset, 0.001, 0.999)).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, clamp(vUv - offset, 0.001, 0.999)).b;
      vec3 col = vec3(r, g, b);

      // Slight cold nocturnal desaturation as dread rises
      float luma = dot(col, vec3(0.299, 0.587, 0.114));
      vec3 coldTint = vec3(luma * 0.92, luma * 0.98, luma * 1.06);
      col = mix(col, coldTint, clamp(uDread * 0.32, 0.0, 0.35));

      // Subtle dark vignette tightening around screen perimeter
      float vigStart = mix(0.86, 0.56, clamp(tension * 0.75, 0.0, 1.0));
      float vigEnd = mix(0.32, 0.16, clamp(tension * 0.75, 0.0, 1.0));
      float vig = smoothstep(vigStart, vigEnd, dist);
      float vigDarkness = mix(0.26, 0.88, clamp(tension * 0.85, 0.0, 1.0)) * pulse;
      col *= mix(1.0 - vigDarkness, 1.0, vig);

      // Subtle crimson-black edge tint at peak danger
      float bloodEdge = smoothstep(0.38, 0.82, dist) * clamp(uDanger * 0.45 + max(0.0, uDread - 0.65) * 0.4, 0.0, 0.45);
      col = mix(col, vec3(0.14, 0.02, 0.02), bloodEdge * pulse);

      // Organic fine film grain
      float grain = (hash12(vUv * 950.0 + fract(uTime * 17.3)) - 0.5) * (0.018 + tension * 0.028);
      col = clamp(col + grain, 0.0, 1.0);

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export interface PostProcessingRig {
  composer: EffectComposer;
  bloomPass: UnrealBloomPass;
  dreadPass: ShaderPass;
  setSize: (w: number, h: number) => void;
  setBloomEnabled: (enabled: boolean) => void;
  update: (time: number, dreadNormalized: number, dangerNormalized: number) => void;
  render: () => void;
  dispose: () => void;
}

export function createPostProcessing(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  width: number,
  height: number,
): PostProcessingRig {
  const composer = new EffectComposer(renderer);

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const halfW = Math.max(1, Math.floor(width / 2));
  const halfH = Math.max(1, Math.floor(height / 2));
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(halfW, halfH),
    0.26, // subtle warm candlelight/lantern bloom at half resolution
    0.5,
    0.84,
  );
  composer.addPass(bloomPass);

  const dreadPass = new ShaderPass(DreadPostShader);
  composer.addPass(dreadPass);

  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  return {
    composer,
    bloomPass,
    dreadPass,
    setSize: (w: number, h: number) => {
      composer.setSize(w, h);
      bloomPass.resolution.set(Math.max(1, Math.floor(w / 2)), Math.max(1, Math.floor(h / 2)));
    },
    setBloomEnabled: (enabled: boolean) => {
      bloomPass.enabled = enabled;
    },
    update: (time: number, dreadNormalized: number, dangerNormalized: number) => {
      dreadPass.uniforms.uTime.value = time;
      dreadPass.uniforms.uDread.value = dreadNormalized;
      dreadPass.uniforms.uDanger.value = dangerNormalized;
    },
    render: () => {
      composer.render();
    },
    dispose: () => {
      composer.dispose();
    },
  };
}
