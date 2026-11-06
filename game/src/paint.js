// The paint shop in code. Every part has a baked mask: red = Paint 1 (the
// orange panels), green = Paint 2 (the teal accents). The shader swaps those
// pixels for the robot's scheme and leaves the steel alone.
import * as THREE from 'three';

export const PATTERNS = ['solid', 'stripes', 'camo', 'checker', 'carbon', 'flames'];
export const FINISHES = {
  matte:    { metal: 0.05, rough: 0.85 },
  gloss:    { metal: 0.20, rough: 0.28 },
  metallic: { metal: 0.85, rough: 0.34 },
  chrome:   { metal: 0.82, rough: 0.24 },
};

export const paintGLSL = /* glsl */ `
uniform sampler2D uPaintMask;
uniform vec3 uPaint1;
uniform vec3 uPaint2;
uniform int uPattern;
uniform float uPatScale;
uniform float uFinishMetal;
uniform float uFinishRough;
uniform float uWreck;
uniform float uFlash;
uniform vec3 uFlashColor;
varying vec3 vPaintPos;
float paintMaskVal;
float pNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453);
  float b = fract(sin(dot(i + vec2(1, 0), vec2(127.1, 311.7))) * 43758.5453);
  float c = fract(sin(dot(i + vec2(0, 1), vec2(127.1, 311.7))) * 43758.5453);
  float d = fract(sin(dot(i + vec2(1, 1), vec2(127.1, 311.7))) * 43758.5453);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float paintPattern(vec3 q) {
  // 1.0 means this pixel takes Paint 2 instead of Paint 1.
  if (uPattern == 1) return step(0.5, fract((q.x + q.z + q.y) * 3.2));
  if (uPattern == 2) return step(0.52, pNoise(q.xz * 3.1 + q.y * 2.3) * 0.65 + pNoise(q.zy * 7.3) * 0.35);
  if (uPattern == 3) { vec3 c = floor(q * 5.0); return mod(c.x + c.y + c.z, 2.0); }
  if (uPattern == 4) { vec2 w = q.xz * 34.0 + q.y * 34.0; return step(0.5, fract(w.x + floor(w.y) * 0.5)) * 0.35; }
  if (uPattern == 5) {
    float n = pNoise(vec2(q.x * 5.0 + q.z * 5.0, q.y * 2.0)) * 0.55;
    return smoothstep(0.42, 0.5, n + (q.y * -1.1 + 0.62) * 0.9);
  }
  return 0.0;
}
`;

export const paintMapFragment = /* glsl */ `
#include <map_fragment>
{
  vec3 pm = texture2D(uPaintMask, vMapUv).rgb;
  float lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  // Keep the wear and shading from the original texture.
  float shade1 = clamp(lum / 0.36, 0.25, 1.25);
  float shade2 = clamp(lum / 0.30, 0.25, 1.35);
  float t = paintPattern(vPaintPos * uPatScale);
  vec3 p1 = mix(uPaint1, uPaint2, t);
  diffuseColor.rgb = mix(diffuseColor.rgb, p1 * shade1, pm.r);
  diffuseColor.rgb = mix(diffuseColor.rgb, uPaint2 * shade2, pm.g);
  paintMaskVal = max(pm.r, pm.g);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.22, uWreck);
}
`;

export function applyPaintShader(mat, maskTex, scale, shared) {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, shared, {
      uPaintMask: { value: maskTex },
      uPatScale: { value: scale },
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPaintPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPaintPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + paintGLSL)
      .replace('#include <map_fragment>', paintMapFragment)
      .replace('#include <metalnessmap_fragment>',
        '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, uFinishMetal, paintMaskVal);')
      .replace('#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, uFinishRough, paintMaskVal);')
      .replace('#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uFlashColor * uFlash * 0.28;');
  };
  mat.customProgramCacheKey = () => 'salvage-paint-1';
  return mat;
}

// One set of uniforms per robot: every part on it shares them.
export function makePaintUniforms(scheme = {}) {
  const u = {
    uPaint1: { value: new THREE.Color() },
    uPaint2: { value: new THREE.Color() },
    uPattern: { value: 0 },
    uFinishMetal: { value: 0.2 },
    uFinishRough: { value: 0.3 },
    uWreck: { value: 0 },
    uFlash: { value: 0 },
    uFlashColor: { value: new THREE.Color(1, 0.9, 0.7) },
  };
  setPaint(u, scheme);
  return u;
}

export function setPaint(u, s) {
  u.uPaint1.value.set(s.c1 || '#ff6a13');
  u.uPaint2.value.set(s.c2 || '#1fd6c2');
  u.uPattern.value = Math.max(0, PATTERNS.indexOf(s.pattern || 'solid'));
  const f = FINISHES[s.finish || 'gloss'];
  u.uFinishMetal.value = f.metal;
  u.uFinishRough.value = f.rough;
}
