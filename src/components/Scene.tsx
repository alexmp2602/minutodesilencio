"use client";

import * as THREE from "three";
import { useMemo, useState, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerformanceMonitor } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import Ground from "./Ground";
import Flowers from "./Flowers";
import PhotoBackdrop from "./PhotoBackdrop";

export default function Scene() {
  const [dpr, setDpr] = useState<[number, number] | number>([1, 2]);
  const [grabbing, setGrabbing] = useState(false);

  // Bruma cálida que funde con la foto
  const fogColor = useMemo(() => new THREE.Color("#ffdcae"), []);
  const clearColor = "#bcd9ff"; // no se llega a ver por el backdrop, pero mantiene coherencia

  return (
    <Canvas
      className={grabbing ? "canvas-grabbing" : "canvas-grab"}
      shadows
      dpr={dpr}
      camera={{ position: [4, 3, 4], fov: 50, near: 0.1, far: 200 }}
      style={{ width: "100%", height: "100%" }}
      onCreated={({ gl, scene }) => {
        gl.setClearColor(clearColor, 1);
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 0.95;
        gl.shadowMap.enabled = true;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
        // Fog que "lava" el horizonte hacia la foto
        scene.fog = new THREE.Fog(fogColor, 18, 46);
      }}
      onPointerDown={(e) => {
        if (e.button === 2) setGrabbing(true);
      }}
      onPointerUp={() => setGrabbing(false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <PerformanceMonitor
        onDecline={() => setDpr(1)}
        onIncline={() => setDpr([1, 2])}
      />

      {/* Fondo de foto (hace de cielo+colinas) */}
      <PhotoBackdrop url="/bg-hills.webp" />

      {/* Iluminación cálida de atardecer */}
      <ambientLight intensity={0.25} />
      <hemisphereLight color="#ffe8cc" groundColor="#315230" intensity={0.35} />
      <directionalLight
        position={[6, 3, -2]}
        color="#ffd8a8"
        intensity={1.06}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0005}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
      />
      <directionalLight
        position={[-5, 3, -2]}
        intensity={0.22}
        color="#e6f0ff"
      />

      <Suspense fallback={null}>
        <Ground /> {/* verde más saturado, ver paso 3 */}
        <Flowers />
      </Suspense>

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

      <EffectComposer multisampling={0}>
        <Bloom
          mipmapBlur
          intensity={0.5}
          luminanceThreshold={0.22}
          luminanceSmoothing={0.12}
          radius={0.7}
        />
      </EffectComposer>
    </Canvas>
  );
}
