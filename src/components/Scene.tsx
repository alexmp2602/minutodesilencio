"use client";

import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Suspense } from "react";
import Ground from "./Ground";

export default function Scene() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [4, 3, 4], fov: 50 }}
      style={{ width: "100%", height: "100%" }} // ocupa todo el contenedor
      onCreated={({ gl, scene }) => {
        gl.setClearColor("#0b0d10", 1);
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.0;
        scene.fog = new THREE.Fog(new THREE.Color("#0a0f0a"), 18, 42);
      }}
    >
      {/* Luces */}
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[5, 6, 3]}
        intensity={1.1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-5, 3, -2]} intensity={0.25} />

      {/* Suelo */}
      <Suspense fallback={null}>
        <Ground />
      </Suspense>

      {/* Cámara */}
      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        maxPolarAngle={Math.PI / 2.05}
        minDistance={3}
        maxDistance={16}
      />
    </Canvas>
  );
}
