"use client";

import * as THREE from "three";
import { useMemo, useState, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerformanceMonitor } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import Ground from "./Ground";
import Flowers from "./Flowers";

export default function Scene() {
  // DPR adaptativo: si el rendimiento baja, caemos a 1; si mejora, subimos a 2
  const [dpr, setDpr] = useState<[number, number] | number>([1, 2]);

  // Colores/fog memoizados para no recalcular
  const fogColor = useMemo(() => new THREE.Color("#0a0f0a"), []);
  const clearColor = "#0b0d10";

  return (
    <Canvas
      shadows
      dpr={dpr}
      camera={{ position: [4, 3, 4], fov: 50, near: 0.1, far: 200 }}
      style={{ width: "100%", height: "100%" }}
      onCreated={({ gl, scene }) => {
        // Color de fondo + gestión de color/tonemapping
        gl.setClearColor(clearColor, 1);
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.0;

        // Sombras suaves
        gl.shadowMap.enabled = true;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;

        // Niebla sutil
        scene.fog = new THREE.Fog(fogColor, 18, 42);
      }}
    >
      {/* Monitor de performance: ajusta DPR automáticamente */}
      <PerformanceMonitor
        onDecline={() => setDpr(1)} // baja calidad si cae el FPS
        onIncline={() => setDpr([1, 2])} // vuelve a adaptativo
      />

      {/* Iluminación */}
      <ambientLight intensity={0.35} />
      <hemisphereLight
        groundColor={"#222a22"}
        color={"#cfd6d9"}
        intensity={0.35}
      />
      <directionalLight
        position={[5, 6, 3]}
        intensity={1.05}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0006} // reduce shadow acne
        shadow-camera-near={1}
        shadow-camera-far={30}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
      />
      <directionalLight position={[-5, 3, -2]} intensity={0.25} />

      {/* Suelo / escena */}
      <Suspense fallback={null}>
        <Ground />
        <Flowers />
      </Suspense>

      {/* Cámara / Controles (estilo theseabetween, sin pan) */}
      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.7}
        zoomSpeed={0.9}
        enablePan={false}
        target={[0, 0.6, 0]}
        maxPolarAngle={Math.PI / 2.05}
        minDistance={3}
        maxDistance={16}
      />

      {/* Efectos postproceso */}
      <EffectComposer multisampling={0}>
        <Bloom
          mipmapBlur
          intensity={0.6}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.1}
          radius={0.7}
        />
      </EffectComposer>
    </Canvas>
  );
}
