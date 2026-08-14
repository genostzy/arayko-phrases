"use client";

import { useRef, useEffect, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const waterVertexShader = `
  uniform float uTime;
  uniform vec2 uMouse;
  uniform float uMouseInfluence;
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying float vElevation;

  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
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
    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
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
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }

  void main() {
    vUv = uv;
    vec3 pos = position;

    float wave1 = snoise(vec3(pos.x * 0.15, pos.z * 0.15, uTime * 0.08)) * 0.3;
    float wave2 = snoise(vec3(pos.x * 0.4 + 5.0, pos.z * 0.3, uTime * 0.12)) * 0.12;
    float wave3 = snoise(vec3(pos.x * 1.5 + 10.0, pos.z * 1.2, uTime * 0.3)) * 0.03;

    // Mouse ripple - STRONG effect
    vec2 mouseWorld = uMouse;
    float dist = length(pos.xz - mouseWorld);

    // Concentric ripple rings
    float ripple = sin(dist * 8.0 - uTime * 6.0) * exp(-dist * 0.4) * uMouseInfluence * 0.8;

    // Central splash bump
    float splash = exp(-dist * 1.5) * uMouseInfluence * 1.2;

    // Trail effect
    float trail = sin(dist * 4.0 - uTime * 8.0) * exp(-dist * 0.2) * uMouseInfluence * 0.3;

    float elevation = wave1 + wave2 + wave3 + ripple + splash + trail;
    vElevation = elevation;
    pos.y += elevation;

    // Normals
    float eps = 0.05;
    float hL = snoise(vec3((pos.x - eps) * 0.4, pos.z * 0.3, uTime * 0.12)) * 0.12;
    float hR = snoise(vec3((pos.x + eps) * 0.4, pos.z * 0.3, uTime * 0.12)) * 0.12;
    float hD = snoise(vec3(pos.x * 0.4, (pos.z - eps) * 0.3, uTime * 0.12)) * 0.12;
    float hU = snoise(vec3(pos.x * 0.4, (pos.z + eps) * 0.3, uTime * 0.12)) * 0.12;
    vNormal = normalize(vec3(hL - hR, 2.0 * eps, hD - hU));

    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const waterFragmentShader = `
  uniform float uTime;
  uniform vec3 uDeepColor;
  uniform vec3 uSurfaceColor;
  uniform vec3 uFogColor;
  uniform vec2 uMouse;
  uniform float uMouseInfluence;
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying float vElevation;

  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);

    float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 3.0);
    float depth = smoothstep(-0.5, 0.5, vElevation);
    vec3 waterColor = mix(uDeepColor, uSurfaceColor, depth);

    vec3 lightDir = normalize(vec3(0.4, 0.8, 0.3));
    float sss = pow(max(dot(viewDir, -lightDir + vNormal * 0.3), 0.0), 4.0) * 0.4;

    vec3 halfDir = normalize(lightDir + viewDir);
    float specular = pow(max(dot(vNormal, halfDir), 0.0), 64.0);

    float foam = smoothstep(0.2, 0.5, vElevation) * 0.5;

    vec3 color = waterColor;
    color += uSurfaceColor * sss;
    color = mix(color, uSurfaceColor * 2.0, fresnel * 0.6);
    color += vec3(specular * 1.5);
    color += vec3(foam * 0.7);

    // Glow at cursor position
    float dist = length(vWorldPosition.xz - uMouse);
    float cursorGlow = exp(-dist * 0.8) * uMouseInfluence * 0.4;
    color += vec3(0.2, 0.6, 0.9) * cursorGlow;

    // Fog
    float fogDist = length(vWorldPosition - cameraPosition);
    float fogFactor = smoothstep(15.0, 35.0, fogDist);
    color = mix(color, uFogColor, fogFactor);

    gl_FragColor = vec4(color, 0.95);
  }
`;

function WaterSurface() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const mousePos = useRef(new THREE.Vector2(0, 0));
  const mouseInfluence = useRef(0);
  const { size } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const planeRef = useRef<THREE.Mesh>(null);
  const mouseNDC = useRef(new THREE.Vector2(0, 0));

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      // Convert mouse to NDC (-1 to 1)
      mouseNDC.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseNDC.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
      mouseInfluence.current = Math.min(mouseInfluence.current + 0.15, 1);
    };

    const handleTouch = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const t = e.touches[0];
        mouseNDC.current.x = (t.clientX / window.innerWidth) * 2 - 1;
        mouseNDC.current.y = -(t.clientY / window.innerHeight) * 2 + 1;
        mouseInfluence.current = Math.min(mouseInfluence.current + 0.15, 1);
      }
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("touchmove", handleTouch, { passive: true });
    window.addEventListener("touchstart", handleTouch, { passive: true });

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("touchmove", handleTouch);
      window.removeEventListener("touchstart", handleTouch);
    };
  }, []);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uMouse: { value: new THREE.Vector2(0, 0) },
    uMouseInfluence: { value: 0 },
    uDeepColor: { value: new THREE.Color("#0a2a40") },
    uSurfaceColor: { value: new THREE.Color("#2090b0") },
    uFogColor: { value: new THREE.Color("#041020") },
  }), []);

  useFrame((state) => {
    if (!materialRef.current || !planeRef.current) return;
    const cam = state.camera;

    // Raycast from camera through mouse to water plane
    raycaster.current.setFromCamera(mouseNDC.current, cam);
    const hits = raycaster.current.intersectObject(planeRef.current);
    if (hits.length > 0) {
      const pt = hits[0].point;
      mousePos.current.set(pt.x, pt.z);
    }

    materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    materialRef.current.uniforms.uMouse.value.copy(mousePos.current);

    // Slower decay so effect is visible
    mouseInfluence.current *= 0.96;
    materialRef.current.uniforms.uMouseInfluence.value = mouseInfluence.current;
  });

  return (
    <mesh ref={planeRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
      <planeGeometry args={[40, 40, 150, 150]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={waterVertexShader}
        fragmentShader={waterFragmentShader}
        transparent
        uniforms={uniforms}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function Particles() {
  const ref = useRef<THREE.Points>(null);
  const count = 150;

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 30;
      pos[i * 3 + 1] = Math.random() * 6 - 2;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 30;
    }
    return pos;
  }, []);

  useFrame((state) => {
    if (!ref.current) return;
    const arr = ref.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] += Math.sin(state.clock.elapsedTime * 0.5 + i) * 0.0008;
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.05} color="#80c8e8" transparent opacity={0.5} sizeAttenuation />
    </points>
  );
}

export default function OceanScene() {
  return (
    <div className="fixed inset-0 z-0">
      <Canvas
        camera={{ position: [0, 5, 10], fov: 50 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: false }}
        style={{ background: "#041020" }}
      >
        <fog attach="fog" args={["#041020", 15, 35]} />
        <ambientLight intensity={0.3} color="#4a7aaa" />
        <directionalLight position={[5, 8, 3]} intensity={0.8} color="#6ab0d0" />
        <pointLight position={[-5, 3, -5]} intensity={0.4} color="#2090c0" />
        <pointLight position={[8, 2, -8]} intensity={0.3} color="#30a0d0" />
        <WaterSurface />
        <Particles />
      </Canvas>
    </div>
  );
}
