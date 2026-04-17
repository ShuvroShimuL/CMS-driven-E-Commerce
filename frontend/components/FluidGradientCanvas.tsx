'use client'

import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';

/* ═══════════════════════════════════════════════════════════════
   GLSL Fluid Gradient Shader
   Creates an organic, morphing fluid gradient background
   inspired by Stripe/Linear hero effects.
   ═══════════════════════════════════════════════════════════════ */

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  precision highp float;

  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec2 uMouse;

  varying vec2 vUv;

  // ─── Simplex noise helpers ───
  vec3 mod289(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+10.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod289(i);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 105.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  // ─── FBM (Fractal Brownian Motion) ───
  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < 5; i++) {
      value += amplitude * snoise(p * frequency);
      amplitude *= 0.5;
      frequency *= 2.0;
    }
    return value;
  }

  void main() {
    vec2 uv = vUv;
    float t = uTime * 0.15;

    // Mouse influence (subtle distortion)
    vec2 mouse = uMouse * 0.3;

    // Create multi-layered fluid distortion
    float n1 = fbm(vec3(uv * 3.0 + mouse * 0.5, t));
    float n2 = fbm(vec3(uv * 2.0 - mouse * 0.3, t * 0.7 + 10.0));
    float n3 = snoise(vec3(uv * 4.0 + n1 * 0.3, t * 0.5));

    // Warp the UV coordinates for organic flow
    vec2 warpedUv = uv + vec2(n1, n2) * 0.15;

    // Deep premium color palette
    vec3 deepIndigo  = vec3(0.059, 0.047, 0.161);   // #0f0c29
    vec3 richPurple  = vec3(0.188, 0.169, 0.388);   // #302b63
    vec3 violet      = vec3(0.486, 0.227, 0.929);   // #7c3aed
    vec3 magenta     = vec3(0.957, 0.082, 0.431);   // #f4156e
    vec3 warmOrange  = vec3(0.984, 0.573, 0.235);   // #fb923c
    vec3 softPink    = vec3(0.957, 0.447, 0.741);   // #f472bd
    
    // Dynamic color mixing based on noise layers
    float blend1 = smoothstep(-0.5, 0.8, n1 + n3 * 0.3);
    float blend2 = smoothstep(-0.3, 0.7, n2);
    float blend3 = smoothstep(0.0, 1.0, warpedUv.y + n1 * 0.2);
    
    // Layer colors organically
    vec3 color = mix(deepIndigo, richPurple, blend3);
    color = mix(color, violet, blend1 * 0.6);
    color = mix(color, softPink, blend2 * 0.25);
    color = mix(color, magenta, smoothstep(0.4, 0.9, n3 + blend1) * 0.2);
    color = mix(color, warmOrange, smoothstep(0.6, 1.0, n1 * n2) * 0.15);

    // Subtle light bloom near center
    float centerGlow = 1.0 - distance(warpedUv, vec2(0.5, 0.4)) * 1.5;
    centerGlow = max(0.0, centerGlow);
    color += violet * centerGlow * 0.15;

    // Vignette for depth
    float vignette = 1.0 - dot(uv - 0.5, uv - 0.5) * 1.2;
    color *= vignette;

    // Subtle grain for texture
    float grain = fract(sin(dot(uv * 300.0, vec2(12.9898, 78.233))) * 43758.5453);
    color += (grain - 0.5) * 0.02;

    gl_FragColor = vec4(color, 1.0);
  }
`;

export default function FluidGradientCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const animationRef = useRef<number>(0);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouseRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // ─── Three.js Setup ───
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const uniforms = {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(canvas.clientWidth, canvas.clientHeight) },
      uMouse: { value: new THREE.Vector2(0, 0) },
    };

    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // ─── Resize handler ───
    const handleResize = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      renderer.setSize(width, height);
      uniforms.uResolution.value.set(width, height);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);

    // ─── Animation loop ───
    const clock = new THREE.Clock();

    function animate() {
      uniforms.uTime.value = clock.getElapsedTime();

      // Smooth mouse lerp
      uniforms.uMouse.value.x += (mouseRef.current.x - uniforms.uMouse.value.x) * 0.05;
      uniforms.uMouse.value.y += (mouseRef.current.y - uniforms.uMouse.value.y) * 0.05;

      renderer.render(scene, camera);
      animationRef.current = requestAnimationFrame(animate);
    }

    animate();

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
    };
  }, [handleMouseMove]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
      }}
    />
  );
}
