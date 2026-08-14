"use client";

import { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

function Particles({ count = 800 }: { count?: number }) {
  const mesh = useRef<THREE.Points>(null);
  const geoRef = useRef<THREE.BufferGeometry>(null);

  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 30;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 30;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 15 - 5;

      const color = new THREE.Color();
      color.setHSL(0.7 + Math.random() * 0.15, 0.7, 0.4 + Math.random() * 0.3);
      col[i * 3] = color.r;
      col[i * 3 + 1] = color.g;
      col[i * 3 + 2] = color.b;
    }

    return [pos, col];
  }, [count]);

  useEffect(() => {
    if (geoRef.current) {
      geoRef.current.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geoRef.current.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    }
  }, [positions, colors]);

  useFrame((state) => {
    if (mesh.current) {
      mesh.current.rotation.y = state.clock.elapsedTime * 0.015;
      mesh.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.008) * 0.05;
    }
  });

  return (
    <points ref={mesh}>
      <bufferGeometry ref={geoRef} />
      <pointsMaterial size={0.04} vertexColors transparent opacity={0.7} sizeAttenuation blending={THREE.AdditiveBlending} depthWrite={false} />
    </points>
  );
}

function FloatingRing({ position, scale = 1, speed = 1 }: { position: [number, number, number]; scale?: number; speed?: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.x = state.clock.elapsedTime * 0.3 * speed;
      ref.current.rotation.y = state.clock.elapsedTime * 0.2 * speed;
      ref.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * speed) * 0.3;
    }
  });
  return (
    <mesh ref={ref} position={position} scale={scale}>
      <torusGeometry args={[1, 0.02, 16, 100]} />
      <meshStandardMaterial color="#6c5ce7" emissive="#6c5ce7" emissiveIntensity={0.6} transparent opacity={0.5} />
    </mesh>
  );
}

function FloatingCube({ position, scale = 1, speed = 1 }: { position: [number, number, number]; scale?: number; speed?: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.x = state.clock.elapsedTime * 0.4 * speed;
      ref.current.rotation.z = state.clock.elapsedTime * 0.2 * speed;
      ref.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * speed * 0.7) * 0.4;
    }
  });
  return (
    <mesh ref={ref} position={position} scale={scale}>
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      <meshStandardMaterial color="#00b894" emissive="#00b894" emissiveIntensity={0.3} transparent opacity={0.3} wireframe />
    </mesh>
  );
}

function FloatingSphere({ position, scale = 1, speed = 1 }: { position: [number, number, number]; scale?: number; speed?: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (ref.current) {
      ref.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * speed * 0.5) * 0.5;
      ref.current.position.x = position[0] + Math.cos(state.clock.elapsedTime * speed * 0.3) * 0.2;
    }
  });
  return (
    <mesh ref={ref} position={position} scale={scale}>
      <sphereGeometry args={[0.25, 32, 32]} />
      <meshStandardMaterial color="#ff6b6b" emissive="#ff6b6b" emissiveIntensity={0.2} transparent opacity={0.25} wireframe />
    </mesh>
  );
}

function Icosahedron({ position, scale = 1, speed = 1 }: { position: [number, number, number]; scale?: number; speed?: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.x = state.clock.elapsedTime * 0.15 * speed;
      ref.current.rotation.y = state.clock.elapsedTime * 0.25 * speed;
      ref.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * speed * 0.4) * 0.3;
    }
  });
  return (
    <mesh ref={ref} position={position} scale={scale}>
      <icosahedronGeometry args={[0.4, 0]} />
      <meshStandardMaterial color="#ffd93d" emissive="#ffd93d" emissiveIntensity={0.2} transparent opacity={0.2} wireframe />
    </mesh>
  );
}

export default function Scene() {
  return (
    <div className="fixed inset-0 z-0">
      <Canvas camera={{ position: [0, 0, 10], fov: 55 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }} style={{ background: "transparent" }}>
        <ambientLight intensity={0.15} />
        <pointLight position={[10, 10, 10]} intensity={0.4} color="#6c5ce7" />
        <pointLight position={[-10, -10, -10]} intensity={0.2} color="#00b894" />
        <pointLight position={[0, 5, -5]} intensity={0.15} color="#ff6b6b" />

        <Particles count={800} />
        <FloatingRing position={[-4, 2, -3]} scale={0.7} speed={0.4} />
        <FloatingRing position={[5, -1, -4]} scale={1} speed={0.25} />
        <FloatingCube position={[4, 3, -2]} scale={0.5} speed={0.6} />
        <FloatingCube position={[-5, -2, -3]} scale={0.35} speed={0.35} />
        <FloatingSphere position={[3, -3, -2]} scale={0.7} speed={0.5} />
        <FloatingSphere position={[-3, 4, -4]} scale={0.4} speed={0.3} />
        <Icosahedron position={[0, -4, -3]} scale={0.8} speed={0.3} />
        <Icosahedron position={[-6, 1, -5]} scale={0.5} speed={0.45} />
      </Canvas>
    </div>
  );
}
